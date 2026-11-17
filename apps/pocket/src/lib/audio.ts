// Recordings on the device: lesson MP3s (same site) and LibriVox audiobooks (archive.org) are stored in
// Cache Storage so they play offline and with the screen off. Nothing about the learner is sent: these are
// plain file downloads. The cache name does not start with "fluent365-", so app updates keep it.
import type { Audiobook, AudioIndex } from "./types";

export const AUDIO_CACHE = "f365-audio-v1";

/** Same-site file URL (works under any GitHub Pages sub-path). */
export const siteUrl = (path: string) => new URL(`./data/${path}`, location.href).href;
export const bookChapterUrl = (b: Audiobook, file: string) => `https://archive.org/download/${b.archive}/${encodeURIComponent(file)}`;

export async function isCached(url: string) {
  try { return !!(await (await caches.open(AUDIO_CACHE)).match(url)); } catch { return false; }
}

/** A playable URL: the stored copy when there is one (works offline), otherwise the network URL. */
export async function playableUrl(url: string) {
  try {
    const hit = await (await caches.open(AUDIO_CACHE)).match(url);
    if (hit) return URL.createObjectURL(await hit.blob());
  } catch { /* no Cache Storage: stream instead */ }
  return url;
}

export type Item = { url: string; bytes: number; group: string };

/** Every downloadable recording: lesson MP3s, then each audiobook chapter. */
export function allItems(a: AudioIndex): Item[] {
  const lessons = Object.values(a.tts).map((t) => ({ url: siteUrl(t.file), bytes: t.bytes, group: "lessons" }));
  const books = Object.entries(a.books).flatMap(([id, b]) => b.chapters.map((ch) => ({ url: bookChapterUrl(b, ch.file), bytes: ch.bytes, group: id })));
  return [...lessons, ...books];
}

/** Which items are already stored. */
export async function cachedSet(items: Item[]) {
  const out = new Set<string>();
  try {
    const cache = await caches.open(AUDIO_CACHE);
    const keys = new Set((await cache.keys()).map((r) => r.url));
    for (const it of items) if (keys.has(it.url)) out.add(it.url);
  } catch { /* nothing stored */ }
  return out;
}

/** Download items one by one (skipping stored ones), with two retries each. Stops when `signal` aborts. */
export async function download(items: Item[], onProgress: (doneBytes: number, url?: string) => void, signal?: AbortSignal) {
  const cache = await caches.open(AUDIO_CACHE);
  let done = 0;
  for (const it of items) {
    if (signal?.aborted) throw new DOMException("Stopped", "AbortError");
    if (await cache.match(it.url)) { done += it.bytes; onProgress(done, it.url); continue; }
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(it.url, { signal, mode: "cors" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        await cache.put(it.url, new Response(blob, { headers: { "Content-Type": "audio/mpeg", "Content-Length": String(blob.size) } }));
        lastError = null;
        break;
      } catch (e) {
        lastError = e;
        if (signal?.aborted) throw e;
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
    if (lastError) throw lastError;
    done += it.bytes;
    onProgress(done, it.url);
  }
}

export async function remove(items: Item[]) {
  const cache = await caches.open(AUDIO_CACHE);
  await Promise.all(items.map((it) => cache.delete(it.url)));
}

/** App files (pages, data, books, covers) that the service worker should have; adds any that are missing. */
export async function ensureAppFiles(onProgress?: (done: number, total: number) => void) {
  const list: string[] = await (await fetch(new URL("./offline-files.json", location.href), { cache: "no-store" })).json();
  const name = (await caches.keys()).filter((k) => k.startsWith("fluent365-")).pop() ?? "fluent365-manual";
  const cache = await caches.open(name);
  let i = 0;
  for (const f of list) {
    const url = new URL(f, location.href).href;
    if (!(await cache.match(url, { ignoreSearch: true }))) {
      const res = await fetch(url);
      if (res.ok) await cache.put(url, res);
    }
    onProgress?.(++i, list.length);
  }
  return list.length;
}

/** Ask the browser to keep the downloads (not clear them when space is low). */
export async function keepStorage() {
  try { return (await navigator.storage?.persist?.()) ?? false; } catch { return false; }
}
export async function storageEstimate() {
  try { const e = await navigator.storage?.estimate?.(); return e ? { used: e.usage ?? 0, quota: e.quota ?? 0 } : null; } catch { return null; }
}
export const mb = (bytes: number) => (bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / 1e6))} MB`);
