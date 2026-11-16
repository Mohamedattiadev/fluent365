// Free-browse screens (the guided session is the main path; these are for extra practice).
import { useEffect, useMemo, useState } from "react";
import { GrammarLesson, GrammarReview } from "../components/Grammar";
import { CourseUnitView, LessonStepView } from "../components/Lessons";
import { FixMistakes, SpeakingTask, WritingTask } from "../components/Skills";
import { cardView, NewWords, ReviewSession, WordFace, viewOf } from "../components/Vocab";
import { Reader } from "../components/Reader";
import { Progress as Bar } from "../components/ui";
import { currentBook, dailyTarget, readToday, remainingWords, setPosition } from "../lib/reading";
import { Icon, SkillBadge, SkillLabel, skillStyle, SpeakButton, toast, type Skill } from "../components/ui";
import { COURSES, loadCourse, type Content } from "../lib/content";
import { addCards, dueCardKeys, markKnown } from "../lib/learning";
import { kindName, POCKET_KINDS, pocketStepCount } from "../lib/session";
import { interval, statusOf } from "../lib/srs";
import { update, useApp } from "../lib/store";
import type { Course } from "../lib/types";
import { navigate } from "../router";

const Back = ({ to, label = "Back" }: { to: string; label?: string }) => (
  <button className="btn quiet" style={{ marginLeft: -10 }} onClick={() => navigate(to)}><Icon name="back" size={20} /> {label}</button>
);
const Done = () => <span className="status"><Icon name="check" size={18} /> Done</span>;

// ---------- Grammar ----------
export function GrammarScreen({ c, path }: { c: Content; path: string[] }) {
  const mastery = useApp((s) => s.grammar);
  if (path[0]) {
    const t = c.grammarById.get(path[0]);
    if (!t) return <p>Topic not found.</p>;
    return <div><Back to="/grammar" /><SkillLabel skill="grammar" text={t.level} /><GrammarLesson topic={t} onDone={() => navigate("/grammar")} /></div>;
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
          {score !== null && <span className="small muted num" title="Average of recognition, practice, production and automatic use">{score}% mastery</span>}
          <Icon name="arrow" />
        </button>
      </li>
    );
  };
  return (
    <div>
      <SkillLabel skill="grammar" />
      <h1>Grammar</h1>
      <p className="lede">Your daily session teaches these in order. Open any topic to practise it now.</p>
      <h2 className="section-title">Grammar Instinct: core patterns</h2>
      <ul className="list">{core.map((t) => <Row key={t.id} id={t.id} title={t.title} level={t.level} />)}</ul>
      <h2 className="section-title">Grammar from the lessons</h2>
      <ul className="list">{lesson.map((t) => <Row key={t.id} id={t.id} title={t.title} level={t.level} />)}</ul>
    </div>
  );
}

// ---------- Vocabulary ----------
export function WordsScreen({ c, path }: { c: Content; path: string[] }) {
  if (path[0] === "review") return <div><Back to="/words" /><SkillLabel skill="words" text="Review" /><ReviewSession c={c} limit={200} onDone={() => navigate("/words")} /></div>;
  if (path[0] === "learn") {
    const ids = path[1]?.split(",").map(Number).filter(Boolean) ?? [];
    return <div><Back to="/words" /><SkillLabel skill="words" text="New words" /><NewWords c={c} ids={ids} onDone={() => navigate("/words")} /></div>;
  }
  return <WordList c={c} />;
}

type WordTab = "learning" | "learned" | "known" | "hard" | "all";

/** Your words, sorted into Learning / Learned / Known / Difficult, plus the whole dictionary. */
function WordList({ c }: { c: Content }) {
  const cards = useApp((s) => s.cards);
  const known = useApp((s) => s.known);
  const [q, setQ] = useState("");
  const [band, setBand] = useState("all");
  const [list, setList] = useState("all");
  const [open, setOpen] = useState<string | null>(null);
  const due = dueCardKeys().length;

  // Every card you have, with its view and status. Imported/Anki words (custom cards) are included.
  const mine = useMemo(() => Object.entries(cards).map(([key, mc]) => {
    const view = cardView(key, mc, c);
    const status = statusOf(mc.card.fresh ? undefined : mc.card);
    return view ? { key, view, mc, learned: status === "learned", hard: mc.card.lapses > 0 || mc.card.difficulty >= 7 } : null;
  }).filter((x): x is NonNullable<typeof x> => !!x), [cards, c]);
  const knownList = useMemo(() => Object.keys(known).map((k) => c.vocabById.get(Number(k))).filter((v): v is NonNullable<typeof v> => !!v).sort((a, b) => a.w.localeCompare(b.w)), [known, c]);
  const counts = { learning: mine.filter((x) => !x.learned).length, learned: mine.filter((x) => x.learned).length, known: knownList.length, hard: mine.filter((x) => x.hard).length };
  const [tab, setTab] = useState<WordTab>(() => (Object.keys(cards).length ? "learning" : "all"));
  const needle = q.trim().toLowerCase();
  const hit = (w: string, d?: string, tr?: string) => !needle || w.toLowerCase().includes(needle) || (d ?? "").toLowerCase().includes(needle) || (tr ?? "").toLowerCase().includes(needle);

  type Row = { key: string; w: string; d?: string; right: string; vocabId?: number };
  const rows: Row[] = useMemo(() => {
    const now = Date.now();
    const when = (dueAt: string) => { const ms = new Date(dueAt).getTime() - now; return ms <= 0 ? "due now" : `in ${interval(ms)}`; };
    if (tab === "known") return knownList.filter((v) => hit(v.w, v.d, v.tr)).map((v) => ({ key: String(v.id), w: v.w, d: v.d, right: "known", vocabId: v.id }));
    if (tab === "all") {
      const out: Row[] = [];
      for (const v of c.vocab) {
        if (band !== "all" && String(v.band) !== band) continue;
        if (list !== "all" && !v.src.includes(list)) continue;
        if (!hit(v.w, v.d, v.tr)) continue;
        const card = cards[String(v.id)];
        out.push({ key: String(v.id), w: v.w, d: v.d, right: card ? (statusOf(card.card) === "learned" ? "learned" : "learning") : known[String(v.id)] ? "known" : "", vocabId: v.id });
        if (out.length >= 80) break;
      }
      return out;
    }
    const pick = mine.filter((x) => (tab === "learned" ? x.learned : tab === "hard" ? x.hard : !x.learned) && hit(x.view.w, x.view.d, x.view.tr));
    pick.sort((a, b) => (tab === "learned" ? (a.mc.card.lastReviewAt ?? "") < (b.mc.card.lastReviewAt ?? "") ? 1 : -1 : new Date(a.mc.card.dueAt).getTime() - new Date(b.mc.card.dueAt).getTime()));
    return pick.map((x) => ({ key: x.key, w: x.view.w, d: x.view.d, right: x.mc.card.fresh ? "new" : when(x.mc.card.dueAt), vocabId: Number.isNaN(Number(x.key)) ? undefined : Number(x.key) }));
  }, [tab, mine, knownList, c, band, list, needle, cards, known]); // eslint-disable-line react-hooks/exhaustive-deps

  const TABS: [WordTab, string][] = [["learning", `Learning ${counts.learning}`], ["learned", `Learned ${counts.learned}`], ["known", `Known ${counts.known}`], ["hard", `Difficult ${counts.hard}`], ["all", "All words"]];
  const explain: Record<WordTab, string> = {
    learning: "Words in your reviews that are not solid yet. Sorted by when they come back.",
    learned: "The review scheduler estimates you will still remember these after 3 weeks or more. They still come back now and then.",
    known: "Words you marked as already known. They are never shown as new words.",
    hard: "Words you forgot at least once or found hard. They come back more often.",
    all: `All ${c.vocab.length.toLocaleString()} words in Fluent365. Tap one to add it to your reviews.`,
  };

  return (
    <div>
      <SkillLabel skill="words" />
      <h1>Words</h1>
      {due > 0 && <button className="btn big primary" style={{ marginBottom: 16 }} onClick={() => navigate("/words/review")}>Review {due} words now <Icon name="arrow" /></button>}
      <div className="tabs" role="tablist" aria-label="Word lists">
        {TABS.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} className={`chip ${tab === k ? "on" : ""}`} onClick={() => { setTab(k); setOpen(null); }}>{label}</button>)}
      </div>
      <p className="small muted" style={{ margin: "8px 0 12px" }}>{explain[tab]}</p>
      <label className="field"><span className="sr-only">Search</span><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search words or meanings" /></label>
      {tab === "all" && (
        <div className="grid2">
          <label className="field"><span>Frequency</span><select value={band} onChange={(e) => setBand(e.target.value)}><option value="all">All</option><option value="1">Top 1,000</option><option value="2">1,000–2,000</option><option value="3">2,000–3,000</option><option value="5">3,000–5,000</option><option value="9">5,000+</option></select></label>
          <label className="field"><span>Collection</span><select value={list} onChange={(e) => setList(e.target.value)}><option value="all">All</option><option value="ngsl">General (NGSL)</option><option value="nawl">Academic (NAWL)</option><option value="spoken">Spoken</option><option value="tsl">Work & business (TSL)</option><option value="lesson">IELTS lesson words</option><option value="phrasal">Phrasal verbs</option><option value="collocation">Collocations</option><option value="linking">Linking words</option></select></label>
        </div>
      )}
      <ul className="list" aria-live="polite">
        {rows.length === 0 && <li className="muted small">{tab === "all" || needle ? "No words found." : tab === "learned" ? "No learned words yet. Keep reviewing: words move here after about 3 weeks of remembering them." : "Nothing here yet."}</li>}
        {rows.map((r) => {
          const v = r.vocabId != null ? c.vocabById.get(r.vocabId) : undefined;
          const card = cards[r.key];
          const view = card ? cardView(r.key, card, c) : v ? viewOf(v) : null;
          return (
            <li key={r.key}>
              <button className="rowbtn" onClick={() => setOpen(open === r.key ? null : r.key)} aria-expanded={open === r.key}>
                <span className="grow"><span style={{ display: "block" }}>{r.w}</span><span className="small muted">{r.d ? (r.d.length > 70 ? `${r.d.slice(0, 70)}…` : r.d) : ""}</span></span>
                {r.right && <span className="small muted num" style={{ whiteSpace: "nowrap" }}>{r.right}</span>}
              </button>
              {open === r.key && view && (
                <div className="card soft" style={{ margin: "0 16px 12px" }}>
                  <WordFace v={view} showWord={false} />
                  <div className="row">
                    <SpeakButton text={view.ex ? `${view.w}. ${view.ex}` : view.w} />
                    {!card && v && <button className="btn outline" onClick={() => { addCards([String(v.id)]); toast(`"${v.w}" added to your reviews`); }}>Add to my reviews</button>}
                    {v && (!known[String(v.id)] ? <button className="btn quiet" onClick={() => markKnown(String(v.id))}>I know it</button> : <button className="btn quiet" onClick={() => markKnown(String(v.id), false)}>Not known</button>)}
                  </div>
                  {card && !card.card.fresh && <p className="small muted" style={{ margin: "8px 0 0" }}>Reviewed {card.card.reps}× · forgotten {card.card.lapses}× · next review {new Date(card.card.dueAt).toLocaleDateString()}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {tab === "all" && <p className="small muted">{c.licence}</p>}
    </div>
  );
}

// ---------- Reading & lessons ----------
export function ReadingScreen({ c, path }: { c: Content; path: string[] }) {
  const lessons = useApp((s) => s.lessons);
  const reading = useApp((s) => s.reading);
  const st = useApp((s) => s);
  const coursework = useApp((s) => s.coursework);
  const [course, setCourse] = useState<Course | null>(null);
  useEffect(() => { if (path[0] === "course" && path[1]) loadCourse(path[1]).then(setCourse); }, [path]);
  if (path[0] === "book" && path[1]) {
    const info = c.books.find((b) => b.id === path[1]);
    if (!info) return <p>Book not found.</p>;
    return <div><Back to="/reading" /><Reader c={c} info={info} target={dailyTarget(st, c.books)} onDone={() => navigate("/reading")} /></div>;
  }
  if (path[0] === "chapters" && path[1]) {
    const info = c.books.find((b) => b.id === path[1]);
    if (!info) return <p>Book not found.</p>;
    const at = reading.books[info.id]?.block ?? 0;
    return (
      <div>
        <Back to="/reading" />
        <h1>{info.title}</h1>
        <p className="lede">{info.author} · {info.year} · ≈ {info.level} · {info.words.toLocaleString()} words</p>
        <ul className="list">{info.chapters.map((ch) => (
          <li key={ch.start}><button className="rowbtn" onClick={() => { setPosition(info.id, ch.start); navigate(`/reading/book/${info.id}`); }}>
            <span className="grow">{ch.title}</span>{ch.start <= at && at > 0 && <span className="small muted">read</span>}<Icon name="chevron" />
          </button></li>
        ))}</ul>
      </div>
    );
  }
  if (path[0] === "lesson" && path[1]) {
    const n = Number(path[1]);
    if (path[2] != null) return <div><Back to={`/reading/lesson/${n}`} label={`Lesson ${n}`} /><LessonStepView c={c} lesson={n} step={Number(path[2])} onDone={() => navigate(`/reading/lesson/${n}`)} /></div>;
    const info = c.lessons.find((l) => l.number === n);
    if (!info) return <p>Lesson not found.</p>;
    const done = new Set(lessons[n]?.done ?? []);
    return (
      <div>
        <Back to="/reading" />
        <h1>Lesson {n}: {info.title}</h1>
        <p className="lede">{info.level} · {info.topic}. {info.goal}</p>
        <ul className="plan">
          {info.kinds.map((k, i) => {
            if (!POCKET_KINDS.includes(k)) return null; // writing and speaking tasks live in the Local app
            const sk = KIND_SKILL[k];
            return (
              <li key={i} style={skillStyle(sk)} className={done.has(i) ? "done" : undefined}>
                <button className="rowbtn" onClick={() => navigate(`/reading/lesson/${n}/${i}`)}>
                  <SkillBadge skill={sk} icon={done.has(i) ? "check" : undefined} /><span className="grow name">{i + 1}. {kindName(k)}</span>{done.has(i) && <Done />}<Icon name="chevron" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
  if (path[0] === "course" && path[1]) {
    if (path[2]) return <div><Back to={`/reading/course/${path[1]}`} /><CourseUnitView courseId={path[1]} unitId={path[2]} onDone={() => navigate(`/reading/course/${path[1]}`)} /></div>;
    if (!course) return null;
    return (
      <div>
        <Back to="/reading" />
        <h1>{course.title}</h1>
        <p className="lede">{course.description}</p>
        <ul className="list">{course.units.map((u) => <li key={u.id}><button className="rowbtn" onClick={() => navigate(`/reading/course/${course.id}/${u.id}`)}><span className="grow"><b>{u.title}</b><br /><span className="small muted">{u.goal}</span></span>{coursework[`${course.id}/${u.id}`]?.done && <Done />}<Icon name="chevron" /></button></li>)}</ul>
      </div>
    );
  }
  return (
    <div>
      <SkillLabel skill="reading" />
      <h1>Reading</h1>
      <BookLadder c={c} />
      <h2 className="section-title">Lessons</h2>
      <p className="small muted">{c.lessons.length} topic lessons, each with words, listening, reading and grammar. Your daily session goes through them in order.</p>
      <ul className="list">
        {c.lessons.map((l) => {
          const p = lessons[l.number];
          return (
            <li key={l.number}><button className="rowbtn" onClick={() => navigate(`/reading/lesson/${l.number}`)}>
              <span className="grow"><b>{l.number}. {l.title}</b><br /><span className="small muted">{l.level} · {l.topic}</span></span>
              {p?.finished ? <Done /> : p?.done.length ? <span className="small muted num">{Math.min(p.done.length, pocketStepCount(l.kinds))} of {pocketStepCount(l.kinds)}</span> : null}
              <Icon name="arrow" />
            </button></li>
          );
        })}
      </ul>
      <h2 className="section-title">Courses</h2>
      <ul className="list">{COURSES.filter((id) => !id.includes("writing")).map((id) => <li key={id}><button className="rowbtn" onClick={() => navigate(`/reading/course/${id}`)}><span className="grow"><b>{courseName(id)}</b></span><Icon name="chevron" /></button></li>)}</ul>
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
    return <div><Back to="/practice/writing" /><SkillLabel skill="writing" text={`Task ${p.task}`} /><div><WritingTask title={`Writing Task ${p.task}`} prompt={p.text} data={p.data} minutes={p.task === 1 ? 20 : 40} minWords={p.task === 1 ? 150 : 250} tip={p.points?.length ? `Cover every point: ${p.points.join("; ")}.` : undefined} promptId={p.id} onDone={() => navigate("/practice")} /></div></div>;
  }
  if (path[0] === "writing") {
    const list = c.ielts.writing.filter((p) => goal === "ielts-ac" ? p.module === "academic" : true);
    return <div><SkillLabel skill="writing" /><h1>Writing tasks</h1><p className="lede">Timed IELTS-style prompts with a word count, self-check and a rewrite step.</p><ul className="list">{list.map((p) => <li key={p.id}><button className="rowbtn" onClick={() => navigate(`/practice/writing/${p.id}`)}><span className="grow"><b>Task {p.task} · {p.module === "general" ? "General Training" : "Academic"} · {p.kind}</b><br /><span className="small muted">{p.text.slice(0, 120)}…</span></span><Icon name="chevron" /></button></li>)}</ul></div>;
  }
  if (path[0] === "speaking" && path[1]) {
    const cue = c.ielts.cueCards.find((x) => x.id === path[1]);
    if (!cue) return null;
    const part1 = c.ielts.part1[0];
    return <div><Back to="/practice/speaking" /><SkillLabel skill="speaking" text="Cue card" /><div><SpeakingTask part1={part1.questions.slice(0, 2)} card={cue} onDone={() => navigate("/practice")} /><details style={{ marginTop: 16 }}><summary>Part 3 discussion questions</summary><ul>{cue.followUp.map((f) => <li key={f}>{f}</li>)}</ul></details></div></div>;
  }
  if (path[0] === "speaking") return <div><SkillLabel skill="speaking" /><h1>Speaking cue cards</h1><p className="lede">Part 2 cue cards with 1 minute to prepare, a 2-minute talk and an optional recording on this device.</p><ul className="list">{c.ielts.cueCards.map((cc) => <li key={cc.id}><button className="rowbtn" onClick={() => navigate(`/practice/speaking/${cc.id}`)}><span className="grow">{cc.title}</span><Icon name="chevron" /></button></li>)}</ul></div>;
  if (path[0] === "mistakes") return <div><Back to="/practice" /><SkillLabel skill="grammar" text="My mistakes" /><FixMistakes max={10} onDone={() => navigate("/practice")} /><MistakeList /></div>;
  if (path[0] === "grammar-mix") {
    const learned = c.grammar.filter((t) => !!grammar[t.id]?.learnedAt);
    return <div><Back to="/practice" /><SkillLabel skill="grammar" text="Mixed review" /><GrammarReview topics={learned.slice(-6)} count={10} onDone={() => navigate("/practice")} /></div>;
  }
  if (path[0] === "official") {
    const official = c.ielts.official.filter((t) => goal === "ielts-ac" ? t.module !== "general" : goal === "ielts-gt" ? t.module !== "academic" : true);
    const skills = ["listening", "reading", "writing", "speaking", "full"];
    return (
      <div>
        <Back to="/practice" />
        <h1>Official IELTS practice</h1>
        <p className="lede">Free practice materials from the official IELTS partners. They open on their website. Real past exam papers are never published, and official material can't be copied into Fluent365, but you can record your practice score here to track progress.</p>
        {skills.map((sk) => {
          const list = official.filter((t) => t.skill === sk);
          if (!list.length) return null;
          return (
            <div key={sk}>
              <h2 className="section-title" style={{ textTransform: "capitalize" }}>{sk}</h2>
              <ul className="list">
                {list.map((t) => (
                  <li key={t.id}>
                    <div className="row"><span className="grow"><b>{t.title}</b><br /><span className="small muted">{t.provider} · {t.module}{t.minutes ? ` · ${t.minutes} min` : ""}{t.notes ? ` · ${t.notes}` : ""}</span></span>
                      <a className="btn outline" href={t.url} target="_blank" rel="noopener noreferrer">Open</a></div>
                    {t.questions ? (
                      <div className="row" style={{ marginTop: 8 }}>
                        <label className="row small">My score <input type="number" min={0} max={t.questions} value={score[t.id] ?? ""} onChange={(e) => setScore({ ...score, [t.id]: e.target.value })} style={{ width: 90 }} aria-label={`Score for ${t.title}`} /> / {t.questions}</label>
                        <button className="btn outline" disabled={!score[t.id]} onClick={() => { update((s) => ({ tests: [{ id: `${t.id}-${Date.now()}`, at: new Date().toISOString(), kind: "official", ref: t.id, title: t.title, score: Number(score[t.id]), of: t.questions! }, ...s.tests] })); toast("Score saved in Progress"); setScore({ ...score, [t.id]: "" }); }}>Save</button>
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
  const row = (to: string, title: string, sub: string, sk?: Skill, icon?: string) => (
    <li key={to} style={skillStyle(sk)}>
      <button className="rowbtn" onClick={() => navigate(to)}>
        <SkillBadge skill={sk} icon={icon} />
        <span className="grow"><span className="name">{title}</span><span className="detail">{sub}</span></span>
        <Icon name="chevron" />
      </button>
    </li>
  );
  return (
    <div>
      <h1>Practice</h1>
      <p className="lede">Extra practice. Your daily session already includes a balanced mix, so this is optional.</p>
      <h2 className="section-title">By skill</h2>
      <ul className="plan">
        {row("/words", "Words", `${dueCardKeys().length} due · search ${c.vocab.length.toLocaleString()} words`, "words")}
        {row("/grammar", "Grammar", `${c.grammar.length} topics`, "grammar")}
        {row("/reading", "Reading and lessons", `${c.lessons.length} topic lessons and ${COURSES.length} courses`, "reading")}
        {row("/listening", "Listening", "Practice tests and lesson recordings", "listening")}
        {row("/practice/writing", "Writing", `${c.ielts.writing.length} Task 1 and 2 prompts`, "writing")}
        {row("/practice/speaking", "Speaking", `${c.ielts.cueCards.length} cue cards with Part 3 questions`, "speaking")}
      </ul>
      <h2 className="section-title">Tests and review</h2>
      <ul className="plan">
        {row("/reading/course/ielts-listening-tests", "Listening tests", "2 full practice tests, exam mode", "listening", "timer")}
        {row("/reading/course/ielts-reading-mock", "Reading mock", "3 passages, 20 minutes each", "reading", "timer")}
        {row("/practice/official", "Official IELTS practice", `${c.ielts.official.length} free official links · log your practice score`, undefined, "list")}
        {row("/practice/mistakes", "My mistakes", `${open} to fix`, "grammar", "again")}
        {row("/practice/grammar-mix", "Mixed grammar review", "Questions from topics you have learned", "grammar", "grammar")}
        {row("/settings/import", "Import Centre", "Praktika PDFs, pasted corrections and words", undefined, "upload")}
      </ul>
      {tests.length > 0 && <p className="small muted" style={{ marginTop: 16 }}>Last practice score: {tests[0].title}: {tests[0].score}/{tests[0].of}</p>}
    </div>
  );
}

// ---------- Listening ----------
export function ListeningScreen({ c }: { c: Content }) {
  const lessons = useApp((s) => s.lessons);
  const coursework = useApp((s) => s.coursework);
  const [tests, setTests] = useState<Course | null>(null);
  useEffect(() => { void loadCourse("ielts-listening-tests").then(setTests).catch(() => undefined); }, []);
  const withAudio = c.lessons.map((l) => ({ l, i: l.kinds.indexOf("listen") })).filter((x) => x.i >= 0);
  return (
    <div>
      <SkillLabel skill="listening" />
      <h1>Listening</h1>
      <p className="lede">Recordings use your device's English voices. Your daily session also includes short dictations.</p>
      <h2 className="section-title">IELTS practice tests</h2>
      <ul className="list">
        {(tests?.units ?? []).map((u) => (
          <li key={u.id}><button className="rowbtn" onClick={() => navigate(`/reading/course/ielts-listening-tests/${u.id}`)}><span className="grow"><b>{u.title}</b><br /><span className="small muted">{u.goal}</span></span>{coursework[`ielts-listening-tests/${u.id}`]?.done && <Done />}<Icon name="chevron" /></button></li>
        ))}
      </ul>
      <h2 className="section-title">Lesson recordings</h2>
      <ul className="list">
        {withAudio.map(({ l, i }) => (
          <li key={l.number}><button className="rowbtn" onClick={() => navigate(`/reading/lesson/${l.number}/${i}`)}><span className="grow"><b>{l.number}. {l.title}</b><br /><span className="small muted">{l.level} · {l.topic}</span></span>{lessons[l.number]?.done.includes(i) && <Done />}<Icon name="chevron" /></button></li>
        ))}
      </ul>
    </div>
  );
}

const KIND_SKILL: Record<string, Skill> = { words: "words", listen: "listening", read: "reading", language: "grammar", write: "writing", speak: "speaking" };

function MistakeList() {
  const mistakes = useApp((s) => s.mistakes);
  return (
    <div className="section">
      <h2 className="section-title">Mistake notebook</h2>
      {mistakes.length === 0 && <p className="muted">No mistakes recorded yet.</p>}
      <ul className="list">
        {mistakes.slice(0, 100).map((m) => (
          <li key={m.id}>
            <p style={{ margin: 0 }}><b>{m.prompt}</b></p>
            <p className="small" style={{ margin: 0 }}><span className="diff"><span className="del">{m.given}</span></span> <Icon name="arrow" size={16} label="corrected to" /> <span style={{ color: "var(--success)", fontWeight: 600 }}>{m.expected}</span></p>
            <p className="small faint" style={{ margin: 0 }}>{new Date(m.at).toLocaleDateString()} · {m.kind}{m.fixed ? " · fixed" : ""}{m.source ? ` · ${m.source}` : ""}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Book ladder ----------
function BookLadder({ c }: { c: Content }) {
  const s = useApp((x) => x);
  if (!c.books.length) return null;
  const cur = currentBook(s, c.books);
  const target = dailyTarget(s, c.books);
  const today = readToday(s);
  const total = c.books.reduce((n, b) => n + b.words, 0);
  const done = total - remainingWords(s, c.books);
  return (
    <section>
      <p className="small muted">Your reading ladder: {c.books.length} classic books, easiest first, about {Math.round(total / 1000)},000 words in the 365-day plan. {done.toLocaleString()} words read so far · today {today.toLocaleString()} / {target.toLocaleString()} words.</p>
      {cur && (
        <div className="card">
          <p className="overline">Now reading · ≈ {cur.level}</p>
          <h2 style={{ margin: 0 }}>{cur.title}</h2>
          <p className="small muted">{cur.author} · {Math.round(((s.reading.books[cur.id]?.words ?? 0) / cur.words) * 100)}% read</p>
          <Bar value={(s.reading.books[cur.id]?.words ?? 0) / cur.words} />
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn primary" onClick={() => navigate(`/reading/book/${cur.id}`)}>{s.reading.books[cur.id] ? "Continue reading" : "Start reading"}</button>
            <button className="btn quiet" onClick={() => navigate(`/reading/chapters/${cur.id}`)}>Chapters</button>
          </div>
        </div>
      )}
      <ul className="list">
        {c.books.map((b, i) => {
          const p = s.reading.books[b.id];
          return (
            <li key={b.id}><button className="rowbtn" onClick={() => navigate(`/reading/chapters/${b.id}`)}>
              <span className="num muted" style={{ width: 20 }}>{i + 1}</span>
              <span className="grow"><span style={{ display: "block" }}>{b.title}</span><span className="small muted">{b.author} · ≈ {b.level} · {Math.round(b.words / 1000)}k words</span></span>
              {p?.finished ? <Done /> : p ? <span className="small muted num">{Math.round((p.words / b.words) * 100)}%</span> : null}
              <Icon name="chevron" />
            </button></li>
          );
        })}
      </ul>
      <p className="small muted">Public-domain texts (Project Gutenberg transcriptions, taken from Bo-ok). Levels are rough estimates. The English is 100+ years old: good for reading volume, while the lessons cover modern IELTS-style texts.</p>
    </section>
  );
}
