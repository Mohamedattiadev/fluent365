// Read: opens straight into the current book of the reading ladder. One tap away: the book's word list
// (words you saved from it + new words coming up), chapters and the book list. Finishing shows a summary.
import { useEffect, useState } from "react";
import { cardView } from "../components/Vocab";
import { Reader, shortTitle } from "../components/Reader";
import { Icon, toast } from "../components/ui";
import { loadBook, type Content } from "../lib/content";
import { addCards, dueCardKeys, markKnown } from "../lib/learning";
import { currentBook, dailyTarget, readToday, remainingWords, savedFromBook, setPosition, wordsAhead } from "../lib/reading";
import { getState, today as todayKey, useApp } from "../lib/store";
import type { Book, BookInfo } from "../lib/types";
import { navigate } from "../router";
import { Back } from "./Learn";

export const Cover = ({ info, size = 56 }: { info: BookInfo; size?: number }) =>
  info.cover ? <img className="cover" src={`./data/${info.cover}`} alt="" width={size} height={Math.round(size * 1.33)} loading="lazy" /> : <span className="cover cover-blank" style={{ width: size, height: Math.round(size * 1.33) }} aria-hidden><Icon name="reading" /></span>;

export function ReadScreen({ c, path }: { c: Content; path: string[] }) {
  const s = useApp((x) => x);
  const [sub, id] = path;
  if (!c.books.length) return <p>No books available.</p>;
  const cur = currentBook(s, c.books);
  const readerPath = (b: BookInfo) => (b.id === cur?.id ? "/read" : `/read/book/${b.id}`);

  if (sub === "books") return <Books c={c} />;
  if ((sub === "words" || sub === "done") && id) {
    const info = c.books.find((b) => b.id === id);
    return info ? <BookWords c={c} info={info} done={sub === "done"} back={readerPath(info)} /> : <p>Book not found.</p>;
  }
  if (sub === "chapters" && id) {
    const info = c.books.find((b) => b.id === id);
    if (!info) return <p>Book not found.</p>;
    const at = s.reading.books[info.id]?.block ?? 0;
    return (
      <div className="read-page">
        <Back to={readerPath(info)} />
        <div className="book-hero"><Cover info={info} size={72} /><div><h1>{info.title}</h1><p className="lede" style={{ margin: 0 }}>{info.author} · {info.year} · ≈ {info.level} · {info.words.toLocaleString()} words</p></div></div>
        <ul className="list">{info.chapters.map((ch) => (
          <li key={ch.start}><button className="rowbtn" onClick={() => { setPosition(info.id, ch.start); navigate(readerPath(info)); }}>
            <span className="grow">{ch.title}</span>{ch.start <= at && at > 0 && <span className="small muted">read</span>}<Icon name="chevron" size={20} />
          </button></li>
        ))}</ul>
      </div>
    );
  }

  const info = (sub === "book" && id ? c.books.find((b) => b.id === id) : null) ?? cur;
  if (!info) return <div><h1>All books finished</h1><p className="lede">You have read the whole ladder.</p><button className="btn outline" onClick={() => navigate("/read/books")}>See the books</button></div>;
  const n = c.books.indexOf(info) + 1;
  const saved = savedFromBook(s, info.id).length;
  return (
    <div className="read-page">
      <Reader key={info.id} c={c} info={info} target={dailyTarget(s, c.books)} onDone={() => navigate(`/read/done/${info.id}`)} actions={<>
        <button className="btn quiet" onClick={() => navigate(`/read/words/${info.id}`)} aria-label={`Words from ${info.title}: ${saved} saved`} title="Book words"><Icon name="words" />{saved ? <span className="num">{saved}</span> : null}</button>
        <button className="btn quiet" onClick={() => navigate(`/read/chapters/${info.id}`)} aria-label={`Chapters of ${info.title}`} title="Chapters"><Icon name="list" /></button>
        <button className="btn quiet" onClick={() => navigate("/read/books")} aria-label={`All books (this is book ${n} of ${c.books.length})`} title="All books"><Icon name="reading" /></button>
      </>} />
    </div>
  );
}

/** A book's word list: what you saved from it, and the new words coming up. `done` = the summary after reading. */
function BookWords({ c, info, done, back }: { c: Content; info: BookInfo; done: boolean; back: string }) {
  const s = useApp((x) => x);
  const [book, setBook] = useState<Book | null>(null);
  const [ahead, setAhead] = useState<ReturnType<typeof wordsAhead>>([]);
  useEffect(() => {
    void loadBook(info.id).then((b) => { setBook(b); setAhead(wordsAhead(b, Math.min(getState().reading.books[info.id]?.block ?? 0, b.blocks.length), c, getState(), 2000, 12)); });
  }, [info.id, c]);
  const keys = savedFromBook(s, info.id);
  const due = new Set(dueCardKeys());
  const dueHere = keys.filter((k) => due.has(k)).length;
  const read = readToday(s);
  const pct = Math.round(((s.reading.books[info.id]?.words ?? 0) / info.words) * 100);
  const savedToday = keys.filter((k) => s.cards[k]?.added === todayKey()).length;

  return (
    <div className="read-page">
      <button className="btn quiet back" onClick={() => navigate(back)}><Icon name="back" size={20} /> {done ? "Keep reading" : shortTitle(info.title)}</button>
      <div className="book-hero">
        <Cover info={info} size={72} />
        <div>
          <p className="overline" style={{ margin: 0 }}>{done ? "Reading done for now" : "Book words"}</p>
          <h1 style={{ margin: "2px 0" }}>{info.title}</h1>
          <p className="small muted" style={{ margin: 0 }}>{pct}% read · today {read.toLocaleString()} / {dailyTarget(s, c.books).toLocaleString()} words{done ? ` · ${savedToday} saved today` : ""}</p>
        </div>
      </div>

      <h2 className="section-title">Saved from this book <span className="muted">· {keys.length}</span></h2>
      {dueHere > 0 && <button className="btn primary" style={{ marginBottom: 12 }} onClick={() => navigate("/learn/words/review")}>Review {dueHere} due {dueHere === 1 ? "word" : "words"}</button>}
      {keys.length === 0 ? <p className="muted small">Tap any word while reading and choose "Add to my words". It is then shown in colour in every book.</p> : (
        <ul className="list">
          {keys.map((k) => {
            const v = cardView(k, s.cards[k], c);
            if (!v) return null;
            return <li key={k}><div className="word-row"><span className="saved-dot" aria-hidden /><span className="grow" style={{ minWidth: 0 }}><span style={{ display: "block" }}>{v.w}</span><span className="small muted ellipsis" style={{ display: "block" }}>{v.d ?? (v.ex ? `“${v.ex}”` : "")}</span></span>{due.has(k) && <span className="pill">due</span>}</div></li>;
          })}
        </ul>
      )}

      <h2 className="section-title">{done ? "Coming up next time" : "New words ahead"} <span className="muted">· {ahead.length}</span></h2>
      <p className="small muted" style={{ marginTop: 0 }}>Words in the next pages that are new for your level. Add the ones you want to learn; mark the ones you know.</p>
      {!book ? <p className="muted small">Loading…</p> : ahead.length === 0 ? <p className="muted small">No new words in the next pages.</p> : (
        <ul className="list">
          {ahead.map((a) => {
            const key = String(a.v.id);
            const added = !!s.cards[key], known = !!s.known[key];
            return (
              <li key={key}><div className="word-row">
                <span className="grow" style={{ minWidth: 0 }}><span style={{ display: "block" }}>{a.v.w} <span className="small muted">{a.n > 1 ? `· ${a.n}×` : ""}</span></span><span className="small muted ellipsis" style={{ display: "block" }}>{a.v.d}</span></span>
                {added ? <span className="small muted"><Icon name="check" size={16} /> added</span> : known ? <span className="small muted">known</span> : (
                  <>
                    <button className="btn quiet" onClick={() => markKnown(key)}>Know it</button>
                    <button className="btn outline" onClick={() => { addCards([key]); toast(`"${a.v.w}" added`); }}>Add</button>
                  </>
                )}
              </div></li>
            );
          })}
        </ul>
      )}
      {done && <button className="btn big primary" style={{ marginTop: 16 }} onClick={() => navigate("/")}>Back to Today</button>}
    </div>
  );
}

function Books({ c }: { c: Content }) {
  const s = useApp((x) => x);
  const cur = currentBook(s, c.books);
  const total = c.books.reduce((n, b) => n + b.words, 0);
  const done = total - remainingWords(s, c.books);
  return (
    <div className="read-page">
      <Back to="/read" />
      <h1>Reading ladder</h1>
      <p className="lede">{c.books.length} classic books, easiest first, about {Math.round(total / 1000)},000 words in the 365-day plan. {done.toLocaleString()} words read so far.</p>
      <ul className="list">
        {c.books.map((b) => {
          const p = s.reading.books[b.id];
          return (
            <li key={b.id}><button className="rowbtn" onClick={() => navigate(b.id === cur?.id ? "/read" : `/read/book/${b.id}`)}>
              <Cover info={b} size={44} />
              <span className="grow"><span style={{ display: "block" }}>{b.title}</span><span className="small muted">{b.id === cur?.id ? "Now reading · " : ""}{b.author} · ≈ {b.level} · {Math.round(b.words / 1000)}k words</span></span>
              {p?.finished ? <span className="status"><Icon name="check" size={18} /> Done</span> : p ? <span className="small muted num">{Math.round((p.words / b.words) * 100)}%</span> : null}
              <Icon name="chevron" size={20} />
            </button></li>
          );
        })}
      </ul>
      <p className="small muted">Public-domain texts (Project Gutenberg transcriptions, taken from Bo-ok). Covers: Project Gutenberg and Wikimedia Commons. Levels are rough estimates. The English is 100+ years old: good for reading volume, while Study now covers modern IELTS-style texts.</p>
    </div>
  );
}
