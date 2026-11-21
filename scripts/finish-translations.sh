#!/usr/bin/env bash
# Fills the missing Turkish/Arabic of the book words and the word list from Wiktionary's Turkish and
# Arabic entries read the other way round (scripts/reverse-translations.py), then builds, tests,
# commits and pushes. Safe to run again: downloads resume, nothing is done twice.
#
#   bash scripts/finish-translations.sh            # everything, ends with git push
#   NO_PUSH=1 bash scripts/finish-translations.sh  # stop before the commit
set -euo pipefail
cd "$(dirname "$0")/.."

DIR="${KAIKKI_DIR:-$HOME/.cache/fluent365/kaikki-full}"
OLD="/home/ati/tmp/claude-1000/-home-ati-Attia-Pro-Projects-Fluent365/e76626e6-a1ef-453a-bde7-1ba00388492e/scratchpad/kaikki-full"
mkdir -p "$DIR"

say() { printf '\n== %s\n' "$*"; }

say "1/6 Turkish and Arabic Wiktionary files (kaikki.org) -> $DIR"
for L in Turkish Arabic; do
  f="$DIR/$L.jsonl"
  # Reuse what the Claude session already downloaded (also a half file: curl continues it).
  if [ ! -s "$f" ] && [ -s "$OLD/$L.jsonl" ]; then cp "$OLD/$L.jsonl" "$f"; fi
  url="https://kaikki.org/dictionary/$L/kaikki.org-dictionary-$L.jsonl"
  want=$(curl -sIL "$url" | tr -d '\r' | awk 'tolower($1)=="content-length:"{n=$2} END{print n}')
  have=$(stat -c %s "$f" 2>/dev/null || echo 0)
  if [ -n "$want" ] && [ "$have" = "$want" ]; then echo "$L: complete ($have bytes)"; continue; fi
  echo "$L: $have of ${want:-?} bytes, downloading…"
  curl -fL --retry 5 --retry-delay 5 -C - -A "fluent365-content-build" -o "$f" "$url"
  have=$(stat -c %s "$f")
  if [ -n "$want" ] && [ "$have" != "$want" ]; then echo "$L is incomplete ($have of $want). Run this script again."; exit 1; fi
done

say "2/6 Read them the other way round (fills book-words.json, writes translations-reverse.json)"
python3 scripts/reverse-translations.py "$DIR/Turkish.jsonl" "$DIR/Arabic.jsonl"

say "3/6 A few samples to look at (TR | AR)"
python3 - <<'EOF'
import json
w = json.load(open("content/vocabulary/book-words.json"))["words"]
for k in ["startled", "gaunt", "haggard", "blistered", "crept", "sobbing", "prairie", "sober", "dazed", "trudged", "meadow", "bewildered"]:
    e = w.get(k) or {}
    print(f"{k:12} {e.get('base', ''):10} {e.get('tr', '-'):35} | {e.get('ar', '-')}")
m = [e for e in w.values() if "d" in e]
print(f"\nbook words with a meaning: {len(m)} · TR {sum('tr' in e for e in m)} · AR {sum('ar' in e for e in m)}")
EOF

say "4/6 Build"
pnpm build

say "5/6 Tests"
pnpm test

if [ -n "${NO_PUSH:-}" ]; then say "NO_PUSH set: stopping before the commit"; git status --short; exit 0; fi

say "6/6 Commit and push"
python3 - <<'EOF'
import json, re
w = json.load(open("content/vocabulary/book-words.json"))["words"]
m = [e for e in w.values() if "d" in e]
r = json.load(open("content/vocabulary/translations-reverse.json"))["words"]
line = (f"- **Reverse translations (2026-11-21).** Missing Turkish/Arabic filled from English Wiktionary's Turkish and Arabic entries "
        f"read the other way round (`scripts/reverse-translations.py`, run by `scripts/finish-translations.sh`; CC BY-SA, no API, offline). "
        f"Book words with a meaning: {len(m)}, TR {sum('tr' in e for e in m)}, AR {sum('ar' in e for e in m)}; word list: +{len(r)} words "
        f"(`translations-reverse.json`, merged in build-content). Cards saved earlier get the new TR/AR at start (`fillCustomMeanings` fills only gaps).")
p = "docs/DEVELOPMENT_STATUS.md"; s = open(p).read()
if "**Reverse translations (2026-11-21).**" not in s:
    i = s.index("- **Owner's phone feedback (2026-11-21).**")
    s = s[:i] + line + "\n" + s[i:]
    open(p, "w").write(s)
p = "docs/CONTENT_LICENSING.md"; s = open(p).read()
if "translations-reverse.json" not in s:
    row = ("| Turkish/Arabic for words that English Wiktionary gives no translation for (`content/vocabulary/translations-reverse.json`, "
           "and the tr/ar filled in `book-words.json`) | English Wiktionary's Turkish and Arabic entries (their English glosses, read the other way round), "
           "contributors of Wiktionary, via kaikki.org / wiktextract (downloaded 2026-11-21) | CC BY-SA 4.0 | Only short exact glosses, "
           "first sense weighted; up to 3 words per language; shown as \"Wiktionary · may be another meaning\". |")
    lines = s.split("\n")
    i = next(n for n, l in enumerate(lines) if "book-words.json" in l)
    lines.insert(i + 1, row)
    open(p, "w").write("\n".join(lines))
EOF
git add content/vocabulary/book-words.json content/vocabulary/translations-reverse.json scripts/reverse-translations.py scripts/finish-translations.sh scripts/build-content.mjs docs/DEVELOPMENT_STATUS.md docs/CONTENT_LICENSING.md
git commit -m "Missing Turkish/Arabic from Wiktionary's Turkish and Arabic entries read the other way round" -m "Book words and word-list words without a translation get one (free, offline, CC BY-SA). Cards saved earlier are filled in when the app starts."
git push origin main
say "Done. The site updates in a few minutes; close and reopen the app on the phone."
