// Audiobooks read by Microsoft Edge neural voices ("Computer" voice), made by scripts/gen-book-audio.py.
// They live in a separate site next to the app (`../fluent365-audio/`, same origin on GitHub Pages: no user
// name or domain in the code). If that site is missing (a fork, local dev) or the browser cannot play Opus
// in WebM (iOS before 17.4), the app keeps the LibriVox recordings only. Each chapter has a timing file with the
// start of every sentence and word, so the text follows the voice exactly.
import { useSyncExternalStore } from "react";
import { AUDIO_CACHE } from "./audio";
import type { Book } from "./types";
import { sentenceStarts, splitSentences } from "./transcript";

export interface EdgeChapter { title: string; file: string; timing: string; seconds: number; bytes: number }
export interface EdgeBook { chapters: EdgeChapter[]; complete: boolean; seconds: number; bytes: number }
export interface EdgeIndex { books: Record<string, EdgeBook>; base: string }
/** One sentence: block index in the book, start (s), start of each word (s). */
export interface TimedSentence { block: number; start: number; words: number[]; text: string; firstToken: number }
export interface Timing { seconds: number; sentences: TimedSentence[] }

export const EDGE_BASE = "../fluent365-audio/";
let index: EdgeIndex | null = null;
let state: "idle" | "loading" | "done" = "idle";
const listeners = new Set<() => void>();

/** Can this browser play Opus in WebM? (Safari before 17.4 says no.) */
export function canPlayWebm() {
  try { return typeof Audio !== "undefined" && new Audio().canPlayType('audio/webm; codecs="opus"') !== ""; } catch { return false; }
}

async function fetchStored(url: string) {
  try {
    const hit = await (await caches.open(AUDIO_CACHE)).match(url);
    if (hit) return hit;
  } catch { /* no Cache Storage */ }
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

export function loadEdgeIndex() {
  if (state !== "idle" || typeof location === "undefined") return;
  state = "loading";
  const base = new URL(EDGE_BASE, location.href).href;
  const url = new URL("index.json", base).href;
  // Online: the newest list; offline: the copy stored with the downloads.
  fetch(url, { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(); return r.clone().json().then((j) => { void caches.open(AUDIO_CACHE).then((c) => c.put(url, r)).catch(() => undefined); return j; }); })
    .catch(() => fetchStored(url).then((r) => r.json()))
    .then((j: { books?: Record<string, EdgeBook> }) => {
      const playable = canPlayWebm();
      const books = Object.fromEntries(Object.entries(j.books ?? {}).filter(([, b]) => b.chapters.length && (playable || b.chapters.every((c) => !c.file.endsWith(".webm")))));
      index = { books, base };
    })
    .catch(() => { index = null; })
    .finally(() => { state = "done"; listeners.forEach((l) => l()); });
}

/** The Edge audiobook list (null until loaded or when there is none). */
export function useEdgeBooks() {
  loadEdgeIndex();
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => index);
}
export const edgeIndex = () => index;
export const edgeUrl = (path: string) => new URL(path, index?.base ?? new URL(EDGE_BASE, location.href).href).href;
export const edgeIndexUrl = () => new URL("index.json", index?.base ?? new URL(EDGE_BASE, location.href).href).href;

const timings = new Map<string, Promise<Timing>>();
/** Sentence and word times of one chapter, with each sentence's text from the book. */
export function loadTiming(book: Book, ch: EdgeChapter): Promise<Timing> {
  const url = edgeUrl(ch.timing);
  if (!timings.has(url)) {
    const p = fetchStored(url).then((r) => r.json()).then((j: { seconds: number; s: [number, number, number[]][] }) => {
      const perBlock = new Map<number, number>();
      const sentences = j.s.map(([block, start, offs]) => {
        const b = book.blocks[block];
        const k = perBlock.get(block) ?? 0;
        perBlock.set(block, k + 1);
        const texts = b?.type === "p" ? splitSentences(b.text) : [b?.text ?? ""];
        const firsts = b?.type === "p" ? sentenceStarts(b.text) : [0];
        return { block, start: start / 100, words: offs.map((o) => (start + o) / 100), text: texts[k] ?? "", firstToken: firsts[k] ?? 0 };
      });
      return { seconds: j.seconds, sentences };
    });
    p.catch(() => timings.delete(url));
    timings.set(url, p);
  }
  return timings.get(url)!;
}

/** Index of the last item whose time is ≤ t (small look-ahead so the mark is not late), or -1. */
export function lastAt(times: number[], t: number) {
  let lo = 0, hi = times.length - 1, ans = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (times[m] <= t + 0.05) { ans = m; lo = m + 1; } else hi = m - 1; }
  return ans;
}
