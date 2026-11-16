// Free-browse screens (the guided session is the main path; these are for extra practice).
import { useEffect, useMemo, useState } from "react";
import { GrammarLesson, GrammarReview } from "../components/Grammar";
import { CourseUnitView, LessonStepView } from "../components/Lessons";
import { FixMistakes, SpeakingTask, WritingTask } from "../components/Skills";
import { NewWords, ReviewSession, WordFace, viewOf } from "../components/Vocab";
import { ActionBar, Icon, SpeakButton, toast } from "../components/ui";
import { COURSES, loadCourse, type Content } from "../lib/content";
import { addCards, dueCardKeys, markKnown } from "../lib/learning";
import { kindName } from "../lib/session";
import { statusOf } from "../lib/srs";
import { update, useApp } from "../lib/store";
import type { Course } from "../lib/types";
import { navigate } from "../router";

const Back = ({ to, label = "Back" }: { to: string; label?: string }) => (
  <button className="btn link" onClick={() => navigate(to)}><Icon name="back" /> {label}</button>
);

// ---------- Grammar ----------
export function GrammarScreen({ c, path }: { c: Content; path: string[] }) {
  const mastery = useApp((s) => s.grammar);
  if (path[0]) {
    const t = c.grammarById.get(path[0]);
    if (!t) return <p>Topic not found.</p>;
    return <div><Back to="/grammar" /><div className="card"><GrammarLesson topic={t} onDone={() => navigate("/grammar")} /></div></div>;
  }
  const core = c.grammar.filter((t) => t.track === "core");
  const lesson = c.grammar.filter((t) => t.track === "lesson");
  const Row = ({ id, title, level }: { id: string; title: string; level: string }) => {
    const m = mastery[id];
    const score = m ? Math.round(((m.rec + m.ctl + m.prod + m.auto) / 4) * 100) : null;
    return (
      <li>
        <button className="rowbtn" onClick={() => navigate(`/grammar/${id}`)}>
          <span className="grow"><b>{title}</b><br /><span className="small muted">{level}{m?.learnedAt ? ` · practised ${m.attempts}×` : " · not started"}</span></span>
          {score !== null && <span className="pill blue">{score}%</span>}
          <Icon name="arrow" />
        </button>
      </li>
    );
  };
  return (
    <div>
      <h1>Grammar</h1>
      <p className="muted">Your daily session teaches these in order. Open any topic to practise it now.</p>
      <h2>Grammar Instinct: core patterns</h2>
      <ul className="list card">{core.map((t) => <Row key={t.id} id={t.id} title={t.title} level={t.level} />)}</ul>
      <h2>Grammar from the lessons</h2>
      <ul className="list card">{lesson.map((t) => <Row key={t.id} id={t.id} title={t.title} level={t.level} />)}</ul>
    </div>
  );
}

// ---------- Vocabulary ----------
export function WordsScreen({ c, path }: { c: Content; path: string[] }) {
  if (path[0] === "review") return <div><Back to="/words" /><div className="card"><ReviewSession c={c} limit={200} onDone={() => navigate("/words")} /></div></div>;
  if (path[0] === "learn") {
    const ids = path[1]?.split(",").map(Number).filter(Boolean) ?? [];
    return <div><Back to="/words" /><div className="card"><NewWords c={c} ids={ids} onDone={() => navigate("/words")} /></div></div>;
  }
  return <WordList c={c} />;
}

function WordList({ c }: { c: Content }) {
  const cards = useApp((s) => s.cards);
  const known = useApp((s) => s.known);
  const [q, setQ] = useState("");
  const [band, setBand] = useState("all");
  const [list, setList] = useState("all");
  const [mine, setMine] = useState("all");
  const [open, setOpen] = useState<number | null>(null);
  const due = dueCardKeys().length;

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = [];
    for (const v of c.vocab) {
      if (band !== "all" && String(v.band) !== band) continue;
      if (list !== "all" && !v.src.includes(list)) continue;
      const card = cards[String(v.id)];
      if (mine === "saved" && !card) continue;
      if (mine === "hard" && !(card && (card.card.lapses > 0 || card.card.difficulty >= 7))) continue;
      if (mine === "known" && !known[String(v.id)]) continue;
      if (needle && !v.w.toLowerCase().includes(needle) && !(v.d ?? "").toLowerCase().includes(needle) && !(v.tr ?? "").toLowerCase().includes(needle)) continue;
      out.push(v);
      if (out.length >= 80) break;
    }
    return out;
  }, [c, q, band, list, mine, cards, known]);
  const counts = useMemo(() => {
    const vals = Object.values(cards);
    return { total: vals.length, learned: vals.filter((x) => statusOf(x.card) === "learned").length };
  }, [cards]);

  return (
    <div>
      <h1>Vocabulary</h1>
      <div className="grid2">
        <div className="card"><p className="big-number">{counts.total}</p><p className="muted">words in your cards · {counts.learned} learned well</p></div>
        <div className="card"><p className="big-number">{due}</p><p className="muted">due for review now</p>{due > 0 && <button className="btn primary" onClick={() => navigate("/words/review")}>Review now</button>}</div>
      </div>
      <div className="card">
        <label className="field"><span>Search words or meanings</span><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. improve, decision, look forward to" /></label>
        <div className="grid2">
          <label className="field"><span>Frequency</span><select value={band} onChange={(e) => setBand(e.target.value)}><option value="all">All</option><option value="1">Top 1,000</option><option value="2">1,000–2,000</option><option value="3">2,000–3,000</option><option value="5">3,000–5,000</option><option value="9">5,000+</option></select></label>
          <label className="field"><span>Collection</span><select value={list} onChange={(e) => setList(e.target.value)}><option value="all">All</option><option value="ngsl">General (NGSL)</option><option value="nawl">Academic (NAWL)</option><option value="spoken">Spoken</option><option value="tsl">Work & business (TSL)</option><option value="lesson">IELTS lesson words</option><option value="phrasal">Phrasal verbs</option><option value="collocation">Collocations</option><option value="linking">Linking words</option></select></label>
          <label className="field"><span>Show</span><select value={mine} onChange={(e) => setMine(e.target.value)}><option value="all">Everything</option><option value="saved">My cards</option><option value="hard">Difficult cards</option><option value="known">Marked as known</option></select></label>
        </div>
      </div>
      <ul className="list card" aria-live="polite">
        {results.length === 0 && <li className="muted">No words found.</li>}
        {results.map((v) => {
          const card = cards[String(v.id)];
          return (
            <li key={v.id}>
              <button className="rowbtn" onClick={() => setOpen(open === v.id ? null : v.id)} aria-expanded={open === v.id}>
                <span className="grow"><b>{v.w}</b> <span className="small muted">{v.d?.slice(0, 80)}</span></span>
                {card ? <span className="pill blue">{statusOf(card.card)}</span> : known[String(v.id)] ? <span className="pill">known</span> : null}
              </button>
              {open === v.id && (
                <div className="card soft" style={{ marginTop: 8 }}>
                  <WordFace v={viewOf(v)} />
                  <p className="small muted">Collections: {v.src.join(", ")} · frequency rank ≈ {v.r}</p>
                  <div className="row">
                    <SpeakButton text={v.ex ? `${v.w}. ${v.ex}` : v.w} />
                    {!card && <button className="btn primary" onClick={() => { addCards([String(v.id)]); toast(`"${v.w}" added to your cards`); }}>Add to my cards</button>}
                    {!known[String(v.id)] ? <button className="btn outline" onClick={() => markKnown(String(v.id))}>I know it</button> : <button className="btn outline" onClick={() => markKnown(String(v.id), false)}>Not known</button>}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="small muted">{c.licence}</p>
    </div>
  );
}

// ---------- Reading & lessons ----------
export function ReadingScreen({ c, path }: { c: Content; path: string[] }) {
  const lessons = useApp((s) => s.lessons);
  const [course, setCourse] = useState<Course | null>(null);
  useEffect(() => { if (path[0] === "course" && path[1]) loadCourse(path[1]).then(setCourse); }, [path]);
  if (path[0] === "lesson" && path[1]) {
    const n = Number(path[1]);
    if (path[2] != null) return <div><Back to={`/reading/lesson/${n}`} /><div className="card"><LessonStepView c={c} lesson={n} step={Number(path[2])} onDone={() => navigate(`/reading/lesson/${n}`)} /></div></div>;
    const info = c.lessons.find((l) => l.number === n);
    if (!info) return <p>Lesson not found.</p>;
    const done = new Set(lessons[n]?.done ?? []);
    return (
      <div>
        <Back to="/reading" />
        <h1>Lesson {n}: {info.title}</h1>
        <p className="muted">{info.level} · {info.topic}. {info.goal}</p>
        <ul className="list card">
          {info.kinds.map((k, i) => (
            <li key={i}><button className="rowbtn" onClick={() => navigate(`/reading/lesson/${n}/${i}`)}><span className="grow"><b>{i + 1}. {kindName(k)}</b></span>{done.has(i) && <span className="pill blue">done ✓</span>}<Icon name="arrow" /></button></li>
          ))}
        </ul>
      </div>
    );
  }
  if (path[0] === "course" && path[1]) {
    if (path[2]) return <div><Back to={`/reading/course/${path[1]}`} /><div className="card"><CourseUnitView courseId={path[1]} unitId={path[2]} onDone={() => navigate(`/reading/course/${path[1]}`)} /></div></div>;
    if (!course) return null;
    return (
      <div>
        <Back to="/reading" />
        <h1>{course.title}</h1>
        <p className="muted">{course.description}</p>
        <ul className="list card">{course.units.map((u) => <li key={u.id}><button className="rowbtn" onClick={() => navigate(`/reading/course/${course.id}/${u.id}`)}><span className="grow"><b>{u.title}</b><br /><span className="small muted">{u.goal}</span></span><Icon name="arrow" /></button></li>)}</ul>
      </div>
    );
  }
  return (
    <div>
      <h1>Reading & lessons</h1>
      <p className="muted">40 topic lessons — each with words, listening, reading, grammar, writing and speaking. Your daily session goes through them in order.</p>
      <ul className="list card">
        {c.lessons.map((l) => {
          const p = lessons[l.number];
          return (
            <li key={l.number}><button className="rowbtn" onClick={() => navigate(`/reading/lesson/${l.number}`)}>
              <span className="grow"><b>{l.number}. {l.title}</b><br /><span className="small muted">{l.level} · {l.topic}</span></span>
              {p?.finished ? <span className="pill blue">done ✓</span> : p?.done.length ? <span className="pill">{p.done.length}/{l.kinds.length}</span> : null}
              <Icon name="arrow" />
            </button></li>
          );
        })}
      </ul>
      <h2>Courses</h2>
      <ul className="list card">{COURSES.map((id) => <li key={id}><button className="rowbtn" onClick={() => navigate(`/reading/course/${id}`)}><span className="grow"><b>{courseName(id)}</b></span><Icon name="arrow" /></button></li>)}</ul>
    </div>
  );
}
const courseName = (id: string) => ({ "general-path": "General English A1 → C2", "ielts-reading-foundations": "IELTS Reading foundations", "ielts-vocabulary-topics": "IELTS vocabulary by topic", "ielts-writing-foundations": "IELTS Writing foundations", "ielts-listening-tests": "IELTS Listening practice tests", "ielts-reading-mock": "IELTS Reading mock test" })[id] ?? id;

// ---------- Practice ----------
export function PracticeScreen({ c, path }: { c: Content; path: string[] }) {
  const tests = useApp((s) => s.tests);
  const goal = useApp((s) => s.settings.goal);
  const mistakes = useApp((s) => s.mistakes);
  const grammar = useApp((s) => s.grammar);
  const [score, setScore] = useState<Record<string, string>>({});
  if (path[0] === "writing" && path[1]) {
    const p = c.ielts.writing.find((x) => x.id === path[1]);
    if (!p) return null;
    return <div><Back to="/practice/writing" /><div className="card"><WritingTask title={`Writing Task ${p.task}`} prompt={p.text} data={p.data} minutes={p.task === 1 ? 20 : 40} minWords={p.task === 1 ? 150 : 250} tip={p.points?.length ? `Cover every point: ${p.points.join("; ")}.` : undefined} promptId={p.id} onDone={() => navigate("/practice")} /></div></div>;
  }
  if (path[0] === "writing") {
    const list = c.ielts.writing.filter((p) => goal === "ielts-ac" ? p.module === "academic" : true);
    return <div><Back to="/practice" /><h1>Writing tasks</h1><ul className="list card">{list.map((p) => <li key={p.id}><button className="rowbtn" onClick={() => navigate(`/practice/writing/${p.id}`)}><span className="grow"><b>Task {p.task} · {p.module === "general" ? "General Training" : "Academic"} · {p.kind}</b><br /><span className="small muted">{p.text.slice(0, 120)}…</span></span><Icon name="arrow" /></button></li>)}</ul></div>;
  }
  if (path[0] === "speaking" && path[1]) {
    const cue = c.ielts.cueCards.find((x) => x.id === path[1]);
    if (!cue) return null;
    const part1 = c.ielts.part1[0];
    return <div><Back to="/practice/speaking" /><div className="card"><SpeakingTask part1={part1.questions.slice(0, 2)} card={cue} onDone={() => navigate("/practice")} /><details className="card soft" style={{ marginTop: 16 }}><summary>Part 3 discussion questions</summary><ul>{cue.followUp.map((f) => <li key={f}>{f}</li>)}</ul></details></div></div>;
  }
  if (path[0] === "speaking") return <div><Back to="/practice" /><h1>Speaking cue cards</h1><ul className="list card">{c.ielts.cueCards.map((cc) => <li key={cc.id}><button className="rowbtn" onClick={() => navigate(`/practice/speaking/${cc.id}`)}><span className="grow">{cc.title}</span><Icon name="arrow" /></button></li>)}</ul></div>;
  if (path[0] === "mistakes") return <div><Back to="/practice" /><div className="card"><FixMistakes max={10} onDone={() => navigate("/practice")} /></div><MistakeList /></div>;
  if (path[0] === "grammar-mix") {
    const learned = c.grammar.filter((t) => !!grammar[t.id]?.learnedAt);
    return <div><Back to="/practice" /><div className="card"><GrammarReview topics={learned.slice(-6)} count={10} onDone={() => navigate("/practice")} /></div></div>;
  }
  if (path[0] === "official") {
    const official = c.ielts.official.filter((t) => goal === "ielts-ac" ? t.module !== "general" : goal === "ielts-gt" ? t.module !== "academic" : true);
    const skills = ["listening", "reading", "writing", "speaking", "full"];
    return (
      <div>
        <Back to="/practice" />
        <h1>Official IELTS practice</h1>
        <p className="muted">These are free practice materials from the official IELTS partners. They open on their website. Real past exam papers are never published, and official material can't be copied into Fluent365 — but you can record your score here to track progress.</p>
        {skills.map((sk) => {
          const list = official.filter((t) => t.skill === sk);
          if (!list.length) return null;
          return (
            <div key={sk}>
              <h2 style={{ textTransform: "capitalize" }}>{sk}</h2>
              <ul className="list card">
                {list.map((t) => (
                  <li key={t.id}>
                    <div className="row"><span className="grow"><b>{t.title}</b><br /><span className="small muted">{t.provider} · {t.module}{t.minutes ? ` · ${t.minutes} min` : ""}{t.notes ? ` · ${t.notes}` : ""}</span></span>
                      <a className="btn outline" href={t.url} target="_blank" rel="noopener noreferrer">Open</a></div>
                    {t.questions ? (
                      <div className="row" style={{ marginTop: 8 }}>
                        <label className="row small">My score <input type="number" min={0} max={t.questions} value={score[t.id] ?? ""} onChange={(e) => setScore({ ...score, [t.id]: e.target.value })} style={{ width: 90 }} aria-label={`Score for ${t.title}`} /> / {t.questions}</label>
                        <button className="btn" disabled={!score[t.id]} onClick={() => { update((s) => ({ tests: [{ id: `${t.id}-${Date.now()}`, at: new Date().toISOString(), kind: "official", ref: t.id, title: t.title, score: Number(score[t.id]), of: t.questions! }, ...s.tests] })); toast("Score saved in Progress"); setScore({ ...score, [t.id]: "" }); }}>Save</button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    );
  }
  const open = mistakes.filter((m) => !m.fixed).length;
  const tile = (to: string, title: string, sub: string) => (
    <button className="btn option" style={{ flexDirection: "column", alignItems: "flex-start", minHeight: 90 }} onClick={() => navigate(to)}>
      <b>{title}</b><span className="small muted" style={{ fontWeight: 400 }}>{sub}</span>
    </button>
  );
  return (
    <div>
      <h1>Practice</h1>
      <p className="muted">Extra practice. Your daily session already includes a balanced mix.</p>
      <div className="grid2">
        {tile("/reading", "Lessons & reading", `${c.lessons.length} topic lessons and 6 courses`)}
        {tile("/practice/speaking", "Speaking", `${c.ielts.cueCards.length} cue cards with Part 3 questions`)}
        {tile("/practice/writing", "Writing", `${c.ielts.writing.length} Task 1 & 2 prompts`)}
        {tile("/reading/course/ielts-listening-tests", "Listening tests", "2 full practice tests, exam mode")}
        {tile("/reading/course/ielts-reading-mock", "Reading mock", "3 passages, 20 minutes each")}
        {tile("/practice/official", "Official IELTS tests", `${c.ielts.official.length} free official practice links`)}
        {tile("/practice/mistakes", "My mistakes", `${open} to fix`)}
        {tile("/grammar", "Grammar topics", `${c.grammar.length} topics`)}
        {tile("/settings/import", "Import (Praktika, PDF, text)", "Bring in words and corrections")}
      </div>
      {tests.length > 0 && <p className="small muted" style={{ marginTop: 12 }}>Last test: {tests[0].title} — {tests[0].score}/{tests[0].of}</p>}
    </div>
  );
}

function MistakeList() {
  const mistakes = useApp((s) => s.mistakes);
  return (
    <div className="card">
      <h2>Mistake notebook</h2>
      {mistakes.length === 0 && <p className="muted">No mistakes recorded yet.</p>}
      <ul className="list">
        {mistakes.slice(0, 100).map((m) => (
          <li key={m.id}>
            <p style={{ margin: 0 }}><b>{m.prompt}</b></p>
            <p className="small" style={{ margin: 0 }}><span style={{ color: "var(--bad)" }}>{m.given}</span> → <span style={{ color: "var(--good)" }}>{m.expected}</span></p>
            <p className="small muted" style={{ margin: 0 }}>{new Date(m.at).toLocaleDateString()} · {m.kind}{m.fixed ? " · fixed ✓" : ""}{m.source ? ` · ${m.source}` : ""}</p>
          </li>
        ))}
      </ul>
      <ActionBar><span /></ActionBar>
    </div>
  );
}
