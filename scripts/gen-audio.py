"""Generate MP3 recordings for every listening text (lessons + IELTS listening practice) with Microsoft Edge's
online neural voices (edge-tts). Only Fluent365's own public lesson scripts are sent; no learner data.

Usage:
  uvx --with edge-tts python scripts/gen-audio.py          # only recordings whose text or cast changed
  uvx --with edge-tts python scripts/gen-audio.py --all    # everything again

Output: content/audio/tts/<key>.mp3 (mono, 48 kbit/s) and content/audio/tts/index.json with the start time of
every line (for following the transcript). Keys: lesson-<n> and <course>-<unit>.
Voices and speeds were picked by ear by the owner (2026-11-17); every voice reads a little slower than default.
Licence notes: docs/CONTENT_LICENSING.md.
"""
import asyncio
import hashlib
import json
import os
import subprocess
import sys
import tempfile

import edge_tts

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "content", "audio", "tts")
RATE = 24000
NARRATOR = ("en-US-AvaNeural", "-10%")
FEMALE = [("en-US-EmmaNeural", "-10%"), ("en-GB-SoniaNeural", "-10%"), ("en-US-AvaNeural", "-10%")]
MALE = [("en-US-AndrewNeural", "-15%"), ("en-US-BrianNeural", "-15%"), ("en-US-GuyNeural", "-10%"), ("en-GB-RyanNeural", "-10%")]
# Content names Azure-style voices; only their gender is used here.
MALE_HINTS = ("Ryan", "William", "Andrew", "Thomas", "Mitchell", "Guy", "Brian", "Christopher", "Eric")


def blocks():
    """Yield (key, audio block) for every recording in the content."""
    for f in sorted(os.listdir(os.path.join(ROOT, "content", "lessons"))):
        if not f.startswith("lesson-"):
            continue
        lesson = json.load(open(os.path.join(ROOT, "content", "lessons", f)))
        for st in lesson["steps"]:
            if st["kind"] == "listen":
                yield f"lesson-{lesson['number']}", st["audio"]
    for f in sorted(os.listdir(os.path.join(ROOT, "content", "courses"))):
        course = json.load(open(os.path.join(ROOT, "content", "courses", f)))
        for unit in course["units"]:
            found = []

            def walk(o):
                if isinstance(o, dict):
                    if o.get("type") == "audio" and "lines" in o:
                        found.append(o)
                    for v in o.values():
                        walk(v)
                elif isinstance(o, list):
                    for v in o:
                        walk(v)

            walk(unit)
            for i, a in enumerate(found):
                yield f"{course['id']}-{unit['id']}" + (f"-{i + 1}" if i else ""), a


def cast(key, audio):
    """A different voice for each speaker: the narrator gets Ava, then women and men in turn.
    The men's list starts at a different place per recording, so every male voice gets used."""
    shift = int(hashlib.sha1(key.encode()).hexdigest(), 16)
    males = iter(MALE[shift % len(MALE):] + MALE[:shift % len(MALE)])
    females, out = iter(FEMALE), {}
    for sid, sp in audio["speakers"].items():
        if sid == "N" or sp["name"].lower() == "narrator":
            out[sid] = NARRATOR
        elif any(h in sp["voice"] for h in MALE_HINTS):
            out[sid] = next(males, MALE[0])
        else:
            out[sid] = next(females, FEMALE[0])
    return out


async def speak(text, voice, rate, path):
    for attempt in range(4):
        try:
            await edge_tts.Communicate(text, voice, rate=rate).save(path)
            if os.path.getsize(path) > 0:
                return
        except Exception as error:  # network hiccups: try again
            print("  retry", voice, error, flush=True)
        await asyncio.sleep(2 * (attempt + 1))
    raise RuntimeError(f"no audio for: {text[:60]}")


def pcm(path):
    """Decode to raw 16-bit mono PCM at RATE."""
    return subprocess.run(["ffmpeg", "-loglevel", "error", "-i", path, "-f", "s16le", "-ac", "1", "-ar", str(RATE), "-"], check=True, capture_output=True).stdout


async def main(redo_all):
    os.makedirs(OUT, exist_ok=True)
    index_path = os.path.join(OUT, "index.json")
    index = {} if redo_all or not os.path.exists(index_path) else json.load(open(index_path))
    seen = set()
    for key, audio in blocks():
        seen.add(key)
        cast_map = cast(key, audio)
        digest = hashlib.sha1(json.dumps(["edge", audio["lines"], cast_map], sort_keys=True).encode()).hexdigest()[:12]
        mp3 = os.path.join(OUT, f"{key}.mp3")
        if index.get(key, {}).get("hash") == digest and os.path.exists(mp3):
            continue
        raw, starts = bytearray(), []
        with tempfile.TemporaryDirectory() as tmp:
            for i, line in enumerate(audio["lines"]):
                starts.append(round(len(raw) / 2 / RATE, 2))
                voice, rate = cast_map.get(line["speaker"], NARRATOR)
                part = os.path.join(tmp, f"{i}.mp3")
                await speak(line["text"], voice, rate, part)
                raw += pcm(part)
                raw += bytes(2 * int(RATE * line.get("pauseAfterMs", 450) / 1000))
            wav = os.path.join(tmp, "all.raw")
            open(wav, "wb").write(raw)
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "s16le", "-ac", "1", "-ar", str(RATE), "-i", wav, "-b:a", "48k", "-metadata", f"title={key}", "-metadata", "comment=Fluent365, generated with Microsoft Edge neural voices", mp3], check=True)
        seconds = round(len(raw) / 2 / RATE, 1)
        index[key] = {"hash": digest, "seconds": seconds, "bytes": os.path.getsize(mp3), "starts": starts, "voices": {k: f"{v} {r}" for k, (v, r) in cast_map.items()}}
        print(key, round(seconds), "s", os.path.getsize(mp3) // 1024, "KB", index[key]["voices"], flush=True)
        json.dump(index, open(index_path, "w"), indent=0, sort_keys=True)
    for key in [k for k in index if k not in seen]:
        del index[key]
    json.dump(index, open(index_path, "w"), indent=0, sort_keys=True)


if __name__ == "__main__":
    asyncio.run(main("--all" in sys.argv))
