// Grammar Instinct Trainer: Notice → Compare → Explain → Choose/Predict → Produce → (later) Recall.
import { useEffect, useMemo, useState } from "react";

// Remembers where the learner is inside a step, so a reload or app switch resumes there.
function usePersisted<T>(key: string | undefined, initial: T) {
  const [v, setV] = useState<T>(() => {
    if (!key) return initial;
    try { const raw = sessionStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : initial; } catch { return initial; }
  });
  useEffect(() => {
    if (!key) return;
    try { sessionStorage.setItem(key, JSON.stringify(v)); } catch { /* storage unavailable */ }
  }, [key, v]);
  return [v, setV] as const;
}
const clearPersisted = (...keys: (string | undefined)[]) => { try { for (const k of keys) if (k) sessionStorage.removeItem(k); } catch { /* ignore */ } };
import { finishTopic } from "../lib/learning";
import { useApp } from "../lib/store";
import { shuffle } from "../lib/text";
import type { Exercise as Ex, GrammarTopic } from "../lib/types";
import { Exercise } from "./Exercise";
import { ActionBar, Bold, Icon, Progress, SpeakButton } from "./ui";

/** Runs a list of exercises one by one and reports accuracy. */
export function ExerciseRunner({ items, onFinish, review, persistKey }: { items: { ex: Ex; topic?: string }[]; onFinish: (accuracy: number) => void; review?: boolean; persistKey?: string }) {
  const [pos, setPos] = usePersisted(persistKey, { i: 0, right: 0 });
  const { i, right } = pos;
  const setI = (n: number) => setPos((p) => ({ ...p, i: n }));
  const setRight = (n: number) => setPos((p) => ({ ...p, right: n }));
  if (!items.length) return null;
  const item = items[Math.min(i, items.length - 1)];
  return (
    <div>
      <div className="counter">
        <span>Question {i + 1} of {items.length}</span>
        <div className="grow"><Progress value={i / items.length} label={`Question ${i + 1} of ${items.length}`} /></div>
      </div>
      <Exercise
        key={i}
        ex={item.ex}
        topic={item.topic}
        review={review}
        onDone={(r) => {
          const nr = right + (r.firstTry ? 1 : 0);
          setRight(nr);
          if (i + 1 >= items.length) { clearPersisted(persistKey); onFinish(nr / items.length); }
          else setI(i + 1);
        }}
      />
    </div>
  );
}

export function GrammarLesson({ topic, onDone }: { topic: GrammarTopic; onDone: () => void }) {
  const lang = useApp((s) => s.settings.explainLang);
  const key = `fluent365:grammar:${topic.id}`;
  const [stage, setStage] = usePersisted<"notice" | "compare" | "explain" | "practice" | "result">(key, "notice");
  const [acc, setAcc] = useState(0);
  // Order: recognition first, then controlled practice, then production last.
  const items = useMemo(() => {
    const rank = (e: Ex) => (["choose", "compare", "find", "predict", "tfng"].includes(e.type) ? 0 : e.type === "produce" ? 2 : 1);
    return [...topic.exercises].sort((a, b) => rank(a) - rank(b)).map((ex) => ({ ex, topic: topic.id }));
  }, [topic]);
  const own = lang !== "en" ? topic.explain[lang] : undefined;
  const rules = splitRules(topic.explain.en);

  if (stage !== "practice" && stage !== "result")
    return (
      <div className="grammar-page">
        <h2>{topic.title}</h2>
        {topic.summary && !topic.summary.startsWith("From lesson") && <p className="lede">{topic.summary}</p>}

        <h3 className="g-h">How it works</h3>
        <ul className="rules">{rules.map((r, i) => <li key={i}><Bold text={r} /></li>)}</ul>
        {own && (
          <details className="card soft" open={lang === "tr" || lang === "ar"}>
            <summary>{lang === "tr" ? "Türkçe açıklama" : "الشرح بالعربية"}</summary>
            <p dir={lang === "ar" ? "rtl" : undefined} style={{ margin: 0 }}>{own}</p>
          </details>
        )}

        {topic.notice.length > 0 && (
          <>
            <h3 className="g-h">Examples</h3>
            <p className="small muted">Read them out loud. The <mark>marked</mark> words show the pattern.</p>
            <ul className="notice-list">{topic.notice.map((n, i) => <li key={i}><Bold text={n} /></li>)}</ul>
            <SpeakButton text={topic.notice.map((n) => n.replace(/\*\*/g, "")).join(" ")} label="Listen to the examples" />
          </>
        )}

        {topic.compare && (
          <>
            <h3 className="g-h">Compare</h3>
            <div className="compare">
              <div><span className="head">A</span><p className="sent">{topic.compare.a}</p></div>
              <div><span className="head">B</span><p className="sent">{topic.compare.b}</p></div>
            </div>
            <div className="feedback info"><strong className="title"><Icon name="hint" size={22} /> The difference</strong><p>{topic.compare.note}</p></div>
          </>
        )}

        <ActionBar><button className="btn big primary" onClick={() => setStage("practice")}>Practise · {items.length} questions <Icon name="arrow" /></button></ActionBar>
      </div>
    );

  if (stage === "practice")
    return (
      <ExerciseRunner
        items={items}
        persistKey={`${key}:run`}
        onFinish={(a) => {
          setAcc(a);
          void finishTopic(topic.id, a);
          setStage("result");
        }}
      />
    );

  return (
    <div>
      <h2>{acc >= 0.8 ? "Well done!" : acc >= 0.6 ? "Good work" : "Good start"}</h2>
      <p className="big-number">{Math.round(acc * 100)}%</p>
      <p className="muted">correct on the first try. {acc < 0.8 ? "This pattern will come back sooner so you can practise it again." : "It will come back in a few days to make it automatic."}</p>
      <ActionBar><button className="btn big primary" onClick={() => { clearPersisted(key); onDone(); }}>Continue <Icon name="arrow" /></button></ActionBar>
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
      <div>
        <h2>Check-up done</h2>
        <p className="big-number">{Math.round(done * 100)}%</p>
        <p className="muted">Mixed practice is harder than practising one topic, and that is why it works.</p>
        <ActionBar><button className="btn big primary" onClick={onDone}>Continue <Icon name="arrow" /></button></ActionBar>
      </div>
    );
  return (
    <div>
      <p className="small faint">Topics: {topics.map((t) => t.title).join(" · ")}</p>
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

/** Split an explanation paragraph into short rules (one sentence each) and bold the forms in quotes. */
function splitRules(text: string) {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z"'])/)
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => r.replace(/(^|[\s(])'(.{2,40}?)'(?=[\s.,;:)!?]|$)/g, "$1**$2**"));
}
