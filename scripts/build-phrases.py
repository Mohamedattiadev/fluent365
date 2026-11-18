"""Merge content/vocabulary/phrases-src/*.tsv into content/vocabulary/phrases.json.

Columns: w, d (meaning), ex (example), lvl (CEFR estimate), kind (expression | pattern | idiom),
tr, ar (Turkish/Arabic meaning), exTr, exAr (example translations).
Meanings and examples are original Fluent365 writing; tr/ar/exTr/exAr are AI translations (labelled in the app).
Order = how common the phrase is (Fluent365 estimate): easier levels first, the five source groups interleaved.
Duplicates (same phrase twice, or already in the phrasal-verb / collocation / linking lists) are dropped.

Usage: python3 -I scripts/build-phrases.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "content/vocabulary/phrases-src"
OUT = ROOT / "content/vocabulary/phrases.json"
COLS = ["w", "d", "ex", "lvl", "kind", "tr", "ar", "exTr", "exAr"]
LEVELS = ["A2", "B1", "B2", "C1"]

norm = lambda s: s.strip().lower().replace("’", "'")
taken = set()
for f in ["phrasal-verbs.json", "collocations.json", "linking.json"]:
    taken |= {norm(x["w"]) for x in json.loads((ROOT / "content/vocabulary" / f).read_text())["items"]}

groups, dropped = [], []
for f in sorted(SRC.glob("*.tsv")):
    rows = []
    for n, line in enumerate(f.read_text().splitlines(), 1):
        if not line.strip() or line.startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) != len(COLS):
            raise SystemExit(f"{f.name}:{n}: {len(parts)} columns, expected {len(COLS)}")
        it = dict(zip(COLS, (p.strip() for p in parts)))
        if it["lvl"] not in LEVELS or it["kind"] not in ("expression", "pattern", "idiom"):
            raise SystemExit(f"{f.name}:{n}: bad level or kind")
        if " " not in it["w"]:
            dropped.append((it["w"], "single word"))
            continue
        k = norm(it["w"])
        if k in taken:
            dropped.append((it["w"], "duplicate"))
            continue
        taken.add(k)
        rows.append(it)
    groups.append(rows)

items = []
for lvl in LEVELS:
    queues = [[r for r in g if r["lvl"] == lvl] for g in groups]
    while any(queues):
        for q in queues:
            if q:
                items.append(q.pop(0))

OUT.write_text(json.dumps({
    "source": "phrase",
    "licence": "Original Fluent365 content (phrase choice, meanings, examples), CC BY-SA 4.0. tr/ar/exTr/exAr: AI translations (Claude), may contain mistakes.",
    "order": "Most common first (Fluent365 estimate: level, then group).",
    "items": [{**it, "pos": "idiom" if it["kind"] == "idiom" else "phrase"} for it in items],
}, ensure_ascii=False, indent=0) + "\n")
print(len(items), "phrases;", len(dropped), "dropped:", dropped)
by = {l: sum(1 for i in items if i["lvl"] == l) for l in LEVELS}
print(by, {k: sum(1 for i in items if i["kind"] == k) for k in ("expression", "pattern", "idiom")})
