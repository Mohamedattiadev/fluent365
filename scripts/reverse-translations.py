"""Turkish and Arabic for English words that Wiktionary's English entries give no translation for
(owner, 2026-11-21: every word should have TR/AR, from a free source, not AI). English Wiktionary
also describes Turkish and Arabic words in English ("ürkütmek: to startle, to scare"); reading those
the other way round gives the Turkish/Arabic words for "startle". Same source and licence as the
rest (kaikki.org / wiktextract, CC BY-SA 4.0), offline, no API.

    python3 scripts/reverse-translations.py <Turkish.jsonl> <Arabic.jsonl>
      (from https://kaikki.org/dictionary/Turkish/kaikki.org-dictionary-Turkish.jsonl, same for Arabic)

Fills tr/ar that are still missing in content/vocabulary/book-words.json and writes
content/vocabulary/translations-reverse.json for the word list (used by build-content.mjs).
Only short, exact glosses count ("to startle", "gaunt; haggard"), weighted towards the first sense
and the first gloss, so a word is not matched through a long explanation.
"""
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BW = ROOT / "content/vocabulary/book-words.json"
OUT = ROOT / "content/vocabulary/translations-reverse.json"

vocab = json.loads((ROOT / "apps/pocket/public/data/vocab.json").read_text())["items"]
bw = json.loads(BW.read_text()) if BW.exists() else {"words": {}}
need = {v["w"].lower() for v in vocab if v.get("w") and " " not in v["w"]}
for w, e in bw["words"].items():
    need.add(w)
    if e.get("base"):
        need.add(e["base"])

SKIP_POS = {"name", "character", "symbol", "suffix", "prefix", "infix", "abbrev", "romanization", "punct"}
BAD_TAGS = {"form-of", "obsolete", "archaic", "dialectal", "rare", "alt-of", "misspelling", "slang", "vulgar", "derogatory", "historical"}
POS = {"noun": "noun", "verb": "verb", "adj": "adjective", "adv": "adverb", "prep": "preposition", "pron": "pronoun", "conj": "conjunction", "det": "determiner", "intj": "interjection"}
PAREN = re.compile(r"\([^)]*\)|\[[^\]]*\]")


def pieces(gloss: str):
    g = PAREN.sub("", gloss).strip().rstrip(".")
    for i, p in enumerate(re.split(r"[;,]", g)):
        p = re.sub(r"^(to|a|an|the)\s+", "", p.strip())
        if not p or not p[0].islower():
            continue  # "May" (the month) is not "may"
        if re.fullmatch(r"[a-z][a-z'-]*( [a-z][a-z'-]*)?", p):
            yield i, p


def build(path: str):
    rev: dict[str, dict[str, Counter]] = defaultdict(lambda: defaultdict(Counter))
    with open(path, encoding="utf-8") as f:
        for line in f:
            e = json.loads(line)
            if e.get("pos") in SKIP_POS:
                continue
            word = e.get("word")
            if not word or " " in word or len(word) > 30:
                continue
            pos = POS.get(e.get("pos"), "")
            for si, s in enumerate(e.get("senses", [])[:6]):
                if BAD_TAGS & set(s.get("tags") or []) or s.get("form_of") or s.get("alt_of"):
                    continue
                for g in (s.get("glosses") or [])[:1]:
                    if len(g) > 80:
                        continue
                    for pi, p in pieces(g):
                        if p in need:
                            rev[p][pos][word] += (3 if si == 0 else 1) * (2 if pi == 0 else 1)
    return rev


def best(rev, w: str, pos: str | None):
    """Up to 3 words. With a known part of speech only words of that part of speech ("blistered" the
    verb is not "bombe"); without one, a weak match (one later gloss of one later sense) is not trusted."""
    by = rev.get(w)
    if not by:
        return None
    p = {"noun": "noun", "verb": "verb", "adjective": "adjective", "adj": "adjective", "adverb": "adverb", "adv": "adverb"}.get((pos or "").split("/")[0].strip())
    c = by.get(p) if p else sum(by.values(), Counter())
    if not c:
        return None
    top = [x for x, n in c.most_common(3) if p or n >= 2]  # the part-of-speech match already filters
    return top or None


tr_rev = build(sys.argv[1])
print(f"Turkish: {len(tr_rev)} English words", flush=True)
ar_rev = build(sys.argv[2])
print(f"Arabic: {len(ar_rev)} English words", flush=True)

filled = Counter()
for w, e in bw["words"].items():
    if "d" not in e:
        continue  # a form of a word-list entry: the word list has it
    head = e.get("base") or w
    for code, rev, sep in (("tr", tr_rev, ", "), ("ar", ar_rev, "، ")):
        if e.get(code):
            continue
        t = best(rev, head, e.get("pos"))
        if t:
            e[code] = sep.join(t)
            filled[code] += 1
if BW.exists():
    BW.write_text(json.dumps(bw, ensure_ascii=False, separators=(",", ":")))
    print(f"book-words.json: +{filled['tr']} tr, +{filled['ar']} ar")

out = {}
for v in vocab:
    w = v.get("w", "").lower()
    if " " in w or not w:
        continue
    item = {}
    for code, rev in (("tr", tr_rev), ("ar", ar_rev)):
        if not v.get(code):
            t = best(rev, w, v.get("pos"))
            if t:
                item[code] = t
    if item:
        out[w] = item
OUT.write_text(json.dumps({"source": "English Wiktionary's Turkish and Arabic entries read the other way round, via kaikki.org (wiktextract), CC BY-SA 4.0", "words": out}, ensure_ascii=False, separators=(",", ":")))
print(f"wrote {OUT.relative_to(ROOT)}: {len(out)} word-list words ({sum(1 for x in out.values() if 'tr' in x)} tr, {sum(1 for x in out.values() if 'ar' in x)} ar)")
