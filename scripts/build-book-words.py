"""Offline dictionary for the words in the books that are not in the word list (owner, 2026-11-21:
"many words say there is no translation"). For every lower-case word in content/books/*.json that
is not a word-list entry: an English meaning, Turkish and Arabic, from English Wiktionary
(kaikki.org / wiktextract, CC BY-SA 4.0). Inflected forms ("startled", "gaunter") point to their
base word ("startle"), whose meaning is used. Nothing is sent from the app: the result is a
static file, content/vocabulary/book-words.json, loaded when a word is tapped.

    python3 scripts/build-book-words.py [cache-dir]     # then: pnpm content
"""
import importlib.util
import json
import re
import sys
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = Path(sys.argv[1] if len(sys.argv) > 1 else "kaikki-cache")
OUT = ROOT / "content/vocabulary/book-words.json"
CACHE.mkdir(parents=True, exist_ok=True)

# Reuse the fetcher and the careful translation picker of fetch-translations.py (without running it).
src = (ROOT / "scripts/fetch-translations.py").read_text()
head = src[: src.index("\nwords = sorted(")]
ft = {"__file__": str(ROOT / "scripts/fetch-translations.py"), "__name__": "ft"}
sys_argv = sys.argv
sys.argv = [sys.argv[0], str(CACHE)]
exec(compile(head, "fetch-translations.py", "exec"), ft)
sys.argv = sys_argv
fetch, translations = ft["fetch"], ft["translations"]

vocab = {x["w"].lower() for x in json.loads((ROOT / "apps/pocket/public/data/vocab.json").read_text())["items"] if x.get("w")}

# Words seen in lower case at least once (so names like "Dorothy" are left out).
seen: dict[str, int] = {}
for f in sorted((ROOT / "content/books").glob("*.json")):
    if f.name == "ladder.json":
        continue
    for bl in json.loads(f.read_text()).get("blocks", []):
        for w in re.findall(r"[A-Za-z’']+", bl.get("text", "") if isinstance(bl, dict) else str(bl)):
            c = w.replace("’", "'").strip("'")
            if c.endswith("'s"):
                c = c[:-2]
            if len(c) < 3 or "'" in c or not c.islower():
                continue
            seen[c] = seen.get(c, 0) + 1
words = sorted(w for w in seen if w not in vocab)


def entries(word: str):
    f = CACHE / (urllib.parse.quote(word, safe="") + ".jsonl")
    if not f.exists() or not f.stat().st_size:
        return []
    return [json.loads(line) for line in f.read_text().splitlines() if line.strip()]


SKIP_POS = {"name", "character", "symbol", "suffix", "prefix", "abbrev"}


def base_of(word: str):
    """'startled' → ('startle', 'verb') when Wiktionary says it is a form of it (first entry that says so).
    The part of speech of the form matters: "blistered" is a verb form, so the verb meaning of "blister"."""
    for e in entries(word):
        for s in e.get("senses", []):
            for fo in s.get("form_of") or s.get("alt_of") or []:
                b = fo.get("word")
                if b and b != word and " " not in b:
                    return b, e.get("pos")
    return None, None


def short(g: str, n: int = 110):
    """Cut a long gloss at a ';' or ',' (else at a word), never in the middle of a word."""
    g = g.rstrip(".")
    if len(g) <= n:
        return g
    for sep in ("; ", ", "):
        i = g.rfind(sep, 0, n)
        if i > 30:
            return g[:i]
    return g[: g.rfind(" ", 0, n)] + "…"


def meaning(word: str, prefer: str | None = None):
    """(pos, first real gloss) of the first useful entry; entries of the `prefer` part of speech first."""
    es = entries(word)
    es = sorted(es, key=lambda e: e.get("pos") != prefer) if prefer else es
    for e in es:
        if e.get("pos") in SKIP_POS:
            continue
        for s in e.get("senses", []):
            if s.get("form_of") or "form-of" in (s.get("tags") or []):
                continue
            g = (s.get("glosses") or [None])[0]
            if g and not g.lower().startswith(("obsolete", "archaic form", "alternative")):
                return e.get("pos"), short(g)
    return None, None


def run(todo):
    todo = [w for w in todo if not (CACHE / (urllib.parse.quote(w, safe="") + ".jsonl")).exists()]
    print(f"{len(todo)} to download", flush=True)
    with ThreadPoolExecutor(6) as pool:
        for i, _ in enumerate(pool.map(fetch, todo), 1):
            if i % 500 == 0:
                print(f"{i}/{len(todo)}", flush=True)


print(f"{len(words)} book words not in the word list", flush=True)
run(words)
forms = {w: base_of(w) for w in words}
bases = {w: f[0] for w, f in forms.items()}
run(sorted({b for b in bases.values() if b and b.lower() not in vocab}))

POS = {"noun": "noun", "verb": "verb", "adj": "adjective", "adv": "adverb", "prep": "preposition", "pron": "pronoun", "conj": "conjunction", "det": "determiner", "intj": "interjection"}
out = {}
for w in words:
    b = bases[w]
    if b and b.lower() in vocab:
        out[w] = {"base": b.lower()}  # the app shows the word-list entry
        continue
    head_word = b or w
    pos, d = meaning(head_word, forms[w][1])
    if not d:
        continue
    item = {"d": d}
    if b:
        item["base"] = b
    if pos in POS:
        item["pos"] = POS[pos]
    t = translations(head_word, item.get("pos"), d) or {}
    # Only translations of the same part of speech ("blistered" the verb is not "kabarcık" the noun).
    kp = {"adjective": "adj", "adverb": "adv"}.get(item.get("pos"), item.get("pos"))
    for code in ("tr", "ar"):
        if kp and t.get(code) and not any(e.get("pos") == kp and any(x.get("code") == code for x in (e.get("translations") or []) + [y for sn in e.get("senses", []) for y in sn.get("translations", [])]) for e in entries(head_word)):
            t.pop(code)
    if t.get("tr"):
        item["tr"] = ", ".join(t["tr"])
    if t.get("ar"):
        item["ar"] = "، ".join(t["ar"])
    out[w] = item

OUT.write_text(json.dumps({"source": "English Wiktionary via kaikki.org (wiktextract), CC BY-SA 4.0", "words": out}, ensure_ascii=False, separators=(",", ":")))
n = len(out)
print(f"wrote {OUT.relative_to(ROOT)}: {n} words ({sum(1 for v in out.values() if 'base' in v and 'd' not in v)} → word list, "
      f"{sum(1 for v in out.values() if 'tr' in v)} tr, {sum(1 for v in out.values() if 'ar' in v)} ar), {OUT.stat().st_size // 1024} KB")
