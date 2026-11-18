#!/usr/bin/env bash
# Publish the generated audiobooks (scripts/gen-book-audio.py --out DIR) to the fluent365-audio repo as ONE commit
# without history (the repo must not grow on every regeneration). Only finished chapters (audio + timing) go in.
# Usage: scripts/publish-book-audio.sh ../fluent365-audio
set -euo pipefail
DIR="${1:?audio folder}"
HERE="$(cd "$(dirname "$0")" && pwd)"
uvx --with edge-tts python "$HERE/gen-book-audio.py" --out "$DIR" --index >/dev/null
cd "$DIR"
git checkout -q --orphan publish-tmp
git rm -rq --cached . >/dev/null 2>&1 || true
git add README.md .nojekyll index.json
for j in */[0-9][0-9].json; do
  b="${j%.json}"
  for a in "$b.webm" "$b.mp3"; do [ -f "$a" ] && git add "$j" "$a"; done
done
git commit -qm "Fluent365 audiobooks (Edge neural voices), $(date -u +%F)"
git branch -D main >/dev/null 2>&1 || true
git branch -m main
git push -qf origin main
git count-objects -vH | grep size-pack
