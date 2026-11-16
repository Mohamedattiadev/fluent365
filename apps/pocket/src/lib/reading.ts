// The reading ladder: 8 public-domain books, easiest first, finished within the 365-day plan.
// Progress is stored per book as the next block (paragraph) to read and the words read so far.
import { dayNumber } from "./session";
import { getState, today, update, type AppState } from "./store";
import type { Book, BookInfo } from "./types";

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
