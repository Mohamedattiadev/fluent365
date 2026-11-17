// Content types (public, built from content/) and learner state types (private, on device).

export type Lang = "en" | "tr" | "ar";
export type Skill = "words" | "grammar" | "reading" | "listening" | "writing" | "speaking";

// ---------- Grammar ----------
export type Exercise =
  | { type: "choose" | "compare" | "find" | "predict"; prompt: string; options: string[]; answer: number; why: string; example?: string }
  | { type: "gap"; prompt: string; answers: string[]; why: string; example?: string }
  | { type: "fix"; wrong: string; answers: string[]; why: string }
  | { type: "rewrite"; prompt: string; answers: string[]; why: string }
  | { type: "build"; blocks: string[]; answer: string; alts?: string[]; why: string }
  | { type: "produce"; prompt: string; check: string; hint: string; model: string }
  | { type: "tfng"; prompt: string; answer: "true" | "false" | "not given"; why: string; example?: string };

export interface GrammarTopic {
  id: string;
  title: string;
  level: string;
  summary: string;
  notice: string[];
  compare?: { a: string; b: string; note: string };
  explain: Partial<Record<Lang, string>> & { en: string };
  exercises: Exercise[];
  track: "core" | "lesson" | "personal";
  lesson?: number;
  order: number;
}

// ---------- Vocabulary ----------
export interface VocabItem {
  id: number;
  w: string;
  d?: string;
  pos?: string;
  ex?: string;
  exSrc?: string;
  tr?: string;
  ar?: string;
  topic?: string;
  lesson?: number;
  src: string[];
  r: number;
  band: number;
  lvl: string;
}

// ---------- Lessons & courses (format shared with Bo-ok) ----------
export interface Explained { why: Record<Lang, string>; example: string }
export interface AudioBlock { type: "audio"; id: string; speakers: Record<string, { name: string; voice: string }>; lines: { speaker: string; text: string; pauseAfterMs?: number }[] }
export type Block =
  | { type: "heading"; text: string }
  | { type: "text"; text: string }
  | { type: "image"; src: string; alt: string; credit?: string }
  | { type: "vocab"; items: { en: string; tr: string; ar: string; example: string }[] }
  | ({ type: "choice"; id: string; prompt: string; options: string[]; answer: number } & Explained)
  | ({ type: "gap"; id: string; prompt: string; answers: string[] } & Explained)
  | ({ type: "tfng"; id: string; statement: string; answer: "true" | "false" | "not given" } & Explained)
  | AudioBlock;

type StepTexts = { i18n?: Partial<Record<Lang, { title?: string; intro?: string; tip?: string }>> };
export type LessonStep = StepTexts &
  (
    | { kind: "words"; title: string; intro: string; words: { en: string; pos: string; tr: string; ar: string; example: string }[]; practice: Block[] }
    | { kind: "listen"; title: string; intro: string; tip: string; audio: AudioBlock; questions: Block[] }
    | { kind: "read"; title: string; intro: string; tip: string; passage: Block[]; questions: Block[] }
    | { kind: "language"; title: string; explain: Record<Lang, string>; examples: string[]; questions: Block[] }
    | { kind: "write"; title: string; task: 1 | 2; prompt: string; data?: string; minutes: number; minWords: number; tip: string; model: string }
    | { kind: "speak"; title: string; part1: string[]; card: { title: string; points: string[]; explain: string }; useful: string[] }
  );
export interface Lesson { id: string; number: number; title: string; topic: string; level: string; goal: string; steps: LessonStep[] }
export interface LessonInfo { id: string; number: number; title: string; topic: string; level: string; goal: string; grammar: string | null; kinds: LessonStep["kind"][] }

export interface Unit { id: string; title: string; timeMinutes?: number; goal: string; blocks: Block[] }
export interface Course { id: string; title: string; level: string; track: string; exam?: "reading" | "listening"; description: string; units: Unit[] }

export interface WritingPrompt { id: string; task: 1 | 2; kind: string; topic: string; text: string; data?: string; module: "general" | "academic"; tone?: string; points?: string[] }
export interface CueCard { id: string; title: string; points: string[]; explain: string; followUp: string[]; category: string }
export interface OfficialTest { id: string; provider: string; title: string; module: string; skill: string; url: string; free: boolean; login: boolean; minutes?: number; questions?: number; notes?: string }
export interface IeltsContent { part1: { id: string; name: string; questions: string[] }[]; cueCards: CueCard[]; writing: WritingPrompt[]; official: OfficialTest[] }

// ---------- Books (reading ladder) ----------
export interface BookChapter { title: string; start: number; startWord: number }
export interface BookInfo { id: string; title: string; author: string; level: string; year: number; words: number; blocks: number; chapters: BookChapter[]; note?: string; gutenberg?: number; cover?: string }
export interface Book { id: string; title: string; author: string; blocks: { type: "h2" | "p"; text: string }[] }
export interface ReadingState { current?: string; books: Record<string, { block: number; max?: number; words: number; finished?: string }>; log: Record<string, number> }

// ---------- Learner state ----------
export type Level = "A2" | "B1" | "B2" | "C1";
export interface Settings {
  name: string;
  level: Level;
  goal: "ielts-gt" | "ielts-ac" | "general";
  target: number;
  minutes: 30 | 60 | 90;
  explainLang: Lang;
  textSize: "s" | "m" | "l" | "xl";
  highContrast: boolean;
  /** One accent colour for the main action and progress; "mono" = black and white. */
  accent?: "violet" | "blue" | "orange" | "mono";
  theme: "system" | "light" | "dark";
  reduceMotion: boolean;
  comfortable: boolean;
  newWords: number;
  setupDone: boolean;
  startDate: string;
}

export interface StoredCard {
  dueAt: string;
  stability: number;
  difficulty: number;
  state: number;
  reps: number;
  lapses: number;
  lastReviewAt: string | null;
  [k: string]: unknown;
}

export interface MyCard { card: StoredCard; added: string; custom?: { w: string; d?: string; ex?: string; source: string }; /** Book id when the word was saved while reading. */ book?: string }

export interface Mastery {
  rec: number; // recognition 0..1
  ctl: number; // controlled practice
  prod: number; // independent production
  auto: number; // later retrieval without hints
  attempts: number;
  correct: number;
  learnedAt?: string;
  card?: StoredCard;
}

export interface Mistake {
  id: string;
  at: string;
  kind: "grammar" | "vocab" | "reading" | "listening" | "imported";
  topic?: string;
  prompt: string;
  given: string;
  expected: string;
  why?: string;
  fixed: boolean;
  fixedAt?: string;
  source?: string;
}

export interface DayLog {
  active: number; // seconds of active learning (estimate)
  byKind: Record<string, number>;
  attempts: number;
  correct: number;
  reviews: number;
  newWords: number;
  sessionDone: boolean;
}

export interface LessonProgress { done: number[]; finished?: string }

export interface WritingEntry { id: string; at: string; promptId: string; prompt: string; text: string; words: number; seconds: number; selfCheck: string[]; rewriteOf?: string }
export interface SpeakingEntry { id: string; at: string; prompt: string; seconds: number; audioKey?: string; selfCheck: string[] }
export interface TestResult { id: string; at: string; kind: "listening" | "reading" | "official" | "checkpoint"; ref: string; title: string; score: number; of: number; band?: number; /** Checkpoints: estimated vocabulary size and rough level (practice estimates). */ vocab?: number; level?: string }
export interface ExternalSession { id: string; at: string; source: "praktika" | "hellotalk" | "other"; topic: string; minutes?: number; method: string }

export interface ImportItem {
  id: string;
  at: string;
  source: "praktika" | "other";
  method: "pdf" | "text" | "share" | "paste";
  name: string;
  vocab: { w: string; d?: string; ex?: string; approved: boolean }[];
  corrections: { original: string; corrected: string; explanation?: string; approved: boolean }[];
  session?: { date?: string; topic?: string; minutes?: number };
  status: "pending" | "applied" | "discarded";
}

export interface SessionStep {
  id: string;
  kind: "recall" | "review" | "pretech" | "grammar" | "grammar-review" | "input" | "book" | "dictation" | "output" | "fluency" | "speak" | "mistakes" | "checkpoint" | "wrap";
  title: string;
  why: string;
  minutes: number;
  ref?: { book?: string; lesson?: number; step?: number; topic?: string; topics?: string[]; course?: string; unit?: string; prompt?: string; cue?: string; words?: number[]; sentences?: string[] };
}

export interface DaySession { date: string; minutes: number; steps: SessionStep[]; index: number; started: string; finished?: string }

/** Generated recording of a listening text (Piper voices): start time of each line, for following along. */
export interface TtsRecording { file: string; seconds: number; bytes: number; starts: number[] }
/** A LibriVox audiobook for a ladder book (public domain), downloaded from archive.org. */
export interface Audiobook { archive: string; reader: string; title: string; licence: string; source: string; bytes: number; seconds: number; chapters: { title: string; file: string; bytes: number; seconds: number }[] }
export interface AudioIndex { tts: Record<string, TtsRecording>; books: Record<string, Audiobook>; about?: string }
export interface ListeningState { pos: Record<string, number>; last?: string }
