// "Today": one obvious action (Start), the plan as a quiet list, and a forgiving week view.
import { useEffect, useState } from "react";
import { Icon, SkillBadge, SKILLS } from "../components/ui";
import type { Content } from "../lib/content";
import { dueCardKeys } from "../lib/learning";
import { dayNumber, phaseOf, skillOf } from "../lib/session";
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
  const now = new Date();
  const hello = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const due = dueCardKeys().length;
  const phase = phaseOf(s);

  const doneSteps = finished ? steps.length : Math.min(session.index, steps.length);
  const weekCount = weekStudied(days);

  return (
    <div>
      <p className="overline">{now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
      <div className="home-head"><h1>{finished ? "Done for today" : `${hello}${settings.name ? `, ${settings.name}` : ""}`}</h1></div>

      <section className="hero" aria-labelledby="today-h">
        <div className="top">
          <Ring value={steps.length ? doneSteps / steps.length : 0} label={`${doneSteps}/${steps.length}`} />
          <div className="grow">
            <h2 id="today-h">{finished ? "Today's session is complete" : started ? "Session in progress" : "Today's session"}</h2>
            <p className="sub">{finished ? `${Math.round((day?.active ?? 0) / 60)} active minutes today` : `About ${total} min · ${joinList(skills)}`}</p>
          </div>
        </div>
        {!finished ? (
          <>
            <button className="btn primary" onClick={() => navigate("/session")} autoFocus>
              <Icon name="play" filled /> {started ? `Continue · step ${session.index + 1} of ${steps.length}` : "Start today's session"}
            </button>
            {!started && settings.minutes !== 30 && (
              <button className="btn quiet" onClick={() => { ensureSession(c, 30); navigate("/session"); }}>Short on time? Do a 25-minute day</button>
            )}
          </>
        ) : (
          <>
            {due > 0 && <button className="btn primary" onClick={() => navigate("/words/review")}><Icon name="words" /> Review {due} words</button>}
            <button className="btn quiet" onClick={() => { update(() => ({ session: null })); ensureSession(c); navigate("/session"); }}>Do another session</button>
          </>
        )}
      </section>

      <div className="tiles">
        <div className="tile"><Icon name="flag" size={20} /><span className="v">{n}</span><span className="k">Day of 365 · {phase === "IELTS" ? "IELTS" : phase}</span></div>
        <button className="tile" onClick={() => navigate("/words")}><Icon name="words" size={20} /><span className="v">{due}</span><span className="k">words due</span></button>
        <button className="tile" onClick={() => navigate("/progress")}><Icon name="today" size={20} /><span className="v">{weekCount}/7</span><span className="k">days this week</span></button>
      </div>

      <div className="home-grid">
        <section aria-labelledby="plan-h">
          <h2 className="section-title" id="plan-h">Today's plan</h2>
          <ul className="plan">
            {steps.map((x, i) => {
              const sk = skillOf(x);
              const done = i < session.index || finished;
              const current = i === session.index && !finished;
              return (
                <li key={x.id} className={done ? "done" : current ? "now" : undefined} aria-current={current ? "step" : undefined}>
                  <SkillBadge skill={sk} icon={done ? "check" : undefined} />
                  <span className="grow"><span className="name">{sk ? SKILLS[sk].label : "Review"}</span><span className="detail">{sk && x.title.startsWith(`${SKILLS[sk].label} · `) ? x.title.slice(SKILLS[sk].label.length + 3) : x.title}</span></span>
                  {current ? <span className="next-chip">Up next</span> : <span className="mins">{done ? "Done" : `${x.minutes} min`}</span>}
                </li>
              );
            })}
          </ul>
        </section>
        <aside>
          <h2 className="section-title">This week</h2>
          <div className="card"><WeekStrip days={days} /></div>
          {openMistakes > 0 && (
            <button className="navrow card" style={{ padding: "8px 16px" }} onClick={() => navigate("/practice/mistakes")}>
              <SkillBadge skill="grammar" icon="again" />
              <span className="grow"><span className="setting-label">Fix old mistakes</span><span className="setting-hint">{openMistakes} waiting in your notebook</span></span>
              <Icon name="chevron" />
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}

function Ring({ value, label }: { value: number; label: string }) {
  const r = 26, c = 2 * Math.PI * r;
  return (
    <div className="ring" role="img" aria-label={`${label} steps done`}>
      <svg width="64" height="64" viewBox="0 0 64 64"><circle className="track" cx="32" cy="32" r={r} fill="none" strokeWidth="6" />{value > 0 && <circle className="val" cx="32" cy="32" r={r} fill="none" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value)} />}</svg>
      <span>{label}</span>
    </div>
  );
}

function weekStudied(days: Record<string, DayLog>) {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => today(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i))).filter((k) => studied(days[k])).length;
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
            <span className={`dot ${d.on ? "on" : ""} ${d.isToday ? "today" : ""} ${!d.on && d.past ? "rest" : ""}`}>{d.on ? <Icon name="check" size={18} /> : !d.on && d.past ? <Icon name="rest" size={16} /> : null}</span>
            <span aria-hidden>{d.label}</span>
          </div>
        ))}
      </div>
      <p className="small muted" style={{ margin: 0 }}>{count} of 7 days · rest days are fine</p>
    </>
  );
}
