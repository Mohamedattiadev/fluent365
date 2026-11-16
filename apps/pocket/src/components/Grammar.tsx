// Grammar Instinct Trainer: Notice → Compare → Explain → Choose/Predict → Produce → (later) Recall.
import { useMemo, useState } from "react";
import { finishTopic } from "../lib/learning";
import { useApp } from "../lib/store";
import { shuffle } from "../lib/text";
import type { Exercise as Ex, GrammarTopic } from "../lib/types";
import { Exercise } from "./Exercise";
import { ActionBar, Bold, Icon, Progress, SpeakButton } from "./ui";

/** Runs a list of exercises one by one and reports accuracy. */
export function ExerciseRunner({ items, onFinish, review }: { items: { ex: Ex; topic?: string }[]; onFinish: (accuracy: number) => void; review?: boolean }) {
  const [i, setI] = useState(0);
  const [right, setRight] = useState(0);
  if (!items.length) return null;
  const item = items[Math.min(i, items.length - 1)];
  return (
    <div>
      <div className="row small muted" style={{ marginBottom: 8 }}>
        <span>Question {i + 1} of {items.length}</span>
        <div className="grow"><Progress value={i / items.length} /></div>
      </div>
      <Exercise
        key={i}
        ex={item.ex}
        topic={item.topic}
        review={review}
        onDone={(r) => {
          const nr = right + (r.firstTry ? 1 : 0);
          setRight(nr);
          if (i + 1 >= items.length) onFinish(nr / items.length);
          else setI(i + 1);
        }}
      />
    </div>
  );
}

export function GrammarLesson({ topic, onDone }: { topic: GrammarTopic; onDone: () => void }) {
  const lang = useApp((s) => s.settings.explainLang);
  const [stage, setStage] = useState<"notice" | "compare" | "explain" | "practice" | "result">("notice");
  const [acc, setAcc] = useState(0);
  // Order: recognition first, then controlled practice, then production last.
  const items = useMemo(() => {
    const rank = (e: Ex) => (["choose", "compare", "find", "predict", "tfng"].includes(e.type) ? 0 : e.type === "produce" ? 2 : 1);
    return [...topic.exercises].sort((a, b) => rank(a) - rank(b)).map((ex) => ({ ex, topic: topic.id }));
  }, [topic]);
  const explanation = topic.explain[lang] ?? topic.explain.en;

  if (stage === "notice")
    return (
      <div>
        <p className="pill blue">Step 1 · Notice</p>
        <h2>{topic.title}</h2>
        <p className="muted">Read these sentences out loud. Look at the <b>bold</b> words. Don't think about rules yet — just notice.</p>
        <div className="card soft">
          <ul className="notice-list">{topic.notice.map((n, i) => <li key={i}><Bold text={n} /></li>)}</ul>
          <SpeakButton text={topic.notice.map((n) => n.replace(/\*\*/g, "")).join(" ")} label="Listen to all" />
        </div>
        <ActionBar><button className="btn big primary" onClick={() => setStage(topic.compare ? "compare" : "explain")}>Next <Icon name="arrow" /></button></ActionBar>
      </div>
    );

  if (stage === "compare" && topic.compare)
    return (
      <div>
        <p className="pill blue">Step 2 · Compare</p>
        <h2>What's the difference?</h2>
        <div className="grid2">
          <div className="card"><p className="pill">A</p><p style={{ fontSize: "1.2rem", fontWeight: 700 }}>{topic.compare.a}</p></div>
          <div className="card"><p className="pill">B</p><p style={{ fontSize: "1.2rem", fontWeight: 700 }}>{topic.compare.b}</p></div>
        </div>
        <details className="card soft">
          <summary>Think first, then tap to see</summary>
          <p>{topic.compare.note}</p>
        </details>
        <ActionBar><button className="btn big primary" onClick={() => setStage("explain")}>Next <Icon name="arrow" /></button></ActionBar>
      </div>
    );

  if (stage === "explain")
    return (
      <div>
        <p className="pill blue">Step 3 · Why it works</p>
        <h2>{topic.title}</h2>
        <div className="card"><p dir={lang === "ar" && topic.explain.ar ? "rtl" : undefined}>{explanation}</p></div>
        <p className="muted">Now practise. First you choose, then you build, then you write your own.</p>
        <ActionBar><button className="btn big primary" onClick={() => setStage("practice")}>Start practice <Icon name="arrow" /></button></ActionBar>
      </div>
    );

  if (stage === "practice")
    return (
      <ExerciseRunner
        items={items}
        onFinish={(a) => {
          setAcc(a);
          void finishTopic(topic.id, a);
          setStage("result");
        }}
      />
    );

  return (
    <div className="center">
      <h2>{acc >= 0.8 ? "Well done!" : acc >= 0.6 ? "Good work" : "Good start"}</h2>
      <p className="big-number">{Math.round(acc * 100)}%</p>
      <p className="muted">correct on the first try. {acc < 0.8 ? "This pattern will come back sooner so you can practise it again." : "It will come back in a few days to make it automatic."}</p>
      <ActionBar><button className="btn big primary" onClick={onDone}>Continue <Icon name="arrow" /></button></ActionBar>
    </div>
  );
}

/** Interleaved retrieval: 2–3 items from each topic, mixed, no explanation first. */
export function GrammarReview({ topics, onDone, count = 8 }: { topics: GrammarTopic[]; onDone: () => void; count?: number }) {
  const items = useMemo(() => {
    const per = Math.max(2, Math.ceil(count / Math.max(1, topics.length)));
    const pool = topics.flatMap((t) => shuffle(t.exercises.filter((e) => e.type !== "produce")).slice(0, per).map((ex) => ({ ex, topic: t.id })));
    return shuffle(pool).slice(0, count);
  }, [topics, count]);
  const [done, setDone] = useState<number | null>(null);
  if (!items.length) return <ActionBar><button className="btn big primary" onClick={onDone}>Continue</button></ActionBar>;
  if (done !== null)
    return (
      <div className="center">
        <h2>Check-up done</h2>
        <p className="big-number">{Math.round(done * 100)}%</p>
        <p className="muted">Mixed practice is harder than practising one topic, and that is why it works.</p>
        <ActionBar><button className="btn big primary" onClick={onDone}>Continue <Icon name="arrow" /></button></ActionBar>
      </div>
    );
  return (
    <div>
      <p className="muted small">Topics: {topics.map((t) => t.title).join(" · ")}</p>
      <ExerciseRunner
        items={items}
        review
        onFinish={(acc) => {
          // Reschedule each topic from its own items.
          for (const t of topics) void finishTopic(t.id, acc);
          setDone(acc);
        }}
      />
    </div>
  );
}
