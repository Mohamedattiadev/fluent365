import type { Content } from "../lib/content";
import { dayNumber, GUIDE, lessonsFinished, phaseOf } from "../lib/session";
import { statusOf } from "../lib/srs";
import { today, useApp } from "../lib/store";
import { Progress as Bar, SKILLS, skillStyle, type Skill } from "../components/ui";
import { studied, WeekStrip } from "./Home";

// Activity kinds recorded by the tracker, mapped to the six skills.
const KIND: Record<string, Skill> = { vocabulary: "words", grammar: "grammar", reading: "reading", listening: "listening", writing: "writing", speaking: "speaking" };

export function ProgressScreen({ c }: { c: Content }) {
  const s = useApp((x) => x);
  const totalMin = Math.round(Object.values(s.days).reduce((n, d) => n + d.active, 0) / 60);
  const studyDays = Object.values(s.days).filter(studied).length;
  const att = Object.values(s.days).reduce((n, d) => n + d.attempts, 0);
  const cor = Object.values(s.days).reduce((n, d) => n + d.correct, 0);
  const cards = Object.values(s.cards);
  const byStatus = { new: 0, learning: 0, review: 0, learned: 0 } as Record<string, number>;
  for (const x of cards) byStatus[statusOf(x.card.fresh ? undefined : x.card)]++;
  const topics = Object.entries(s.grammar).sort((a, b) => (b[1].learnedAt ?? "").localeCompare(a[1].learnedAt ?? ""));
  const extMin = s.external.reduce((n, e) => n + (e.minutes ?? 0), 0);
  const n = dayNumber(s);

  // Last 12 weeks, Monday-first columns.
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) - 7 * 11);
  const cells = Array.from({ length: 84 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const k = today(d);
    const min = Math.round((s.days[k]?.active ?? 0) / 60);
    return { k, min, future: k > today(), l: min === 0 ? 0 : min < 15 ? 1 : min < 30 ? 2 : min < 60 ? 3 : 4 };
  });
  const last84 = cells.filter((x) => !x.future && x.min > 0).length;

  // Minutes per skill in the last 7 days (shown as a share of the week, with the minutes as text).
  const week: Record<Skill, number> = { words: 0, grammar: 0, reading: 0, listening: 0, writing: 0, speaking: 0 };
  for (const [d, log] of Object.entries(s.days)) {
    if (Date.now() - new Date(d).getTime() > 7 * 86400000) continue;
    for (const [k, sec] of Object.entries(log.byKind)) if (KIND[k]) week[KIND[k]] += sec / 60;
  }
  const maxSkill = Math.max(10, ...Object.values(week));

  return (
    <div>
      <h1>Progress</h1>
      <div className="stats">
        <div><p className="big-number">{studyDays}</p><p className="label">study days</p></div>
        <div><p className="big-number">{totalMin >= 120 ? `${Math.round(totalMin / 6) / 10} h` : `${totalMin} min`}</p><p className="label">active time in total (estimate)</p></div>
        <div><p className="big-number">{byStatus.learned + Object.keys(s.known).length}</p><p className="label">words known well · {cards.length} in cards</p></div>
      </div>

      <section className="section">
        <h2 className="section-title">This week</h2>
        <WeekStrip days={s.days} />
      </section>

      <section className="section">
        <h2 className="section-title">Last 12 weeks</h2>
        <div className="heatmap" role="img" aria-label={`Studied on ${last84} of the last 84 days`}>
          {cells.map((x) => <span key={x.k} data-l={x.future ? undefined : x.l} style={x.future ? { opacity: 0.3 } : undefined} title={`${x.k}: ${x.min} min`} />)}
        </div>
        <p className="small muted">Studied on {last84} of the last 84 days. Darker squares mean more active minutes (under 15, 15–29, 30–59, 60+).</p>
      </section>

      <section className="section">
        <h2 className="section-title">Time by skill, last 7 days</h2>
        {(Object.keys(week) as Skill[]).map((k) => (
          <div className="skillbar" key={k} style={skillStyle(k)}>
            <span className="lbl">{SKILLS[k].label}</span>
            <div className="bar" aria-hidden><div style={{ width: `${(week[k] / maxSkill) * 100}%` }} /></div>
            <span className="val">{Math.round(week[k])} min</span>
          </div>
        ))}
        <p className="small muted">Counted only while you were actively answering, reading, listening, writing or speaking. Outside practice (Praktika and others) is kept separate: {extMin} min logged.</p>
      </section>

      <section className="section">
        <h2 className="section-title">Your 365-day guide</h2>
        <p className="muted">Day {n} · {lessonsFinished(s)} of 40 lessons finished · {phaseOf(s)} phase. The calendar is a guide: the app moves on when you show you're ready.</p>
        <Bar value={n / 365} label={`Day ${n} of 365`} />
        <ul className="list" style={{ marginTop: 8 }}>
          {GUIDE.map((g) => <li key={g.from} style={{ fontWeight: n >= g.from && n <= g.to ? 700 : 400, color: n >= g.from && n <= g.to ? "var(--text)" : "var(--text-muted)" }}>Days {g.from}–{g.to}: {g.focus}</li>)}
        </ul>
      </section>

      <section className="section">
        <h2 className="section-title">Grammar mastery</h2>
        <p className="small muted">Four separate skills: recognising a form, controlled practice, producing it yourself, and using it later without help.</p>
        {topics.length === 0 && <p className="muted">No grammar practised yet.</p>}
        {topics.map(([id, m]) => (
          <div key={id} style={{ marginBottom: 16 }}>
            <b>{c.grammarById.get(id)?.title ?? (id === "my-corrections" ? "My corrections" : id)}</b>
            {(["rec", "ctl", "prod", "auto"] as const).map((k) => (
              <div className="dim" key={k}><span className="muted">{{ rec: "Recognition", ctl: "Practice", prod: "Production", auto: "Automatic" }[k]}</span><Bar value={m[k]} /><span className="num">{Math.round(m[k] * 100)}%</span></div>
            ))}
          </div>
        ))}
      </section>

      <section className="section">
        <h2 className="section-title">Vocabulary</h2>
        <table><tbody>
          <tr><td>Learning (new)</td><td className="num">{byStatus.new + byStatus.learning}</td></tr>
          <tr><td>In review</td><td className="num">{byStatus.review}</td></tr>
          <tr><td>Learned (remembered for 3+ weeks)</td><td className="num">{byStatus.learned}</td></tr>
          <tr><td>Marked as already known</td><td className="num">{Object.keys(s.known).length}</td></tr>
          <tr><td>Answers correct</td><td className="num">{att ? Math.round((cor / att) * 100) : 0}% of {att}</td></tr>
        </tbody></table>
      </section>

      <section className="section">
        <h2 className="section-title">Tests and practice scores</h2>
        {s.tests.length === 0 ? <p className="muted">No tests yet.</p> : (
          <table><tbody>{s.tests.slice(0, 30).map((t) => <tr key={t.id}><td>{new Date(t.at).toLocaleDateString()}</td><td>{t.title}</td><td className="num"><b>{t.score}/{t.of}</b></td></tr>)}</tbody></table>
        )}
        <p className="small muted">Practice scores, not official IELTS results.</p>
      </section>

      <section className="section">
        <h2 className="section-title">Speaking in HelloTalk and Praktika</h2>
        <p>{s.external.length} sessions logged · {extMin} minutes in total</p>
        <ul className="list">
          {s.external.slice(0, 8).map((e) => <li key={e.id}><span className="small">{new Date(e.at).toLocaleDateString()} · {e.source === "hellotalk" ? "HelloTalk" : e.source === "praktika" ? "Praktika" : "Other"} · {e.minutes ?? "?"} min · {e.topic}</span></li>)}
          {s.external.length === 0 && <li className="muted small">Nothing logged yet. Log your minutes after speaking (Today → Speaking).</li>}
        </ul>
        <p className="small muted">Typed in by you. Fluent365 is not connected to these apps.</p>
      </section>
    </div>
  );
}
