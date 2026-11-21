// Book reader for the reading ladder: one page (~350 words) at a time, tap a word to look it up
// in Fluent365's word list and save it to your reviews. Works offline (books are precached).
// Read Along (like Apple Books): ▶ plays the computer-voice audiobook from this page; the sentence being read is
// marked, the word being spoken underlined, and the page turns by itself (exact Edge word times).
import { useEffect, useRef, useState } from "react";
import { ping } from "../lib/activity";
import { loadBook, type Content } from "../lib/content";
import { addCards } from "../lib/learning";
import { lastAt, loadTiming, useEdgeBooks, type Timing } from "../lib/edgebooks";
import * as player from "../lib/player";
import { bookWordsNow, cardKeyFor, cleanWord, countWords, loadBookWords, lookupWord, wordInfo, pageAt, previousPageStart, readToday, recordPage, setPosition, tagBook, wordIndex, wordsAhead } from "../lib/reading";
import { getState, useApp } from "../lib/store";
import type { Book, BookInfo, VocabItem } from "../lib/types";
import { bookTracks } from "../screens/Listen";
import { Xlate, xlateNote } from "./Vocab";
import { ActionBar, Icon, Loading, Progress, speak, stopSpeaking, toast } from "./ui";

export { lookupWord };

/** Short book title for tight places ("The Wonderful Wizard of Oz" → "Wonderful Wizard of Oz"). */
export const shortTitle = (t: string) => t.replace(/^The /, "");

export function Reader({ c, info, target, onDone, actions }: { c: Content; info: BookInfo; target: number; onDone?: () => void; actions?: React.ReactNode }) {
  useEffect(() => { void loadBookWords(); }, []); // ready before the first tap
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
  // Read Along: the computer-voice audiobook of this book, when there is one.
  const edge = useEdgeBooks();
  const eb = edge?.books[info.id];
  const pl = player.usePlayer();
  const tr = player.current();
  const along = tr?.key.startsWith(`ebook:${info.id}:`) ? Number(tr.key.split(":")[2]) : -1;
  const [timing, setTiming] = useState<{ ch: number; t: Timing } | null>(null);
  useEffect(() => {
    if (along < 0 || !book || !eb?.chapters[along] || timing?.ch === along) return;
    let live = true;
    void loadTiming(book, eb.chapters[along]).then((t) => { if (live) setTiming({ ch: along, t }); }).catch(() => undefined);
    return () => { live = false; };
  }, [along, book, eb, timing?.ch]);
  const ts = along >= 0 && timing?.ch === along ? timing.t.sentences : null;
  const si = ts ? lastAt(ts.map((x) => x.start), pl.time) : -1;
  const cur = ts && si >= 0 && (pl.playing || pl.time > 0) ? ts[si] : null;
  const curWord = cur ? lastAt(cur.words, pl.time) : -1;
  // The page follows the voice: when the sentence being read is on another page, go there.
  const follow = useRef<(block: number) => void>(() => undefined);
  useEffect(() => { if (cur && pl.playing) follow.current(cur.block); }, [cur?.block, pl.playing]); // eslint-disable-line react-hooks/exhaustive-deps
  // Laptop: ← / → turn the page (the handlers are refreshed on every render through the ref).
  const keys = useRef<{ next?: () => void; back?: () => void }>({});
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = (e.target as HTMLElement)?.tagName;
      if (e.ctrlKey || e.metaKey || e.altKey || t === "INPUT" || t === "TEXTAREA" || document.querySelector(".fp")) return;
      if (e.key === "ArrowRight") { e.preventDefault(); keys.current.next?.(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); keys.current.back?.(); }
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, []);
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
  keys.current = { next: finished ? undefined : next, back: start > 0 ? back : undefined };
  follow.current = (block: number) => {
    if (block >= page.start && block < page.end) return;
    if (block >= page.end && block < pageAt(book!, page.end).end) { recordPage(book!, info, page.start, page.end); ping("reading"); window.scrollTo({ top: 0 }); }
    else setPosition(info.id, block);
  };
  const chapterIndex = Math.max(0, info.chapters.reduce((k, ch, n) => (ch.start <= page.start ? n : k), 0));
  const canAlong = !!eb?.chapters[chapterIndex];
  async function readAlong() {
    if (along >= 0) { player.toggle(); return; }
    stopSpeaking();
    const tracks = bookTracks(c, info.id, edge, "computer");
    let at = 0;
    try {
      const t = await loadTiming(book!, eb!.chapters[chapterIndex]);
      const first = t.sentences.find((x) => x.block >= page.start);
      at = first ? Math.max(0, first.start - 0.15) : 0;
    } catch { /* offline without the timing file: from the chapter start */ }
    player.play(tracks, chapterIndex, at);
    ping("listening");
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
        <span className="grow" />
        {actions}
        <b className="reader-title">{info.title}</b>
      </div>
      <div className="thin-bar"><Progress value={pos.words / info.words} label={`${Math.round((pos.words / info.words) * 100)}% of ${info.title}${chapter ? `, ${chapter.title}` : ""}`} /></div>
      <p className="small muted reader-meta">{Math.round((pos.words / info.words) * 100)}% of the book · today {today.toLocaleString()} / {target.toLocaleString()} words{reachedTarget ? " · target reached" : ""}</p>
      <p className="small muted legend" aria-label="How words are marked: saved words are coloured, new words for your level have a dotted underline">
        <span className="book-text-sample"><span className="w saved">word</span></span> saved · <span className="book-text-sample"><span className="w ahead-w">word</span></span> new for you · tap any word
      </p>
      {ahead && ahead.length > 0 && (
        <details className="ahead">
          <summary>New words ahead <span className="muted">· {ahead.length}</span></summary>
          <div className="ahead-chips">{ahead.map((a) => <button key={a.v.id} className={`chip ${cards[String(a.v.id)] ? "on" : ""}`} onClick={() => setPick({ word: a.v.w, sentence: a.sentence })}>{a.v.w}</button>)}</div>
        </details>
      )}
      <div className="book-text" onClick={onTap}>
        {book.blocks.slice(page.start, page.end).map((b, i) =>
          b.type === "h2" ? <h3 key={i} className={cur?.block === page.start + i ? "ra-h" : undefined}>{b.text}</h3> : <p key={i}>{(() => {
            let n = -1;
            const on = cur?.block === page.start + i ? cur : null;
            return b.text.split(/(\s+)/).map((t, k) => {
              if (!/\S/.test(t)) return t;
              n++;
              const key = cardKeyFor(index, t);
              let cls = cards[key] ? "w saved" : aheadIds.has(key) ? "w ahead-w" : "w";
              if (on && n >= on.firstToken && n < on.firstToken + on.words.length) cls += n - on.firstToken === curWord ? " ra-s ra-w" : " ra-s";
              return <span key={k} className={cls}>{t}</span>;
            });
          })()}</p>,
        )}
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        {canAlong
          ? <button className="btn tonal" onClick={() => void readAlong()} aria-label={along >= 0 && pl.playing ? "Pause reading along" : "Listen and read along from this page"}><Icon name={along >= 0 && pl.playing ? "pause" : "play"} filled /> {along >= 0 ? (pl.playing ? "Pause" : "Continue listening") : "Listen along"}</button>
          : <button className="btn quiet" onClick={() => { stopSpeaking(); speak(pageText, { rate: 0.95 }); ping("listening"); }}><Icon name="audio" /> Read this page aloud</button>}
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

/** Word card: definition, listen, add to reviews. Also used by the full-screen player (long-press a word). */
export function WordSheet({ index, pick, bookId, saved, onClose }: { c: Content; index: Map<string, VocabItem>; pick: { word: string; sentence: string }; bookId?: string; saved: (key: string) => boolean; onClose: () => void }) {
  const [bw, setBw] = useState(bookWordsNow);
  useEffect(() => { if (!bw) void loadBookWords().then(setBw); }, [bw]);
  const { v, extra } = wordInfo(index, pick.word, bw);
  const clean = extra?.w ?? pick.word.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
  const customKey = `c:${extra?.w ?? cleanWord(pick.word)}`;
  const key = v ? String(v.id) : customKey;
  const isSaved = saved(key);
  function save() {
    if (v) addCards([key]);
    else addCards([customKey], { [customKey]: { w: clean.toLowerCase(), ex: pick.sentence, source: bookId ? "Saved while reading" : "Saved while listening", ...(extra && { d: extra.d, pos: extra.pos, tr: extra.tr, ar: extra.ar, trSrc: "wiktionary" }) } });
    if (bookId) tagBook(key, bookId);
    toast(`"${v?.w ?? clean}" added to your reviews`);
    onClose();
  }
  return (
    <div className="sheet" role="dialog" aria-label={`Word: ${clean}`}>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="grow">
          <p className="sheet-word">{v?.w ?? clean}</p>
          {v?.pos && <p className="small muted" style={{ margin: 0 }}>{v.pos}{v.lvl ? ` · ≈ ${v.lvl}` : ""}</p>}
          {!v && extra?.pos && <p className="small muted" style={{ margin: 0 }}>{extra.pos}</p>}
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
      </div>
      {v?.d && <p className="sheet-def">{v.d}</p>}
      {v && <Xlate tr={v.tr} ar={v.ar} note={xlateNote(v.trSrc, "")} />}
      {!v && extra?.d && <p className="sheet-def">{extra.d}</p>}
      {!v && extra && <Xlate tr={extra.tr} ar={extra.ar} note="Wiktionary · may be another meaning" />}
      {v?.d || extra?.d ? null : <p className="small muted sheet-def">{bw ? "No meaning found for this word. You can still save it with its sentence." : "Looking up…"}</p>}
      <p className="small muted sheet-ex"><i>"{pick.sentence}"</i></p>
      <div className="sheet-actions">
        <button className="btn tonal" onClick={() => { stopSpeaking(); speak(v?.w ?? clean, { rate: 0.85 }); }} aria-label={`Listen to the word: ${clean}`}><Icon name="audio" size={18} /> Word</button>
        <button className="btn tonal" onClick={() => { stopSpeaking(); speak(pick.sentence, { rate: 0.9 }); }} aria-label="Listen to the sentence"><Icon name="audio" size={18} /> Sentence</button>
        {isSaved ? <span className="btn saved-tag" role="status"><Icon name="check" size={18} /> Saved</span> : <button className="btn primary" onClick={save}><Icon name="check" size={18} /> Add</button>}
      </div>
    </div>
  );
}
