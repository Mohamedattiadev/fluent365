"""Resumable AI translation of the book quotes used as word examples (content/vocabulary/daily-en.json).

  python3 scripts/quote-batch.py next 80 > batch.txt   # next untranslated quotes, numbered by index
  python3 scripts/quote-batch.py merge batch.json      # {"<index>": ["tr", "ar"], ...} -> quotes-tr-ar.json
  python3 scripts/quote-batch.py status
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "content/vocabulary"
OUT = ROOT / "quotes-tr-ar.json"
SOURCE = ("Translated by AI (Claude) for Fluent365, 2026-11-19; may contain mistakes. "
          "Translations of public-domain book quotes (Project Gutenberg).")

def quotes():
    seen, out = set(), []
    for it in json.loads((ROOT / "daily-en.json").read_text())["items"]:
        q = (it.get("quote") or "").strip()
        if q and q not in seen:
            seen.add(q); out.append(q)
    return out

def load():
    if OUT.exists():
        return json.loads(OUT.read_text())
    return {"source": SOURCE, "sentences": {}}

def save(d):
    d["sentences"] = dict(sorted(d["sentences"].items()))
    OUT.write_text(json.dumps(d, ensure_ascii=False, indent=0) + "\n")

cmd = sys.argv[1]
qs, d = quotes(), load()
if cmd == "status":
    print(f"{len(d['sentences'])}/{len(qs)} translated")
elif cmd == "next":
    n = int(sys.argv[2])
    for i, q in [(i, q) for i, q in enumerate(qs) if q not in d["sentences"]][:n]:
        print(f"{i}\t{q}")
elif cmd == "merge":
    b = json.loads(Path(sys.argv[2]).read_text())
    for k, (tr, ar) in b.items():
        assert tr.strip() and ar.strip(), k
        d["sentences"][qs[int(k)]] = {"tr": tr.strip(), "ar": ar.strip()}
    save(d)
    print(f"merged {len(b)}; {len(d['sentences'])}/{len(qs)} translated")
