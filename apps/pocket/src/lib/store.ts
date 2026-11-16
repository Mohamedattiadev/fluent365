// The learner's private state. Lives in memory, saved to IndexedDB slice by slice (debounced),
// never sent anywhere. React components subscribe with useApp().
import { useSyncExternalStore } from "react";
import * as db from "./db";
import type { DayLog, DaySession, ExternalSession, ImportItem, LessonProgress, Mastery, Mistake, MyCard, Settings, SpeakingEntry, TestResult, WritingEntry } from "./types";

export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const DEFAULT_SETTINGS: Settings = {
  name: "",
  level: "B1",
  goal: "ielts-gt",
  target: 7.5,
  minutes: 60,
  explainLang: "en",
  textSize: "large",
  theme: "system",
  reduceMotion: false,
  comfortable: false,
  newWords: 15,
  setupDone: false,
  startDate: today(),
};

export interface AppState {
  settings: Settings;
  cards: Record<string, MyCard>; // key: vocab id or "c:<custom id>"
  known: Record<string, true>; // words marked as already known
  grammar: Record<string, Mastery>;
  mistakes: Mistake[];
  days: Record<string, DayLog>;
  lessons: Record<string, LessonProgress>;
  coursework: Record<string, { answers: Record<string, boolean>; done?: string }>;
  writing: WritingEntry[];
  speaking: SpeakingEntry[];
  tests: TestResult[];
  external: ExternalSession[];
  imports: ImportItem[];
  integrations: { praktika: { enabled: boolean } };
  session: DaySession | null;
  history: DaySession[]; // finished sessions (last 60)
}

export const SLICES = ["settings", "cards", "known", "grammar", "mistakes", "days", "lessons", "coursework", "writing", "speaking", "tests", "external", "imports", "integrations", "session", "history"] as const;
export type Slice = (typeof SLICES)[number];

export const emptyState = (): AppState => ({
  settings: { ...DEFAULT_SETTINGS, startDate: today() },
  cards: {},
  known: {},
  grammar: {},
  mistakes: [],
  days: {},
  lessons: {},
  coursework: {},
  writing: [],
  speaking: [],
  tests: [],
  external: [],
  imports: [],
  integrations: { praktika: { enabled: false } },
  session: null,
  history: [],
});

let state: AppState = emptyState();
let loaded = false;
const listeners = new Set<() => void>();
const dirty = new Set<Slice>();
let timer: ReturnType<typeof setTimeout> | null = null;

export const getState = () => state;
export const isLoaded = () => loaded;

export async function loadState() {
  const base = emptyState();
  const values = await Promise.all(SLICES.map((s) => db.get<unknown>("kv", s)));
  SLICES.forEach((s, i) => {
    if (values[i] !== undefined) (base as unknown as Record<string, unknown>)[s] = values[i];
  });
  base.settings = { ...DEFAULT_SETTINGS, ...base.settings };
  state = base;
  loaded = true;
  emit();
}

function emit() {
  for (const l of listeners) l();
}

export async function flush() {
  if (timer) clearTimeout(timer);
  timer = null;
  const slices = [...dirty];
  dirty.clear();
  await Promise.all(slices.map((s) => db.set("kv", s, state[s])));
}

/** Update one or more slices immutably and schedule saving. */
export function update(fn: (draft: AppState) => Partial<AppState> | void) {
  const draft: AppState = { ...state };
  const patch = fn(draft) ?? {};
  const next = { ...draft, ...patch };
  for (const s of SLICES) if (next[s] !== state[s]) dirty.add(s);
  state = next;
  emit();
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, 400);
}

export async function replaceState(next: AppState) {
  state = next;
  for (const s of SLICES) dirty.add(s);
  emit();
  await flush();
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => void flush());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush();
  });
}

export function useApp<T>(select: (s: AppState) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => select(state),
  );
}

export const emptyDay = (): DayLog => ({ active: 0, byKind: {}, attempts: 0, correct: 0, reviews: 0, newWords: 0, sessionDone: false });

export function bumpDay(fn: (d: DayLog) => DayLog) {
  update((s) => {
    const key = today();
    return { days: { ...s.days, [key]: fn({ ...(s.days[key] ?? emptyDay()) }) } };
  });
}

export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
