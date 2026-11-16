// Read: opens straight into the current book of the reading ladder. Chapters and the book list are one tap away.
import { Reader } from "../components/Reader";
import { Icon } from "../components/ui";
import type { Content } from "../lib/content";
import { currentBook, dailyTarget, remainingWords, setPosition } from "../lib/reading";
import { useApp } from "../lib/store";
import { navigate } from "../router";
import { Back } from "./Learn";

export function ReadScreen({ c, path }: { c: Content; path: string[] }) {
  const s = useApp((x) => x);
  const [sub, id] = path;
  if (!c.books.length) return <p>No books available.</p>;
  const cur = currentBook(s, c.books);

  if (sub === "books") return <Books c={c} />;
  if (sub === "chapters" && id) {
    const info = c.books.find((b) => b.id === id);
    if (!info) return <p>Book not found.</p>;
    const at = s.reading.books[info.id]?.block ?? 0;
    return (
      <div>
        <Back to={info.id === cur?.id ? "/read" : `/read/book/${info.id}`} />
        <h1>{info.title}</h1>
        <p className="lede">{info.author} · {info.year} · ≈ {info.level} · {info.words.toLocaleString()} words</p>
        <ul className="list">{info.chapters.map((ch) => (
          <li key={ch.start}><button className="rowbtn" onClick={() => { setPosition(info.id, ch.start); navigate(info.id === cur?.id ? "/read" : `/read/book/${info.id}`); }}>
            <span className="grow">{ch.title}</span>{ch.start <= at && at > 0 && <span className="small muted">read</span>}<Icon name="chevron" size={20} />
          </button></li>
        ))}</ul>
      </div>
    );
  }

  const info = (sub === "book" && id ? c.books.find((b) => b.id === id) : null) ?? cur;
  if (!info) return <div><h1>All books finished</h1><p className="lede">You have read the whole ladder.</p><button className="btn outline" onClick={() => navigate("/read/books")}>See the books</button></div>;
  const n = c.books.indexOf(info) + 1;
  return (
    <div className="read-page">
      <div className="read-head">
        <span className="small muted">Book {n} of {c.books.length}</span>
        <span className="grow" />
        <button className="btn quiet" onClick={() => navigate(`/read/chapters/${info.id}`)}>Chapters</button>
        <button className="btn quiet" onClick={() => navigate("/read/books")}>All books</button>
      </div>
      <Reader key={info.id} c={c} info={info} target={dailyTarget(s, c.books)} />
    </div>
  );
}

function Books({ c }: { c: Content }) {
  const s = useApp((x) => x);
  const cur = currentBook(s, c.books);
  const total = c.books.reduce((n, b) => n + b.words, 0);
  const done = total - remainingWords(s, c.books);
  return (
    <div>
      <Back to="/read" />
      <h1>Reading ladder</h1>
      <p className="lede">{c.books.length} classic books, easiest first, about {Math.round(total / 1000)},000 words in the 365-day plan. {done.toLocaleString()} words read so far.</p>
      <ul className="list">
        {c.books.map((b, i) => {
          const p = s.reading.books[b.id];
          return (
            <li key={b.id}><button className="rowbtn" onClick={() => navigate(b.id === cur?.id ? "/read" : `/read/book/${b.id}`)}>
              <span className="num muted" style={{ width: 20 }}>{i + 1}</span>
              <span className="grow"><span style={{ display: "block" }}>{b.title}{b.id === cur?.id ? " · now reading" : ""}</span><span className="small muted">{b.author} · ≈ {b.level} · {Math.round(b.words / 1000)}k words</span></span>
              {p?.finished ? <span className="status"><Icon name="check" size={18} /> Done</span> : p ? <span className="small muted num">{Math.round((p.words / b.words) * 100)}%</span> : null}
              <Icon name="chevron" size={20} />
            </button></li>
          );
        })}
      </ul>
      <p className="small muted">Public-domain texts (Project Gutenberg transcriptions, taken from Bo-ok). Levels are rough estimates. The English is 100+ years old: good for reading volume, while Study now covers modern IELTS-style texts.</p>
    </div>
  );
}
