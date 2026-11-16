// The guided daily session: one step after another, the learner just presses Next.
import { useEffect, useMemo } from "react";
import { CourseUnitView, LessonStepView } from "../components/Lessons";
import { GrammarLesson, GrammarReview } from "../components/Grammar";
import { Dictation, dictationSentences, FixMistakes, Fluency, Recall, SpeakingTask, WritingTask } from "../components/Skills";
import { NewWords, ReviewSession } from "../components/Vocab";
import { ActionBar, Icon } from "../components/ui";
import type { Content } from "../lib/content";
import { buildSession, dayNumber, phaseOf } from "../lib/session";
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
  useEffect(() => { if (stale) ensureSession(c); }, [stale, c]);
  if (!session || stale) return null;
  const step = session.steps[session.index];
  return (
    <div className="focus">
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn link" onClick={() => navigate("/")} aria-label="Pause and go home"><Icon name="back" /> Pause</button>
        <div className="grow steps-dots" aria-label={`Step ${Math.min(session.index + 1, session.steps.length)} of ${session.steps.length}`}>
          {session.steps.filter((s) => s.kind !== "wrap").map((s, i) => <span key={s.id} className={i < session.index ? "done" : i === session.index ? "now" : ""} />)}
        </div>
      </div>
      {step ? (
        <>
          {step.kind !== "wrap" && (
            <div className="small muted" style={{ marginBottom: 8 }}>
              <b>{step.title}</b> · about {step.minutes} min
              <div>{step.why}</div>
            </div>
          )}
          <div className="card"><StepView key={step.id} c={c} step={step} onDone={advance} /></div>
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
    <div className="center">
      <h1>Well done!</h1>
      <p className="muted">That's today's session. Day {dayNumber(s)} of your 365-day plan · {phase === "IELTS" ? "IELTS phase" : `${phase} phase`}</p>
      <div className="grid2" style={{ textAlign: "left" }}>
        <div className="card"><p className="big-number">{Math.round((day?.active ?? 0) / 60)}</p><p className="muted">active minutes today</p></div>
        <div className="card"><p className="big-number">{known}</p><p className="muted">words you know well</p></div>
        <div className="card"><p className="big-number">{Math.round(weekMinutes)}</p><p className="muted">minutes this week</p></div>
      </div>
      <p className="small muted">Tomorrow's session is ready when you are. Short on time? Settings → Daily time → 30 minutes.</p>
      <ActionBar>
        <button className="btn big primary" onClick={() => { onDone?.(); navigate("/"); }}>Finish <Icon name="check" /></button>
      </ActionBar>
      <span className="sr-only">{c.lessons.length}</span>
    </div>
  );
}
