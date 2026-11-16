// Path lessons (one topic each: words → listen → read → grammar → write → speak) and course units.
import { useEffect, useState } from "react";
import { loadCourse, loadLesson, type Content } from "../lib/content";
import { addCards } from "../lib/learning";
import { pocketStepCount } from "../lib/session";
import { update, useApp } from "../lib/store";
import type { Course, Lesson, Unit } from "../lib/types";
import { ExerciseRunner, GrammarLesson } from "./Grammar";
import { blockToExercise, InputTask, Passage, SpeakingTask, WritingTask } from "./Skills";
import { ActionBar, Icon, Loading } from "./ui";
import { IntroCards, type CardView } from "./Vocab";

export function markLessonStep(lesson: number, step: number, total: number) {
  update((s) => {
    const cur = s.lessons[lesson] ?? { done: [] };
    const done = [...new Set([...cur.done, step])];
    return { lessons: { ...s.lessons, [lesson]: { done, finished: done.length >= total ? cur.finished ?? new Date().toISOString() : undefined } } };
  });
}

export function LessonStepView({ c, lesson: n, step, onDone }: { c: Content; lesson: number; step: number; onDone: () => void }) {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [error, setError] = useState(false);
  const lang = useApp((s) => s.settings.explainLang);
  useEffect(() => { loadLesson(n).then(setLesson).catch(() => setError(true)); }, [n]);
  if (error) return <p>Could not load this lesson. Check your connection once, then it will work offline.</p>;
  if (!lesson) return <Loading />;
  const st = lesson.steps[step];
  const finish = () => { markLessonStep(n, step, pocketStepCount(lesson.steps.map((x) => x.kind))); onDone(); };
  const t = st.i18n?.[lang] ?? st.i18n?.en ?? {};
  const title = t.title ?? st.i18n?.en?.title ?? st.title;
  const intro = "intro" in st ? (t.intro ?? st.i18n?.en?.intro ?? st.intro) : undefined;
  const tip = "tip" in st ? (t.tip ?? st.i18n?.en?.tip ?? st.tip) : undefined;

  switch (st.kind) {
    case "words":
      return <LessonWords c={c} lesson={lesson} title={title} intro={intro} words={st.words} practice={st.practice} onDone={finish} />;
    case "listen":
      return <InputTask kind="listening" title={title} intro={intro} tip={tip} audio={st.audio} questions={st.questions} onDone={finish} />;
    case "read":
      return <InputTask kind="reading" title={title} intro={intro} tip={tip} passage={st.passage} questions={st.questions} onDone={finish} />;
    case "language": {
      const topic = c.grammarById.get(`l-${n}`);
      return topic ? <GrammarLesson topic={topic} onDone={finish} /> : <ActionBar><button className="btn big primary" onClick={finish}>Continue</button></ActionBar>;
    }
    case "write":
      return <WritingTask title={title} prompt={st.prompt} data={st.data} minutes={st.minutes} minWords={st.minWords} tip={tip} model={st.model} promptId={`lesson-${n}`} onDone={finish} />;
    case "speak":
      return (
        <div>
          <h2>{title}</h2>
          <SpeakingTask part1={st.part1} card={st.card} useful={st.useful} onDone={finish} />
        </div>
      );
  }
}

function LessonWords({ c, lesson, title, intro, words, practice, onDone }: { c: Content; lesson: Lesson; title: string; intro?: string; words: Lesson["steps"][number] extends infer S ? S extends { kind: "words"; words: infer W } ? W : never : never; practice: import("../lib/types").Block[]; onDone: () => void }) {
  const lang = useApp((s) => s.settings.explainLang);
  const [stage, setStage] = useState<"learn" | "practice">("learn");
  const items = practice.map((b) => blockToExercise(b, lang)).filter((x): x is NonNullable<typeof x> => !!x).map((ex) => ({ ex }));
  const done = () => {
    const keys = words.map((w) => c.vocab.find((v) => v.w.toLowerCase() === w.en.toLowerCase())).filter((v): v is NonNullable<typeof v> => !!v).map((v) => String(v.id));
    addCards(keys);
    onDone();
  };
  if (stage === "learn") {
    const cards: CardView[] = words.map((w) => {
      const v = c.vocab.find((x) => x.w.toLowerCase() === w.en.toLowerCase());
      return { key: w.en, w: w.en, pos: w.pos, d: v?.d, tr: w.tr, ar: w.ar, ex: w.example, lvl: v?.lvl };
    });
    return (
      <div>
        <IntroCards items={cards} title={title} onDone={() => (items.length ? setStage("practice") : done())} />
      </div>
    );
  }
  return (
    <div>
      <p className="overline">Quick check · Lesson {lesson.number}: {lesson.title}</p>
      <ExerciseRunner items={items} onFinish={done} />
    </div>
  );
}

export function markUnit(course: string, unit: string, answers: Record<string, boolean> = {}) {
  update((s) => ({ coursework: { ...s.coursework, [`${course}/${unit}`]: { answers, done: new Date().toISOString() } } }));
}

export function CourseUnitView({ courseId, unitId, onDone }: { courseId: string; unitId: string; onDone: () => void }) {
  const [course, setCourse] = useState<Course | null>(null);
  useEffect(() => { loadCourse(courseId).then(setCourse); }, [courseId]);
  if (!course) return <Loading />;
  const unit = course.units.find((u) => u.id === unitId) ?? course.units[0];
  return <UnitRunner course={course} unit={unit} onDone={onDone} />;
}

function UnitRunner({ course, unit, onDone }: { course: Course; unit: Unit; onDone: () => void }) {
  const audio = unit.blocks.find((b) => b.type === "audio");
  const questions = unit.blocks.filter((b) => b.type === "choice" || b.type === "gap" || b.type === "tfng");
  const passage = unit.blocks.filter((b) => b.type === "heading" || b.type === "text" || b.type === "vocab");
  const finish = (acc: number) => {
    markUnit(course.id, unit.id);
    if (course.exam && questions.length) {
      update((s) => ({ tests: [{ id: `${course.id}/${unit.id}/${Date.now()}`, at: new Date().toISOString(), kind: course.exam!, ref: `${course.id}/${unit.id}`, title: `${course.title} · ${unit.title}`, score: Math.round(acc * questions.length), of: questions.length }, ...s.tests] }));
    }
    onDone();
  };
  if (!questions.length)
    return (
      <div>
        <h2>{unit.title}</h2>
        <p className="muted">{unit.goal}</p>
        <Passage blocks={passage} />
        <ActionBar><button className="btn big primary" onClick={() => finish(1)}>Done <Icon name="check" /></button></ActionBar>
      </div>
    );
  return (
    <InputTask
      kind={audio ? "listening" : "reading"}
      title={unit.title}
      intro={unit.goal + (unit.timeMinutes ? ` · About ${unit.timeMinutes} minutes.` : "")}
      passage={passage.length ? passage : undefined}
      audio={audio && audio.type === "audio" ? audio : undefined}
      once={!!course.exam && !!audio}
      questions={questions}
      onDone={finish}
    />
  );
}

export { ExerciseRunner };
