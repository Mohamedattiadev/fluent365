// Book reader for the reading ladder: one page (~350 words) at a time, tap a word to look it up
// in Fluent365's word list and save it to your reviews. Works offline (books are precached).
import { useEffect, useState } from "react";
import { ping } from "../lib/activity";
import { loadBook, type Content } from "../lib/content";
import { addCards } from "../lib/learning";
import { cardKeyFor, cleanWord, countWords, lookupWord, pageAt, previousPageStart, readToday, recordPage, setPosition, tagBook, wordIndex, wordsAhead } from "../lib/reading";
import { getState, useApp } from "../lib/store";
import type { Book, BookInfo, VocabItem } from "../lib/types";
import { ActionBar, Icon, Loading, Progress, speak, stopSpeaking, toast } from "./ui";

export { lookupWord };

/** Short book title for tight places ("The Wonderful Wizard of Oz" → "Wonderful Wizard of Oz"). */
export const shortTitle = (t: string) => t.replace(/^The /, "");

export function Reader({ c, info, target, onDone, actions }: { c: Content; info: BookInfo; target: number; onDone?: () => void; actions?: React.ReactNode }) {
  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState(false);
  const stored = useApp((s) => s.reading.books[info.id]); // select the stored object (stable), default below
  const pos = stored ?? { block: 0, words: 0 };
  const today = useApp((s) => readToday(s));
  const cards = useApp((s) => s.cards);
  const [pick, setPick] = useState<{ word: string; sentence: string } | null>(null);
  const index = wordIndex(c);
  // New words in the pages ahead, worked out once when the reader opens (so the list does not jump while reading).
  const [ahead, setAhead] = useState<ReturnType<typeof wordsAhead> | null>(null);
  useEffect(() => { loadBook(info.id).then((b) => { setBook(b); setAhead(wordsAhead(b, Math.min(getState().reading.books[info.id]?.block ?? 0, b.blocks.length), c, getState())); }).catch(() => setError(true)); }, [info.id, c]);
  useEffect(() => () => stopSpeaking(), []);
  if (error) return <p>Could not load this book. Open the app once with internet; after that it works offline.</p>;
  if (!book) return <Loading what="Opening the book…" />;

  const start = Math.min(pos.block, book.blocks.length);
  const finished = !!pos.finished && start >= book.blocks.length;
  const page = pageAt(book, start);
  const chapter = [...info.chapters].reverse().find((ch) => ch.start <= start);
  const pageText = book.blocks.slice(page.start, page.end).map((b) => b.text).join(" ");
  const reachedTarget = today >= target;
  const aheadIds = new Set((ahead ?? []).map((a) => String(a.v.id)));

  function next() {
    recordPage(book!, info, page.start, page.end);
    ping("reading");
    stopSpeaking();
    setPick(null);
    window.scrollTo({ top: 0 });
  }
  function back() {
    setPosition(info.id, previousPageStart(book!, start));
    stopSpeaking();
    setPick(null);
    window.scrollTo({ top: 0 });
  }
  function onTap(e: React.MouseEvent<HTMLElement>) {
    const el = e.target as HTMLElement;
    if (!el.classList.contains("w")) return;
    const para = el.closest("p")?.textContent ?? "";
    const sentence = para.split(/(?<=[.!?])\s+/).find((x) => x.includes(el.textContent ?? "")) ?? para;
    setPick({ word: el.textContent ?? "", sentence: sentence.slice(0, 300) });
    ping("reading");
  }

  if (finished) {
    return (
      <div>
        <h2>You finished {info.title}</h2>
        <p className="muted">{info.words.toLocaleString()} words read. The next book on your ladder is ready.</p>
        <ActionBar><button className="btn big primary" onClick={() => onDone?.()}>Continue <Icon name="arrow" /></button></ActionBar>
      </div>
    );
  }

  return (
    <div className="reader">
      <div className="reader-head">
        {info.cover && <img className="cover" src={`./data/${info.cover}`} alt="" width={22} height={30} />}
        <b className="grow ellipsis">{info.title}</b>
        {actions}
      </div>
      <div className="thin-bar"><Progress value={pos.words / info.words} label={`${Math.round((pos.words / info.words) * 100)}% of ${info.title}${chapter ? `, ${chapter.title}` : ""}`} /></div>
      <p className="small muted reader-meta">{Math.round((pos.words / info.words) * 100)}% of the book · today {today.toLocaleString()} / {target.toLocaleString()} words{reachedTarget ? " · target reached" : ""}{today === 0 ? " · tap a word to look it up" : ""}</p>
      {ahead && ahead.length > 0 && (
        <details className="ahead" open={today === 0}>
          <summary>New words ahead <span className="muted">· {ahead.length}</span></summary>
          <p className="small muted" style={{ margin: "4px 0 8px" }}>Words you will meet in the next pages. Tap one to see it; underlined in the text.</p>
          <div className="ahead-chips">{ahead.map((a) => <button key={a.v.id} className={`chip ${cards[String(a.v.id)] ? "on" : ""}`} onClick={() => setPick({ word: a.v.w, sentence: a.sentence })}>{a.v.w}</button>)}</div>
        </details>
      )}
      <div className="book-text" onClick={onTap}>
        {book.blocks.slice(page.start, page.end).map((b, i) =>
          b.type === "h2" ? <h3 key={i}>{b.text}</h3> : <p key={i}>{b.text.split(/(\s+)/).map((t, k) => {
            if (!/\S/.test(t)) return t;
            const key = cardKeyFor(index, t);
            const cls = cards[key] ? "w saved" : aheadIds.has(key) ? "w ahead-w" : "w";
            return <span key={k} className={cls}>{t}</span>;
          })}</p>,
        )}
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn quiet" onClick={() => { stopSpeaking(); speak(pageText, { rate: 0.95 }); ping("listening"); }}><Icon name="audio" /> Read this page aloud</button>
        {start > 0 && <button className="btn quiet" onClick={back}><Icon name="back" /> Previous page</button>}
      </div>

      {pick && <WordSheet c={c} index={index} pick={pick} bookId={info.id} saved={(k) => !!cards[k]} onClose={() => setPick(null)} />}

      <ActionBar>
        <button className="btn big primary" onClick={next}>Next page <Icon name="arrow" /></button>
        {onDone && <button className="btn quiet" style={{ width: "100%" }} onClick={onDone}>{reachedTarget ? "Done for today · continue" : "Stop here for today"}</button>}
      </ActionBar>
      <span className="sr-only">{countWords(pageText)} words on this page</span>
    </div>
  );
}

function WordSheet({ index, pick, bookId, saved, onClose }: { c: Content; index: Map<string, VocabItem>; pick: { word: string; sentence: string }; bookId: string; saved: (key: string) => boolean; onClose: () => void }) {
  const v = lookupWord(index, pick.word);
  const clean = pick.word.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
  const customKey = `c:${cleanWord(pick.word)}`;
  const key = v ? String(v.id) : customKey;
  const isSaved = saved(key);
  function save() {
    if (v) addCards([key]);
    else addCards([customKey], { [customKey]: { w: clean.toLowerCase(), ex: pick.sentence, source: "Saved while reading" } });
    tagBook(key, bookId);
    toast(`"${v?.w ?? clean}" added to your reviews`);
    onClose();
  }
  return (
    <div className="sheet" role="dialog" aria-label={`Word: ${clean}`}>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="grow">
          <p style={{ fontSize: "var(--fs-lg)", margin: 0 }}>{v?.w ?? clean}</p>
          {v?.pos && <p className="small muted" style={{ margin: 0 }}>{v.pos}{v.lvl ? ` · ≈ ${v.lvl}` : ""}</p>}
        </div>
        <button className="icon-btn" onClick={() => { stopSpeaking(); speak(v?.w ?? clean); }} aria-label={`Listen: ${clean}`}><Icon name="audio" /></button>
        <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
      </div>
      {v?.d ? <p style={{ margin: "8px 0" }}>{v.d}</p> : <p className="small muted" style={{ margin: "8px 0" }}>This word is not in Fluent365's word list, so there is no definition here. You can still save it with this sentence.</p>}
      <p className="small muted" style={{ margin: "0 0 12px" }}><i>"{pick.sentence}"</i></p>
      {isSaved ? <p className="status"><Icon name="check" size={18} /> In your words · shown in colour in every book</p> : <button className="btn primary" onClick={save}>Add to my words</button>}
    </div>
  );
}
