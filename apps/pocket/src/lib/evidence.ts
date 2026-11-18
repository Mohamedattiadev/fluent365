// Evidence for moving to the next phase (design rule 16, docs/research/HOW_PEOPLE_LEARN_LANGUAGES.md §15):
// move on only when the vocabulary estimate, review accuracy, listening and reading comprehension and the
// checkpoint grammar meet the phase target; otherwise stay and say why. All are PRACTICE estimates.
import type { AppState } from "./store";
import { today } from "./store";

export type Phase = "B1" | "B2" | "IELTS";
export const PHASES: Phase[] = ["B1", "B2", "IELTS"];
export const nextPhase = (p: Phase): Phase | null => PHASES[PHASES.indexOf(p) + 1] ?? null;

/** Fewer answers than this in the window = not enough evidence yet. */
export const MIN_ANSWERS = 20;
const WINDOW_DAYS = 30;

/** Targets for entering a phase. Vocabulary thresholds match the checkpoint's level estimate. */
export const GATES: Record<"B2" | "IELTS", { vocab: number; review: number; listening: number; reading: number; grammar: number }> = {
  B2: { vocab: 3000, review: 0.85, listening: 0.7, reading: 0.7, grammar: 0.67 },
  IELTS: { vocab: 4200, review: 0.85, listening: 0.75, reading: 0.75, grammar: 0.75 },
};

const recentDays = (s: AppState, days = WINDOW_DAYS, now = new Date()) => {
  const from = today(new Date(now.getTime() - (days - 1) * 86400000));
  return Object.entries(s.days).filter(([d]) => d >= from).map(([, d]) => d);
};

export interface Share { acc: number | null; n: number }
const share = (right: number, n: number): Share => ({ acc: n >= MIN_ANSWERS ? right / n : null, n });

/** Questions answered right on the first try in listening or reading tasks (last 30 days). */
export function comprehension(s: AppState, kind: "listening" | "reading", now = new Date()): Share {
  let r = 0, n = 0;
  for (const d of recentDays(s, WINDOW_DAYS, now)) { const c = d.comp?.[kind]; if (c) { r += c[0]; n += c[1]; } }
  return share(r, n);
}

/** Word reviews not answered "Again" (last 30 days). */
export function reviewAccuracy(s: AppState, now = new Date()): Share {
  let r = 0, n = 0;
  for (const d of recentDays(s, WINDOW_DAYS, now)) if (d.revOk != null) { r += d.revOk; n += d.reviews; }
  return share(r, n);
}

export interface GateCheck { label: string; ok: boolean; have: string; need: string }

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** What stands between the learner and `target`, using a checkpoint's vocabulary and grammar results. */
export function gateChecks(s: AppState, target: "B2" | "IELTS", check: { vocab?: number; grammar?: number }, now = new Date()): GateCheck[] {
  const g = GATES[target];
  const rate = (label: string, x: Share, need: number): GateCheck => ({
    label, ok: x.acc != null && x.acc >= need, need: pct(need),
    have: x.acc == null ? `not enough practice yet (${x.n} of ${MIN_ANSWERS} answers in 30 days)` : `${pct(x.acc)} of ${x.n}`,
  });
  return [
    { label: "Words you know (estimate)", ok: (check.vocab ?? 0) >= g.vocab, have: check.vocab != null ? `about ${check.vocab.toLocaleString()}` : "no estimate yet", need: g.vocab.toLocaleString() },
    { label: "Checkpoint grammar", ok: (check.grammar ?? 0) >= g.grammar, have: check.grammar != null ? pct(check.grammar) : "no result yet", need: pct(g.grammar) },
    rate("Word reviews remembered", reviewAccuracy(s, now), g.review),
    rate("Listening questions right", comprehension(s, "listening", now), g.listening),
    rate("Reading questions right", comprehension(s, "reading", now), g.reading),
  ];
}
