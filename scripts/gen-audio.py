"""Generate MP3 recordings for every listening text (lessons + IELTS listening practice) with Piper,
a free offline voice engine. Nothing is sent anywhere: everything runs on this computer.

Usage (once):
  uv venv --python 3.12 /tmp/tts && VIRTUAL_ENV=/tmp/tts uv pip install piper-tts
  download the voices listed in VOICES (onnx + onnx.json) from https://huggingface.co/rhasspy/piper-voices
  /tmp/tts/bin/python scripts/gen-audio.py <voices_dir>

Output: content/audio/tts/<key>.mp3 (mono, 32 kbit/s) and content/audio/tts/index.json with the start time of
every line (for following the transcript). Keys: lesson-<n> and <course>-<unit>.
Voices (all trained on public-domain or CC0 recordings; the voice models are MIT): see docs/CONTENT_LICENSING.md.
"""
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import wave

import numpy as np
from piper import PiperVoice
from piper.config import SynthesisConfig

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "content", "audio", "tts")
RATE = 22050
NARRATOR = "en_GB-cori-high"
FEMALE = ["en_US-kristin-medium", "en_US-ljspeech-high", "en_GB-cori-high"]
MALE = ["en_US-john-medium", "en_US-norman-medium", "en_US-joe-medium"]
VOICES = sorted(set([NARRATOR, *FEMALE, *MALE]))
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


def cast(audio):
    """A different voice for each speaker: the narrator gets Cori (British), then women and men in turn."""
    has_narrator = any(sid == "N" or sp["name"].lower() == "narrator" for sid, sp in audio["speakers"].items())
    females = iter([v for v in FEMALE if not (has_narrator and v == NARRATOR)])
    males, out = iter(MALE), {}
    for sid, sp in audio["speakers"].items():
        if sid == "N" or sp["name"].lower() == "narrator":
            out[sid] = NARRATOR
        elif any(h in sp["voice"] for h in MALE_HINTS):
            out[sid] = next(males, MALE[0])
        else:
            out[sid] = next(females, FEMALE[0])
    return out


def main(voices_dir):
    os.makedirs(OUT, exist_ok=True)
    loaded = {v: PiperVoice.load(os.path.join(voices_dir, f"{v}.onnx")) for v in VOICES}
    index_path = os.path.join(OUT, "index.json")
    index = json.load(open(index_path)) if os.path.exists(index_path) else {}
    cfg = SynthesisConfig(length_scale=1.08)  # a little slower than default: clearer for learners
    for key, audio in blocks():
        cast_map = cast(audio)
        digest = hashlib.sha1(json.dumps([audio["lines"], cast_map], sort_keys=True).encode()).hexdigest()[:12]
        mp3 = os.path.join(OUT, f"{key}.mp3")
        if index.get(key, {}).get("hash") == digest and os.path.exists(mp3):
            continue
        pcm, starts = [], []
        t = 0.0
        for line in audio["lines"]:
            starts.append(round(t, 2))
            voice = loaded[cast_map.get(line["speaker"], NARRATOR)]
            chunk = np.concatenate([c.audio_int16_array for c in voice.synthesize(line["text"], cfg)])
            gap = np.zeros(int(RATE * (line.get("pauseAfterMs", 450) / 1000)), dtype=np.int16)
            pcm += [chunk, gap]
            t += (len(chunk) + len(gap)) / RATE
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            with wave.open(tmp.name, "wb") as w:
                w.setnchannels(1)
                w.setsampwidth(2)
                w.setframerate(RATE)
                w.writeframes(np.concatenate(pcm).tobytes())
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", tmp.name, "-ac", "1", "-b:a", "32k", "-metadata", f"title={key}", "-metadata", "comment=Fluent365, generated with Piper", mp3], check=True)
            os.unlink(tmp.name)
        index[key] = {"hash": digest, "seconds": round(t, 1), "bytes": os.path.getsize(mp3), "starts": starts, "voices": cast_map}
        print(key, round(t), "s", os.path.getsize(mp3) // 1024, "KB", cast_map, flush=True)
        json.dump(index, open(index_path, "w"), indent=0, sort_keys=True)
    json.dump(index, open(index_path, "w"), indent=0, sort_keys=True)


if __name__ == "__main__":
    main(sys.argv[1])
