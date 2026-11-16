// Book reader for the reading ladder: one page (~350 words) at a time, tap a word to look it up
// in Fluent365's word list and save it to your reviews. Works offline (books are precached).
import { useEffect, useMemo, useState } from "react";
import { ping } from "../lib/activity";
import { loadBook, type Content } from "../lib/content";
import { addCards } from "../lib/learning";
import { countWords, pageAt, previousPageStart, readToday, recordPage, setPosition } from "../lib/reading";
import { useApp } from "../lib/store";
import type { Book, BookInfo, VocabItem } from "../lib/types";
import { ActionBar, Icon, Loading, Progress, speak, stopSpeaking, toast } from "./ui";

/** Find a word in the word list, trying simple English endings (books → book, studied → study). */
export function lookupWord(index: Map<string, VocabItem>, raw: string): VocabItem | undefined {
  const w = raw.toLowerCase().replace(/[’]/g, "'").replace(/^[^a-z]+|[^a-z]+$/g, "").replace(/'s$/, "");
  if (!w) return undefined;
  const tries = [w];
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

export function Reader({ c, info, target, onDone, actions }: { c: Content; info: BookInfo; target: number; onDone?: () => void; actions?: React.ReactNode }) {
  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState(false);
  const stored = useApp((s) => s.reading.books[info.id]); // select the stored object (stable), default below
  const pos = stored ?? { block: 0, words: 0 };
  const today = useApp((s) => readToday(s));
  const cards = useApp((s) => s.cards);
  const [pick, setPick] = useState<{ word: string; sentence: string } | null>(null);
  const index = useMemo(() => {
    const m = new Map<string, VocabItem>();
    for (const v of c.vocab) if (!v.w.includes(" ") && !m.has(v.w.toLowerCase())) m.set(v.w.toLowerCase(), v);
    return m;
  }, [c]);
  useEffect(() => { loadBook(info.id).then(setBook).catch(() => setError(true)); }, [info.id]);
  useEffect(() => () => stopSpeaking(), []);
  if (error) return <p>Could not load this book. Open the app once with internet; after that it works offline.</p>;
  if (!book) return <Loading what="Opening the book…" />;

  const start = Math.min(pos.block, book.blocks.length);
  const finished = !!pos.finished && start >= book.blocks.length;
  const page = pageAt(book, start);
  const chapter = [...info.chapters].reverse().find((ch) => ch.start <= start);
  const pageText = book.blocks.slice(page.start, page.end).map((b) => b.text).join(" ");
  const reachedTarget = today >= target;

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
        <b className="grow ellipsis">{info.title}</b>
        {actions}
      </div>
      <div className="thin-bar"><Progress value={pos.words / info.words} label={`${Math.round((pos.words / info.words) * 100)}% of ${info.title}${chapter ? `, ${chapter.title}` : ""}`} /></div>
      <p className="small muted reader-meta">{Math.round((pos.words / info.words) * 100)}% of the book · today {today.toLocaleString()} / {target.toLocaleString()} words{reachedTarget ? " · target reached" : ""}{today === 0 ? " · tap a word to look it up" : ""}</p>
      <div className="book-text" onClick={onTap}>
        {book.blocks.slice(page.start, page.end).map((b, i) =>
          b.type === "h2" ? <h3 key={i}>{b.text}</h3> : <p key={i}>{b.text.split(/(\s+)/).map((t, k) => (/\S/.test(t) ? <span key={k} className="w">{t}</span> : t))}</p>,
        )}
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn quiet" onClick={() => { stopSpeaking(); speak(pageText, { rate: 0.95 }); ping("listening"); }}><Icon name="audio" /> Read this page aloud</button>
        {start > 0 && <button className="btn quiet" onClick={back}><Icon name="back" /> Previous page</button>}
      </div>

      {pick && <WordSheet c={c} index={index} pick={pick} saved={(k) => !!cards[k]} onClose={() => setPick(null)} />}

      <ActionBar>
        <button className="btn big primary" onClick={next}>Next page <Icon name="arrow" /></button>
        {onDone && <button className="btn quiet" style={{ width: "100%" }} onClick={onDone}>{reachedTarget ? "Done for today · continue" : "Stop here for today"}</button>}
      </ActionBar>
      <span className="sr-only">{countWords(pageText)} words on this page</span>
    </div>
  );
}

function WordSheet({ index, pick, saved, onClose }: { c: Content; index: Map<string, VocabItem>; pick: { word: string; sentence: string }; saved: (key: string) => boolean; onClose: () => void }) {
  const v = lookupWord(index, pick.word);
  const clean = pick.word.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
  const customKey = `c:${clean.toLowerCase()}`;
  const key = v ? String(v.id) : customKey;
  const isSaved = saved(key);
  function save() {
    if (v) addCards([key]);
    else addCards([customKey], { [customKey]: { w: clean.toLowerCase(), ex: pick.sentence, source: "Saved while reading" } });
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
      {isSaved ? <p className="status"><Icon name="check" size={18} /> Already in your reviews</p> : <button className="btn primary" onClick={save}>Add to my words</button>}
    </div>
  );
}
