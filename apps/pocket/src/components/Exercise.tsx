// One exercise at a time: answer → check → feedback (why + example + correct form) → Next.
// Feedback follows the research: a hint on the first miss for typed answers, then the explicit
// correction as a word diff; the learner retypes the correct form before moving on.
import { useEffect, useMemo, useRef, useState } from "react";
import { recordAttempt } from "../lib/learning";
import { diffWords, matches, shuffle } from "../lib/text";
import type { Exercise as Ex, Mistake } from "../lib/types";
import { ActionBar, Icon, SpeakButton } from "./ui";

export interface ExerciseResult { ok: boolean; firstTry: boolean }

interface Props {
  ex: Ex;
  topic?: string;
  kind?: Mistake["kind"];
  review?: boolean;
  onDone: (r: ExerciseResult) => void;
  nextLabel?: string;
}

const LABEL: Record<Ex["type"], string> = {
  choose: "Choose the best answer",
  compare: "Compare",
  find: "Find the unnatural one",
  predict: "What comes next?",
  gap: "Fill the gap",
  fix: "Correct the mistake",
  rewrite: "Rewrite",
  build: "Build the sentence",
  produce: "Your turn: write it yourself",
  tfng: "True, False or Not Given?",
};

export function Exercise({ ex, topic, kind = "grammar", review, onDone, nextLabel = "Next" }: Props) {
  const [state, setState] = useState<"answer" | "hint" | "correct" | "wrong" | "retype" | "self">("answer");
  const [choice, setChoice] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [used, setUsed] = useState<number[]>([]);
  const [selfOk, setSelfOk] = useState<boolean | null>(null);
  const firstTry = useRef(true);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const order = useMemo(() => (ex.type === "build" ? shuffle(ex.blocks.map((_, i) => i)) : []), [ex]);

  useEffect(() => {
    setState("answer"); setChoice(null); setText(""); setUsed([]); setSelfOk(null); firstTry.current = true;
  }, [ex]);
  useEffect(() => {
    if (state === "retype" || state === "answer" || state === "hint") inputRef.current?.focus({ preventScroll: state === "answer" });
    if (state !== "answer") requestAnimationFrame(() => document.querySelector(".feedback")?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  }, [state]);

  const isMC = ex.type === "choose" || ex.type === "compare" || ex.type === "find" || ex.type === "predict";
  const typedAnswers = ex.type === "gap" || ex.type === "fix" || ex.type === "rewrite" ? ex.answers : ex.type === "build" ? [ex.answer, ...(ex.alts ?? [])] : [];
  const expected = isMC ? (ex as { options: string[]; answer: number }).options[(ex as { answer: number }).answer] : ex.type === "tfng" ? ex.answer : typedAnswers[0] ?? "";
  const prompt = "prompt" in ex ? ex.prompt : ex.type === "fix" ? ex.wrong : ex.type === "build" ? "Build the sentence" : "";
  const built = used.map((i) => (ex as { blocks: string[] }).blocks[i]).join(" ");

  function record(ok: boolean, given: string) {
    recordAttempt({ kind, topic, exType: ex.type, ok, prompt: ex.type === "fix" ? `Correct: ${ex.wrong}` : prompt, given, expected, why: "why" in ex ? ex.why : undefined, review });
  }

  function check() {
    if (isMC || ex.type === "tfng") {
      if (choice === null) return;
      const ok = isMC ? choice === (ex as { answer: number }).answer : (["true", "false", "not given"] as const)[choice] === ex.answer;
      const given = isMC ? (ex as { options: string[] }).options[choice] : ["true", "false", "not given"][choice];
      record(ok, given);
      setState(ok ? "correct" : "wrong");
      return;
    }
    if (ex.type === "produce") {
      const re = ex.check ? safeRegex(ex.check) : null;
      const okPattern = re ? re.test(text) : text.trim().split(/\s+/).length >= 5;
      setSelfOk(okPattern);
      setState("self");
      return;
    }
    const given = ex.type === "build" ? built : text;
    if (!given.trim()) return;
    const ok = matches(given, typedAnswers);
    if (ok) {
      record(firstTry.current, given);
      setState("correct");
    } else if (state === "answer" && ex.type !== "build") {
      firstTry.current = false;
      setState("hint");
    } else {
      record(false, given);
      firstTry.current = false;
      setState("wrong");
    }
  }

  function retypeCheck() {
    if (matches(text, typedAnswers)) onDone({ ok: false, firstTry: false });
  }

  function finishSelf(ok: boolean) {
    recordAttempt({ kind, topic, exType: "produce", ok, prompt: (ex as { prompt: string }).prompt, given: text, expected: (ex as { model: string }).model, review });
    onDone({ ok, firstTry: ok });
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && ex.type !== "produce") {
      e.preventDefault();
      if (state === "answer" || state === "hint") check();
      else if (state === "retype") retypeCheck();
      else if (state === "correct" || state === "wrong") next();
    }
  };

  function next() {
    if (state === "wrong" && typedAnswers.length && ex.type !== "build") {
      setText("");
      setState("retype");
      return;
    }
    onDone({ ok: state === "correct", firstTry: state === "correct" && firstTry.current });
  }

  const answered = state === "correct" || state === "wrong";

  return (
    <div onKeyDown={onKey}>
      <p className="pill blue">{LABEL[ex.type]}</p>
      {ex.type === "fix" && <p className="muted small">This sentence has a mistake. Write it correctly.</p>}
      <h2 style={{ marginTop: 8 }}>{ex.type === "fix" ? <span style={{ textDecoration: "underline wavy var(--bad)" }}>{ex.wrong}</span> : ex.type === "build" ? "Put the words in order" : prompt}</h2>

      {(isMC || ex.type === "tfng") && (
        <div className="options" role="radiogroup">
          {(isMC ? (ex as { options: string[] }).options : ["True", "False", "Not given"]).map((o, i) => {
            const right = isMC ? i === (ex as { answer: number }).answer : ["true", "false", "not given"][i] === (ex as { answer: string }).answer;
            const cls = answered ? (right ? "right" : i === choice ? "wrong" : "") : i === choice ? "selected" : "";
            return (
              <button key={i} role="radio" aria-checked={i === choice} className={`btn option ${cls}`} disabled={answered} onClick={() => setChoice(i)}>
                <span aria-hidden>{String.fromCharCode(65 + i)}.</span> {o}
              </button>
            );
          })}
        </div>
      )}

      {(ex.type === "gap" || ex.type === "fix" || ex.type === "rewrite") && state !== "retype" && (
        <input ref={inputRef as React.RefObject<HTMLInputElement>} type="text" value={text} onChange={(e) => setText(e.target.value)} disabled={answered} placeholder={ex.type === "gap" ? "Type the missing word(s)" : "Type the whole sentence"} aria-label="Your answer" autoCapitalize="off" autoComplete="off" spellCheck={false} />
      )}

      {ex.type === "build" && (
        <div className="stack">
          <div className="answer-line" aria-label="Your sentence">
            {used.length === 0 && <span className="muted">Tap the words below</span>}
            {used.map((i, k) => (
              <button key={k} className="chip" disabled={answered} onClick={() => setUsed(used.filter((_, j) => j !== k))}>{ex.blocks[i]}</button>
            ))}
          </div>
          <div className="blocks">
            {order.map((i) => (
              <button key={i} className={`chip ${used.includes(i) ? "used" : ""}`} disabled={used.includes(i) || answered} onClick={() => setUsed([...used, i])}>{ex.blocks[i]}</button>
            ))}
          </div>
        </div>
      )}

      {ex.type === "produce" && (
        <>
          <textarea ref={inputRef as React.RefObject<HTMLTextAreaElement>} value={text} onChange={(e) => setText(e.target.value)} disabled={state === "self"} placeholder="Write your sentence here" aria-label="Your sentence" />
          {state === "answer" && <p className="muted small">Tip: {ex.hint}</p>}
        </>
      )}

      {state === "hint" && (
        <div className="feedback info" role="status">
          <strong className="title">Not quite. Try once more.</strong>
          {"why" in ex && <p>Hint: {hintOf(ex.why)}</p>}
        </div>
      )}

      {answered && (
        <div className={`feedback ${state === "correct" ? "ok" : "no"}`} role="status">
          <strong className="title">{state === "correct" ? "Correct!" : "Not this time"}</strong>
          {state === "wrong" && typedAnswers.length > 0 && (
            <p className="diff">
              {diffWords(ex.type === "build" ? built : text, expected).map((d, i) => (
                <span key={i} className={d.op}>{d.text} </span>
              ))}
            </p>
          )}
          {state === "wrong" && <p><b>Answer:</b> {expected}</p>}
          {"why" in ex && <p>{ex.why}</p>}
          {"example" in ex && ex.example && <p className="muted">Example: {ex.example}</p>}
          {(typedAnswers.length > 0 || isMC) && <SpeakButton text={expected} label="Hear it" />}
        </div>
      )}

      {state === "retype" && (
        <div className="feedback info">
          <strong className="title">Now type the correct answer once</strong>
          <p className="muted">{expected}</p>
          <input ref={inputRef as React.RefObject<HTMLInputElement>} type="text" value={text} onChange={(e) => setText(e.target.value)} aria-label="Type the correct answer" autoCapitalize="off" autoComplete="off" />
        </div>
      )}

      {state === "self" && ex.type === "produce" && (
        <div className="feedback info" role="status">
          <strong className="title">Compare with a model answer</strong>
          <p>{ex.model}</p>
          {selfOk === false && ex.check && <p className="small">The pattern doesn't seem to be there yet. {ex.hint}</p>}
          {selfOk === true && <p className="small">The pattern is there. Check the details yourself.</p>}
          <p><b>Did you use the pattern correctly?</b></p>
        </div>
      )}

      <ActionBar>
        {state === "self" ? (
          <div className="grid2">
            <button className="btn big outline" onClick={() => finishSelf(false)}>Not yet</button>
            <button className="btn big primary" onClick={() => finishSelf(true)}>Yes, I got it</button>
          </div>
        ) : state === "retype" ? (
          <button className="btn big primary" onClick={retypeCheck} disabled={!matches(text, typedAnswers)}>Next <Icon name="arrow" /></button>
        ) : answered ? (
          <button className="btn big primary" onClick={next} autoFocus>{nextLabel} <Icon name="arrow" /></button>
        ) : (
          <button className="btn big primary" onClick={check} disabled={(isMC || ex.type === "tfng") ? choice === null : ex.type === "build" ? used.length === 0 : !text.trim()}>Check</button>
        )}
      </ActionBar>
    </div>
  );
}

function safeRegex(src: string) {
  try {
    return new RegExp(src, "i");
  } catch {
    return null;
  }
}

/** First clause of the explanation, without giving the answer away completely. */
const hintOf = (why: string) => why.split(/[:.]/)[0] + ".";
