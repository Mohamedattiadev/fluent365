// One audio player for the whole app. It keeps playing with the screen off and shows lock-screen
// controls (Media Session API). Your place in every recording is saved on this device.
import { useSyncExternalStore } from "react";
import { ping } from "./activity";
import { playableUrl } from "./audio";
import { getState, update } from "./store";

export interface Track { key: string; title: string; artist: string; url: string; cover?: string; album?: string }
/** Sleep timer: stop at a time (ms since epoch) or at the end of the current recording. */
export type Sleep = null | { until: number } | { end: true };
interface PlayerState { queue: Track[]; index: number; playing: boolean; time: number; duration: number; rate: number; loading: boolean; error?: string; sleep: Sleep; expanded: boolean }

let st: PlayerState = { queue: [], index: 0, playing: false, time: 0, duration: 0, rate: 1, loading: false, sleep: null, expanded: false };
const listeners = new Set<() => void>();
const set = (patch: Partial<PlayerState>) => { st = { ...st, ...patch }; listeners.forEach((l) => l()); };
let el: HTMLAudioElement | null = null;
let objectUrl: string | null = null;
let lastSave = 0;

function audio() {
  if (el) return el;
  el = new Audio();
  el.preload = "auto";
  el.addEventListener("timeupdate", () => {
    set({ time: el!.currentTime, duration: Number.isFinite(el!.duration) ? el!.duration : st.duration });
    if (Date.now() - lastSave > 5000) { savePosition(); lastSave = Date.now(); if (document.visibilityState === "visible") ping("listening"); }
    updatePosition();
    if (st.sleep && "until" in st.sleep && Date.now() >= st.sleep.until) { set({ sleep: null }); el!.pause(); }
    if (Number.isFinite(el!.duration) && el!.currentTime / el!.duration > 0.95) markDone();
  });
  el.addEventListener("play", () => { set({ playing: true }); if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing"; });
  el.addEventListener("pause", () => { set({ playing: false }); savePosition(); if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused"; });
  el.addEventListener("ended", () => {
    markDone();
    savePosition(0);
    if (st.sleep && "end" in st.sleep) { set({ sleep: null, playing: false }); return; }
    if (st.index < st.queue.length - 1) void playAt(st.index + 1, 0); else set({ playing: false });
  });
  el.addEventListener("error", () => set({ loading: false, playing: false, error: navigator.onLine ? "This recording could not be played." : "You are offline and this recording is not downloaded yet." }));
  return el;
}

function savePosition(at?: number) {
  const t = st.queue[st.index];
  if (!t || !el) return;
  const time = at ?? Math.floor(el.currentTime);
  update((s) => ({ listening: { ...s.listening, pos: { ...s.listening.pos, [t.key]: time }, last: t.key } }));
}

function markDone() {
  const t = st.queue[st.index];
  if (!t || getState().listening.done?.[t.key]) return;
  update((s) => ({ listening: { ...s.listening, done: { ...s.listening.done, [t.key]: true } } }));
}

function updatePosition() {
  if (!("mediaSession" in navigator) || !el || !Number.isFinite(el.duration)) return;
  try { navigator.mediaSession.setPositionState({ duration: el.duration, position: Math.min(el.currentTime, el.duration), playbackRate: el.playbackRate }); } catch { /* not supported */ }
}

function setMediaSession(t: Track) {
  if (!("mediaSession" in navigator)) return;
  const ms = navigator.mediaSession;
  ms.metadata = new MediaMetadata({ title: t.title, artist: t.artist, album: t.album ?? "Fluent365", artwork: t.cover ? [{ src: new URL(t.cover, location.href).href, sizes: "200x266", type: "image/jpeg" }] : [{ src: new URL("./icons/icon-512.png", location.href).href, sizes: "512x512", type: "image/png" }] });
  const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
    ["play", () => void resume()],
    ["pause", () => pause()],
    ["seekbackward", (d) => seek(-(d.seekOffset ?? 15))],
    ["seekforward", (d) => seek(d.seekOffset ?? 15)],
    ["previoustrack", () => void playAt(Math.max(0, st.index - 1), 0)],
    ["nexttrack", () => { if (st.index < st.queue.length - 1) void playAt(st.index + 1, 0); }],
    ["seekto", (d) => { if (el && d.seekTime != null) el.currentTime = d.seekTime; }],
  ];
  for (const [a, h] of handlers) { try { ms.setActionHandler(a, h); } catch { /* action not supported */ } }
}

async function playAt(index: number, startAt?: number) {
  const t = st.queue[index];
  if (!t) return;
  const a = audio();
  set({ index, loading: true, error: undefined, time: 0, duration: 0 });
  const src = await playableUrl(t.url);
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = src.startsWith("blob:") ? src : null;
  a.src = src;
  a.playbackRate = st.rate;
  const from = startAt ?? getState().listening.pos[t.key] ?? 0;
  a.currentTime = 0;
  setMediaSession(t);
  try {
    await a.play();
    if (from > 3) a.currentTime = from;
  } catch {
    set({ playing: false });
  }
  set({ loading: false });
}

/** Play a list of tracks from `index`; continues where you stopped last time unless `startAt` is given. */
export function play(queue: Track[], index = 0, startAt?: number) {
  set({ queue });
  void playAt(index, startAt);
}
export async function resume() { if (el?.src) { try { await el.play(); } catch { /* blocked */ } } else if (st.queue.length) await playAt(st.index); }
export function pause() { el?.pause(); }
export function toggle() { if (st.playing) pause(); else void resume(); }
export function seek(delta: number) { if (el) el.currentTime = Math.max(0, Math.min((el.duration || 0) - 1, el.currentTime + delta)); }
export function seekTo(t: number) { if (el) el.currentTime = t; }
export function next() { if (st.index < st.queue.length - 1) void playAt(st.index + 1, 0); }
export function prev() { if (el && el.currentTime > 5) el.currentTime = 0; else void playAt(Math.max(0, st.index - 1), 0); }
export function setRate(rate: number) { set({ rate }); if (el) el.playbackRate = rate; }
export function stop() { el?.pause(); set({ queue: [], index: 0, playing: false, sleep: null, expanded: false }); }
export function setSleep(sleep: Sleep) { set({ sleep }); }
/** Jump to a time and keep playing (tap a sentence, "Repeat sentence"). */
export function playFrom(t: number) { if (!el) return; el.currentTime = Math.max(0, t); if (!st.playing) void resume(); }

// Full-screen player. Opening adds a history entry so the phone's Back button closes it.
export function open() {
  if (st.expanded || !st.queue.length) return;
  set({ expanded: true });
  try { history.pushState({ f365Player: true }, ""); } catch { /* ignore */ }
}
export function close() {
  if (!st.expanded) return;
  if (history.state?.f365Player) history.back(); else set({ expanded: false });
}
if (typeof window !== "undefined") window.addEventListener("popstate", () => { if (st.expanded) set({ expanded: false }); });

export function usePlayer() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => st);
}
export const current = () => st.queue[st.index];
