// Text that goes with the recording on the Listen page.
// Lesson recordings: one line per spoken line, with exact start times (index.json `starts`).
// Audiobooks: the LibriVox chapter is matched to the book's chapter by title; the place inside the chapter
// is an estimate (time elapsed ÷ chapter length → the same share of the chapter's words).
import type { Audiobook, Book } from "./types";

export interface Line { text: string; speaker?: string }

/** Index of the line being spoken at `time` (last start ≤ time). */
export function lineAt(starts: number[], time: number) {
  let i = 0;
  while (i + 1 < starts.length && starts[i + 1] <= time + 0.05) i++;
  return i;
}

const norm = (s: string) => s.toLowerCase().replace(/\\/g, "").replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();
const audioKey = (title: string) => norm(title.replace(/^\d+\s*-\s*/, "").replace(/,?\s*part\s*\d+\s*$/i, ""));
const words = (t: string) => (t.match(/[\p{L}\p{N}'’-]+/gu) ?? []).length;

/** Same title despite small spelling differences ("Some One"/"Someone", "Bascombe"/"Boscombe"). */
function similar(key: string, head: string) {
  if (head.replace(/ /g, "").includes(key.replace(/ /g, ""))) return true;
  const hw = new Set(head.split(" ")), kw = key.split(" ");
  return kw.length >= 2 && kw.filter((w) => hw.has(w)).length / kw.length >= 0.6;
}

/** For each audio chapter: the book block range it covers and which share of that range (from–to, 0–1). */
export function mapChapters(book: Book, audio: Audiobook) {
  const heads = book.blocks.map((b, i) => (b.type === "h2" ? i : -1)).filter((i) => i >= 0);
  const ch = audio.chapters;
  // 1. By title ("A Scandal in Bohemia" → "I. A SCANDAL IN BOHEMIA"), in order.
  const hit: number[] = [];
  let from = 0;
  for (const c of ch) {
    const k = audioKey(c.title);
    const generic = /^(chapter )?(\d+|[ivxlc]+)$/.test(k) || k.length < 4;
    const j = generic ? -1 : heads.findIndex((h, n) => n >= from && similar(k, norm(book.blocks[h].text)));
    if (j < 0) { hit.length = 0; break; }
    hit.push(j); from = j;
  }
  let groups: { start: number; end: number }[];
  if (hit.length === ch.length) {
    const used = [...new Set(hit)];
    const range = (j: number) => ({ start: heads[j], end: heads[used[used.indexOf(j) + 1]] ?? book.blocks.length });
    groups = hit.map(range);
  } else if (heads.length === ch.length) {
    groups = heads.map((h, i) => ({ start: h, end: heads[i + 1] ?? book.blocks.length }));
  } else {
    // 3. No usable match: spread the whole book over the whole recording by time.
    const total = ch.reduce((n, c) => n + c.seconds, 0) || 1;
    let t = 0;
    return ch.map((c) => { const r = { start: 0, end: book.blocks.length, from: t / total, to: (t + c.seconds) / total }; t += c.seconds; return r; });
  }
  // Several audio parts on one book chapter ("In the Garden, Part 1/2"): split it by their lengths.
  return groups.map((g, i) => {
    const same = groups.map((x, n) => (x.start === g.start ? n : -1)).filter((n) => n >= 0);
    const total = same.reduce((n, k) => n + ch[k].seconds, 0) || 1;
    const before = same.filter((k) => k < i).reduce((n, k) => n + ch[k].seconds, 0);
    return { ...g, from: before / total, to: (before + ch[i].seconds) / total };
  });
}

/** Sentences of one audio chapter's text, each with the share (0–1) of the chapter where it starts. */
export function chapterSentences(book: Book, audio: Audiobook, index: number) {
  const m = mapChapters(book, audio)[index];
  if (!m) return [];
  const blocks = book.blocks.slice(m.start, m.end).filter((b) => b.type === "p");
  const all = blocks.flatMap((b) => splitSentences(b.text));
  const total = all.reduce((n, s) => n + words(s), 0) || 1;
  const lo = m.from * total, hi = m.to * total;
  const out: { text: string; at: number }[] = [];
  let w = 0;
  for (const s of all) {
    const n = words(s);
    if (w + n > lo && w < hi) out.push({ text: s, at: Math.max(0, (w - lo) / (hi - lo || 1)) });
    w += n;
  }
  return out;
}

/** Index of the sentence at a share (0–1) of the chapter. */
export function sentenceAt(list: { at: number }[], share: number) {
  let i = 0;
  while (i + 1 < list.length && list[i + 1].at <= share) i++;
  return i;
}

/** Sentences, without breaking after "Mr." / "Mrs." / "Dr." / "St.". */
export function splitSentences(text: string) {
  const parts = (text.match(/[^.!?]+[.!?]+["”’)]*\s*|[^.!?]+$/g) ?? [text]).map((x) => x.trim()).filter(Boolean);
  const out: string[] = [];
  for (const x of parts) {
    if (out.length && /\b(Mr|Mrs|Ms|Dr|St|Mt|Jr|Sr)\.$/.test(out[out.length - 1])) out[out.length - 1] += " " + x;
    else out.push(x);
  }
  return out;
}
