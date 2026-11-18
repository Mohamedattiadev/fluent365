// Listen: background audio for the metro and the bus. The audiobook of your current ladder book (computer voices
// with text that follows word by word, or the LibriVox human reader: a switch per book) and the lesson recordings (generated on the laptop with Microsoft Edge neural voices). Plays with the
// screen off, with lock-screen controls. Download once and it works offline.
// One card at the top (continue / now playing → opens the full-screen player), then compact lists with
// what you have heard, then the books. Downloads are small per-chapter buttons; everything at once is in Settings.
import { useEffect, useState } from "react";
import { bookOf, Controls, Extras, LyricsCard, QueueList, RATES, Scrubber, time, TranscriptView, useTranscript } from "../components/FullPlayer";
import { WordSheet } from "../components/Reader";
import { CourseUnitView, LessonStepView } from "../components/Lessons";
import { Icon, Segmented, toast, useWide } from "../components/ui";
import { allItems, bookChapterUrl, cachedSet, download, keepStorage, mb, siteUrl, voiceFor, type Item, type Voice } from "../lib/audio";
import { edgeUrl, useEdgeBooks, type EdgeIndex } from "../lib/edgebooks";
import { loadCourse, type Content } from "../lib/content";
import * as player from "../lib/player";
import { currentBook, wordIndex } from "../lib/reading";
import { getState, update, useApp } from "../lib/store";
import type { Course } from "../lib/types";
import { navigate } from "../router";
import { Back } from "./Learn";

const NONE: Record<string, true> = {};
const hours = (s: number) => (s >= 3600 ? `${(s / 3600).toFixed(1)} h` : `${Math.round(s / 60)} min`);
/** Mobile data (when the browser tells us): big downloads ask for a second tap. */
const onCellular = () => { const n = navigator as Navigator & { connection?: { type?: string; saveData?: boolean } }; return n.connection?.type === "cellular" || !!n.connection?.saveData; };

/** Tracks for one ladder book's audiobook, in the chosen voice (computer voices when there is no choice yet). */
export function bookTracks(c: Content, id: string, edge: EdgeIndex | null = null, voice?: Voice): player.Track[] {
  const b = c.audio.books[id];
  const info = c.books.find((x) => x.id === id);
  if (!info) return [];
  const cover = info.cover ? `./data/${info.cover}` : undefined;
  if (voiceFor(voice ?? getState().listening.voice, edge, c.audio, id) === "computer" && edge?.books[id]) {
    return edge.books[id].chapters.map((ch, i) => ({ key: `ebook:${id}:${i}`, title: ch.title, artist: `${info.title} · computer voices`, album: info.title, url: edgeUrl(ch.file), cover }));
  }
  if (!b) return [];
  return b.chapters.map((ch, i) => ({ key: `book:${id}:${i}`, title: ch.title.replace(/^\d+\s*-\s*/, ""), artist: `${info.title} · read by ${b.reader}`, album: info.title, url: bookChapterUrl(b, ch.file), cover }));
}
/** Tracks for the lesson recordings, in lesson order. */
export function lessonTracks(c: Content): player.Track[] {
  return c.lessons.filter((l) => c.audio.tts[`lesson-${l.number}`]).map((l) => ({ key: `tts:lesson-${l.number}`, title: l.title, artist: `Fluent365 · lesson ${l.number} · ${l.topic}`, album: "Fluent365 lessons", url: siteUrl(c.audio.tts[`lesson-${l.number}`].file) }));
}

/** Download a few files right here (one chapter, one book), with a progress line. */
function useDownloads(c: Content) {
  const [stored, setStored] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Record<string, number>>({});
  const edge = useEdgeBooks();
  const voice = useApp((s) => s.listening.voice);
  const refresh = () => void cachedSet(allItems(c.audio, edge, voice)).then(setStored);
  useEffect(refresh, [c, edge, voice]); // eslint-disable-line react-hooks/exhaustive-deps
  async function get(id: string, items: Item[]) {
    const todo = items.filter((i) => !stored.has(i.url));
    const total = todo.reduce((n, i) => n + i.bytes, 0) || 1;
    setBusy((b) => ({ ...b, [id]: 0 }));
    await keepStorage();
    try {
      await download(todo, (done) => setBusy((b) => ({ ...b, [id]: done / total })));
      toast("Downloaded: plays offline");
    } catch {
      toast(navigator.onLine ? "The download stopped. Tap again to continue." : "You are offline. Tap again on Wi-Fi.");
    } finally {
      setBusy((b) => { const n = { ...b }; delete n[id]; return n; });
      refresh();
    }
  }
  return { stored, busy, get };
}
type Downloads = ReturnType<typeof useDownloads>;

export function ListenScreen({ c, path }: { c: Content; path: string[] }) {
  const lessons = useApp((s) => s.lessons);
  const coursework = useApp((s) => s.coursework);
  const st = useApp((s) => s);
  const p = player.usePlayer();
  const [tests, setTests] = useState<Course | null>(null);
  const dl = useDownloads(c);
  const edge = useEdgeBooks();
  const wide = useWide("(min-width: 1100px)");
  useEffect(() => { void loadCourse("ielts-listening-tests").then(setTests).catch(() => undefined); }, []);
  const [sub, a, b] = path;
  if (sub === "lesson" && a && b) return <div><Back to="/listen" /><LessonStepView c={c} lesson={Number(a)} step={Number(b)} onDone={() => navigate("/listen")} /></div>;
  if (sub === "test" && a) return <div><Back to="/listen" /><CourseUnitView courseId="ielts-listening-tests" unitId={a} onDone={() => navigate("/listen")} /></div>;

  const book = currentBook(st, c.books);
  const items = allItems(c.audio, edge, st.listening.voice);
  const lessonList = lessonTracks(c);
  const cur = player.current();
  const pos = st.listening.pos;
  const heard = st.listening.done ?? {};
  const left = items.filter((i) => !dl.stored.has(i.url));

  // Nothing playing yet: offer to continue where you stopped (or start the current book).
  const lastKey = st.listening.last;
  const resumeQueue = (): [player.Track[], number] => {
    if (lastKey && /^e?book:/.test(lastKey)) { const [kind, id, i] = lastKey.split(":"); return [bookTracks(c, id, edge, kind === "ebook" ? "computer" : "human"), Number(i)]; }
    if (lastKey?.startsWith("tts:")) { const i = lessonList.findIndex((t) => t.key === lastKey); if (i >= 0) return [lessonList, i]; }
    return [book ? bookTracks(c, book.id, edge) : lessonList, 0];
  };
  const [rq, ri] = resumeQueue();
  const hero = cur ?? rq[ri];
  // The next lesson to listen to: the one you stopped in, else the first one not heard yet.
  const nextLesson = Math.max(0, lessonList.findIndex((t) => !heard[t.key]));
  const books = [...c.books.filter((x) => x.id === book?.id), ...c.books.filter((x) => x.id !== book?.id)].filter((x) => c.audio.books[x.id] || edge?.books[x.id]);

  return (
    <div className="listen">
      <h1>Listen</h1>
      <div className="listen-cols">
        <div className="listen-main">
          {hero && (
            <div className="resume-card">
              <button className="resume-open" onClick={() => { if (!cur) player.play(rq, ri); if (!wide) player.open(); }} aria-label={`${cur ? "Open the player" : "Play"}: ${hero.title}`}>
                {hero.cover ? <img className="cover" src={hero.cover} alt="" width={56} height={74} /> : <span className="cover cover-blank" style={{ width: 56, height: 74 }}><Icon name="listening" /></span>}
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="overline" style={{ display: "block", margin: 0 }}>{cur ? (p.loading ? "Loading…" : p.playing ? "Now playing" : "Paused") : lastKey ? "Continue listening" : "Start listening"}</span>
                  <span className="ellipsis" style={{ display: "block", fontWeight: 500 }}>{hero.title}</span>
                  <span className="small muted ellipsis" style={{ display: "block" }}>{hero.album ?? hero.artist}</span>
                </span>
              </button>
              <button className="play-fab" onClick={() => (cur ? player.toggle() : player.play(rq, ri))} aria-label={cur && p.playing ? "Pause" : "Play"}><Icon name={cur && p.playing ? "pause" : "play"} size={28} filled /></button>
              {cur && <div className="mini-bar" style={{ width: `${p.duration ? (p.time / p.duration) * 100 : 0}%` }} aria-hidden />}
            </div>
          )}

          {cur && !wide && <LyricsCard c={c} />}

          <h2 className="section-title">Lesson recordings <span className="muted">· {lessonList.filter((t) => heard[t.key]).length} of {lessonList.length} heard</span></h2>
          {lessonList.length > 0 ? (
            <>
              <button className="btn tonal continue-btn" onClick={() => player.play(lessonList, nextLesson)}><Icon name="play" size={20} filled /> <span className="ellipsis">Continue: Lesson {c.lessons.find((l) => lessonList[nextLesson].key === `tts:lesson-${l.number}`)?.number} · {lessonList[nextLesson].title}</span></button>
              <ul className="list tracks">
                {c.lessons.map((l) => {
                  const i = lessonList.findIndex((t) => t.key === `tts:lesson-${l.number}`);
                  if (i < 0) return null;
                  const t = lessonList[i];
                  const on = cur?.key === t.key;
                  const step = l.kinds.indexOf("listen");
                  const rec = c.audio.tts[`lesson-${l.number}`];
                  const done = !!heard[t.key];
                  const share = done ? 1 : (on ? p.time : pos[t.key] ?? 0) / (rec.seconds || 1);
                  return (
                    <li key={l.number} className={on ? "playing" : undefined}><div className="track">
                      <button className="rowbtn" onClick={() => (on ? player.toggle() : player.play(lessonList, i))} aria-label={`${on && p.playing ? "Pause" : "Play"} lesson ${l.number}: ${l.title}${done ? ", heard" : ""}`}>
                        <Icon name={on && p.playing ? "pause" : "play"} filled={on} />
                        <span className="grow ellipsis"><span className="muted num">{l.number}.</span> {l.title}</span>
                        <span className="small muted num track-meta">{done ? <Icon name="check" size={18} label="Heard" /> : time(rec.seconds)}</span>
                      </button>
                      {step >= 0 && <button className="icon-btn" onClick={() => navigate(`/listen/lesson/${l.number}/${step}`)} aria-label={`Questions for lesson ${l.number}${lessons[l.number]?.done.includes(step) ? " (done)" : ""}`}><Icon name={lessons[l.number]?.done.includes(step) ? "done" : "quiz"} size={22} /></button>}
                      {share > 0.01 && <span className="track-bar" style={{ width: `${Math.min(1, share) * 100}%` }} aria-hidden />}
                    </div></li>
                  );
                })}
              </ul>
            </>
          ) : <p className="muted small">Lesson recordings are not available in this version.</p>}

          <h2 className="section-title">Books</h2>
          <div className="books-list">
            {books.map((x) => <BookChapters key={x.id} c={c} id={x.id} dl={dl} edge={edge} current={x.id === book?.id} />)}
          </div>

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

          <button className="btn quiet offline-link" onClick={() => navigate("/settings/offline")}>
            <Icon name={left.length ? "download" : "offline"} size={18} /> {left.length ? `Download everything for offline (${mb(left.reduce((n, i) => n + i.bytes, 0))}, use Wi-Fi)` : "Everything is downloaded: works offline"}
          </button>
          <p className="small muted" style={{ marginTop: 8 }}>Audiobooks: computer voices (Microsoft Edge neural voices; the text follows word by word) or human readers (LibriVox volunteers, public domain, from the Internet Archive). Lesson recordings: computer voices, not human readers.</p>
        </div>
        {wide && <NowPanel c={c} />}
      </div>
    </div>
  );
}

function BookChapters({ c, id, dl, edge, current }: { c: Content; id: string; dl: Downloads; edge: EdgeIndex | null; current?: boolean }) {
  const p = player.usePlayer();
  const pos = useApp((s) => s.listening.pos);
  const heard = useApp((s) => s.listening.done) ?? NONE;
  const [open, setOpen] = useState(false);
  const [sure, setSure] = useState(false);
  const pref = useApp((s) => s.listening.voice);
  const voice = voiceFor(pref, edge, c.audio, id);
  const human = c.audio.books[id];
  const info = c.books.find((x) => x.id === id)!;
  const tracks = bookTracks(c, id, edge, voice);
  const chapters = voice === "computer" ? edge!.books[id].chapters : human.chapters;
  const b = { seconds: chapters.reduce((n, x) => n + x.seconds, 0), chapters };
  const cur = player.current();
  // A chapter's files: the recording (+ its timing file for computer voices).
  const files = (i: number): Item[] => voice === "computer"
    ? [{ url: tracks[i].url, bytes: chapters[i].bytes, group: id }, { url: edgeUrl(edge!.books[id].chapters[i].timing), bytes: Math.round(chapters[i].seconds * 25), group: id }]
    : [{ url: tracks[i].url, bytes: chapters[i].bytes, group: id }];
  const all = tracks.flatMap((_, i) => files(i));
  const have = tracks.filter((t) => dl.stored.has(t.url)).length;
  const done = tracks.filter((t) => heard[t.key]).length;
  const leftBytes = all.filter((x) => !dl.stored.has(x.url)).reduce((n, x) => n + x.bytes, 0);
  function getBook() {
    if (onCellular() && !sure) { setSure(true); toast(`You seem to be on mobile data. ${mb(leftBytes)}: tap again to download anyway.`); return; }
    setSure(false);
    void dl.get(id, all);
  }
  return (
    <section className="book-audio">
      <button className="book-audio-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        {info.cover ? <img className="cover" src={`./data/${info.cover}`} alt="" width={36} height={48} /> : null}
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="ellipsis" style={{ display: "block", fontWeight: 500 }}>{info.title}{current ? <span className="pill" style={{ marginLeft: 8 }}>Reading now</span> : null}</span>
          <span className="small muted">{hours(b.seconds)} · {done ? `${done}/${tracks.length} heard · ` : ""}{have === tracks.length ? "downloaded" : have ? `${have}/${tracks.length} downloaded` : `${tracks.length} chapters`}</span>
        </span>
        <Icon name="chevron" size={20} />
      </button>
      {open && (
        <>
          {human && edge?.books[id] ? (
            <div className="book-voice"><Segmented label="Voice" value={voice} options={[["computer", "Computer"], ["human", "Human"]]}
              onChange={(v: Voice) => { update((s) => ({ listening: { ...s.listening, voice: v } })); toast(v === "computer" ? "Computer voices: the text follows word by word" : `Human reader: ${human.reader} (LibriVox)`); }} /></div>
          ) : null}
          <p className="small muted book-audio-sub">{voice === "computer" ? "Microsoft Edge neural voices: a narrator, the characters in other voices; the text follows word by word" : `Read by ${human.reader} (LibriVox)`}{voice === "computer" && edge && !edge.books[id].complete ? ` · ${chapters.length} chapters so far` : ""}</p>
          <ul className="list tracks">
            {tracks.map((t, i) => {
              const on = cur?.key === t.key;
              const isDone = !!heard[t.key];
              const share = isDone ? 1 : (on ? p.time : pos[t.key] ?? 0) / (b.chapters[i].seconds || 1);
              const k = `${id}:${i}`;
              return (
                <li key={t.key} className={on ? "playing" : undefined}><div className="track">
                  <button className="rowbtn" onClick={() => (on ? player.toggle() : player.play(tracks, i))} aria-label={`${on && p.playing ? "Pause" : "Play"} ${t.title}${isDone ? ", heard" : ""}`}>
                    <Icon name={on && p.playing ? "pause" : "play"} filled={on} />
                    <span className="grow ellipsis">{t.title}</span>
                    <span className="small muted num track-meta">{isDone ? <Icon name="check" size={18} label="Heard" /> : time(b.chapters[i].seconds)}</span>
                  </button>
                  {dl.stored.has(t.url) ? <span className="icon-btn" aria-hidden title="Downloaded"><Icon name="downloaded" size={20} /></span>
                    : k in dl.busy ? <span className="icon-btn small num" role="status" aria-label="Downloading">{Math.round(dl.busy[k] * 100)}%</span>
                    : <button className="icon-btn" onClick={() => void dl.get(k, files(i))} aria-label={`Download only this chapter (${mb(b.chapters[i].bytes)})`}><Icon name="download" size={20} /></button>}
                  {share > 0.01 && <span className="track-bar" style={{ width: `${Math.min(1, share) * 100}%` }} aria-hidden />}
                </div></li>
              );
            })}
          </ul>
          {have < tracks.length && (
            id in dl.busy
              ? <p className="small muted" role="status">Downloading the book… {Math.round(dl.busy[id] * 100)}%</p>
              : <button className="btn quiet" onClick={getBook}><Icon name="download" size={18} /> {sure ? "Tap again: download on mobile data" : `Download the whole book · ${mb(leftBytes)} (Wi-Fi)`}</button>
          )}
        </>
      )}
    </section>
  );
}

/** Laptop Listen page, right column: what is playing and its transcript (the controls are in the bottom bar). */
function NowPanel({ c }: { c: Content }) {
  const tr = player.current();
  const t = useTranscript(c, tr?.key);
  const cards = useApp((s) => s.cards);
  const [word, setWord] = useState<{ word: string; sentence: string } | null>(null);
  const [list, setList] = useState(false);
  if (!tr) return <aside className="listen-now empty"><Icon name="listening" size={40} /><p className="muted">Pick a recording on the left. Its text appears here and follows the voice.</p></aside>;
  return (
    <aside className="listen-now" aria-label="Now playing">
      <div className="np-head">
        {tr.cover ? <img className="cover" src={tr.cover} alt="" width={48} height={64} /> : <span className="cover cover-blank" style={{ width: 48, height: 64 }}><Icon name="listening" /></span>}
        <div className="grow" style={{ minWidth: 0 }}><p className="overline" style={{ margin: 0 }}>Now playing</p><p className="np-title ellipsis">{tr.title}</p><p className="small muted ellipsis" style={{ margin: 0 }}>{tr.artist}</p></div>
      </div>
      {list ? <div className="fp-text fp-list"><QueueList onPick={() => setList(false)} /></div> : t ? <TranscriptView c={c} t={t} onWord={setWord} /> : <div className="fp-text fp-empty"><p className="muted">No text for this recording.</p></div>}
      <p className="fp-note small muted">{t?.book ? "Place in the text is estimated · " : t ? "Click a sentence to jump · " : ""}hold a word to save it</p>
      <Extras t={t} onList={() => setList(!list)} />
      {word && <WordSheet c={c} index={wordIndex(c)} pick={word} bookId={bookOf(tr.key)} saved={(k) => !!cards[k]} onClose={() => setWord(null)} />}
    </aside>
  );
}

/** A small bar above the bottom navigation while something plays (hidden on Listen and in Study now).
 *  Tap it to open the full-screen player. */
export function MiniPlayer() {
  const p = player.usePlayer();
  const t = player.current();
  const wide = useWide();
  if (!t) return null;
  // Laptop: a full-width player bar (Spotify desktop): title left, controls and scrubber centre, speed right.
  if (wide) return (
    <div className="mini-player player-bar" role="region" aria-label="Player">
      <button className="mini-main" onClick={() => (matchMedia("(min-width: 1100px)").matches ? navigate("/listen") : player.open())} aria-label={`Show the text: ${t.title}`}>
        {t.cover ? <img className="cover" src={t.cover} alt="" width={36} height={48} /> : <Icon name="listening" />}
        <span className="grow" style={{ minWidth: 0 }}><span className="ellipsis" style={{ display: "block", fontWeight: 500 }}>{t.title}</span><span className="small muted ellipsis" style={{ display: "block" }}>{t.album ?? t.artist}</span></span>
      </button>
      <div className="pb-centre"><Controls big={false} /><Scrubber /></div>
      <div className="pb-end">
        <button className="btn quiet" onClick={() => { const i = RATES.indexOf(p.rate); player.setRate(RATES[(i + 1) % RATES.length]); }} aria-label={`Speed ${p.rate}×, click to change`}>{p.rate}×</button>
        <button className="icon-btn" onClick={player.stop} aria-label="Stop and close the player"><Icon name="close" /></button>
      </div>
    </div>
  );
  return (
    <div className="mini-player" role="region" aria-label="Now playing">
      <button className="mini-main" onClick={player.open} aria-label={`Open the player: ${t.title}`}>
        {t.cover ? <img className="cover" src={t.cover} alt="" width={30} height={40} /> : <Icon name="listening" />}
        <span className="grow" style={{ minWidth: 0 }}><span className="ellipsis" style={{ display: "block", fontWeight: 500 }}>{t.title}</span><span className="small muted ellipsis" style={{ display: "block" }}>{t.album ?? t.artist}</span></span>
      </button>
      <button className="icon-btn" onClick={player.toggle} aria-label={p.playing ? "Pause" : "Play"}><Icon name={p.playing ? "pause" : "play"} filled /></button>
      <button className="icon-btn" onClick={player.stop} aria-label="Stop and close the player"><Icon name="close" /></button>
      <div className="mini-bar" style={{ width: `${p.duration ? (p.time / p.duration) * 100 : 0}%` }} aria-hidden />
    </div>
  );
}
