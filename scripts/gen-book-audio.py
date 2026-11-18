"""Audiobooks for the reading ladder, read by Microsoft Edge neural voices (edge-tts), chapter by chapter.

The narrator (Ava) reads the text; dialogue in double quotes is read by the speaking character's voice
(content/audio/book-casts.json). Every sentence uses the reader's own sentence split (splitSentences in
apps/pocket/src/lib/transcript.ts) and gets its start time and the start time of each of its words (Edge
WordBoundary), so the app can follow the voice word by word and highlight the sentence in the reader.

Usage (needs `pnpm content` first: reads apps/pocket/public/data/books*.json):
  uvx --with edge-tts python scripts/gen-book-audio.py --out ../fluent365-audio wizard-of-oz [more books]
  ... --chapters 1,2      only these chapters (1-based)
  ... --format opus16     opus24 (default) | opus16 | mp3
  ... --index             only rebuild <out>/index.json
Resumable: a chapter whose text, cast and format did not change is skipped.

Output: <out>/<book>/<NN>.webm (Opus in WebM: Chrome, Firefox, Safari 17.4+ / iOS 17.4+) or .mp3, and
<out>/<book>/<NN>.json: {"hash", "seconds", "s": [[block, startCs, [wordOffsetCs, ...]], ...]} — one entry per
sentence in reading order (headings count as one sentence), block = absolute block index in the book,
word offsets relative to the sentence start, one per whitespace-separated word.
Plus <out>/index.json listing books and chapters (what the app reads to know what exists).
"""
import argparse
import asyncio
import hashlib
import json
import os
import re
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tts_common import RATE, align, encode, pcm, silence, speak  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA = os.path.join(ROOT, "apps", "pocket", "public", "data")
CASTS = json.load(open(os.path.join(ROOT, "content", "audio", "book-casts.json")))
FORMATS = {
    "opus24": ("webm", ["-c:a", "libopus", "-b:a", "24k"]),
    "opus16": ("webm", ["-c:a", "libopus", "-b:a", "16k"]),
    "mp3": ("mp3", ["-b:a", "48k"]),
}
VERBS = r"(?:said|says|asked|cried|replied|answered|exclaimed|shouted|called|whispered|added|continued|remarked|returned|observed|repeated|went on|began|screamed|sobbed|muttered|declared|inquired|explained|thought|murmured|growled|roared|panted|gasped|interrupted|resumed)"
PARA_PAUSE, HEAD_PAUSE = 550, 1000


def split_sentences(text):
    """Python copy of splitSentences() in apps/pocket/src/lib/transcript.ts (keep them identical)."""
    return [t for t, _ in split_with_pos(text)]


def split_with_pos(text):
    """Sentences with the character position where each starts (same rules as splitSentences)."""
    parts = []
    for m in re.finditer(r"[^.!?]+[.!?]+[\"”’)]*\s*|[^.!?]+$", text):
        x = m.group(0)
        if x.strip():
            parts.append((x.strip(), m.start() + len(x) - len(x.lstrip())))
    if not parts:
        return [(text, 0)]
    out = []
    for x, at in parts:
        if out and re.search(r"\b(Mr|Mrs|Ms|Dr|St|Mt|Jr|Sr)\.$", out[-1][0]):
            out[-1] = (out[-1][0] + " " + x, out[-1][1])
        else:
            out.append((x, at))
    return out


def sentence_token_starts(text):
    """Index of the whitespace token in which each sentence starts."""
    spans = [m.start() for m in re.finditer(r"\S+", text)]
    return [max(0, sum(1 for a in spans if a <= at) - 1) for _, at in split_with_pos(text)]


def roman(t):
    vals = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100}
    n, prev = 0, 0
    for ch in reversed(t):
        v = vals[ch]
        n = n - v if v < prev else n + v
        prev = max(prev, v)
    return str(n)


def heading_speech(text):
    """'Chapter I. — THE CYCLONE' → 'Chapter 1. The cyclone.' (numbers read as numbers, capitals not spelled)."""
    toks = text.replace("—", " ").split()
    out = []
    for i, t in enumerate(toks):
        bare = t.rstrip(".")
        if re.fullmatch(r"[IVXLC]+", bare) and (i == 0 or toks[i - 1].lower() == "chapter"):
            out.append(roman(bare) + ".")
        elif t.isupper() and len(t) > 1:
            out.append(t.capitalize() if not out else t.lower())
        else:
            out.append(t)
    s = " ".join(out)
    return s if s.endswith(".") else s + "."


class Cast:
    def __init__(self, book):
        cfg = CASTS["books"].get(book, {})
        self.voices = {k: tuple(v) for k, v in CASTS["voices"].items()}
        self.narrator = self.voices[CASTS["narrator"]]
        self.male = self.voices[cfg.get("male", "Brian")]
        self.female = self.voices[cfg.get("female", "Sonia")]
        self.i = self.voices[cfg["i"]] if cfg.get("i") else None
        names = [(n, (self.voices[c["voice"]], c["gender"])) for c in cfg.get("cast", []) for n in c["names"]]
        names.sort(key=lambda x: -len(x[0]))
        self.names = [(re.compile(r"(?<![\w.])(?:the |The )?" + re.escape(n) + r"(?!\w)"), v) for n, v in names]
        self.gender = {v: g for _, (v, g) in names}
        self.gender.setdefault(self.male, "m")
        self.gender.setdefault(self.female, "f")
        self.history = []  # speakers of the last dialogue paragraphs (reset by narration-only paragraphs)

    def who(self, narration):
        """Voice for the quotes in a paragraph from its narration text."""
        best = None
        if self.i:
            for m in re.finditer(r"\b" + VERBS + r" I\b|\bI " + VERBS + r"\b", narration):
                best = (0, m.start(), (self.i, "m"))
                break
        for rx, v in self.names:
            for m in rx.finditer(narration):
                near = re.search(VERBS + r"\W*$", narration[max(0, m.start() - 25):m.start()]) or re.match(r"\W*" + VERBS, narration[m.end():m.end() + 25])
                cand = (0 if near else 1, m.start(), v)
                if best is None or cand[:2] < best[:2]:
                    best = cand
                break
        if best and best[0] == 0:
            return best[2][0]
        m = re.search(r"\b(he|she)\W+" + VERBS + r"|" + VERBS + r"\W+(he|she)\b", narration, re.I)
        if m:
            g = "m" if (m.group(1) or m.group(2)).lower() == "he" else "f"
            if best and best[2][1] == g:
                return best[2][0]
            same = [v for v in self.history[::-1] if self.gender.get(v) == g]
            return same[0] if same else self.male if g == "m" else self.female
        if best:
            return best[2][0]
        if len(self.history) >= 2:
            return self.history[-2]
        return self.male if not self.history else self.female if self.history[-1] == self.male else self.male


def segments(text):
    """Split a paragraph into runs of whitespace tokens: (is_quote, tokens). A token belongs to a quote if a
    quote is open at its first character."""
    out, inside = [], False
    for tok in text.split():
        q = inside or tok.startswith("“")
        for ch in tok:
            if ch == "“":
                inside = True
            elif ch == "”":
                inside = False
        if out and out[-1][0] == q:
            out[-1][1].append(tok)
        else:
            out.append((q, [tok]))
    return out


def plan_chapter(book, blocks, start, end, cast):
    """List of jobs (block, kind, text, voice, tokens-offset) in order, per block."""
    plan = []
    for b in range(start, end):
        blk = blocks[b]
        if blk["type"] == "h2":
            plan.append((b, "h", [(heading_speech(blk["text"]), cast.narrator, len(blk["text"].split()), blk["text"])]))
            continue
        segs = segments(blk["text"])
        quoted = any(q for q, _ in segs)
        voice = None
        if quoted:
            voice = cast.who(" ".join(" ".join(t) for q, t in segs if not q))
            cast.history = (cast.history + [voice])[-3:]
        else:
            cast.history = []
        plan.append((b, "p", [(" ".join(t), voice if q else cast.narrator, len(t), " ".join(t)) for q, t in segs]))
    return plan


async def make_chapter(book, n, blocks, start, end, out_dir, fmt, sem, force):
    cast = Cast(book)
    # Who speaks depends on the paragraphs before, so the cast state runs from the chapter start.
    plan = plan_chapter(book, blocks, start, end, cast)
    ext, args = FORMATS[fmt]
    digest = hashlib.sha1(json.dumps(["v1", fmt, plan, CASTS["voices"]], sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:12]
    base = os.path.join(out_dir, book, f"{n:02d}")
    if not force and os.path.exists(base + ".json") and os.path.exists(f"{base}.{ext}"):
        try:
            if json.load(open(base + ".json")).get("hash") == digest:
                return False
        except (ValueError, OSError):
            pass
    os.makedirs(os.path.dirname(base), exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        async def one(key, speech, voice):
            part = os.path.join(tmp, key + ".mp3")
            async with sem:
                bounds = await speak(speech, voice[0], voice[1], part)
            return bounds, await asyncio.to_thread(pcm, part)

        jobs = [one(f"{i}-{j}", sp, v) for i, (_, _, segs) in enumerate(plan) for j, (sp, v, _, _) in enumerate(segs)]
        results = iter(await asyncio.gather(*jobs))
        raw, sents = bytearray(), []
        for b, kind, segs in plan:
            times = []
            for speech, voice, ntok, shown in segs:
                bounds, data = next(results)
                at = len(raw) / 2 / RATE
                t = align(shown, bounds) if kind == "p" else align(shown, bounds)
                times += [at + x for x in t][:ntok] + [at] * max(0, ntok - len(t))
                raw += data
            text = blocks[b]["text"]
            firsts = [0] if kind == "h" else sentence_token_starts(text)
            for k, first in enumerate(firsts):
                last = firsts[k + 1] if k + 1 < len(firsts) else len(times)
                if first >= len(times):
                    continue
                s0 = times[first]
                sents.append([b, round(s0 * 100), [max(0, round((x - s0) * 100)) for x in times[first:last]]])
            raw += silence(HEAD_PAUSE if kind == "h" else PARA_PAUSE)
        await asyncio.to_thread(encode, raw, f"{base}.{ext}", args, f"{book} {n}")
    seconds = round(len(raw) / 2 / RATE, 1)
    write_json(base + ".json", {"hash": digest, "seconds": seconds, "s": sents}, separators=(",", ":"))
    print(book, n, round(seconds), "s", os.path.getsize(f"{base}.{ext}") // 1024, "KB", flush=True)
    return True


def write_json(path, data, **kw):
    """Write atomically (several generator processes read these files while others write them)."""
    tmp = f"{path}.{os.getpid()}.tmp"
    with open(tmp, "w") as f:
        json.dump(data, f, ensure_ascii=False, **kw)
    os.replace(tmp, path)


def build_index(out_dir):
    books_meta = {b["id"]: b for b in json.load(open(os.path.join(DATA, "books.json")))["books"]}
    index = {"about": "Fluent365 audiobooks read by Microsoft Edge neural voices (narrator en-US-Ava; dialogue in character voices). Text: public domain (Project Gutenberg). Made with scripts/gen-book-audio.py.", "books": {}}
    total = 0
    for book in sorted(os.listdir(out_dir)):
        d = os.path.join(out_dir, book)
        if book not in books_meta or not os.path.isdir(d):
            continue
        chapters = []
        for i, ch in enumerate(books_meta[book]["chapters"]):
            meta = os.path.join(d, f"{i + 1:02d}.json")
            audio = next((f"{i + 1:02d}.{e}" for e in ("webm", "mp3") if os.path.exists(os.path.join(d, f"{i + 1:02d}.{e}"))), None)
            if not audio or not os.path.exists(meta):
                break
            try:
                secs = json.load(open(meta))["seconds"]
            except (ValueError, KeyError):
                break
            size = os.path.getsize(os.path.join(d, audio))
            total += size
            chapters.append({"title": ch["title"], "file": f"{book}/{audio}", "timing": f"{book}/{i + 1:02d}.json", "seconds": secs, "bytes": size})
        if chapters:
            index["books"][book] = {"chapters": chapters, "complete": len(chapters) == len(books_meta[book]["chapters"]), "seconds": round(sum(c["seconds"] for c in chapters)), "bytes": sum(c["bytes"] for c in chapters)}
    write_json(os.path.join(out_dir, "index.json"), index, indent=1)
    print("index:", {k: len(v["chapters"]) for k, v in index["books"].items()}, round(total / 1e6), "MB", flush=True)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("books", nargs="*")
    ap.add_argument("--out", required=True)
    ap.add_argument("--chapters", default="")
    ap.add_argument("--format", default="opus24", choices=list(FORMATS))
    ap.add_argument("--index", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--parallel", type=int, default=8)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    if not a.index:
        sem = asyncio.Semaphore(a.parallel)
        info = {b["id"]: b for b in json.load(open(os.path.join(DATA, "books.json")))["books"]}
        for book in a.books:
            blocks = json.load(open(os.path.join(DATA, "books", f"{book}.json")))["blocks"]
            chs = info[book]["chapters"]
            want = {int(x) for x in a.chapters.split(",") if x} or set(range(1, len(chs) + 1))
            for i, ch in enumerate(chs):
                if i + 1 in want:
                    end = chs[i + 1]["start"] if i + 1 < len(chs) else len(blocks)
                    await make_chapter(book, i + 1, blocks, ch["start"], end, a.out, a.format, sem, a.force)
                    build_index(a.out)
    build_index(a.out)


if __name__ == "__main__":
    asyncio.run(main())
