// Today: a ring that fills as you study, the Study now button, this week's days, a word of the day,
// and one small progress line. Black and white; it moves (count-ups, ring fill) unless motion is reduced.
import { useEffect, useMemo, useState } from "react";
import { AudioIcon } from "../components/Vocab";
import { ActionBar, CountUp, Icon, toast } from "../components/ui";
import type { Content } from "../lib/content";
import { addCards, dueCardKeys } from "../lib/learning";
import { currentBook } from "../lib/reading";
import { dayNumber } from "../lib/session";
import { getState, today, update, useApp } from "../lib/store";
import type { DayLog, VocabItem } from "../lib/types";
import { navigate } from "../router";
import { ensureSession } from "./Session";

export const studied = (d?: DayLog) => !!d && (d.active >= 300 || d.sessionDone);

/** Monday–Sunday of the current week, with whether each day was studied. */
function week(days: Record<string, DayLog>) {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const t = today();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const k = today(d);
    return { k, label: d.toLocaleDateString(undefined, { weekday: "narrow" }), long: d.toLocaleDateString(undefined, { weekday: "long" }), on: studied(days[k]), isToday: k === t, future: k > t };
  });
}
export const daysThisWeek = (days: Record<string, DayLog>) => week(days).filter((d) => d.on).length;

/** Words known well: remembered for 3+ weeks by the scheduler, or marked as already known. */
export const wordsKnown = (s = getState()) => Object.values(s.cards).filter((x) => !x.card.fresh && x.card.stability >= 21).length + Object.keys(s.known).length;

/** The same word all day: a useful word at your level that you don't have yet (chosen from the date). */
function wordOfTheDay(c: Content): VocabItem | undefined {
  const s = getState();
  const start = ({ A2: 300, B1: 800, B2: 1800, C1: 2800 } as const)[s.settings.level] ?? 800;
  const pool = c.vocab.filter((v) => v.d && v.ex && !v.w.includes(" ") && v.r >= start && v.r < start + 2500);
  if (!pool.length) return undefined;
  const key = today();
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  for (let i = 0; i < pool.length; i++) {
    const v = pool[(h + i * 7919) % pool.length];
    if (!s.known[String(v.id)] && (!s.cards[String(v.id)] || s.cards[String(v.id)].added === key)) return v;
  }
  return pool[h % pool.length];
}

function Ring({ value, children }: { value: number; children: React.ReactNode }) {
  const r = 52, len = 2 * Math.PI * r;
  const [shown, setShown] = useState(0);
  useEffect(() => { const t = requestAnimationFrame(() => setShown(value)); return () => cancelAnimationFrame(t); }, [value]);
  return (
    <div className="ring">
      <svg viewBox="0 0 120 120" aria-hidden>
        <circle cx="60" cy="60" r={r} className="track" />
        <circle cx="60" cy="60" r={r} className="fill" strokeDasharray={len} strokeDashoffset={len * (1 - Math.max(0, Math.min(1, shown)))} />
      </svg>
      <div className="ring-in">{children}</div>
    </div>
  );
}

export function Home({ c }: { c: Content }) {
  const settings = useApp((s) => s.settings);
  const session = useApp((s) => s.session);
  const [, force] = useState(0);
  useEffect(() => { if (!session || session.date !== today()) { ensureSession(c); force((x) => x + 1); } }, [c, session]);
  if (!session || session.date !== today()) return null;

  const s = getState();
  const finished = !!session.finished;
  const started = session.index > 0 && !finished;
  const counted = (k: string) => k !== "wrap" && k !== "speak";
  const steps = session.steps.filter((x) => counted(x.kind));
  const total = steps.reduce((n, x) => n + x.minutes, 0);
  const doneMin = finished ? total : session.steps.slice(0, session.index).filter((x) => counted(x.kind)).reduce((n, x) => n + x.minutes, 0);
  const pct = total ? Math.round((doneMin / total) * 100) : 0;
  const due = dueCardKeys().length;
  const onSpeak = session.steps[session.index]?.kind === "speak";
  const nextStep = session.steps[session.index];

  return (
    <div className="today">
      <p className="overline">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })} · Day {dayNumber(s)}</p>
      <h1>{settings.name ? `Hi, ${settings.name}` : "Today"}</h1>

      {/* The next step and why, first; today's progress is a small ring beside it (not a big 0 %). */}
      <section className="next-step" aria-label={finished ? "Today is done" : "Next step"}>
        <div className="grow">
          {finished ? (
            <><p className="overline">Done for today</p><p className="next-title">You did all {steps.length} steps · {total} min</p><p className="next-why">Come back tomorrow: your reviews will be ready.</p></>
          ) : nextStep ? (
            <><p className="overline">{started ? `Next · step ${Math.min(session.index + 1, steps.length)} of ${steps.length}` : "First"}</p>
              <p className="next-title">{nextStep.title} <span className="muted">· {nextStep.minutes} min</span></p>
              <p className="next-why">{nextStep.why}</p></>
          ) : null}
        </div>
        <Ring value={pct / 100}>
          {finished ? <Icon name="check" size={26} /> : <span className="ring-sub"><b>{doneMin}</b>/{total}<br />min</span>}
        </Ring>
      </section>
      <ActionBar>
        {finished ? (
          due > 0
            ? <button className="btn big primary" onClick={() => navigate("/learn/words/review")}>Review {due} more {due === 1 ? "word" : "words"}</button>
            : <button className="btn big outline" onClick={() => { update(() => ({ session: null })); ensureSession(c); navigate("/session"); }}>Study more</button>
        ) : (
          <button className="btn big primary" onClick={() => navigate("/session")} autoFocus>{started ? "Continue" : "Study now"}</button>
        )}
        <p className="study-sub">{finished ? "Done for today. See you tomorrow." : onSpeak ? "Only the optional speaking topic is left" : started ? `Step ${Math.min(session.index + 1, steps.length)} of ${steps.length}` : `About ${total} min · ${steps.length} steps`}</p>
      </ActionBar>

      <div className="today-extras"><TodayExtras c={c} /></div>
    </div>
  );
}

/** This week, the word of the day and one progress line. Under the session on phones; the right-hand panel on laptops. */
export function TodayExtras({ c }: { c: Content }) {
  const days = useApp((s) => s.days);
  const cards = useApp((s) => s.cards);
  const word = useMemo(() => wordOfTheDay(c), [c]);
  const s = getState();
  const days7 = week(days);
  const inReviews = word ? !!cards[String(word.id)] : false;
  const book = currentBook(s, c.books);
  const bookPct = book ? Math.floor(((s.reading.books[book.id]?.words ?? 0) / book.words) * 100) : null;
  return (
    <>
      <div className="week-dots" role="list" aria-label={`Studied ${days7.filter((d) => d.on).length} of 7 days this week`}>
        {days7.map((d, i) => (
          <div key={d.k} role="listitem" className="wd" style={{ animationDelay: `${i * 40}ms` }} aria-label={`${d.long}: ${d.on ? "studied" : d.isToday ? "today" : d.future ? "coming up" : "rest day"}`}>
            <span className={`dot ${d.on ? "on" : ""} ${d.isToday ? "is-today" : ""} ${d.future ? "future" : ""}`}>{d.on ? <Icon name="check" size={14} /> : null}</span>
            <span aria-hidden>{d.label}</span>
          </div>
        ))}
      </div>

      {word && (
        <section className="wotd" aria-label="Word of the day">
          <p className="overline">Word of the day</p>
          <div className="wotd-head">
            <span className="wotd-word">{word.w}</span>
            {word.pos && <span className="small muted">{word.pos}</span>}
            <span className="grow" />
            <AudioIcon text={word.w} label="Listen to the word" />
          </div>
          <p className="wotd-def">{word.d}</p>
          {word.ex && <p className="small muted wotd-ex">“{word.ex}”</p>}
          {inReviews ? <p className="small muted" style={{ margin: 0 }}><Icon name="check" size={16} /> In your reviews</p>
            : <button className="btn quiet" onClick={() => { addCards([String(word.id)]); toast(`"${word.w}" added to your reviews`); }}>Add to my reviews</button>}
        </section>
      )}

      <p className="progress-line">
        <span><CountUp value={wordsKnown(s)} /> words known</span>
        {book && <span>{bookPct}% of {book.title.replace(/^The /, "")}</span>}
      </p>
    </>
  );
}
