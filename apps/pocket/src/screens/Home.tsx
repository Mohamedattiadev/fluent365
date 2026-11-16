import { useEffect, useState } from "react";
import { ActionBar, Icon, Progress } from "../components/ui";
import type { Content } from "../lib/content";
import { dueCardKeys } from "../lib/learning";
import { dayNumber, GUIDE, phaseOf } from "../lib/session";
import { getState, today, update, useApp } from "../lib/store";
import { navigate } from "../router";
import { ensureSession } from "./Session";

export function Home({ c }: { c: Content }) {
  const settings = useApp((s) => s.settings);
  const session = useApp((s) => s.session);
  const day = useApp((s) => s.days[today()]);
  const days = useApp((s) => s.days);
  const [, force] = useState(0);
  useEffect(() => { if (!session || session.date !== today()) { ensureSession(c); force((x) => x + 1); } }, [c, session]);
  if (!session || session.date !== today()) return null;

  const s = getState();
  const finished = !!session.finished;
  const started = session.index > 0 && !finished;
  const total = session.steps.reduce((n, x) => n + x.minutes, 0);
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000);
    const k = today(d);
    return { k, label: d.toLocaleDateString(undefined, { weekday: "narrow" }), on: (days[k]?.active ?? 0) >= 300 || days[k]?.sessionDone };
  });
  const n = dayNumber(s);
  const guide = GUIDE.find((g) => n >= g.from && n <= g.to) ?? GUIDE[GUIDE.length - 1];
  const hello = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";

  return (
    <div>
      <h1>{hello}{settings.name ? `, ${settings.name}` : ""}</h1>
      <p className="muted">Day {n} of 365 · {phaseOf(s) === "IELTS" ? "IELTS phase" : `${phaseOf(s)} phase`} · {guide.focus}</p>

      <div className="card">
        {finished ? (
          <>
            <h2>Today's session is done ✓</h2>
            <p className="muted">{Math.round((day?.active ?? 0) / 60)} active minutes today. Come back tomorrow, or keep going with extra practice below.</p>
          </>
        ) : (
          <>
            <h2>{started ? "Continue today's session" : "Today's session"}</h2>
            <p className="muted">About {total} minutes · {session.steps.length - 1} steps. Just press the button and follow along.</p>
            {started && <Progress value={session.index / session.steps.length} />}
            <ol className="small" style={{ paddingLeft: 22, marginTop: 12 }}>
              {session.steps.filter((x) => x.kind !== "wrap").map((x, i) => (
                <li key={x.id} style={{ opacity: i < session.index ? 0.5 : 1, marginBottom: 4 }}>
                  {i < session.index ? "✓ " : ""}{x.title} <span className="muted">· {x.minutes} min</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>

      <div className="card">
        <h3>This week</h3>
        <div className="row" style={{ justifyContent: "space-between" }} aria-label="Days studied this week">
          {week.map((d) => (
            <div key={d.k} className="center" style={{ flex: 1 }}>
              <div style={{ width: 34, height: 34, margin: "0 auto", borderRadius: 999, background: d.on ? "var(--good)" : "var(--surface-2)", border: d.k === today() ? "2px solid var(--primary)" : "none" }} aria-label={`${d.k}: ${d.on ? "studied" : "not studied"}`} />
              <span className="small muted">{d.label}</span>
            </div>
          ))}
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>Missing a day is fine. Fluent365 never makes you "catch up": tomorrow's plan just continues.</p>
      </div>

      {finished && (
        <div className="grid2">
          <button className="btn big outline" onClick={() => navigate("/words/review")}>Review words ({dueCardKeys().length} due)</button>
          <button className="btn big outline" onClick={() => { update(() => ({ session: null })); ensureSession(c); navigate("/session"); }}>Do another session</button>
        </div>
      )}

      {!finished && (
        <ActionBar>
          <button className="btn big primary" onClick={() => navigate("/session")} autoFocus>
            {started ? "Continue" : "Start today's session"} <Icon name="arrow" />
          </button>
          {!started && settings.minutes !== 30 && (
            <button className="btn link" style={{ width: "100%" }} onClick={() => { ensureSession(c, 30); navigate("/session"); }}>
              Short on time? Do a 25-minute short day instead
            </button>
          )}
        </ActionBar>
      )}
    </div>
  );
}
