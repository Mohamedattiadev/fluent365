// The guided daily session: one step after another, the learner just presses Next.
import { useEffect, useMemo, useState } from "react";
import { CourseUnitView, LessonStepView } from "../components/Lessons";
import { GrammarLesson, GrammarReview } from "../components/Grammar";
import { Dictation, dictationSentences, FixMistakes, Fluency, Recall, SpeakPrompt, SpeakingTask, WritingTask } from "../components/Skills";
import { NewWords, ReviewSession } from "../components/Vocab";
import { ActionBar, Icon, Progress, SkillLabel, SKILLS } from "../components/ui";
import { Reader } from "../components/Reader";
import { dailyTarget } from "../lib/reading";
import type { Content } from "../lib/content";
import { buildSession, dayNumber, phaseOf, skillOf } from "../lib/session";
import { bumpDay, getState, today, update, useApp } from "../lib/store";
import type { SessionStep } from "../lib/types";
import { navigate } from "../router";

export function ensureSession(c: Content, minutes?: 30 | 60 | 90) {
  const s = getState();
  if (s.session && s.session.date === today() && !minutes) return s.session;
  const session = buildSession(c, s, minutes ?? s.settings.minutes);
  update(() => ({ session }));
  return session;
}

function advance() {
  update((s) => {
    if (!s.session) return {};
    const index = s.session.index + 1;
    const finished = index >= s.session.steps.length ? new Date().toISOString() : undefined;
    const session = { ...s.session, index, finished };
    if (finished) {
      return { session, history: [session, ...s.history.filter((h) => h.date !== session.date)].slice(0, 60) };
    }
    return { session };
  });
  const s = getState();
  if (s.session?.finished) bumpDay((d) => ({ ...d, sessionDone: true }));
  window.scrollTo({ top: 0 });
}

export function SessionScreen({ c }: { c: Content }) {
  const session = useApp((s) => s.session);
  const stale = !session || session.date !== today();
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { if (stale) ensureSession(c); }, [stale, c]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setConfirm((v) => !v); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (!session || stale) return null;
  const step = session.steps[session.index];
  const visible = session.steps.filter((s) => s.kind !== "wrap").length;
  const isWrap = !step || step.kind === "wrap";
  const sk = step ? skillOf(step) : undefined;
  return (
    <div className="focus">
      {!isWrap && (
        <div className="session-top">
          <button className="icon-btn" onClick={() => setConfirm(true)} aria-label="Close the session"><Icon name="close" /></button>
          <Progress value={session.index / visible} label={`Step ${session.index + 1} of ${visible}`} />
          <span className="count" aria-hidden>{session.index + 1} / {visible}</span>
        </div>
      )}
      {confirm && !isWrap && (
        <div className="scrim" onClick={() => setConfirm(false)}>
          <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="leave-h" aria-describedby="leave-p" onClick={(e) => e.stopPropagation()}>
            <h2 id="leave-h">Leave the session?</h2>
            <p id="leave-p">Your place is saved. You can continue from Today at any time.</p>
            <div className="actions">
              <button className="btn quiet" onClick={() => setConfirm(false)} autoFocus>Stay</button>
              <button className="btn quiet" onClick={() => navigate("/")}>Leave</button>
            </div>
          </div>
        </div>
      )}
      {step ? (
        <>
          {!isWrap && (
            <header className="step-head">
              <SkillLabel skill={sk} text={sk && step.title.toLowerCase().startsWith(SKILLS[sk].label.toLowerCase()) ? step.title.split(" · ").slice(1).join(" · ") || undefined : step.title} />
              {step.kind !== "speak" && <p className="why">{step.why} <span className="faint">· about {step.minutes} min</span></p>}
            </header>
          )}
          <div className="step-body"><div className="card"><StepView key={step.id} c={c} step={step} onDone={advance} /></div></div>
        </>
      ) : (
        <Wrap c={c} />
      )}
    </div>
  );
}

function StepView({ c, step, onDone }: { c: Content; step: SessionStep; onDone: () => void }) {
  const ref = step.ref ?? {};
  const dictation = useMemo(() => (step.kind === "dictation" ? dictationSentences(c, 3) : []), [step, c]);
  switch (step.kind) {
    case "recall":
      return <Recall items={(ref.words ?? []).map((id) => c.vocabById.get(id)!).filter(Boolean)} onDone={onDone} />;
    case "review":
      return <ReviewSession c={c} limit={step.minutes * 6} onDone={onDone} />;
    case "grammar-review":
      return <GrammarReview topics={(ref.topics ?? []).map((id) => c.grammarById.get(id)!).filter(Boolean)} onDone={onDone} />;
    case "mistakes":
      return <FixMistakes onDone={onDone} />;
    case "dictation":
      return dictation.length ? <Dictation sentences={dictation} onDone={onDone} /> : <Skip onDone={onDone} />;
    case "fluency": {
      const cue = c.ielts.cueCards.find((x) => x.id === ref.cue) ?? c.ielts.cueCards[0];
      return <Fluency cue={cue} minutes={step.minutes} onDone={onDone} />;
    }
    case "book": {
      const info = c.books.find((b) => b.id === ref.book);
      return info ? <Reader c={c} info={info} target={dailyTarget(getState(), c.books)} onDone={onDone} /> : <Skip onDone={onDone} />;
    }
    case "speak":
      return <OptionalSpeak c={c} cueId={ref.cue} onDone={onDone} />;
    case "wrap":
      return <Wrap c={c} onDone={onDone} />;
  }
  if (ref.lesson != null && ref.step != null) return <LessonStepView c={c} lesson={ref.lesson} step={ref.step} onDone={onDone} />;
  if (step.kind === "pretech" && ref.words) return <NewWords c={c} ids={ref.words} onDone={onDone} />;
  if (step.kind === "grammar" && ref.topic) {
    const t = c.grammarById.get(ref.topic);
    return t ? <GrammarLesson topic={t} onDone={onDone} /> : <Skip onDone={onDone} />;
  }
  if (step.kind === "input" && ref.course && ref.unit) return <CourseUnitView courseId={ref.course} unitId={ref.unit} onDone={onDone} />;
  if (step.kind === "output") {
    if (ref.prompt) {
      const p = c.ielts.writing.find((x) => x.id === ref.prompt);
      if (p) return <WritingTask title={`Writing Task ${p.task}${p.module === "general" ? " (General Training)" : ""}`} prompt={p.text} data={p.data} minutes={p.task === 1 ? 20 : 40} minWords={p.task === 1 ? 150 : 250} tip={p.points?.length ? `Cover every point: ${p.points.join("; ")}.` : undefined} promptId={p.id} onDone={onDone} />;
    }
    const cue = c.ielts.cueCards.find((x) => x.id === ref.cue) ?? c.ielts.cueCards[0];
    const part1 = c.ielts.part1[new Date().getDate() % c.ielts.part1.length];
    return <SpeakingTask part1={part1.questions.slice(0, 3)} card={cue} onDone={onDone} />;
  }
  return <Skip onDone={onDone} />;
}

/** The last card: an optional speaking topic for HelloTalk / Praktika. Skipping is one tap. */
function OptionalSpeak({ c, cueId, onDone }: { c: Content; cueId?: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  if (open) return <SpeakPrompt c={c} cueId={cueId} onDone={onDone} />;
  const cue = c.ielts.cueCards.find((x) => x.id === cueId);
  return (
    <div>
      <h2>Want to speak today?</h2>
      <p>{cue ? <>Topic: <b>{cue.title.replace(/\.$/, "")}</b></> : "A topic to talk about"}, with questions, your newest words and a grammar pattern to use in HelloTalk or Praktika.</p>
      <p className="small muted">Optional. Your study for today is already done.</p>
      <ActionBar>
        <button className="btn big primary" onClick={() => setOpen(true)}>Show the topic</button>
        <button className="btn quiet" style={{ width: "100%" }} onClick={onDone}>Skip</button>
      </ActionBar>
    </div>
  );
}

const Skip = ({ onDone }: { onDone: () => void }) => (
  <div className="center"><p className="muted">Nothing to do here today.</p><ActionBar><button className="btn big primary" onClick={onDone}>Continue</button></ActionBar></div>
);

function Wrap({ c, onDone }: { c: Content; onDone?: () => void }) {
  const s = getState();
  const day = s.days[today()];
  const known = Object.values(s.cards).filter((x) => x.card.stability >= 21).length + Object.keys(s.known).length;
  const weekMinutes = Object.entries(s.days).filter(([d]) => Date.now() - new Date(d).getTime() < 7 * 86400000).reduce((n, [, d]) => n + d.active, 0) / 60;
  const phase = phaseOf(s);
  return (
    <div style={{ paddingTop: 32 }}>
      <p className="overline">Day {dayNumber(s)} of 365 · {phase === "IELTS" ? "IELTS phase" : `${phase} phase`}</p>
      <h1>Well done</h1>
      <p className="lede">That's today's session.</p>
      <div className="stats">
        <div><p className="big-number">{Math.round((day?.active ?? 0) / 60)}</p><p className="label">active minutes today</p></div>
        <div><p className="big-number">{known}</p><p className="label">words you know well</p></div>
        <div><p className="big-number">{Math.round(weekMinutes)}</p><p className="label">minutes this week</p></div>
      </div>
      <p className="small muted">Tomorrow's session is ready when you are. Short on time? Settings → Daily time → 30 minutes.</p>
      <ActionBar>
        <button className="btn big primary" onClick={() => { onDone?.(); navigate("/"); }}>Finish <Icon name="check" /></button>
      </ActionBar>
      <span className="sr-only">{c.lessons.length}</span>
    </div>
  );
}
