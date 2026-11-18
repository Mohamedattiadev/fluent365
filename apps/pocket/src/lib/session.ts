// Builds today's guided session. The learner never chooses: the app picks what to do and says why.
// Rules come from docs/research/HOW_PEOPLE_LEARN_LANGUAGES.md (section 15):
// reviews before new items, adaptive new-word limit, four-strands balance, a grammar point every
// 2–3 days in B1, daily input + pushed output + a fluency block, IELTS format mostly late.
import type { Content } from "./content";
import { dueCardKeys, dueTopics, recentAccuracy } from "./learning";
import { currentBook, dailyTarget, READING_WPM } from "./reading";
import { getState, today, uid } from "./store";
import type { AppState } from "./store";
import type { DaySession, LessonInfo, LessonStep, SessionStep, Skill } from "./types";
import { PHASES, type Phase } from "./evidence";

export type { Phase };

export const lessonsFinished = (s: AppState) => Object.values(s.lessons).filter((l) => l.finished).length;

const byLessons = (done: number): Phase => (done < 16 ? "B1" : done < 40 ? "B2" : "IELTS");
/** The phase the lesson path has reached (before the evidence gate). */
export const lessonPhase = (s: AppState): Phase => byLessons(lessonsFinished(s) + startLesson(s) - 1);
/** The phase your stated level starts in. */
export const basePhase = (s: AppState): Phase => byLessons(startLesson(s) - 1);
const later = (a: Phase, b: Phase) => (PHASES.indexOf(a) >= PHASES.indexOf(b) ? a : b);
const earlier = (a: Phase, b: Phase) => (PHASES.indexOf(a) <= PHASES.indexOf(b) ? a : b);

/** Current phase: the lesson path, but never past what the evidence allowed (design rule 16). */
export function phaseOf(s: AppState): Phase {
  const lp = lessonPhase(s);
  const reached = later(s.settings.phaseReached ?? lp, basePhase(s));
  return earlier(lp, reached);
}
/** The lessons are ahead of the evidence: the next checkpoint decides about moving on. */
export const phaseHeld = (s: AppState) => phaseOf(s) !== lessonPhase(s);

/** Where the path starts for a learner's stated level. */
export const startLesson = (s: AppState) => ({ A2: 1, B1: 1, B2: 17, C1: 29 })[s.settings.level] ?? 1;

/** Lesson step kinds Pocket teaches. Writing and speaking tasks belong to the Local app (PLAN.md §3);
 * Pocket's speaking is a short prompt before HelloTalk/Praktika. */
export const POCKET_KINDS: LessonStep["kind"][] = ["words", "listen", "read", "language"];
export const pocketStepCount = (kinds: LessonStep["kind"][]) => kinds.filter((k) => POCKET_KINDS.includes(k)).length;

/** Next lesson steps in order: [lesson number, step index, kind]. */
export function nextLessonSteps(s: AppState, lessons: LessonInfo[], max = 12) {
  const out: { lesson: number; step: number; kind: LessonStep["kind"] }[] = [];
  for (const l of lessons) {
    if (l.number < startLesson(s)) continue;
    const done = new Set(s.lessons[l.number]?.done ?? []);
    l.kinds.forEach((k, i) => {
      if (POCKET_KINDS.includes(k) && !done.has(i) && out.length < max) out.push({ lesson: l.number, step: i, kind: k });
    });
    if (out.length >= max) break;
  }
  return out;
}

const SLOT: Record<LessonStep["kind"], "pretech" | "input" | "grammar" | "output"> = { words: "pretech", listen: "input", read: "input", language: "grammar", write: "output", speak: "output" };

// Minutes per block, from the research budget table.
const BUDGET: Record<Phase, Record<30 | 60 | 90, { review: number; pretech: number; grammar: number; input: number; dictation: number; output: number; fluency: number }>> = {
  B1: {
    30: { review: 6, pretech: 4, grammar: 5, input: 8, dictation: 0, output: 5, fluency: 0 },
    60: { review: 10, pretech: 6, grammar: 6, input: 12, dictation: 5, output: 10, fluency: 8 },
    90: { review: 12, pretech: 8, grammar: 10, input: 18, dictation: 8, output: 16, fluency: 12 },
  },
  B2: {
    30: { review: 6, pretech: 4, grammar: 4, input: 9, dictation: 0, output: 5, fluency: 0 },
    60: { review: 10, pretech: 6, grammar: 4, input: 14, dictation: 4, output: 14, fluency: 8 },
    90: { review: 12, pretech: 9, grammar: 6, input: 22, dictation: 6, output: 22, fluency: 13 },
  },
  IELTS: {
    30: { review: 6, pretech: 3, grammar: 3, input: 10, dictation: 0, output: 8, fluency: 0 },
    60: { review: 8, pretech: 6, grammar: 0, input: 16, dictation: 0, output: 22, fluency: 6 },
    90: { review: 10, pretech: 8, grammar: 0, input: 26, dictation: 0, output: 36, fluency: 8 },
  },
};

/** How many new words today: default from settings, reduced when reviews pile up or accuracy drops. */
export function newWordLimit(s: AppState, due: number, minutes: number) {
  let n = s.settings.newWords;
  if (due > 150) n = 0;
  else if (due > 100) n = Math.min(n, 5);
  else if (due > 60) n = Math.min(n, 8);
  const acc = recentAccuracy();
  if (acc !== null && acc < 0.8) n = Math.round(n * 0.6);
  if (minutes <= 30) n = Math.min(n, 5);
  return Math.max(0, Math.min(30, n));
}

/** Chunk sources: everyday phrases and idioms, phrasal verbs, collocations (design rule 5: chunks). */
export const CHUNK_SOURCES = ["phrase", "phrasal", "collocation"] as const;
const LEVEL_ORDER = ["A2", "B1", "B2", "C1"];

/** Frequency-ordered new words, skipping what the learner already has or knows; ~40% chunks,
 *  taken in turn from phrases, phrasal verbs and collocations (each list in its own order). */
export function pickNewWords(s: AppState, c: Content, n: number) {
  if (n <= 0) return [];
  const startRank = ({ A2: 300, B1: 800, B2: 1800, C1: 2800 } as const)[s.settings.level] ?? 800;
  const free = (id: number) => !s.cards[String(id)] && !s.known[String(id)];
  // Phrases two levels below yours are skipped (a C1 learner knows "good morning").
  const tooEasy = (v: Content["vocab"][number]) => v.src.includes("phrase") && LEVEL_ORDER.indexOf(v.lvl ?? "B1") < LEVEL_ORDER.indexOf(s.settings.level) - 1;
  const queues = CHUNK_SOURCES.map((src) => c.vocab.filter((v) => v.src.includes(src) && free(v.id) && !tooEasy(v)));
  const isChunk = (x: string) => (CHUNK_SOURCES as readonly string[]).includes(x) || x === "lesson";
  const words = c.vocab.filter((v) => v.r >= startRank && !v.src.every(isChunk) && free(v.id) && v.d);
  const want = Math.round(n * 0.4);
  const chunks: number[] = [];
  const seen = new Set<number>(words.slice(0, n).map((v) => v.id));
  for (let i = 0; chunks.length < want && queues.some((q) => i < q.length); i++)
    for (const q of queues) if (q[i] && !seen.has(q[i].id) && chunks.length < want) { seen.add(q[i].id); chunks.push(q[i].id); }
  return [...words.slice(0, n - chunks.length).map((v) => v.id), ...chunks];
}

export function buildSession(c: Content, s: AppState = getState(), minutes: 30 | 60 | 90 = s.settings.minutes): DaySession {
  const phase = phaseOf(s);
  const b = BUDGET[phase][minutes];
  const steps: SessionStep[] = [];
  const add = (st: Omit<SessionStep, "id">) => steps.push({ ...st, id: uid() });
  const due = dueCardKeys();
  const topicsDue = dueTopics();

  // 0. Placement check in week 1, then a checkpoint every 30 days (practice estimates, never official scores).
  const checks = s.tests.filter((t) => t.kind === "checkpoint");
  const lastCheck = checks[0] ? (Date.now() - new Date(checks[0].at).getTime()) / 86400000 : Infinity;
  if (!checks.length && dayNumber(s) <= 7) add({ kind: "checkpoint", title: "Placement check", why: "Six minutes to find your level, so the words and grammar fit you. Not an official score.", minutes: 6, ref: { prompt: "placement" } });
  else if (checks.length && phaseHeld(s) && lastCheck >= 7) add({ kind: "checkpoint", title: "Phase check", why: `You have finished the ${phase} lessons. Six minutes to see if your words, grammar, listening and reading are ready for the next phase. A practice estimate.`, minutes: 6, ref: { prompt: "monthly" } });
  else if (checks.length && lastCheck >= 30) add({ kind: "checkpoint", title: "Monthly checkpoint", why: "Once a month: how many words you know now and how your grammar has grown. A practice estimate.", minutes: 6, ref: { prompt: "monthly" } });
  else if (!checks.length && dayNumber(s) >= 30) add({ kind: "checkpoint", title: "Checkpoint", why: "A short check of your words and grammar. A practice estimate, not an official score.", minutes: 6, ref: { prompt: "monthly" } });

  // 1. Warm-up recall: yesterday's new words, said aloud.
  const yesterday = Object.entries(s.cards).filter(([, x]) => x.added !== today()).sort((a, b) => (a[1].added < b[1].added ? 1 : -1)).slice(0, 3).map(([k]) => Number(k)).filter((k) => !Number.isNaN(k));
  if (yesterday.length >= 3 && minutes > 30) add({ kind: "recall", title: "Warm-up", why: "Remembering yesterday's words out loud makes them stick (retrieval practice).", minutes: 2, ref: { words: yesterday } });

  // 2. Reviews first.
  if (due.length) add({ kind: "review", title: `Review ${Math.min(due.length, b.review * 6)} words`, why: "These words are due today. Reviewing just before you forget is the fastest way to remember for years.", minutes: b.review });
  if (topicsDue.length) add({ kind: "grammar-review", title: "Grammar check-up", why: "Mixed questions on grammar you learned before, so you can use it without thinking.", minutes: Math.max(3, Math.round(b.review / 2)), ref: { topics: topicsDue.slice(0, 4) } });

  // 3. Lesson steps for today, one per slot, in path order.
  const taken = new Set<string>();
  const next = nextLessonSteps(s, c.lessons);
  for (const st of next) {
    const slot = SLOT[st.kind];
    if (taken.has(slot)) break;
    if (slot === "grammar" && phase === "IELTS" && b.grammar === 0) break;
    taken.add(slot);
    const info = c.lessons.find((l) => l.number === st.lesson)!;
    const why = {
      pretech: `New words for lesson ${st.lesson} (${info.topic}). You will meet them again in the listening, reading and speaking.`,
      input: `Understanding real English is how vocabulary and grammar grow. Lesson ${st.lesson}: ${info.title}.`,
      grammar: `The grammar you need for lesson ${st.lesson}'s writing and speaking.`,
      output: "Using new language yourself shows what you can't say yet, and that is when you learn it.",
    }[slot];
    add({ kind: slot, title: `Lesson ${st.lesson} · ${kindName(st.kind)}`, why, minutes: b[slot] || 6, ref: { lesson: st.lesson, step: st.step } });
  }

  // 4. Fill empty slots.
  if (!taken.has("pretech")) {
    const ids = pickNewWords(s, c, newWordLimit(s, due.length, minutes));
    if (ids.length) add({ kind: "pretech", title: `${ids.length} new words`, why: "Common, useful words chosen by frequency. Fewer today if your reviews are piling up.", minutes: b.pretech, ref: { words: ids } });
  }
  if (!taken.has("grammar") && b.grammar > 0) {
    const nextCore = c.grammar.find((t) => t.track === "core" && !s.grammar[t.id]?.learnedAt);
    const learnedToday = Object.values(s.grammar).some((m) => m.learnedAt?.startsWith(today()));
    const lastCore = Object.entries(s.grammar).filter(([id]) => c.grammarById.get(id)?.track === "core").map(([, m]) => m.learnedAt ?? "").sort().pop();
    const daysSince = lastCore ? (Date.now() - new Date(lastCore).getTime()) / 86400000 : 99;
    if (nextCore && !learnedToday && (phase !== "B1" || daysSince >= 1.5 || !lastCore)) add({ kind: "grammar", title: `Grammar · ${nextCore.title}`, why: "A new grammar pattern: notice it, compare, then use it yourself.", minutes: b.grammar, ref: { topic: nextCore.id } });
    else {
      const weak = weakestTopics(s, 3);
      if (weak.length && !topicsDue.length) add({ kind: "grammar-review", title: "Grammar practice", why: "Extra practice on the patterns you get wrong most often.", minutes: b.grammar, ref: { topics: weak } });
    }
  }
  if (!taken.has("input")) {
    const pick = nextCourseUnit(s, phase);
    if (pick) add({ kind: "input", title: pick.title, why: phase === "IELTS" ? "Exam-format practice with the real timing." : "Reading or listening for meaning: the biggest source of new language.", minutes: b.input, ref: { course: pick.course, unit: pick.unit } });
  }

  // 4b. Book reading: today's share of the reading ladder (finishes all 8 books within the 365-day plan).
  const book = currentBook(s, c.books ?? []);
  if (book) {
    const left = Math.max(0, dailyTarget(s, c.books ?? []) - (s.reading?.log[today()] ?? 0));
    if (left > 0) add({ kind: "book", title: `Book · ${book.title}`, why: `Reading a whole book is how vocabulary and grammar become natural. ${left.toLocaleString()} words today keeps you on track to finish all 8 books within the year.`, minutes: Math.min(20, Math.max(4, Math.round(left / READING_WPM))), ref: { book: book.id } });
  }

  // 5. Dictation: decoding fast speech.
  if (b.dictation > 0) add({ kind: "dictation", title: "Listen and write", why: "Writing down exactly what you hear trains your ear for fast, connected speech.", minutes: b.dictation });

  // 6. Mistakes.
  const open = s.mistakes.filter((m) => !m.fixed && m.expected);
  if (open.length >= 3 && minutes > 30) add({ kind: "mistakes", title: "Fix old mistakes", why: "Correcting your own past mistakes is the most personal practice there is.", minutes: 4 });
  // 7. Optional, last: today's speaking topic. The speaking itself happens in HelloTalk / Praktika.
  add({ kind: "speak", title: "Speaking topic (optional)", why: "Read it on the way, then speak in HelloTalk or Praktika and log your minutes. Real conversation is where speaking grows.", minutes: 3, ref: { cue: repeatCue(s, c) } });
  add({ kind: "wrap", title: "Done for today", why: "See what you achieved.", minutes: 2 });

  fitToDailyTime(steps, minutes);
  return { date: today(), minutes, steps, index: 0, started: new Date().toISOString() };
}

/** The daily time the learner chose, in minutes ("30" is shown as "about 25 minutes"). */
export const dailyMinutes = (minutes: 30 | 60 | 90) => (minutes === 30 ? 25 : minutes);
/** Steps that count towards the daily time (the optional speaking card and the wrap-up do not). */
export const countsTowardTime = (st: SessionStep) => st.kind !== "wrap" && st.kind !== "speak";

/**
 * Make the minutes add up to the chosen daily time. Spare time goes to the book (more reading), or to
 * reviews and input when there is no book step; too much time shrinks every step in proportion.
 */
export function fitToDailyTime(steps: SessionStep[], minutes: 30 | 60 | 90) {
  const target = dailyMinutes(minutes);
  const counted = steps.filter(countsTowardTime);
  if (!counted.length) return;
  const total = counted.reduce((n, st) => n + st.minutes, 0);
  if (total < target) {
    const sink = counted.find((st) => st.kind === "book") ?? counted.find((st) => st.kind === "input") ?? counted.find((st) => st.kind === "review") ?? counted[counted.length - 1];
    sink.minutes += target - total;
  } else if (total > target) {
    const f = target / total;
    for (const st of counted) st.minutes = Math.max(2, Math.round(st.minutes * f));
    let diff = target - counted.reduce((n, st) => n + st.minutes, 0);
    // Rounding leftovers: take them from (or give them to) the longest steps.
    const byLength = [...counted].sort((a, b) => b.minutes - a.minutes);
    for (let i = 0; diff !== 0 && i < byLength.length * 4; i++) {
      const st = byLength[i % byLength.length];
      if (diff > 0) { st.minutes++; diff--; } else if (st.minutes > 2) { st.minutes--; diff++; }
    }
  }
}

export const kindName = (k: LessonStep["kind"]) => ({ words: "Words", listen: "Listening", read: "Reading", language: "Grammar", write: "Writing", speak: "Speaking" })[k];

export function weakestTopics(s: AppState, n: number) {
  return Object.entries(s.grammar)
    .filter(([, m]) => m.attempts >= 3)
    .map(([id, m]) => [id, (m.rec + m.ctl + m.prod + m.auto) / 4] as const)
    .sort((a, b) => a[1] - b[1])
    .slice(0, n)
    .filter(([, score]) => score < 0.85)
    .map(([id]) => id);
}

// Units used when the lesson path does not provide input (and in the IELTS phase).
const INPUT_UNITS: [string, string][] = [
  ...["b1-present-perfect", "b1-first-conditional", "b2-passive", "b2-unreal-conditionals", "c1-inversion", "c1-cleft-sentences", "c2-register", "c2-idiom-nuance"].map((u) => ["general-path", u] as [string, string]),
  ...["city-bees", "night-sky", "railway-time", "putting-off", "streets-for-people"].map((u) => ["ielts-reading-foundations", u] as [string, string]),
  ...["education", "environment", "technology", "health", "work", "crime-law", "cities-housing", "media-advertising"].map((u) => ["ielts-vocabulary-topics", u] as [string, string]),
];
const IELTS_ROTATION: [string, string][] = [
  // Writing units are practised in the Local app; Pocket rotates reading and listening only.
  ["ielts-listening-tests", "t1-part1"], ["ielts-reading-mock", "passage-1"], ["ielts-listening-tests", "t1-part2"], ["ielts-reading-mock", "passage-2"],
  ["ielts-listening-tests", "t1-part3"], ["ielts-reading-mock", "passage-3"], ["ielts-listening-tests", "t1-part4"],
  ["ielts-listening-tests", "t2-part1"], ["ielts-listening-tests", "t2-part2"], ["ielts-listening-tests", "t2-part3"], ["ielts-listening-tests", "t2-part4"],
];

export function nextCourseUnit(s: AppState, phase: Phase): { course: string; unit: string; title: string } | null {
  const done = ([c, u]: [string, string]) => !!s.coursework[`${c}/${u}`]?.done;
  const list = phase === "IELTS" ? IELTS_ROTATION : INPUT_UNITS;
  const pick = list.find((x) => !done(x)) ?? list[Object.keys(s.days).length % list.length];
  const title = pick[0].includes("listening") ? "IELTS Listening practice" : pick[0].includes("mock") ? "IELTS Reading practice" : pick[0].includes("writing") ? "IELTS Writing skills" : "Reading for meaning";
  return { course: pick[0], unit: pick[1], title };
}

/** Task repetition: reuse a cue card from 2 or 7 days ago, else a fresh one. */
function repeatCue(s: AppState, c: Content) {
  const past = s.history.flatMap((h) => h.steps.filter((x) => x.ref?.cue).map((x) => ({ date: h.date, cue: x.ref!.cue! })));
  const ago = (d: string) => Math.round((Date.now() - new Date(d).getTime()) / 86400000);
  const again = past.find((p) => ago(p.date) === 2 || ago(p.date) === 7);
  return again?.cue ?? c.ielts.cueCards[(Object.keys(s.days).length + 5) % c.ielts.cueCards.length].id;
}

/** Day number in the 365-day guide (calendar days since start, 1-based). */
export const dayNumber = (s: AppState) => Math.max(1, Math.floor((Date.now() - new Date(s.settings.startDate).getTime()) / 86400000) + 1);

export const GUIDE = [
  { from: 1, to: 60, focus: "B1 foundations: sentence accuracy, core tenses, high-frequency words" },
  { from: 61, to: 120, focus: "B1 → B2: complex sentences, verb patterns, reading fluency" },
  { from: 121, to: 180, focus: "B2 consolidation: advanced grammar, collocations, longer reading" },
  { from: 181, to: 240, focus: "IELTS introduction: task formats, listening and reading strategies" },
  { from: 241, to: 300, focus: "IELTS skills: timed practice, writing and speaking" },
  { from: 301, to: 365, focus: "Full practice, error correction, targeted revision, exam readiness" },
];

/** Which skill a session step trains (used for its colour line, icon and label). */
export function skillOf(step: SessionStep): Skill | undefined {
  const r = step.ref ?? {};
  switch (step.kind) {
    case "recall": case "review": case "pretech": return "words";
    case "grammar": case "grammar-review": case "mistakes": return "grammar";
    case "dictation": return "listening";
    case "book": return "reading";
    case "fluency": case "speak": return "speaking";
    case "input": return /listening/i.test(step.title) || r.course?.includes("listening") ? "listening" : "reading";
    case "output": return r.prompt || /writing/i.test(step.title) ? "writing" : "speaking";
    default: return undefined;
  }
}
