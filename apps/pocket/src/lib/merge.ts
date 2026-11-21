// Combine two copies of the progress (this device + the account) when BOTH changed, so the
// learner never has to choose and nothing learned is lost. Each piece keeps the side that is
// further along: a word card with more reviews, a day with more done, a session at a later step,
// every mistake / writing / test from both. Settings come from the side changed last.
// Used only when both sides changed; when only one changed, that copy is taken whole (so a
// deletion on one device is not undone). Pure, tested in merge.test.ts.
import type { AppState } from "./store";
import type { DayLog, DaySession, MyCard, Mastery } from "./types";

type Rec<T> = Record<string, T>;

/** Per key: both sides' keys; when both have one, `pick` decides. */
function byKey<T>(a: Rec<T>, b: Rec<T>, pick: (x: T, y: T) => T): Rec<T> {
  const out: Rec<T> = { ...b, ...a };
  for (const k of Object.keys(a)) if (k in b) out[k] = pick(a[k], b[k]);
  return out;
}

/** Lists of records with an id: everything from both; the same id → `pick`. Sorted by time. */
function byId<T extends { id: string; at?: string }>(a: T[], b: T[], pick: (x: T, y: T) => T = (x) => x): T[] {
  const m = new Map<string, T>();
  for (const x of b) m.set(x.id, x);
  for (const x of a) m.set(x.id, m.has(x.id) ? pick(x, m.get(x.id)!) : x);
  return [...m.values()].sort((x, y) => (x.at ?? "").localeCompare(y.at ?? ""));
}

const time = (s?: string | null) => (s ? Date.parse(s) || 0 : 0);

function card(a: MyCard, b: MyCard): MyCard {
  const ra = a.card?.reps ?? 0, rb = b.card?.reps ?? 0;
  if (ra !== rb) return ra > rb ? a : b;
  return time(b.card?.lastReviewAt) > time(a.card?.lastReviewAt) ? b : a;
}

const mastery = (a: Mastery, b: Mastery) => (b.attempts > a.attempts ? b : a);

function day(a: DayLog, b: DayLog): DayLog {
  const max = (x?: number, y?: number) => Math.max(x ?? 0, y ?? 0);
  const comp: DayLog["comp"] = {};
  for (const k of ["listening", "reading"] as const) {
    const x = a.comp?.[k], y = b.comp?.[k];
    if (x || y) comp[k] = !x ? y : !y ? x : y[1] > x[1] ? y : x;
  }
  return {
    ...b, ...a,
    active: max(a.active, b.active),
    byKind: byKey(a.byKind ?? {}, b.byKind ?? {}, Math.max),
    attempts: max(a.attempts, b.attempts),
    correct: max(a.correct, b.correct),
    reviews: max(a.reviews, b.reviews),
    newWords: max(a.newWords, b.newWords),
    sessionDone: a.sessionDone || b.sessionDone,
    ...(a.revOk !== undefined || b.revOk !== undefined ? { revOk: max(a.revOk, b.revOk) } : {}),
    ...(Object.keys(comp).length ? { comp } : {}),
  };
}

/** Today's session: the later day; the same day → the one further along. */
function session(a: DaySession | null, b: DaySession | null, aNewer: boolean): DaySession | null {
  if (!a || !b) return a ?? b;
  if (a.date !== b.date) return a.date > b.date ? a : b;
  if (!!a.finished !== !!b.finished) return a.finished ? a : b;
  if (a.index !== b.index) return a.index > b.index ? a : b;
  return aNewer ? a : b;
}

/** `local` and `remote` both changed since they last matched. `localNewer`: this device changed last. */
export function mergeStates(local: AppState, remote: AppState, localNewer: boolean): AppState {
  const n = localNewer ? local : remote; // changed last
  const o = localNewer ? remote : local;
  const newer = <T>(x: T, y: T) => (localNewer ? x : y);
  const history = new Map<string, DaySession>();
  for (const s of [...o.history, ...n.history]) history.set(s.date + s.started, s);
  return {
    ...o, ...n,
    settings: n.settings,
    integrations: n.integrations,
    cards: byKey(local.cards, remote.cards, card),
    known: { ...remote.known, ...local.known },
    grammar: byKey(local.grammar, remote.grammar, mastery),
    mistakes: byId(local.mistakes, remote.mistakes, (x, y) => (x.fixed === y.fixed ? newer(x, y) : x.fixed ? x : y)),
    days: byKey(local.days, remote.days, day),
    lessons: byKey(local.lessons, remote.lessons, (x, y) => ({ done: [...new Set([...x.done, ...y.done])].sort((p, q) => p - q), finished: x.finished ?? y.finished })),
    coursework: byKey(local.coursework, remote.coursework, (x, y) => ({ answers: newer({ ...y.answers, ...x.answers }, { ...x.answers, ...y.answers }), done: x.done ?? y.done })),
    writing: byId(local.writing, remote.writing),
    speaking: byId(local.speaking, remote.speaking),
    tests: byId(local.tests, remote.tests),
    external: byId(local.external, remote.external),
    imports: byId(local.imports, remote.imports, (x, y) => (x.status === y.status ? newer(x, y) : x.status !== "pending" ? x : y)),
    reading: {
      ...o.reading, ...n.reading,
      books: byKey(local.reading.books, remote.reading.books, (x, y) => ({
        ...newer(x, y),
        block: newer(x, y).block,
        max: Math.max(x.max ?? x.block, y.max ?? y.block),
        words: Math.max(x.words, y.words),
        finished: x.finished ?? y.finished,
      })),
      log: byKey(local.reading.log, remote.reading.log, Math.max),
    },
    listening: {
      ...o.listening, ...n.listening,
      pos: { ...o.listening.pos, ...n.listening.pos },
      ...(o.listening.done || n.listening.done ? { done: { ...o.listening.done, ...n.listening.done } } : {}),
    },
    session: session(local.session, remote.session, localNewer),
    history: [...history.values()].sort((x, y) => x.date.localeCompare(y.date) || x.started.localeCompare(y.started)).slice(-60),
  };
}
