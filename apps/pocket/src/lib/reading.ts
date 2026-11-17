// The reading ladder: 8 public-domain books, easiest first, finished within the 365-day plan.
// Progress is stored per book as the next block (paragraph) to read and the words read so far.
import { dayNumber } from "./session";
import { getState, today, update, type AppState } from "./store";
import type { Content } from "./content";
import type { Book, BookInfo, VocabItem } from "./types";

export const PAGE_WORDS = 350;
export const READING_WPM = 150; // a comfortable B1–B2 reading speed, used only to estimate minutes

export const countWords = (t: string) => (t.match(/[\p{L}\p{N}'’-]+/gu) ?? []).length;

export const progressOf = (s: AppState, id: string) => s.reading.books[id] ?? { block: 0, words: 0 };

/** The book to read now: the first unfinished book on the ladder. */
export function currentBook(s: AppState, books: BookInfo[]) {
  return books.find((b) => !s.reading.books[b.id]?.finished) ?? null;
}

export function remainingWords(s: AppState, books: BookInfo[]) {
  return books.reduce((n, b) => n + (s.reading.books[b.id]?.finished ? 0 : Math.max(0, b.words - progressOf(s, b.id).words)), 0);
}

/** Words per day so that the whole ladder ends on day 365 (rounded to 50, between 300 and 3,000). */
export function dailyTarget(s: AppState, books: BookInfo[]) {
  const daysLeft = Math.max(1, 365 - dayNumber(s) + 1);
  const raw = remainingWords(s, books) / daysLeft;
  return Math.min(3000, Math.max(300, Math.round(raw / 50) * 50));
}

export const readToday = (s: AppState = getState()) => s.reading.log[today()] ?? 0;

/** A page: whole paragraphs from `start` until about PAGE_WORDS words; a chapter heading starts a new page. */
export function pageAt(book: Book, start: number) {
  let end = start, words = 0;
  while (end < book.blocks.length) {
    const b = book.blocks[end];
    if (b.type === "h2" && end > start) break;
    words += countWords(b.text);
    end++;
    if (words >= PAGE_WORDS) break;
  }
  return { start, end, words };
}

/** Start of the page before `start` (for the Back button). */
export function previousPageStart(book: Book, start: number) {
  let i = start, words = 0;
  while (i > 0 && words < PAGE_WORDS) {
    i--;
    words += countWords(book.blocks[i].text);
    if (book.blocks[i].type === "h2") break;
  }
  return i;
}

/** Save that a page was read: move the position, and count only words beyond the furthest point reached
 *  (re-reading earlier pages never counts twice). */
export function recordPage(book: Book, info: BookInfo, start: number, end: number) {
  update((s) => {
    const cur = progressOf(s, book.id);
    const furthest = cur.max ?? cur.block;
    let counted = 0;
    for (let i = Math.max(start, furthest); i < end; i++) counted += countWords(book.blocks[i].text);
    const finished = end >= book.blocks.length ? cur.finished ?? new Date().toISOString() : cur.finished;
    return {
      reading: {
        ...s.reading,
        current: book.id,
        books: { ...s.reading.books, [book.id]: { block: end, max: Math.max(furthest, end), words: Math.min(info.words, cur.words + counted), finished } },
        log: { ...s.reading.log, [today()]: (s.reading.log[today()] ?? 0) + counted },
      },
    };
  });
}

/** Move the reading position without counting words (Back, or choosing a chapter). */
export function setPosition(id: string, block: number) {
  update((s) => ({ reading: { ...s.reading, current: id, books: { ...s.reading.books, [id]: { ...progressOf(s, id), block } } } }));
}

// ---------- Words in books ----------

/** Find a word in the word list, trying simple English endings (books → book, studied → study). */
export function lookupWord(index: Map<string, VocabItem>, raw: string): VocabItem | undefined {
  const w = cleanWord(raw);
  if (!w) return undefined;
  const tries = [w];
  // Short words are never stemmed ("his" is not "hi", "was" is not "wa").
  if (w.length < 4) return index.get(w);
  if (w.endsWith("ies")) tries.push(w.slice(0, -3) + "y");
  if (w.endsWith("es")) tries.push(w.slice(0, -2));
  if (w.endsWith("s")) tries.push(w.slice(0, -1));
  if (w.endsWith("ied")) tries.push(w.slice(0, -3) + "y");
  if (w.endsWith("ed")) tries.push(w.slice(0, -2), w.slice(0, -1), w.slice(0, -3));
  if (w.endsWith("ing")) tries.push(w.slice(0, -3), w.slice(0, -3) + "e", w.slice(0, -4));
  if (w.endsWith("ly")) tries.push(w.slice(0, -2));
  if (w.endsWith("er")) tries.push(w.slice(0, -2), w.slice(0, -1));
  for (const t of tries) { const v = index.get(t); if (v) return v; }
  return undefined;
}

/** Lower case, curly apostrophes straightened, punctuation and a final 's removed. */
export const cleanWord = (raw: string) => raw.toLowerCase().replace(/[’]/g, "'").replace(/^[^a-z]+|[^a-z]+$/g, "").replace(/'s$/, "");

const indexCache = new WeakMap<Content, Map<string, VocabItem>>();
/** Single words of the word list by spelling (built once per content load). */
export function wordIndex(c: Content) {
  let m = indexCache.get(c);
  if (!m) {
    m = new Map();
    for (const v of c.vocab) if (!v.w.includes(" ") && !m.has(v.w.toLowerCase())) m.set(v.w.toLowerCase(), v);
    indexCache.set(c, m);
  }
  return m;
}

/** The card key for a word in a book: its word-list id, or the custom key used when it is not in the list. */
export function cardKeyFor(index: Map<string, VocabItem>, raw: string) {
  const v = lookupWord(index, raw);
  return v ? String(v.id) : `c:${cleanWord(raw)}`;
}

/** The first rank of "new" words for a level (more frequent words count as already known). */
export const levelStartRank = (s: AppState) => ({ A2: 300, B1: 800, B2: 1800, C1: 2800 } as const)[s.settings.level] ?? 800;

/**
 * New words you are likely to meet in the next `words` words of a book: in the word list, with a meaning,
 * not in your reviews and not marked as known, and not too common for your level. Most frequent first.
 */
export function wordsAhead(book: Book, start: number, c: Content, s: AppState, words = PAGE_WORDS * 4, max = 10) {
  const index = wordIndex(c);
  // Skip words that are very common or below your level: the list would be full of words you know.
  const minRank = levelStartRank(s) + 700;
  const LV = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const minLv = LV.indexOf(s.settings.level);
  const found = new Map<number, { v: VocabItem; n: number; sentence: string }>();
  let seen = 0;
  for (let i = start; i < book.blocks.length && seen < words; i++) {
    const text = book.blocks[i].text;
    seen += countWords(text);
    for (const tok of text.split(/\s+/)) {
      const v = lookupWord(index, tok);
      if (!v || !v.d || v.r < minRank || s.cards[String(v.id)] || s.known[String(v.id)]) continue;
      if (v.lvl && LV.indexOf(v.lvl) < minLv) continue;
      const hit = found.get(v.id);
      if (hit) hit.n++;
      else found.set(v.id, { v, n: 1, sentence: (text.split(/(?<=[.!?])\s+/).find((x) => x.includes(tok)) ?? text).slice(0, 300) });
    }
  }
  return [...found.values()].sort((a, b) => b.n - a.n || b.v.r - a.v.r).slice(0, max);
}

/** Keys of the cards you saved while reading this book, newest first. */
export const savedFromBook = (s: AppState, bookId: string) =>
  Object.entries(s.cards).filter(([, mc]) => mc.book === bookId).sort((a, b) => (a[1].added < b[1].added ? 1 : -1)).map(([k]) => k);

/** Remember which book a saved word came from. */
export function tagBook(key: string, bookId: string) {
  update((s) => (s.cards[key] ? { cards: { ...s.cards, [key]: { ...s.cards[key], book: s.cards[key].book ?? bookId } } } : {}));
}
