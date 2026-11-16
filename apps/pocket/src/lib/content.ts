// Loads public content from ./data (relative, so it works under any base path) and caches it.
import type { Course, GrammarTopic, IeltsContent, Lesson, LessonInfo, VocabItem } from "./types";

const cache = new Map<string, Promise<unknown>>();
const base = () => (typeof document !== "undefined" ? new URL("./data/", document.baseURI).href : "./data/");

export function load<T>(path: string): Promise<T> {
  let p = cache.get(path) as Promise<T> | undefined;
  if (!p) {
    p = fetch(base() + path).then((r) => {
      if (!r.ok) throw new Error(`Could not load ${path}`);
      return r.json() as Promise<T>;
    });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return p;
}

export interface Content {
  grammar: GrammarTopic[];
  grammarById: Map<string, GrammarTopic>;
  vocab: VocabItem[];
  vocabById: Map<number, VocabItem>;
  lessons: LessonInfo[];
  ielts: IeltsContent;
  licence: string;
}

let all: Promise<Content> | null = null;
export function loadAll(): Promise<Content> {
  all ??= Promise.all([
    load<{ topics: GrammarTopic[] }>("grammar.json"),
    load<{ items: VocabItem[]; licence: string }>("vocab.json"),
    load<{ lessons: LessonInfo[] }>("lessons.json"),
    load<IeltsContent>("ielts.json"),
  ]).then(([g, v, l, i]) => ({
    grammar: g.topics,
    grammarById: new Map(g.topics.map((t) => [t.id, t])),
    vocab: v.items,
    vocabById: new Map(v.items.map((x) => [x.id, x])),
    lessons: l.lessons,
    ielts: i,
    licence: v.licence,
  }));
  all.catch(() => (all = null));
  return all;
}

export const loadLesson = (n: number) => load<Lesson>(`lessons/lesson-${String(n).padStart(2, "0")}.json`);
export const loadCourse = (id: string) => load<Course>(`courses/${id}.json`);
export const COURSES = ["general-path", "ielts-reading-foundations", "ielts-vocabulary-topics", "ielts-writing-foundations", "ielts-listening-tests", "ielts-reading-mock"] as const;
