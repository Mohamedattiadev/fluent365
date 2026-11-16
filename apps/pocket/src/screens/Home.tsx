// Today: one Study now button and one small progress line. Everything else lives in Learn, Read and Listen.
import { useEffect, useState } from "react";
import type { Content } from "../lib/content";
import { dueCardKeys } from "../lib/learning";
import { currentBook } from "../lib/reading";
import { dayNumber } from "../lib/session";
import { getState, today, update, useApp } from "../lib/store";
import type { DayLog } from "../lib/types";
import { navigate } from "../router";
import { ensureSession } from "./Session";

export const studied = (d?: DayLog) => !!d && (d.active >= 300 || d.sessionDone);

/** Studied days in the current Monday–Sunday week. */
export function daysThisWeek(days: Record<string, DayLog>) {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => today(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i))).filter((k) => studied(days[k])).length;
}

/** Words known well: remembered for 3+ weeks by the scheduler, or marked as already known. */
export const wordsKnown = (s = getState()) => Object.values(s.cards).filter((x) => !x.card.fresh && x.card.stability >= 21).length + Object.keys(s.known).length;

export function Home({ c }: { c: Content }) {
  const settings = useApp((s) => s.settings);
  const session = useApp((s) => s.session);
  const days = useApp((s) => s.days);
  const [, force] = useState(0);
  useEffect(() => { if (!session || session.date !== today()) { ensureSession(c); force((x) => x + 1); } }, [c, session]);
  if (!session || session.date !== today()) return null;

  const s = getState();
  const finished = !!session.finished;
  const started = session.index > 0 && !finished;
  const steps = session.steps.filter((x) => x.kind !== "wrap" && x.kind !== "speak");
  const total = steps.reduce((n, x) => n + x.minutes, 0);
  const due = dueCardKeys().length;
  const book = currentBook(s, c.books);
  const bookPct = book ? Math.floor(((s.reading.books[book.id]?.words ?? 0) / book.words) * 100) : null;
  const now = new Date();

  return (
    <div className="today">
      <p className="overline">{now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })} · Day {dayNumber(s)}</p>
      <h1>{settings.name ? `Hi, ${settings.name}` : "Today"}</h1>
      <section className="study">
        {finished ? (
          <>
            <p className="done-line">Done for today.</p>
            {due > 0
              ? <button className="btn big primary" onClick={() => navigate("/learn/words/review")}>Review {due} more {due === 1 ? "word" : "words"}</button>
              : <button className="btn big outline" onClick={() => { update(() => ({ session: null })); ensureSession(c); navigate("/session"); }}>Study more</button>}
          </>
        ) : (
          <>
            <button className="btn big primary" onClick={() => navigate("/session")} autoFocus>
              {started ? "Continue" : "Study now"}
            </button>
            <p className="study-sub">{!started ? `About ${total} min` : session.steps[session.index]?.kind === "speak" ? "Only the optional speaking topic is left" : `Step ${Math.min(session.index + 1, steps.length)} of ${steps.length}`}</p>
          </>
        )}
      </section>
      <p className="progress-line">
        <span>{daysThisWeek(days)}/7 days this week</span>
        <span>{wordsKnown(s).toLocaleString()} words known</span>
        {book && <span>{bookPct}% of {book.title.replace(/^The /, "")}</span>}
      </p>
    </div>
  );
}
