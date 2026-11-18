// Full-screen "now playing" (like Spotify lyrics): the whole transcript in large type, the sentence being
// spoken bold and kept in the middle, earlier and later lines dimmed. Tap a sentence to jump there,
// long-press a word to look it up or add it to your words. Opens from the mini player or the Listen card;
// closes with the arrow, a swipe down, Escape or the phone's Back button.
// Lesson recordings and the Edge-voice audiobooks have exact sentence and word times (Edge WordBoundary), so the
// word being spoken is marked. For LibriVox audiobooks the place is only an estimate (lib/transcript.ts).
import { useEffect, useRef, useState } from "react";
import { loadBook, loadLesson, type Content } from "../lib/content";
import * as player from "../lib/player";
import { wordIndex } from "../lib/reading";
import { useApp } from "../lib/store";
import { edgeIndex, lastAt, loadTiming } from "../lib/edgebooks";
import { chapterSentences, lineAt, sentenceAt, type Line } from "../lib/transcript";
import type { AudioBlock } from "../lib/types";
import { WordSheet } from "./Reader";
import { Icon, toast } from "./ui";

export const time = (s: number) => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`; };
const NONE: Record<string, true> = {};
export const RATES = [0.8, 0.9, 1, 1.15, 1.3];
const SLEEPS: { label: string; v: player.Sleep | "min"; min?: number }[] = [
  { label: "Sleep", v: null }, { label: "15 min", v: "min", min: 15 }, { label: "30 min", v: "min", min: 30 }, { label: "60 min", v: "min", min: 60 }, { label: "End of chapter", v: { end: true } },
];

/** `book`: the place is estimated (LibriVox; starts are shares 0–1). Otherwise starts are seconds and `words`
 *  (when present) holds the start of every word of every line in seconds. */
export interface Transcript { key: string; lines: Line[]; starts: number[]; book: boolean; words?: number[][] }

/** The ladder book a track belongs to (LibriVox "book:<id>:<n>" or Edge voices "ebook:<id>:<n>"). */
export const bookOf = (key?: string) => (key && /^e?book:/.test(key) ? key.split(":")[1] : undefined);

/** The text that goes with a recording: lesson lines with start times (seconds) or book sentences (share 0–1). */
export function useTranscript(c: Content, trackKey?: string) {
  const [data, setData] = useState<Transcript | null>(null);
  useEffect(() => {
    if (!trackKey) return;
    let live = true;
    const [kind, a, b] = trackKey.split(":");
    if (kind === "tts" && a.startsWith("lesson-")) {
      const rec = c.audio.tts[a];
      void loadLesson(Number(a.slice(7))).then((l) => {
        let block: AudioBlock | undefined;
        const walk = (o: unknown): void => { if (block || !o || typeof o !== "object") return; if ((o as AudioBlock).type === "audio" && (o as AudioBlock).lines) { block = o as AudioBlock; return; } Object.values(o).forEach(walk); };
        walk(l);
        const words = rec?.words?.map((w, i) => w.map((o) => rec.starts[i] + o / 100));
        if (live && block && rec?.starts) setData({ key: trackKey, book: false, starts: rec.starts, words, lines: block.lines.map((x) => ({ text: x.text, speaker: block!.speakers[x.speaker]?.name ?? x.speaker })) });
      }).catch(() => undefined);
    } else if (kind === "ebook") {
      const ch = edgeIndex()?.books[a]?.chapters[Number(b)];
      if (ch) void loadBook(a).then((book) => loadTiming(book, ch)).then((tm) => {
        if (live) setData({ key: trackKey, book: false, lines: tm.sentences.map((x) => ({ text: x.text })), starts: tm.sentences.map((x) => x.start), words: tm.sentences.map((x) => x.words) });
      }).catch(() => undefined);
    } else if (kind === "book" && c.audio.books[a]) {
      void loadBook(a).then((book) => {
        if (!live) return;
        const list = chapterSentences(book, c.audio.books[a], Number(b));
        setData({ key: trackKey, book: true, lines: list.map((x) => ({ text: x.text })), starts: list.map((x) => x.at) });
      }).catch(() => undefined);
    }
    return () => { live = false; setData(null); };
  }, [trackKey, c]);
  return data && data.key === trackKey && data.lines.length ? data : null;
}

/** Index of the line being spoken and its start time in seconds. */
export function placeIn(t: Transcript, p: { time: number; duration: number }) {
  const pos = t.book ? (p.duration ? p.time / p.duration : 0) : p.time;
  const i = t.book ? sentenceAt(t.starts.map((at) => ({ at })), pos) : lineAt(t.starts, pos);
  return i;
}
/** The word being spoken inside line i, or -1. Exact when the recording has word times (Edge WordBoundary).
 *  Older lesson files without them: an estimate inside the line's exact start/end (longer words get more time,
 *  punctuation a short pause). LibriVox audiobooks: no word mark, because even the sentence is only estimated. */
export function wordAt(t: Transcript, p: { time: number; duration: number; playing: boolean }, i: number) {
  if (t.book || (!p.playing && p.time <= 0)) return -1;
  const w = t.words?.[i];
  if (w?.length) return lastAt(w, p.time);
  const end = t.starts[i + 1] ?? (p.duration || t.starts[i] + 4);
  const span = Math.max(0.0001, (end - t.starts[i]) * 0.9 - 0.25);
  const words = t.lines[i].text.split(/\s+/);
  const weight = words.map((w) => Math.max(2, w.replace(/[^\p{L}\p{N}]/gu, "").length) + (/[,;:]$/.test(w) ? 3 : /[.!?]["”’]?$/.test(w) ? 5 : 0));
  const total = weight.reduce((a, b) => a + b, 0);
  let at = ((p.time - t.starts[i]) / span) * total;
  for (let k = 0; k < words.length; k++) { at -= weight[k]; if (at < 0) return k; }
  return words.length - 1;
}
export const startOf = (t: Transcript, i: number, duration: number) => (t.book ? t.starts[i] * duration : t.starts[i]);

/** Scrubber, −10 s, play/pause, +10 s (and previous/next). Shared by the full-screen player and the laptop bar. */
export function Controls({ big = true }: { big?: boolean }) {
  const p = player.usePlayer();
  return (
    <div className={`fp-controls ${big ? "" : "small"}`}>
      <button className="icon-btn" onClick={player.prev} aria-label="Previous"><Icon name="prev" /></button>
      <button className="icon-btn" onClick={() => player.seek(-10)} aria-label="Back 10 seconds"><Icon name="rew" /></button>
      <button className={`play-fab ${big ? "big" : ""}`} onClick={player.toggle} aria-label={p.playing ? "Pause" : "Play"}><Icon name={p.playing ? "pause" : "play"} size={big ? 36 : 28} filled /></button>
      <button className="icon-btn" onClick={() => player.seek(10)} aria-label="Forward 10 seconds"><Icon name="fwd" /></button>
      <button className="icon-btn" onClick={player.next} aria-label="Next"><Icon name="next" /></button>
    </div>
  );
}
export function Scrubber() {
  const p = player.usePlayer();
  return (
    <div className="fp-seek">
      <input className="np-seek" type="range" min={0} max={Math.max(1, Math.floor(p.duration))} value={Math.floor(p.time)} onChange={(e) => player.seekTo(Number(e.target.value))} aria-label="Position" aria-valuetext={`${time(p.time)} of ${time(p.duration)}`} style={{ ["--pct" as string]: `${p.duration ? (p.time / p.duration) * 100 : 0}%` }} />
      <div className="np-times small muted"><span>{time(p.time)}</span><span>-{time(Math.max(0, p.duration - p.time))}</span></div>
    </div>
  );
}

/** Repeat sentence · speed · sleep timer · chapters. */
export function Extras({ t, onList }: { t: Transcript | null; onList: () => void }) {
  const p = player.usePlayer();
  const [, tick] = useState(0);
  useEffect(() => { if (!p.sleep || !("until" in p.sleep)) return; const id = setInterval(() => tick((x) => x + 1), 15000); return () => clearInterval(id); }, [p.sleep]);
  const step = useRef(0);
  const sleepLabel = !p.sleep ? "Sleep" : "end" in p.sleep ? "End of chapter" : `${Math.max(1, Math.ceil((p.sleep.until - Date.now()) / 60000))} min left`;
  function nextSleep() {
    // Off → 15 → 30 → 60 min → end of chapter → off.
    const n = p.sleep ? (step.current + 1) % SLEEPS.length : 1;
    step.current = n;
    const s = SLEEPS[n];
    player.setSleep(s.v === "min" ? { until: Date.now() + s.min! * 60000 } : s.v);
    toast(n === 0 ? "Sleep timer off" : `Stops ${s.v === "min" ? `in ${s.label}` : "at the end of this chapter"}`);
  }
  function repeat() {
    if (!t) { player.seek(-5); return; }
    const i = placeIn(t, p);
    player.playFrom(startOf(t, i, p.duration) - (t.book ? 1 : 0.1));
  }
  const rate = () => { const i = RATES.indexOf(p.rate); player.setRate(RATES[(i + 1) % RATES.length]); };
  return (
    <div className="fp-extras">
      <button className="fp-chip" onClick={repeat} aria-label="Repeat this sentence"><Icon name="repeat1" size={20} /><span>Repeat</span></button>
      <button className="fp-chip" onClick={rate} aria-label={`Speed ${p.rate}×, tap to change`}><Icon name="speed" size={20} /><span>{p.rate}×</span></button>
      <button className={`fp-chip ${p.sleep ? "on" : ""}`} onClick={nextSleep} aria-label={`Sleep timer: ${p.sleep ? sleepLabel : "off"}, tap to change`}><Icon name="sleep" size={20} /><span>{sleepLabel}</span></button>
      <button className="fp-chip" onClick={onList} aria-label="Chapters"><Icon name="queue" size={20} /><span>{bookOf(p.queue[0]?.key) ? "Chapters" : "Lessons"}</span></button>
    </div>
  );
}

/** All lines, the current one bold and centred; tap = jump, long-press a word = word card. */
export function TranscriptView({ c, t, onWord }: { c: Content; t: Transcript; onWord: (w: { word: string; sentence: string }) => void }) {
  const p = player.usePlayer();
  const box = useRef<HTMLDivElement>(null);
  const manual = useRef(0);
  const press = useRef<{ id: ReturnType<typeof setTimeout>; fired: boolean } | null>(null);
  const i = placeIn(t, p);
  const wi = wordAt(t, p, i);
  void c;
  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>(`[data-i="${i}"]`);
    if (!el || !box.current || Date.now() < manual.current) return;
    const reduce = document.documentElement.dataset.motion === "reduce" || matchMedia("(prefers-reduced-motion: reduce)").matches;
    box.current.scrollTo({ top: el.offsetTop - box.current.clientHeight / 2 + el.clientHeight / 2, behavior: reduce ? "auto" : "smooth" });
  }, [i, t]);
  const userScroll = () => { manual.current = Date.now() + 4000; };
  const down = (e: React.PointerEvent) => {
    const w = (e.target as HTMLElement).closest<HTMLElement>(".fw");
    if (!w) return;
    const line = w.closest<HTMLElement>("[data-i]");
    press.current = { fired: false, id: setTimeout(() => { if (press.current) press.current.fired = true; onWord({ word: w.textContent ?? "", sentence: t.lines[Number(line?.dataset.i)]?.text ?? "" }); }, 480) };
  };
  const cancel = () => { if (press.current) clearTimeout(press.current.id); };
  return (
    <div className={`fp-text ${t.book ? "is-book" : ""}`} ref={box} onWheel={userScroll} onTouchMove={() => { userScroll(); cancel(); }} onPointerDown={down} onPointerUp={cancel} onPointerLeave={cancel} onContextMenu={(e) => e.preventDefault()}>
      {t.lines.map((l, k) => (
        <p key={k} data-i={k} className={k === i ? "now" : k < i ? "past" : undefined}
          onClick={() => { if (press.current?.fired) { press.current = null; return; } manual.current = 0; player.playFrom(startOf(t, k, p.duration)); }}>
          {l.speaker && <b className="spk">{l.speaker}: </b>}
          {l.text.split(/(\s+)/).map((w, n) => (/\S/.test(w) ? <span key={n} className={k === i && n / 2 === wi ? "fw cur-w" : "fw"}>{w}</span> : w))}
        </p>
      ))}
    </div>
  );
}

/** The queue (book chapters or lessons) to jump to another one. */
export function QueueList({ onPick }: { onPick: () => void }) {
  const p = player.usePlayer();
  const done = useApp((s) => s.listening.done) ?? NONE;
  return (
    <ul className="list fp-queue">
      {p.queue.map((q, k) => (
        <li key={q.key} className={k === p.index ? "playing" : undefined}><button className="rowbtn" onClick={() => { player.play(p.queue, k); onPick(); }}>
          <Icon name={k === p.index ? (p.playing ? "pause" : "play") : done[q.key] ? "check" : "play"} filled={k === p.index} />
          <span className="grow ellipsis">{q.title}</span>
        </button></li>
      ))}
    </ul>
  );
}

export function FullPlayer({ c }: { c: Content }) {
  const p = player.usePlayer();
  const tr = player.current();
  const t = useTranscript(c, tr?.key);
  const [word, setWord] = useState<{ word: string; sentence: string } | null>(null);
  const [list, setList] = useState(false);
  const [dy, setDy] = useState(0);
  const drag = useRef<number | null>(null);
  const cards = useApp((s) => s.cards);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { if (word) setWord(null); else if (list) setList(false); else player.close(); } };
    addEventListener("keydown", key);
    document.documentElement.classList.add("fp-open");
    return () => { removeEventListener("keydown", key); document.documentElement.classList.remove("fp-open"); };
  }, [word, list]);
  if (!tr) return null;
  const bookId = bookOf(tr.key);
  // Swipe down on the header or the controls to close (the text in the middle scrolls).
  const start = (e: React.PointerEvent) => { if ((e.target as HTMLElement).closest("button, input")) return; drag.current = e.clientY; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); };
  const move = (e: React.PointerEvent) => { if (drag.current !== null) setDy(Math.max(0, e.clientY - drag.current)); };
  const end = () => { if (drag.current === null) return; drag.current = null; if (dy > 110) player.close(); setDy(0); };
  const sw = { onPointerDown: start, onPointerMove: move, onPointerUp: end, onPointerCancel: end };
  return (
    <div className="fp" role="dialog" aria-modal="true" aria-label={`Now playing: ${tr.title}`} style={dy ? { transform: `translateY(${dy}px)`, transition: "none" } : undefined}>
      <div className="fp-head" {...sw}>
        <span className="fp-grip" aria-hidden />
        <button className="icon-btn" onClick={player.close} aria-label="Close the player"><Icon name="down" size={28} /></button>
        <div className="grow fp-title">
          <span className="ellipsis">{tr.title}</span>
          <span className="small muted ellipsis">{tr.album ?? tr.artist}{p.loading ? " · loading…" : ""}</span>
        </div>
        {tr.cover ? <img className="cover" src={tr.cover} alt="" width={36} height={48} /> : <span style={{ width: 48 }} />}
      </div>
      {list ? (
        <div className="fp-text fp-list"><QueueList onPick={() => setList(false)} /></div>
      ) : t ? (
        <TranscriptView c={c} t={t} onWord={setWord} />
      ) : (
        <div className="fp-text fp-empty"><p className="muted">No text for this recording.</p></div>
      )}
      <div className="fp-foot" {...sw}>
        {t?.book && !list && <p className="fp-note small muted">Place in the text is estimated · long-press a word to save it</p>}
        {t && !t.book && !list && <p className="fp-note small muted">Tap a sentence to jump · long-press a word to save it</p>}
        {p.error && <p className="small" style={{ color: "var(--md-error)", margin: "0 0 6px" }}>{p.error}</p>}
        <Scrubber />
        <Controls />
        <Extras t={t} onList={() => setList(!list)} />
      </div>
      {word && <WordSheet c={c} index={wordIndex(c)} pick={word} bookId={bookId} saved={(k) => !!cards[k]} onClose={() => setWord(null)} />}
    </div>
  );
}

/** Spotify-style lyrics card on the Listen page (phones): the line being spoken, big and bold, with the lines
 *  around it; it follows the voice. Tap it to open the full-screen player. */
export function LyricsCard({ c }: { c: Content }) {
  const p = player.usePlayer();
  const tr = player.current();
  const t = useTranscript(c, tr?.key);
  if (!tr) return null;
  if (!t) return <button className="lyrics-card" onClick={player.open}><span className="lyrics-head"><span>Transcript</span><Icon name="arrow" size={18} /></span><p className="lyrics-line next">{p.loading ? "Loading…" : "No text for this recording."}</p></button>;
  const i = placeIn(t, p);
  const wi = wordAt(t, p, i);
  const show = t.lines.slice(Math.max(0, i - 1), i + 4).map((l, k) => ({ l, k: Math.max(0, i - 1) + k }));
  return (
    <button className="lyrics-card" onClick={player.open} aria-label="Open the transcript in full screen">
      <span className="lyrics-head"><span>{t.book ? "Book text · place estimated" : bookOf(tr.key) ? "Book text" : "Transcript"}</span><span className="lyrics-open">Full screen <Icon name="arrow" size={18} /></span></span>
      {show.map(({ l, k }) => (
        <p key={k} className={`lyrics-line ${k === i ? "now" : k < i ? "past" : "next"}`}>{l.speaker && <b>{l.speaker}: </b>}{k === i ? l.text.split(/\s+/).map((w, n, a) => <span key={n} className={n === wi ? "cur-w" : undefined}>{w}{n < a.length - 1 ? " " : ""}</span>) : l.text}</p>
      ))}
    </button>
  );
}
