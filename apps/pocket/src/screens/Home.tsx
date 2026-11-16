// "Today", Anki-style: one Study now button (the guided session), then the decks with their counts.
import { useEffect, useState } from "react";
import { Icon } from "../components/ui";
import type { Content } from "../lib/content";
import { dueCardKeys, dueTopics } from "../lib/learning";
import { dayNumber, phaseOf, skillOf } from "../lib/session";
import { getState, today, update, useApp } from "../lib/store";
import type { DayLog } from "../lib/types";
import { navigate } from "../router";
import { ensureSession } from "./Session";

export function Home({ c }: { c: Content }) {
  const settings = useApp((s) => s.settings);
  const session = useApp((s) => s.session);
  const days = useApp((s) => s.days);
  const openMistakes = useApp((s) => s.mistakes.filter((m) => !m.fixed && m.expected).length);
  const [, force] = useState(0);
  useEffect(() => { if (!session || session.date !== today()) { ensureSession(c); force((x) => x + 1); } }, [c, session]);
  if (!session || session.date !== today()) return null;

  const s = getState();
  const finished = !!session.finished;
  const started = session.index > 0 && !finished;
  const steps = session.steps.filter((x) => x.kind !== "wrap");
  const total = session.steps.reduce((n, x) => n + x.minutes, 0);
  const due = dueCardKeys().length;
  const newWords = session.steps.find((x) => x.kind === "pretech")?.ref?.words?.length ?? (session.steps.some((x) => x.kind === "pretech") ? 8 : 0);
  const grammarDue = dueTopics().length;
  const grammarNew = session.steps.some((x) => x.kind === "grammar") ? 1 : 0;
  const reading = session.steps.filter((x) => skillOf(x) === "reading").length;
  const listening = session.steps.filter((x) => skillOf(x) === "listening").length;
  const spokeToday = s.external.some((e) => e.at.startsWith(today()));
  const now = new Date();
  const phase = phaseOf(s);

  const decks: { name: string; icon: string; to: string; due?: number; fresh?: number; note?: string }[] = [
    { name: "Words", icon: "words", to: due ? "/words/review" : "/words", due, fresh: newWords },
    { name: "Grammar", icon: "grammar", to: "/grammar", due: grammarDue, fresh: grammarNew },
    { name: "Reading", icon: "reading", to: "/reading", fresh: reading },
    { name: "Listening", icon: "listening", to: "/listening", fresh: listening },
    { name: "Speaking", icon: "speaking", to: "/speak", note: spokeToday ? "Logged today" : "Today's topic" },
    { name: "Mistakes", icon: "again", to: "/practice/mistakes", due: openMistakes },
  ];

  return (
    <div>
      <p className="overline">{now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })} · Day {dayNumber(s)} · {phase === "IELTS" ? "IELTS" : phase}</p>
      <h1>{settings.name ? `Hi, ${settings.name}` : "Today"}</h1>

      <section className="study">
        {finished ? (
          <>
            <p className="study-sub">Today's session is done. {due ? `${due} words are still due.` : "Nothing is due."}</p>
            {due > 0 && <button className="btn big primary" onClick={() => navigate("/words/review")}>Review {due} words</button>}
            <button className="btn quiet" onClick={() => { update(() => ({ session: null })); ensureSession(c); navigate("/session"); }}>Study more</button>
          </>
        ) : (
          <>
            <button className="btn big primary" onClick={() => navigate("/session")} autoFocus>
              {started ? `Continue · ${session.index + 1} of ${steps.length}` : "Study now"}
            </button>
            <p className="study-sub">About {total} min · {due} reviews · {newWords} new words</p>
            {!started && settings.minutes !== 30 && <button className="btn quiet" onClick={() => { ensureSession(c, 30); navigate("/session"); }}>Short day (25 min)</button>}
          </>
        )}
      </section>

      <table className="decks">
        <thead><tr><th scope="col">Deck</th><th scope="col" className="n">Due</th><th scope="col" className="n">New</th><th aria-hidden /></tr></thead>
        <tbody>
          {decks.map((d) => (
            <tr key={d.name} onClick={() => navigate(d.to)}>
              <th scope="row"><a href={`#${d.to}`} onClick={(e) => e.stopPropagation()}><Icon name={d.icon} size={20} />{d.name}</a></th>
              {d.note ? <td colSpan={2} className="note">{d.note}</td> : (<><td className="n">{d.due ?? "–"}</td><td className="n">{d.fresh ?? "–"}</td></>)}
              <td className="go" aria-hidden><Icon name="chevron" size={20} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <WeekStrip days={days} />
    </div>
  );
}

export const studied = (d?: DayLog) => !!d && (d.active >= 300 || d.sessionDone);

/** Monday–Sunday. Studied days are filled; missed days are just rest days (nothing to lose). */
export function WeekStrip({ days }: { days: Record<string, DayLog> }) {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const t = today();
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const k = today(d);
    return { k, label: d.toLocaleDateString(undefined, { weekday: "narrow" }), long: d.toLocaleDateString(undefined, { weekday: "long" }), on: studied(days[k]), past: k < t, isToday: k === t };
  });
  const count = week.filter((d) => d.on).length;
  return (
    <div className="weekbox">
      <div className="week" role="list" aria-label="Days studied this week">
        {week.map((d) => (
          <div key={d.k} className="day" role="listitem" aria-label={`${d.long}: ${d.on ? "studied" : d.isToday ? "today" : d.past ? "rest day" : "coming up"}`}>
            <span className={`dot ${d.on ? "on" : ""} ${d.isToday ? "today" : ""}`}>{d.on ? <Icon name="check" size={16} /> : null}</span>
            <span aria-hidden>{d.label}</span>
          </div>
        ))}
      </div>
      <p className="small muted" style={{ margin: 0 }}>{count} of 7 days this week · rest days are fine</p>
    </div>
  );
}
