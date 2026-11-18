"""Shared helpers for gen-audio.py (lessons) and gen-book-audio.py (books): Microsoft Edge neural voices via
edge-tts, with the start time of every word (Edge WordBoundary events). Only Fluent365's public text is sent."""
import asyncio
import os
import re
import subprocess

import edge_tts

RATE = 24000  # Edge sends 24 kHz mono


def norm(s):
    return re.sub(r"[^\w']+", "", s.lower().replace("’", "'"))


def align(text, bounds):
    """Start time (s) of every whitespace-separated word in `text` (same split as the app: text.split(/\\s+/)).
    Edge gives words without punctuation and sometimes splits one token ("dog—it") into two: the token gets the
    time of its first word. Tokens Edge skips (a lone "—") get the previous token's time."""
    tokens = text.split()
    out = [None] * len(tokens)
    k = 0
    for t, w in bounds:
        nw = norm(w)
        if not nw:
            continue
        for j in range(k, min(k + 6, len(tokens))):
            if nw in norm(tokens[j]) or norm(tokens[j]) in nw and norm(tokens[j]):
                if out[j] is None:
                    out[j] = t
                k = j if nw != norm(tokens[j]) and not norm(tokens[j]).endswith(nw) else j + 1
                break
    last = 0.0
    for j in range(len(out)):
        if out[j] is None:
            out[j] = last
        last = out[j]
    return out


async def speak(text, voice, rate, path):
    """Save Edge's MP3 for `text` to `path`; return [(seconds, word), ...] from WordBoundary."""
    for attempt in range(6):
        try:
            bounds = []
            with open(path, "wb") as f:
                async for ch in edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary").stream():
                    if ch["type"] == "audio":
                        f.write(ch["data"])
                    elif ch["type"] == "WordBoundary":
                        bounds.append((ch["offset"] / 1e7, ch["text"]))
            if os.path.getsize(path) > 0:
                return bounds
        except Exception as error:  # network hiccups: try again
            print("  retry", voice, repr(error)[:120], flush=True)
        await asyncio.sleep(3 * (attempt + 1))
    raise RuntimeError(f"no audio for: {text[:60]}")


def pcm(path):
    """Decode to raw 16-bit mono PCM at RATE."""
    return subprocess.run(["ffmpeg", "-loglevel", "error", "-i", path, "-f", "s16le", "-ac", "1", "-ar", str(RATE), "-"], check=True, capture_output=True).stdout


def silence(ms):
    return bytes(2 * int(RATE * ms / 1000))


def encode(raw, out, args, title):
    """Raw PCM → file with ffmpeg codec args, e.g. ["-b:a", "48k"] or ["-c:a", "libopus", "-b:a", "24k"]."""
    p = subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "s16le", "-ac", "1", "-ar", str(RATE), "-i", "-", *args,
                        "-metadata", f"title={title}", "-metadata", "comment=Fluent365, generated with Microsoft Edge neural voices", out],
                       input=bytes(raw), capture_output=True)
    if p.returncode:
        raise RuntimeError(p.stderr.decode()[:300])
