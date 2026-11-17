// Listen: background audio for the metro and the bus. The audiobook of your current ladder book (LibriVox,
// public domain) and the lesson recordings (generated on the laptop with free Piper voices). Plays with the
// screen off, with lock-screen controls. Download once and it works offline.
import { useEffect, useState } from "react";
import { CourseUnitView, LessonStepView } from "../components/Lessons";
import { Icon } from "../components/ui";
import { allItems, bookChapterUrl, cachedSet, mb, siteUrl } from "../lib/audio";
import { loadBook, loadCourse, loadLesson, type Content } from "../lib/content";
import { chapterSentences, lineAt, sentenceAt, type Line } from "../lib/transcript";
import * as player from "../lib/player";
import { currentBook } from "../lib/reading";
import { useApp } from "../lib/store";
import type { AudioBlock, Course } from "../lib/types";
import { navigate } from "../router";
import { Back } from "./Learn";

const time = (s: number) => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`; };
const hours = (s: number) => (s >= 3600 ? `${(s / 3600).toFixed(1)} h` : `${Math.round(s / 60)} min`);

/** Tracks for one ladder book's audiobook. */
export function bookTracks(c: Content, id: string): player.Track[] {
  const b = c.audio.books[id];
  const info = c.books.find((x) => x.id === id);
  if (!b || !info) return [];
  return b.chapters.map((ch, i) => ({ key: `book:${id}:${i}`, title: ch.title.replace(/^\d+\s*-\s*/, ""), artist: `${info.title} · read by ${b.reader}`, album: info.title, url: bookChapterUrl(b, ch.file), cover: info.cover ? `./data/${info.cover}` : undefined }));
}
/** Tracks for the lesson recordings, in lesson order. */
export function lessonTracks(c: Content): player.Track[] {
  return c.lessons.filter((l) => c.audio.tts[`lesson-${l.number}`]).map((l) => ({ key: `tts:lesson-${l.number}`, title: l.title, artist: `Fluent365 · lesson ${l.number} · ${l.topic}`, album: "Fluent365 lessons", url: siteUrl(c.audio.tts[`lesson-${l.number}`].file) }));
}

export function ListenScreen({ c, path }: { c: Content; path: string[] }) {
  const lessons = useApp((s) => s.lessons);
  const coursework = useApp((s) => s.coursework);
  const st = useApp((s) => s);
  const p = player.usePlayer();
  const [tests, setTests] = useState<Course | null>(null);
  const [stored, setStored] = useState<Set<string>>(new Set());
  const [showBooks, setShowBooks] = useState(false);
  useEffect(() => { void loadCourse("ielts-listening-tests").then(setTests).catch(() => undefined); }, []);
  useEffect(() => { void cachedSet(allItems(c.audio)).then(setStored); }, [c, p.index, p.playing]);
  const [sub, a, b] = path;
  if (sub === "lesson" && a && b) return <div><Back to="/listen" /><LessonStepView c={c} lesson={Number(a)} step={Number(b)} onDone={() => navigate("/listen")} /></div>;
  if (sub === "test" && a) return <div><Back to="/listen" /><CourseUnitView courseId="ielts-listening-tests" unitId={a} onDone={() => navigate("/listen")} /></div>;

  const book = currentBook(st, c.books);
  const items = allItems(c.audio);
  const allStored = items.length > 0 && items.every((i) => stored.has(i.url));
  const lessonList = lessonTracks(c);
  const cur = player.current();

  // Nothing playing yet: offer to continue where you stopped (or start the current book).
  const lastKey = st.listening.last;
  const resumeQueue = (): [player.Track[], number] => {
    if (lastKey?.startsWith("book:")) { const [, id, i] = lastKey.split(":"); return [bookTracks(c, id), Number(i)]; }
    if (lastKey?.startsWith("tts:")) { const i = lessonList.findIndex((t) => t.key === lastKey); if (i >= 0) return [lessonList, i]; }
    return [book ? bookTracks(c, book.id) : lessonList, 0];
  };
  const [rq, ri] = resumeQueue();

  return (
    <div className="listen">
      <h1>Listen</h1>
      {cur ? <NowPlaying c={c} /> : rq[ri] && (
        <button className="resume-card" onClick={() => player.play(rq, ri)}>
          {rq[ri].cover ? <img className="cover" src={rq[ri].cover} alt="" width={56} height={74} /> : <span className="cover cover-blank" style={{ width: 56, height: 74 }}><Icon name="listening" /></span>}
          <span className="grow" style={{ minWidth: 0 }}>
            <span className="overline" style={{ display: "block", margin: 0 }}>{lastKey ? "Continue listening" : "Start listening"}</span>
            <span className="ellipsis" style={{ display: "block", fontWeight: 500 }}>{rq[ri].title}</span>
            <span className="small muted ellipsis" style={{ display: "block" }}>{rq[ri].artist}</span>
          </span>
          <span className="play-fab" aria-hidden><Icon name="play" size={28} filled /></span>
        </button>
      )}

      <button className="offline-row" onClick={() => navigate("/settings/offline")}>
        <Icon name={allStored ? "offline" : "download"} />
        <span className="grow">{allStored ? "Everything is downloaded: works offline" : "Download for offline"}<span className="small muted" style={{ display: "block" }}>{allStored ? "Lessons and all audiobooks are on this device" : `Lessons and audiobooks · ${mb(items.filter((i) => !stored.has(i.url)).reduce((n, i) => n + i.bytes, 0))} to go`}</span></span>
        <Icon name="chevron" size={20} />
      </button>

      {book && c.audio.books[book.id] && <BookChapters c={c} id={book.id} stored={stored} />}

      <h2 className="section-title">Lesson recordings <span className="muted">· {lessonList.length}</span></h2>
      {lessonList.length > 0 ? (
        <>
          <button className="btn outline" style={{ marginBottom: 8 }} onClick={() => player.play(lessonList, 0)}><Icon name="play" size={18} /> Play all</button>
          <ul className="list">
            {c.lessons.map((l) => {
              const i = lessonList.findIndex((t) => t.key === `tts:lesson-${l.number}`);
              if (i < 0) return null;
              const t = lessonList[i];
              const on = cur?.key === t.key;
              const step = l.kinds.indexOf("listen");
              const rec = c.audio.tts[`lesson-${l.number}`];
              return (
                <li key={l.number} className={on ? "playing" : undefined}><div className="track">
                  <button className="rowbtn" onClick={() => (on ? player.toggle() : player.play(lessonList, i))} aria-label={`${on && p.playing ? "Pause" : "Play"} ${l.title}`}>
                    <Icon name={on && p.playing ? "pause" : "play"} filled={on} />
                    <span className="grow" style={{ minWidth: 0 }}><span className="ellipsis" style={{ display: "block" }}>{l.title}</span><span className="small muted">{l.level} · {time(rec.seconds)}{stored.has(t.url) ? " · downloaded" : ""}{lessons[l.number]?.done.includes(step) ? " · questions done" : ""}</span></span>
                  </button>
                  {step >= 0 && <button className="btn quiet" onClick={() => navigate(`/listen/lesson/${l.number}/${step}`)}>Questions</button>}
                </div></li>
              );
            })}
          </ul>
        </>
      ) : <p className="muted small">Lesson recordings are not available in this version.</p>}

      <h2 className="section-title">IELTS listening practice</h2>
      <ul className="list">
        {(tests?.units ?? []).map((u) => (
          <li key={u.id}><button className="rowbtn" onClick={() => navigate(`/listen/test/${u.id}`)}>
            <Icon name={coursework[`ielts-listening-tests/${u.id}`]?.done ? "check" : "timer"} />
            <span className="grow"><span style={{ display: "block" }}>{u.title}</span><span className="small muted">{u.goal}</span></span>
            <Icon name="chevron" size={20} />
          </button></li>
        ))}
      </ul>
      <p className="small muted">Practice scores only, not official IELTS results.</p>

      <button className="btn quiet" onClick={() => setShowBooks(!showBooks)} aria-expanded={showBooks}>{showBooks ? "Hide" : "Show"} all audiobooks</button>
      {showBooks && c.books.filter((x) => x.id !== book?.id && c.audio.books[x.id]).map((x) => <BookChapters key={x.id} c={c} id={x.id} stored={stored} compact />)}
      <p className="small muted" style={{ marginTop: 16 }}>Audiobooks: LibriVox volunteers, public domain, from the Internet Archive. Lesson recordings: generated with Piper voices trained on public-domain recordings.</p>
    </div>
  );
}

function BookChapters({ c, id, stored }: { c: Content; id: string; stored: Set<string>; compact?: boolean }) {
  const p = player.usePlayer();
  const pos = useApp((s) => s.listening.pos);
  const [open, setOpen] = useState(false);
  const b = c.audio.books[id];
  const info = c.books.find((x) => x.id === id)!;
  const tracks = bookTracks(c, id);
  const cur = player.current();
  const have = tracks.filter((t) => stored.has(t.url)).length;
  return (
    <section className="book-audio">
      <button className="book-audio-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        {info.cover ? <img className="cover" src={`./data/${info.cover}`} alt="" width={44} height={58} /> : null}
        <span className="grow" style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontWeight: 500 }}>{info.title}</span>
          <span className="small muted">Read by {b.reader} · {hours(b.seconds)} · {have === tracks.length ? "downloaded" : have ? `${have}/${tracks.length} downloaded` : mb(b.bytes)}</span>
        </span>
        <Icon name="chevron" size={20} />
      </button>
      {open && (
        <ul className="list">
          {tracks.map((t, i) => {
            const on = cur?.key === t.key;
            const done = (pos[t.key] ?? 0) > 0;
            return (
              <li key={t.key} className={on ? "playing" : undefined}><button className="rowbtn" onClick={() => (on ? player.toggle() : player.play(tracks, i))}>
                <Icon name={on && p.playing ? "pause" : "play"} filled={on} />
                <span className="grow" style={{ minWidth: 0 }}><span className="ellipsis" style={{ display: "block" }}>{t.title}</span><span className="small muted">{time(b.chapters[i].seconds)}{done ? ` · stopped at ${time(pos[t.key])}` : ""}</span></span>
                {stored.has(t.url) && <Icon name="downloaded" size={18} label="Downloaded" />}
              </button></li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** The big player on the Listen page. */
function NowPlaying({ c }: { c: Content }) {
  const p = player.usePlayer();
  const t = player.current();
  if (!t) return null;
  return (
    <section className="now-playing" aria-label="Now playing">
      <div className="np-top">
        {t.cover ? <img className="cover" src={t.cover} alt="" width={72} height={96} /> : <span className="cover cover-blank" style={{ width: 72, height: 96 }}><Icon name="listening" /></span>}
        <div className="grow" style={{ minWidth: 0 }}>
          <p className="overline" style={{ margin: 0 }}>{p.loading ? "Loading…" : p.playing ? "Playing" : "Paused"}</p>
          <p className="np-title">{t.title}</p>
          <p className="small muted" style={{ margin: 0 }}>{t.artist}</p>
        </div>
      </div>
      <input className="np-seek" type="range" min={0} max={Math.max(1, Math.floor(p.duration))} value={Math.floor(p.time)} onChange={(e) => player.seekTo(Number(e.target.value))} aria-label="Position" style={{ ["--pct" as string]: `${p.duration ? (p.time / p.duration) * 100 : 0}%` }} />
      <div className="np-times small muted"><span>{time(p.time)}</span><span>-{time(Math.max(0, p.duration - p.time))}</span></div>
      <div className="np-controls">
        <button className="icon-btn" onClick={player.prev} aria-label="Previous"><Icon name="prev" /></button>
        <button className="icon-btn" onClick={() => player.seek(-10)} aria-label="Back 10 seconds"><Icon name="rew" /></button>
        <button className="play-fab big" onClick={player.toggle} aria-label={p.playing ? "Pause" : "Play"}><Icon name={p.playing ? "pause" : "play"} size={34} filled /></button>
        <button className="icon-btn" onClick={() => player.seek(10)} aria-label="Forward 10 seconds"><Icon name="fwd" /></button>
        <button className="icon-btn" onClick={player.next} aria-label="Next"><Icon name="next" /></button>
      </div>
      <div className="np-rate" role="group" aria-label="Speed">
        {[0.8, 0.9, 1, 1.15, 1.3].map((r) => <button key={r} className={`chip ${p.rate === r ? "on" : ""}`} aria-pressed={p.rate === r} onClick={() => player.setRate(r)}>{r}×</button>)}
      </div>
      {p.error && <p className="small" style={{ color: "var(--md-error)", margin: "8px 0 0" }}>{p.error}</p>}
      <Transcript c={c} trackKey={t.key} />
    </section>
  );
}

/** A small bar above the bottom navigation while something plays (hidden on Listen and in Study now). */
export function MiniPlayer() {
  const p = player.usePlayer();
  const t = player.current();
  if (!t) return null;
  return (
    <div className="mini-player" role="region" aria-label="Now playing">
      <button className="mini-main" onClick={() => navigate("/listen")} aria-label={`Open the player: ${t.title}`}>
        {t.cover ? <img className="cover" src={t.cover} alt="" width={30} height={40} /> : <Icon name="listening" />}
        <span className="grow" style={{ minWidth: 0 }}><span className="ellipsis" style={{ display: "block", fontWeight: 500 }}>{t.title}</span><span className="small muted ellipsis" style={{ display: "block" }}>{t.album ?? t.artist}</span></span>
      </button>
      <button className="icon-btn" onClick={player.toggle} aria-label={p.playing ? "Pause" : "Play"}><Icon name={p.playing ? "pause" : "play"} filled /></button>
      <button className="icon-btn" onClick={player.stop} aria-label="Stop and close the player"><Icon name="close" /></button>
      <div className="mini-bar" style={{ width: `${p.duration ? (p.time / p.duration) * 100 : 0}%` }} aria-hidden />
    </div>
  );
}

/** Two or three lines of text under the player: the line being spoken (highlighted) and the next one.
 *  Lesson recordings use exact start times; audiobooks show the book text at an estimated place. */
function Transcript({ c, trackKey }: { c: Content; trackKey: string }) {
  const p = player.usePlayer();
  const [data, setData] = useState<{ key: string; lines: Line[]; starts?: number[] } | null>(null);
  useEffect(() => {
    let live = true;
    const [kind, a, b] = trackKey.split(":");
    if (kind === "tts" && a.startsWith("lesson-")) {
      const rec = c.audio.tts[a];
      void loadLesson(Number(a.slice(7))).then((l) => {
        let block: AudioBlock | undefined;
        const walk = (o: unknown): void => { if (block || !o || typeof o !== "object") return; if ((o as AudioBlock).type === "audio" && (o as AudioBlock).lines) { block = o as AudioBlock; return; } Object.values(o).forEach(walk); };
        walk(l);
        if (live && block && rec) setData({ key: trackKey, starts: rec.starts, lines: block.lines.map((x) => ({ text: x.text, speaker: block!.speakers[x.speaker]?.name ?? x.speaker })) });
      }).catch(() => undefined);
    } else if (kind === "book" && c.audio.books[a]) {
      void loadBook(a).then((book) => {
        if (!live) return;
        const list = chapterSentences(book, c.audio.books[a], Number(b));
        setData({ key: trackKey, lines: list.map((x) => ({ text: x.text })), starts: list.map((x) => x.at) });
      }).catch(() => undefined);
    }
    return () => { live = false; setData(null); };
  }, [trackKey, c]);
  if (!data || data.key !== trackKey || !data.lines.length || !data.starts) return null;
  const book = trackKey.startsWith("book:");
  const i = book ? sentenceAt(data.starts.map((at) => ({ at })), p.duration ? p.time / p.duration : 0) : lineAt(data.starts, p.time);
  const show = data.lines.slice(i, i + 2);
  return (
    <div className="transcript" aria-live="off">
      <p className="overline">{book ? "Book text · place estimated" : "Transcript"}</p>
      {show.map((l, k) => (
        <p key={i + k} className={k === 0 ? "now" : "next"}>{l.speaker && <b>{l.speaker}: </b>}{l.text}</p>
      ))}
    </div>
  );
}
