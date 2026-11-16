// Heavy practice (writing tasks, cue cards, official IELTS links, mocks) belongs to the Local app.
// Hidden in Pocket: nothing links here; the code is kept for porting (see docs/DEVELOPMENT_STATUS.md).
import { useState } from "react";
import { GrammarReview } from "../components/Grammar";
import { FixMistakes, SpeakingTask, WritingTask } from "../components/Skills";
import { Icon, SkillBadge, SkillLabel, skillStyle, toast, type Skill } from "../components/ui";
import { COURSES, type Content } from "../lib/content";
import { dueCardKeys } from "../lib/learning";
import { update, useApp } from "../lib/store";
import { navigate } from "../router";
import { Back } from "./Learn";

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
  if (path[0] === "mistakes") return <div><Back to="/practice" /><SkillLabel skill="grammar" text="My mistakes" /><FixMistakes max={10} onDone={() => navigate("/practice")} /></div>;
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

