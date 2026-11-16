// Records learning events: attempts, grammar mastery, mistakes, vocabulary reviews.
import { ping } from "./activity";
import { gradeFromAccuracy, isDue, schedule, type Grade, Rating } from "./srs";
import { bumpDay, getState, today, uid, update } from "./store";
import type { Exercise, Mastery, Mistake, MyCard, VocabItem } from "./types";

export const emptyMastery = (): Mastery => ({ rec: 0, ctl: 0, prod: 0, auto: 0, attempts: 0, correct: 0 });

export type Dimension = "rec" | "ctl" | "prod" | "auto";
export const dimensionOf = (t: Exercise["type"]): Dimension =>
  t === "choose" || t === "compare" || t === "find" || t === "predict" || t === "tfng" ? "rec" : t === "produce" ? "prod" : "ctl";

const ALPHA = 0.3;
const ema = (old: number, ok: boolean) => old + ALPHA * ((ok ? 1 : 0) - old);

export interface AttemptInput {
  kind: Mistake["kind"];
  topic?: string;
  exType?: Exercise["type"];
  ok: boolean;
  prompt: string;
  given: string;
  expected: string;
  why?: string;
  review?: boolean; // a later retrieval (counts toward automaticity)
}

export function recordAttempt(a: AttemptInput) {
  ping(a.kind === "grammar" ? "grammar" : a.kind);
  bumpDay((d) => ({ ...d, attempts: d.attempts + 1, correct: d.correct + (a.ok ? 1 : 0) }));
  update((s) => {
    const patch: Partial<typeof s> = {};
    if (a.topic && a.exType) {
      const m = { ...(s.grammar[a.topic] ?? emptyMastery()) };
      const dim = dimensionOf(a.exType);
      m[dim] = ema(m[dim], a.ok);
      if (a.review) m.auto = ema(m.auto, a.ok);
      m.attempts++;
      if (a.ok) m.correct++;
      patch.grammar = { ...s.grammar, [a.topic]: m };
    }
    const same = (x: Mistake) => x.prompt === a.prompt && !x.fixed;
    if (!a.ok && a.given.trim()) {
      const existing = s.mistakes.find(same);
      if (!existing)
        patch.mistakes = [{ id: uid(), at: new Date().toISOString(), kind: a.kind, topic: a.topic, prompt: a.prompt, given: a.given, expected: a.expected, why: a.why, fixed: false }, ...s.mistakes].slice(0, 1000);
    } else if (a.ok && s.mistakes.some(same)) {
      patch.mistakes = s.mistakes.map((x) => (same(x) ? { ...x, fixed: true, fixedAt: new Date().toISOString() } : x));
    }
    return patch;
  });
}

/** After a block of practice on one topic: schedule its next review with FSRS. */
export async function finishTopic(topicId: string, accuracy: number) {
  const m = getState().grammar[topicId] ?? emptyMastery();
  const card = await schedule(m.card, gradeFromAccuracy(accuracy));
  update((s) => ({ grammar: { ...s.grammar, [topicId]: { ...(s.grammar[topicId] ?? emptyMastery()), card, learnedAt: s.grammar[topicId]?.learnedAt ?? new Date().toISOString() } } }));
}

export const dueTopics = (now = Date.now()) =>
  Object.entries(getState().grammar)
    .filter(([, m]) => isDue(m.card, now))
    .sort((a, b) => new Date(a[1].card!.dueAt).getTime() - new Date(b[1].card!.dueAt).getTime())
    .map(([id]) => id);

// ---------- Vocabulary ----------
export const vocabKey = (v: VocabItem) => String(v.id);

export function addCards(keys: string[], custom?: Record<string, MyCard["custom"]>) {
  const now = new Date().toISOString();
  let added = 0;
  update((s) => {
    const cards = { ...s.cards };
    for (const k of keys) {
      if (cards[k]) continue;
      cards[k] = { card: { dueAt: now, stability: 0, difficulty: 0, state: 0, reps: 0, lapses: 0, lastReviewAt: null, fresh: true }, added: today(), custom: custom?.[k] };
      added++;
    }
    return { cards };
  });
  if (added) bumpDay((d) => ({ ...d, newWords: d.newWords + added }));
  return added;
}

export async function reviewWord(key: string, grade: Grade) {
  ping("vocabulary");
  const mine = getState().cards[key];
  const prev = mine?.card && !mine.card.fresh ? mine.card : undefined;
  const card = await schedule(prev, grade);
  update((s) => ({ cards: { ...s.cards, [key]: { ...(s.cards[key] ?? { added: today() }), card } } }));
  bumpDay((d) => ({ ...d, reviews: d.reviews + 1, attempts: d.attempts + 1, correct: d.correct + (grade === Rating.Again ? 0 : 1) }));
}

export const dueCardKeys = (now = Date.now()) =>
  Object.entries(getState().cards)
    .filter(([, c]) => isDue(c.card, now))
    .sort((a, b) => new Date(a[1].card.dueAt).getTime() - new Date(b[1].card.dueAt).getTime())
    .map(([k]) => k);

export function markKnown(key: string, known = true) {
  update((s) => {
    const next = { ...s.known };
    if (known) next[key] = true;
    else delete next[key];
    const cards = { ...s.cards };
    if (known) delete cards[key];
    return { known: next, cards };
  });
}

/** Recent accuracy across the last 3 study days (null if too little data). */
export function recentAccuracy() {
  const days = Object.entries(getState().days).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, 3);
  const att = days.reduce((n, [, d]) => n + d.attempts, 0);
  return att < 20 ? null : days.reduce((n, [, d]) => n + d.correct, 0) / att;
}
