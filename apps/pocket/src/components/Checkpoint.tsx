// Placement check (week 1) and monthly checkpoint: a yes/no vocabulary test with made-up words to correct for
// guessing, plus 12 grammar questions from B1 to B2+. The result is a rough PRACTICE estimate for planning,
// never an official IELTS or CEFR result.
import { useMemo, useRef, useState } from "react";
import type { Content } from "../lib/content";
import { comprehension, gateChecks, nextPhase, type GateCheck, type Phase } from "../lib/evidence";
import { markKnown } from "../lib/learning";
import { phaseHeld, phaseOf } from "../lib/session";
import { getState, uid, update } from "../lib/store";
import { shuffle } from "../lib/text";
import type { Exercise as Ex, Settings, VocabItem } from "../lib/types";
import { ExerciseRunner } from "./Grammar";
import { ActionBar, Icon } from "./ui";

/** Made-up words that look English. Checked against the word list and the 8 ladder books (none occurs). */
const PSEUDO = ["bromtious", "plinkery", "drimsome", "starnish", "gorpulent", "trandible", "mispery", "quarbling", "fendulous", "chorbent", "slentive", "vorbish", "plosterous", "frastic", "dompery", "skelvish", "wendacious", "morplet", "blusterine", "fanticle"];
/** Frequency bands of the word list (by rank) and how many words each stands for. */
const BANDS: [number, number][] = [[1, 1000], [1001, 2000], [2001, 3000], [3001, 5000], [5001, 8000]];
const PER_BAND = 8;
const GRAMMAR_LEVELS = ["B1", "B1+", "B2", "B2+"] as const;

export type CheckKind = "placement" | "monthly";
type VItem = { w: string; band: number; id?: number };

/** Vocabulary size estimate from yes/no answers: per band, hits corrected by the false-alarm rate. */
export function estimateVocab(answers: { band: number; yes: boolean }[]) {
  const pseudo = answers.filter((a) => a.band < 0);
  const fa = pseudo.length ? pseudo.filter((a) => a.yes).length / pseudo.length : 0;
  let total = 0;
  BANDS.forEach(([from, to], b) => {
    const real = answers.filter((a) => a.band === b);
    if (!real.length) return;
    const h = real.filter((a) => a.yes).length / real.length;
    const adj = fa >= 1 ? 0 : Math.max(0, (h - fa) / (1 - fa));
    total += adj * (to - from + 1);
  });
  return { words: Math.round(total / 50) * 50, falseAlarms: fa };
}

/** Rough level from vocabulary size (thresholds after Milton 2010, scaled to this list) and grammar. */
export function estimateLevel(vocab: number, grammar: Record<string, number>): Settings["level"] {
  const v: Settings["level"] = vocab < 2000 ? "A2" : vocab < 3000 ? "B1" : vocab < 4200 ? "B2" : "C1";
  const ok = (lv: string) => (grammar[lv] ?? 0) >= 2 / 3;
  const g: Settings["level"] = !ok("B1") ? "A2" : !ok("B2") ? "B1" : ok("B2+") ? "C1" : "B2";
  const order = ["A2", "B1", "B2", "C1"];
  return order[Math.min(order.indexOf(v), order.indexOf(g))] as Settings["level"];
}

export function Checkpoint({ c, kind, onDone }: { c: Content; kind: CheckKind; onDone: () => void }) {
  const vItems = useMemo<VItem[]>(() => {
    const out: VItem[] = [];
    BANDS.forEach(([from, to], b) => {
      const pool = c.vocab.filter((v: VocabItem) => v.r >= from && v.r <= to && !v.w.includes(" ") && v.w.length > 2 && /^[a-z]+$/.test(v.w));
      for (const v of shuffle(pool).slice(0, PER_BAND)) out.push({ w: v.w, band: b, id: v.id });
    });
    for (const p of shuffle(PSEUDO).slice(0, 10)) out.push({ w: p, band: -1 });
    return shuffle(out);
  }, [c]);
  const gItems = useMemo(() => {
    const out: { ex: Ex; topic?: string; level: string }[] = [];
    for (const lv of GRAMMAR_LEVELS) {
      const pool = c.grammar.filter((t) => t.track !== "personal" && t.level === lv).flatMap((t) => t.exercises.filter((e) => e.type === "choose" || e.type === "compare").map((ex) => ({ ex, topic: undefined, level: lv })));
      out.push(...shuffle(pool).slice(0, 3));
    }
    return out;
  }, [c]);
  const [stage, setStage] = useState<"intro" | "vocab" | "grammar" | "result">("intro");
  const [yes, setYes] = useState<Record<number, boolean>>({});
  const gRight = useRef<Record<string, number>>({}); // share of each level answered right on the first try
  const [result, setResult] = useState<null | { vocab: number; level: Settings["level"]; grammar: number; fa: number; listening: number | null; reading: number | null; gate?: { from: Phase; to: Phase; checks: GateCheck[]; passed: boolean } }>(null);
  const previous = getState().tests.find((t) => t.kind === "checkpoint");

  function finish(perLevel: Record<string, number>) {
    const answers = vItems.map((it, i) => ({ band: it.band, yes: !!yes[i] }));
    const v = estimateVocab(answers);
    const level = estimateLevel(v.words, perLevel);
    const grammar = Math.round((Object.values(perLevel).reduce((n, x) => n + x, 0) / GRAMMAR_LEVELS.length) * 100);
    // Listening and reading come from the last 30 days of practice; a phase move needs all the evidence.
    const st = getState();
    const listening = comprehension(st, "listening").acc, reading = comprehension(st, "reading").acc;
    const from = phaseOf(st), to = nextPhase(from);
    let gate: { from: Phase; to: Phase; checks: GateCheck[]; passed: boolean } | undefined;
    if (kind === "monthly" && to && to !== "B1" && phaseHeld(st)) {
      const checks = gateChecks(st, to, { vocab: v.words, grammar: grammar / 100 });
      gate = { from, to, checks, passed: checks.every((x) => x.ok) };
    }
    setResult({ vocab: v.words, level, grammar, fa: v.falseAlarms, listening, reading, gate });
    // Words you said you know, in bands well inside your estimate, are not taught as new words.
    const safeBand = BANDS.findIndex(([, to]) => to >= v.words) - 1;
    vItems.forEach((it, i) => { if (yes[i] && it.id != null && it.band <= safeBand && v.falseAlarms <= 0.2) markKnown(String(it.id)); });
    update((s) => ({
      tests: [{ id: uid(), at: new Date().toISOString(), kind: "checkpoint", ref: kind, title: kind === "placement" ? "Placement check" : "Monthly checkpoint", score: Math.round((grammar / 100) * gItems.length), of: gItems.length, vocab: v.words, level, ...(listening != null ? { listening } : {}), ...(reading != null ? { reading } : {}) }, ...s.tests],
      // The first placement sets the level (the plan starts there); monthly checks only suggest.
      settings: kind === "placement" ? { ...s.settings, level } : gate?.passed ? { ...s.settings, phaseReached: gate.to } : s.settings,
      session: s.session,
    }));
    setStage("result");
  }

  if (stage === "intro")
    return (
      <div>
        <h2>{kind === "placement" ? "A 6-minute placement check" : "Your monthly checkpoint"}</h2>
        <p>{kind === "placement" ? "So the plan starts at the right place." : "To see how much you have grown this month."} Two short parts: 50 words (do you know them?) and 12 grammar questions.</p>
        <p className="small muted">Be honest: some words are made up, and saying "I know it" to them lowers the estimate. The result is a rough practice estimate for your plan, not an official IELTS score or level.</p>
        <ActionBar><button className="btn big primary" onClick={() => setStage("vocab")}>Start <Icon name="arrow" /></button><button className="btn quiet" style={{ width: "100%" }} onClick={onDone}>Not today</button></ActionBar>
      </div>
    );

  if (stage === "vocab") {
    const answered = Object.keys(yes).length;
    return (
      <div>
        <h2>Which words do you know?</h2>
        <p className="small muted">Tap the words you know (you can explain or translate them). Leave the others. Some words are not real.</p>
        <div className="vcheck">
          {vItems.map((it, i) => (
            <button key={i} className={`chip ${yes[i] ? "on" : ""}`} aria-pressed={!!yes[i]} onClick={() => setYes((y) => ({ ...y, [i]: !y[i] }))}>{yes[i] && <Icon name="check" size={16} />}{it.w}</button>
          ))}
        </div>
        <ActionBar><button className="btn big primary" onClick={() => setStage("grammar")}>Next: grammar ({answered} known) <Icon name="arrow" /></button></ActionBar>
      </div>
    );
  }

  if (stage === "grammar")
    return (
      <div>
        <h2>Grammar: choose the natural sentence</h2>
        <ExerciseRunner
          items={gItems.map(({ ex }) => ({ ex }))}
          review
          onFinish={() => finish(gRight.current)}
          onAnswer={(i, ok) => { const lv = gItems[i].level; const n = gItems.filter((g) => g.level === lv).length || 1; gRight.current = { ...gRight.current, [lv]: (gRight.current[lv] ?? 0) + (ok ? 1 / n : 0) }; }}
        />
      </div>
    );

  return (
    <div>
      <p className="overline">Practice estimate · not an official score</p>
      <h2>Your starting point: about {result!.level}</h2>
      <div className="stats">
        <div><p className="big-number">{result!.vocab.toLocaleString()}</p><p className="label">common words you know (estimate)</p></div>
        <div><p className="big-number">{result!.grammar}%</p><p className="label">grammar questions right</p></div>
        {result!.listening != null && <div><p className="big-number">{Math.round(result!.listening * 100)}%</p><p className="label">listening questions right (30 days)</p></div>}
        {result!.reading != null && <div><p className="big-number">{Math.round(result!.reading * 100)}%</p><p className="label">reading questions right (30 days)</p></div>}
      </div>
      {result!.gate && (
        <div className={`feedback ${result!.gate.passed ? "ok" : "info"}`}>
          <strong className="title">{result!.gate.passed ? `You move on to the ${result!.gate.to} phase` : `You stay in the ${result!.gate.from} phase for now`}</strong>
          <p>{result!.gate.passed ? "Your words, grammar, reviews, listening and reading all meet the target. From tomorrow the daily plan follows the next phase." : `The lessons continue. The ${result!.gate.to} phase starts when everything below meets its target; the next check comes in a week.`}</p>
          <ul className="gate">{result!.gate.checks.map((g) => <li key={g.label}><Icon name={g.ok ? "check" : "close"} size={18} label={g.ok ? "met" : "not yet"} /> {g.label}: <b>{g.have}</b> <span className="muted">(target {g.need})</span></li>)}</ul>
        </div>
      )}
      {previous?.vocab != null && <p>Last time: about {previous.vocab.toLocaleString()} words{previous.level ? `, ${previous.level}` : ""} ({new Date(previous.at).toLocaleDateString()}).</p>}
      {result!.fa > 0.2 && <p className="small muted">You marked several made-up words as known, so the word estimate is less reliable this time.</p>}
      <p className="small muted">{kind === "placement" ? `Your plan now starts at ${result!.level}. You can change it any time in Settings.` : result!.level !== getState().settings.level ? `Your plan is set to ${getState().settings.level}. If this estimate feels right, change it in Settings → English level.` : "Your plan level fits this estimate."} Words you clearly know were marked as known, so they won't come as new words.</p>
      <ActionBar><button className="btn big primary" onClick={onDone}>Continue <Icon name="arrow" /></button></ActionBar>
    </div>
  );
}
