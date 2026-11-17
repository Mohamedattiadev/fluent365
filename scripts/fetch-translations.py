"""Turkish and Arabic translations for the word list, from English Wiktionary's translation tables
(via kaikki.org / wiktextract; Wiktionary text is CC BY-SA 4.0, see docs/CONTENT_LICENSING.md).

Usage: python3 -I scripts/fetch-translations.py <raw-cache-dir>
Reads apps/pocket/public/data/vocab.json (run `pnpm content` first), downloads one small JSONL file per word
into <raw-cache-dir> (skips files already there, so it resumes), and writes
content/vocabulary/translations-wiktionary.json: {word: {"tr": [...], "ar": [...]}}.
Only public word data is downloaded; nothing about the learner is sent.
"""
import json
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = Path(sys.argv[1] if len(sys.argv) > 1 else "kaikki-cache")
OUT = ROOT / "content/vocabulary/translations-wiktionary.json"
CACHE.mkdir(parents=True, exist_ok=True)

items = json.loads((ROOT / "apps/pocket/public/data/vocab.json").read_text())["items"]
POS = {"noun": "noun", "verb": "verb", "adjective": "adj", "adverb": "adv", "preposition": "prep", "pronoun": "pron", "conjunction": "conj", "determiner": "det", "phrase": "phrase"}


def url(word: str) -> str:
    w = word
    a, b = w[0], w[:2]
    return "https://kaikki.org/dictionary/English/meaning/" + "/".join(urllib.parse.quote(x, safe="") for x in (a, b, w)) + ".jsonl"


def fetch(word: str):
    f = CACHE / (urllib.parse.quote(word, safe="") + ".jsonl")
    if f.exists():
        return
    for attempt in range(3):
        try:
            req = urllib.request.Request(url(word), headers={"User-Agent": "fluent365-content-build"})
            with urllib.request.urlopen(req, timeout=30) as r:
                f.write_bytes(r.read())
            return
        except urllib.error.HTTPError as e:
            if e.code == 404:
                f.write_bytes(b"")
                return
            time.sleep(2 * (attempt + 1))
        except Exception:
            time.sleep(2 * (attempt + 1))


STOP = {"a", "an", "the", "to", "of", "or", "and", "in", "on", "for", "that", "is", "be", "with", "as", "by", "at", "something", "someone", "used", "very"}


def toks(text: str) -> set[str]:
    # Word starts (5 letters) so "meaning"/"means" and "planned"/"planning" match.
    return {w[:5] for w in "".join(ch.lower() if ch.isalpha() else " " for ch in text or "").split() if w not in STOP and len(w) > 2}


def translations(word: str, pos: str | None, definition: str | None = None):
    """Per language: the Wiktionary meaning group closest to our English definition (shared words), our part of
    speech first. With no shared word, only the first entry's first meaning is trusted; otherwise nothing,
    because a wrong meaning ("fine" = a penalty) is worse than none."""
    f = CACHE / (urllib.parse.quote(word, safe="") + ".jsonl")
    if not f.exists() or not f.stat().st_size:
        return None
    entries = [json.loads(line) for line in f.read_text().splitlines() if line.strip()]
    want = {POS.get(p.strip()) for p in (pos or "").split("/") if p.strip()}
    want_t = toks(definition)
    out = {}
    for code in ("tr", "ar"):
        groups = []  # (score, pos match, -entry, -sense, words)
        for ei, e in enumerate(entries):
            ts = e.get("translations") or [t for s in e.get("senses", []) for t in s.get("translations", [])]
            ts = [t for t in ts if t.get("code") == code and t.get("word")]
            senses = list(dict.fromkeys(t.get("sense", "") for t in ts))
            for si, sense in enumerate(senses):
                words = list(dict.fromkeys(t["word"] for t in ts if t.get("sense", "") == sense))
                groups.append((len(toks(sense) & want_t), e.get("pos") in want, -ei, -si, sense, words))
        if not groups:
            continue
        best = max(groups, key=lambda g: g[:4])
        score, _, ei, si, sense, words = best
        if score == 0:
            first = [g for g in groups if g[1] or not want] or groups
            first = max(first, key=lambda g: (g[2], g[3]))
            sense = first[4]
            if first[2] != 0 or first[3] != 0 or (sense[:1].isdigit() and not sense.startswith("1.")):
                continue
            words = first[5]
        out[code] = words[:3]
    return out or None


words = sorted({x["w"] for x in items if x.get("w") and "/" not in x["w"]})
todo = [w for w in words if not (CACHE / (urllib.parse.quote(w, safe="") + ".jsonl")).exists()]
print(f"{len(words)} words, {len(todo)} to download", flush=True)
done = 0
with ThreadPoolExecutor(4) as pool:
    for _ in pool.map(fetch, todo):
        done += 1
        if done % 250 == 0:
            print(f"{done}/{len(todo)}", flush=True)

pos_of = {x["w"]: x.get("pos") for x in items}
def_of = {x["w"]: x.get("d") for x in items}
result = {}
for w in words:
    t = translations(w, pos_of.get(w), def_of.get(w))
    if t:
        result[w] = t
OUT.write_text(json.dumps({"source": "English Wiktionary translation tables via kaikki.org (wiktextract), CC BY-SA 4.0", "words": result}, ensure_ascii=False, indent=0))
print(f"wrote {OUT.relative_to(ROOT)}: {len(result)} words with tr/ar ({sum(1 for v in result.values() if 'tr' in v)} tr, {sum(1 for v in result.values() if 'ar' in v)} ar)")
