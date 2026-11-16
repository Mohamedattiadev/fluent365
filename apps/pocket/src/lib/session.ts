// Builds today's guided session. The learner never chooses: the app picks what to do and says why.
// Rules come from docs/research/HOW_PEOPLE_LEARN_LANGUAGES.md (section 15):
// reviews before new items, adaptive new-word limit, four-strands balance, a grammar point every
// 2–3 days in B1, daily input + pushed output + a fluency block, IELTS format mostly late.
import type { Content } from "./content";
import { dueCardKeys, dueTopics, recentAccuracy } from "./learning";
import { getState, today, uid } from "./store";
import type { AppState } from "./store";
import type { DaySession, LessonInfo, LessonStep, SessionStep, Skill } from "./types";

export type Phase = "B1" | "B2" | "IELTS";

export const lessonsFinished = (s: AppState) => Object.values(s.lessons).filter((l) => l.finished).length;

export function phaseOf(s: AppState): Phase {
  const done = lessonsFinished(s) + startLesson(s) - 1;
  return done < 16 ? "B1" : done < 40 ? "B2" : "IELTS";
}

/** Where the path starts for a learner's stated level. */
export const startLesson = (s: AppState) => ({ A2: 1, B1: 1, B2: 17, C1: 29 })[s.settings.level] ?? 1;

/** Next lesson steps in order: [lesson number, step index, kind]. */
export function nextLessonSteps(s: AppState, lessons: LessonInfo[], max = 12) {
  const out: { lesson: number; step: number; kind: LessonStep["kind"] }[] = [];
  for (const l of lessons) {
    if (l.number < startLesson(s)) continue;
    const done = new Set(s.lessons[l.number]?.done ?? []);
    l.kinds.forEach((k, i) => {
      if (!done.has(i) && out.length < max) out.push({ lesson: l.number, step: i, kind: k });
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
  return Math.max(0, Math.min(20, n));
}

/** Frequency-ordered new words, skipping what the learner already has or knows; ~40% chunks. */
export function pickNewWords(s: AppState, c: Content, n: number) {
  if (n <= 0) return [];
  const startRank = ({ A2: 300, B1: 800, B2: 1800, C1: 2800 } as const)[s.settings.level] ?? 800;
  const free = (id: number) => !s.cards[String(id)] && !s.known[String(id)];
  const chunks = c.vocab.filter((v) => (v.src.includes("phrasal") || v.src.includes("collocation")) && free(v.id));
  const words = c.vocab.filter((v) => v.r >= startRank && !v.src.every((x) => x === "phrasal" || x === "collocation" || x === "lesson") && free(v.id) && v.d);
  const nChunks = Math.min(chunks.length, Math.round(n * 0.4));
  return [...words.slice(0, n - nChunks), ...chunks.slice(0, nChunks)].map((v) => v.id);
}

export function buildSession(c: Content, s: AppState = getState(), minutes: 30 | 60 | 90 = s.settings.minutes): DaySession {
  const phase = phaseOf(s);
  const b = BUDGET[phase][minutes];
  const steps: SessionStep[] = [];
  const add = (st: Omit<SessionStep, "id">) => steps.push({ ...st, id: uid() });
  const due = dueCardKeys();
  const topicsDue = dueTopics();

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

  // 5. Dictation: decoding fast speech.
  if (b.dictation > 0) add({ kind: "dictation", title: "Listen and write", why: "Writing down exactly what you hear trains your ear for fast, connected speech.", minutes: b.dictation });

  // 6. Output if no lesson step gave one.
  if (!taken.has("output")) {
    const p = pickOutput(s, c, phase);
    add({ kind: "output", title: p.title, why: "Speaking or writing every day turns what you know into what you can use.", minutes: b.output, ref: p.ref });
  }

  // 7. Fluency with known material.
  if (b.fluency > 0) {
    const cue = repeatCue(s, c);
    add({ kind: "fluency", title: b.fluency >= 9 ? "Fluency: 4 · 3 · 2" : "Fluency: 3 · 2 · 1", why: "Telling the same story three times, faster each time, builds smooth speaking without new words.", minutes: b.fluency, ref: { cue } });
  }

  // 8. Mistakes, then wrap-up.
  const open = s.mistakes.filter((m) => !m.fixed && m.expected);
  if (open.length >= 3 && minutes > 30) add({ kind: "mistakes", title: "Fix old mistakes", why: "Correcting your own past mistakes is the most personal practice there is.", minutes: 4 });
  add({ kind: "wrap", title: "Done for today", why: "See what you achieved.", minutes: 2 });

  return { date: today(), minutes, steps, index: 0, started: new Date().toISOString() };
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
  ["ielts-listening-tests", "t1-part1"], ["ielts-reading-mock", "passage-1"], ["ielts-listening-tests", "t1-part2"], ["ielts-reading-mock", "passage-2"],
  ["ielts-listening-tests", "t1-part3"], ["ielts-reading-mock", "passage-3"], ["ielts-listening-tests", "t1-part4"], ["ielts-writing-foundations", "opinion-essay"],
  ["ielts-listening-tests", "t2-part1"], ["ielts-writing-foundations", "discussion-essay"], ["ielts-listening-tests", "t2-part2"], ["ielts-writing-foundations", "problem-solution"],
  ["ielts-listening-tests", "t2-part3"], ["ielts-writing-foundations", "advantages-disadvantages"], ["ielts-listening-tests", "t2-part4"],
];

export function nextCourseUnit(s: AppState, phase: Phase): { course: string; unit: string; title: string } | null {
  const done = ([c, u]: [string, string]) => !!s.coursework[`${c}/${u}`]?.done;
  const list = phase === "IELTS" ? IELTS_ROTATION : INPUT_UNITS;
  const pick = list.find((x) => !done(x)) ?? list[Object.keys(s.days).length % list.length];
  const title = pick[0].includes("listening") ? "IELTS Listening practice" : pick[0].includes("mock") ? "IELTS Reading practice" : pick[0].includes("writing") ? "IELTS Writing skills" : "Reading for meaning";
  return { course: pick[0], unit: pick[1], title };
}

function pickOutput(s: AppState, c: Content, phase: Phase): { title: string; ref: SessionStep["ref"] } {
  const day = Object.keys(s.days).length;
  const gt = s.settings.goal !== "ielts-ac";
  const prompts = c.ielts.writing.filter((p) => (gt ? p.module === "general" || p.task === 2 : p.module === "academic"));
  const written = new Set(s.writing.map((w) => w.promptId));
  if (phase !== "B1" && day % 2 === 0 && prompts.length) {
    const p = prompts.find((x) => !written.has(x.id)) ?? prompts[day % prompts.length];
    return { title: `Writing · Task ${p.task}`, ref: { prompt: p.id } };
  }
  return { title: "Speaking practice", ref: { cue: c.ielts.cueCards[day % c.ielts.cueCards.length].id } };
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
    case "fluency": return "speaking";
    case "input": return /listening/i.test(step.title) || r.course?.includes("listening") ? "listening" : "reading";
    case "output": return r.prompt || /writing/i.test(step.title) ? "writing" : "speaking";
    default: return undefined;
  }
}
