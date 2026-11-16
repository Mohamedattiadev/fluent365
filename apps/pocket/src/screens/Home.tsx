// "Today": one obvious action (Start), the plan as a quiet list, and a forgiving week view.
import { useEffect, useState } from "react";
import { Icon, SKILLS, skillStyle } from "../components/ui";
import type { Content } from "../lib/content";
import { dueCardKeys } from "../lib/learning";
import { dayNumber, GUIDE, phaseOf, skillOf } from "../lib/session";
import { getState, today, update, useApp } from "../lib/store";
import type { DayLog } from "../lib/types";
import { navigate } from "../router";
import { ensureSession } from "./Session";

export function Home({ c }: { c: Content }) {
  const settings = useApp((s) => s.settings);
  const session = useApp((s) => s.session);
  const day = useApp((s) => s.days[today()]);
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
  const skills = [...new Set(steps.map(skillOf).filter(Boolean))].map((k) => SKILLS[k!].label.toLowerCase());
  const n = dayNumber(s);
  const guide = GUIDE.find((g) => n >= g.from && n <= g.to) ?? GUIDE[GUIDE.length - 1];
  const now = new Date();
  const hello = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const due = dueCardKeys().length;
  const phase = phaseOf(s);

  return (
    <div>
      <section className="home-hero">
        <p className="overline">{now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1>{finished ? "Today's session is done" : `${hello}${settings.name ? `, ${settings.name}` : ""}`}</h1>
        {finished ? (
          <p className="lede">{Math.round((day?.active ?? 0) / 60)} active minutes today. Tomorrow's plan is ready when you are.</p>
        ) : (
          <p className="lede">About {total} minutes · {joinList(skills)}.</p>
        )}
        <p className="small faint" title={guide.focus}>Day {n} of 365 · {phase === "IELTS" ? "IELTS phase" : `${phase} phase`}</p>
        {!finished ? (
          <>
            <div className="start-row">
              <button className="btn big primary" onClick={() => navigate("/session")} autoFocus>
                {started ? `Continue session · step ${session.index + 1} of ${steps.length}` : "Start today's session"} <Icon name="play" />
              </button>
              <span className="kbd desktop-only" aria-hidden>Enter</span>
            </div>
            {!started && settings.minutes !== 30 && (
              <button className="btn quiet" onClick={() => { ensureSession(c, 30); navigate("/session"); }}>Short on time? Do a 25-minute short day instead</button>
            )}
          </>
        ) : (
          <div className="start-row">
            {due > 0 ? <button className="btn big primary" onClick={() => navigate("/words/review")}>Review words ({due} due) <Icon name="arrow" /></button> : null}
            <button className="btn quiet" onClick={() => { update(() => ({ session: null })); ensureSession(c); navigate("/session"); }}>Do another session</button>
          </div>
        )}
      </section>

      <div className="home-grid">
        <section aria-labelledby="plan-h">
          <h2 className="section-title" id="plan-h">Today's plan</h2>
          <ul className="plan">
            {steps.map((x, i) => {
              const sk = skillOf(x);
              const done = i < session.index || finished;
              const current = i === session.index && started;
              return (
                <li key={x.id} style={skillStyle(sk)} className={done ? "done" : current ? "now" : undefined} aria-current={current ? "step" : undefined}>
                  <Icon name={sk ? SKILLS[sk].icon : "list"} size={20} />
                  <span className="grow"><span className="name">{sk ? SKILLS[sk].label : "Review"}</span><span className="detail">{sk && x.title.startsWith(`${SKILLS[sk].label} · `) ? x.title.slice(SKILLS[sk].label.length + 3) : x.title}</span></span>
                  <span className="mins">{done ? <span className="status"><Icon name="check" size={18} /> Done</span> : `${x.minutes} min`}</span>
                </li>
              );
            })}
          </ul>
        </section>
        <aside aria-labelledby="week-h">
          <h2 className="section-title" id="week-h">This week</h2>
          <WeekStrip days={days} />
          {openMistakes > 0 && (
            <button className="btn quiet" style={{ paddingLeft: 0, marginTop: 16 }} onClick={() => navigate("/practice/mistakes")}>
              Fix old mistakes ({openMistakes}) <Icon name="arrow" size={20} />
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}

const joinList = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

export const studied = (d?: DayLog) => !!d && (d.active >= 300 || d.sessionDone);

/** Monday–Sunday. Studied days are filled; missed days are rest days (no guilt, no streak to lose). */
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
    <>
      <div className="week" role="list" aria-label="Days studied this week">
        {week.map((d) => (
          <div key={d.k} className="day" role="listitem" aria-label={`${d.long}: ${d.on ? "studied" : d.isToday ? "today" : d.past ? "rest day" : "coming up"}`}>
            <span className={`dot ${d.on ? "on" : ""} ${d.isToday ? "today" : ""} ${!d.on && d.past ? "rest" : ""}`}>{!d.on && d.past && <Icon name="rest" size={16} />}</span>
            <span aria-hidden>{d.label}</span>
          </div>
        ))}
      </div>
      <p className="small muted">{count} of 7 days this week · rest days are fine</p>
    </>
  );
}
