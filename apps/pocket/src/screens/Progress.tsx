import type { Content } from "../lib/content";
import { dayNumber, GUIDE, lessonsFinished, phaseOf } from "../lib/session";
import { statusOf } from "../lib/srs";
import { today, useApp } from "../lib/store";
import { Progress as Bar } from "../components/ui";

export function ProgressScreen({ c }: { c: Content }) {
  const s = useApp((x) => x);
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86400000);
    const k = today(d);
    return { k, label: String(d.getDate()), min: Math.round((s.days[k]?.active ?? 0) / 60) };
  });
  const max = Math.max(30, ...last14.map((d) => d.min));
  const totalMin = Math.round(Object.values(s.days).reduce((n, d) => n + d.active, 0) / 60);
  const att = Object.values(s.days).reduce((n, d) => n + d.attempts, 0);
  const cor = Object.values(s.days).reduce((n, d) => n + d.correct, 0);
  const cards = Object.values(s.cards);
  const byStatus = { new: 0, learning: 0, review: 0, learned: 0 } as Record<string, number>;
  for (const x of cards) byStatus[statusOf(x.card.fresh ? undefined : x.card)]++;
  const topics = Object.entries(s.grammar).sort((a, b) => (b[1].learnedAt ?? "").localeCompare(a[1].learnedAt ?? ""));
  const extMin = s.external.reduce((n, e) => n + (e.minutes ?? 0), 0);
  const n = dayNumber(s);

  return (
    <div>
      <h1>Progress</h1>
      <div className="grid2">
        <div className="card"><p className="big-number">{totalMin}</p><p className="muted">active minutes in total (estimate)</p></div>
        <div className="card"><p className="big-number">{att ? Math.round((cor / att) * 100) : 0}%</p><p className="muted">correct answers ({att} answers)</p></div>
        <div className="card"><p className="big-number">{byStatus.learned + Object.keys(s.known).length}</p><p className="muted">words known well · {cards.length} in cards</p></div>
        <div className="card"><p className="big-number">{lessonsFinished(s)}/40</p><p className="muted">lessons finished · {phaseOf(s)} phase</p></div>
      </div>

      <div className="card">
        <h2>Active minutes, last 14 days</h2>
        <div className="bars" role="img" aria-label={`Active minutes: ${last14.map((d) => `${d.k} ${d.min}`).join(", ")}`}>
          {last14.map((d) => <div key={d.k} style={{ height: `${(d.min / max) * 100}%`, opacity: d.min ? 1 : 0.25 }} title={`${d.k}: ${d.min} min`} />)}
        </div>
        <div className="bars-labels">{last14.map((d) => <span key={d.k}>{d.label}</span>)}</div>
        <p className="small muted">Counted only while you were actively answering, reading, listening, writing or speaking. External practice (Praktika etc.) is listed separately: {extMin} min.</p>
      </div>

      <div className="card">
        <h2>Your 365-day guide</h2>
        <p className="muted">Day {n}. The calendar is a guide — the app moves on when you show you're ready.</p>
        <Bar value={n / 365} />
        <ul className="list" style={{ marginTop: 8 }}>
          {GUIDE.map((g) => <li key={g.from} style={{ fontWeight: n >= g.from && n <= g.to ? 700 : 400 }}>Days {g.from}–{g.to}: {g.focus}</li>)}
        </ul>
      </div>

      <div className="card">
        <h2>Grammar mastery</h2>
        <p className="small muted">Four separate skills: recognising a form, controlled practice, producing it yourself, and using it later without help.</p>
        {topics.length === 0 && <p className="muted">No grammar practised yet.</p>}
        {topics.map(([id, m]) => (
          <div key={id} style={{ marginBottom: 14 }}>
            <b>{c.grammarById.get(id)?.title ?? (id === "my-corrections" ? "My corrections" : id)}</b>
            {(["rec", "ctl", "prod", "auto"] as const).map((k) => (
              <div className="dim" key={k}><span className="muted">{{ rec: "Recognition", ctl: "Practice", prod: "Production", auto: "Automatic" }[k]}</span><Bar value={m[k]} /><span>{Math.round(m[k] * 100)}%</span></div>
            ))}
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Vocabulary</h2>
        <table><tbody>
          <tr><td>Learning (new)</td><td>{byStatus.new + byStatus.learning}</td></tr>
          <tr><td>In review</td><td>{byStatus.review}</td></tr>
          <tr><td>Learned (remembered for 3+ weeks)</td><td>{byStatus.learned}</td></tr>
          <tr><td>Marked as already known</td><td>{Object.keys(s.known).length}</td></tr>
        </tbody></table>
      </div>

      <div className="card">
        <h2>Tests & practice scores</h2>
        {s.tests.length === 0 ? <p className="muted">No tests yet.</p> : (
          <table><tbody>{s.tests.slice(0, 30).map((t) => <tr key={t.id}><td>{new Date(t.at).toLocaleDateString()}</td><td>{t.title}</td><td><b>{t.score}/{t.of}</b></td></tr>)}</tbody></table>
        )}
        <p className="small muted">Practice scores, not official IELTS results.</p>
      </div>

      <div className="card">
        <h2>Writing & speaking</h2>
        <p>{s.writing.length} writing pieces · {s.speaking.length} speaking sessions · {s.mistakes.filter((m) => !m.fixed).length} open mistakes</p>
        {s.writing.slice(0, 5).map((w) => (
          <details key={w.id} className="card soft"><summary>{new Date(w.at).toLocaleDateString()} · {w.words} words{w.rewriteOf ? " · rewrite" : ""}</summary><p className="small muted">{w.prompt}</p><p style={{ whiteSpace: "pre-wrap" }}>{w.text}</p></details>
        ))}
      </div>
    </div>
  );
}
