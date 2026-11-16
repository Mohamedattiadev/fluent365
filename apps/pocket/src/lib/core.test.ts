import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { Content } from "./content";
import { addCards, dueCardKeys, recordAttempt, reviewWord } from "./learning";
import { ankiExport, ankiImport, checkBackup, makeBackup, parseLearningText } from "./portability";
import { buildSession, newWordLimit } from "./session";
import { Rating, schedule, type Grade } from "./srs";
import { emptyState, flush, getState, loadState, replaceState } from "./store";
import { diffWords, matches, normalize } from "./text";
import type { GrammarTopic, IeltsContent, LessonInfo, SessionStep, VocabItem } from "./types";

const data = join(__dirname, "../../public/data");
const read = <T,>(f: string) => JSON.parse(readFileSync(join(data, f), "utf8")) as T;

function content(): Content {
  const g = read<{ topics: GrammarTopic[] }>("grammar.json").topics;
  const v = read<{ items: VocabItem[]; licence: string }>("vocab.json");
  return {
    grammar: g, grammarById: new Map(g.map((t) => [t.id, t])),
    vocab: v.items, vocabById: new Map(v.items.map((x) => [x.id, x])),
    lessons: read<{ lessons: LessonInfo[] }>("lessons.json").lessons,
    ielts: read<IeltsContent>("ielts.json"), licence: v.licence, books: read<{ books: Content["books"] }>("books.json").books,
  };
}

beforeEach(async () => {
  await replaceState(emptyState());
});

describe("answer checking", () => {
  it("ignores case, final punctuation and contractions", () => {
    expect(matches("I'm reading a novel at the moment", ["I am reading a novel at the moment."])).toBe(true);
    expect(matches("  she DOESN’T like coffee ", ["She does not like coffee."])).toBe(true);
    expect(matches("goes", ["go"])).toBe(false);
    expect(matches("", ["x"])).toBe(false);
  });
  it("normalizes curly apostrophes", () => expect(normalize("It’s")).toBe("it is"));
  it("diffs words", () => {
    const d = diffWords("He don't like coffee", "He doesn't like coffee");
    expect(d.some((x) => x.op === "del")).toBe(true);
    expect(d.some((x) => x.op === "add")).toBe(true);
  });
});

describe("content", () => {
  const c = content();
  it("has grammar with valid exercises", () => {
    expect(c.grammar.length).toBeGreaterThanOrEqual(58);
    for (const t of c.grammar) {
      expect(t.exercises.length).toBeGreaterThan(0);
      for (const e of t.exercises) {
        if ("options" in e) expect(e.answer, t.id).toBeLessThan(e.options.length);
        if (e.type === "produce" && e.check) expect(() => new RegExp(e.check, "i")).not.toThrow();
      }
    }
  });
  it("build exercises use exactly the words of the answer", () => {
    const words = (s: string) => s.toLowerCase().replace(/[.,?!]/g, "").split(/\s+/).sort().join(" ");
    for (const t of c.grammar) for (const e of t.exercises) if (e.type === "build") expect(words(e.blocks.join(" ")), `${t.id}: ${e.answer}`).toBe(words(e.answer));
  });
  it("model answers satisfy their own production check", () => {
    for (const t of c.grammar) for (const e of t.exercises) if (e.type === "produce" && e.check) expect(new RegExp(e.check, "i").test(e.model), `${t.id}: ${e.model}`).toBe(true);
  });
  it("has thousands of unique words with definitions", () => {
    expect(c.vocab.length).toBeGreaterThan(5000);
    expect(c.vocab.filter((v) => v.d).length).toBeGreaterThan(4500);
    expect(new Set(c.vocab.map((v) => v.w.toLowerCase().trim())).size).toBe(c.vocab.length);
  });
});

describe("FSRS scheduling", () => {
  it("Good pushes the due date later than Again", async () => {
    const now = new Date("2026-11-16T10:00:00Z");
    const again = await schedule(undefined, Rating.Again as Grade, now);
    const good = await schedule(undefined, Rating.Good as Grade, now);
    expect(new Date(good.dueAt).getTime()).toBeGreaterThanOrEqual(new Date(again.dueAt).getTime());
    const later = await schedule(good, Rating.Good as Grade, new Date(good.dueAt));
    expect(new Date(later.dueAt).getTime()).toBeGreaterThan(new Date(good.dueAt).getTime());
  });
  it("review updates the card and the day log, and survives reload", async () => {
    addCards(["10", "11"]);
    expect(dueCardKeys()).toEqual(expect.arrayContaining(["10", "11"]));
    await reviewWord("10", Rating.Easy as Grade);
    expect(getState().cards["10"].card.reps).toBeGreaterThan(0);
    expect(dueCardKeys()).not.toContain("10");
    await flush();
    await loadState();
    expect(getState().cards["10"].card.reps).toBeGreaterThan(0);
    expect(Object.values(getState().days)[0].reviews).toBe(1);
  });
});

describe("grammar mastery and mistakes", () => {
  it("tracks dimensions separately and records + fixes mistakes", () => {
    recordAttempt({ kind: "grammar", topic: "g-articles", exType: "choose", ok: true, prompt: "p1", given: "a", expected: "a" });
    recordAttempt({ kind: "grammar", topic: "g-articles", exType: "fix", ok: false, prompt: "p2", given: "wrong", expected: "right" });
    const m = getState().grammar["g-articles"];
    expect(m.rec).toBeGreaterThan(0);
    expect(m.ctl).toBe(0);
    expect(m.prod).toBe(0);
    expect(getState().mistakes).toHaveLength(1);
    recordAttempt({ kind: "grammar", topic: "g-articles", exType: "fix", ok: true, prompt: "p2", given: "right", expected: "right" });
    expect(getState().mistakes[0].fixed).toBe(true);
  });
});

describe("guided session", () => {
  const c = content();
  it("builds a Pocket session: words, grammar, input, a speaking prompt and a wrap-up", () => {
    const s = buildSession(c, getState(), 60);
    const kinds = s.steps.map((x) => x.kind);
    expect(kinds).toContain("pretech");
    expect(kinds).toContain("input");
    expect(kinds).toContain("speak");
    // Writing and speaking tasks belong to the Local app.
    expect(kinds).not.toContain("output");
    expect(kinds).not.toContain("fluency");
    expect(kinds).toContain("grammar");
    expect(kinds.at(-1)).toBe("wrap");
    expect(s.steps.every((x) => x.why.length > 10)).toBe(true);
  });
  it("puts reviews first when cards are due", () => {
    addCards(["100", "101", "102"]);
    expect(buildSession(c, getState(), 60).steps[0].kind).toBe("review");
  });
  it("cuts new words when the review backlog is large", () => {
    const st = getState();
    expect(newWordLimit(st, 0, 60)).toBe(15);
    expect(newWordLimit(st, 120, 60)).toBe(5);
    expect(newWordLimit(st, 200, 60)).toBe(0);
    expect(newWordLimit(st, 0, 30)).toBe(5);
  });
  it("short day is shorter", () => {
    const total = (m: 30 | 90) => buildSession(c, getState(), m).steps.reduce((n, x) => n + x.minutes, 0);
    expect(total(30)).toBeLessThan(total(90));
  });
});

describe("backup", () => {
  it("round-trips and rejects bad files", () => {
    addCards(["5"]);
    const ok = checkBackup(JSON.stringify(makeBackup()));
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(Object.keys(ok.state.cards)).toContain("5");
    expect(checkBackup("not json").ok).toBe(false);
    expect(checkBackup(JSON.stringify({ app: "other" })).ok).toBe(false);
    expect(checkBackup(JSON.stringify({ app: "fluent365", format: 99, data: {} })).ok).toBe(false);
    expect(checkBackup(JSON.stringify({ app: "fluent365", format: 1, data: { cards: [] } })).ok).toBe(false);
  });
});

describe("import parsing (Praktika / shared text)", () => {
  it("finds words and explicit corrections only", () => {
    const it = parseLearningText("Topic: Travel\nDate: 2026-11-10\n25 min\n\nVocabulary\n• commute – to travel to work\n• layover: a short stop on a journey\n\nYou said: I am agree with you\nCorrected: I agree with you\nExplanation: agree is a verb\n\nI go there yesterday → I went there yesterday\nThis is a normal sentence without a pattern.", "praktika", "paste", "test");
    expect(it.vocab.map((v) => v.w)).toEqual(["commute", "layover"]);
    expect(it.corrections).toHaveLength(2);
    expect(it.corrections[0]).toMatchObject({ original: "I am agree with you", corrected: "I agree with you", explanation: "agree is a verb" });
    expect(it.session).toMatchObject({ topic: "Travel", date: "2026-11-10", minutes: 25 });
  });
  it("returns nothing for text without patterns", () => {
    const it = parseLearningText("Hello, this is just a paragraph of text with no structure at all.", "other", "paste", "x");
    expect(it.vocab).toHaveLength(0);
    expect(it.corrections).toHaveLength(0);
  });
});

describe("Anki", () => {
  it("exports TSV with GUIDs and imports plain text", () => {
    const tsv = ankiExport([{ key: "1", front: "commute", back: "travel\tto work", tags: ["ngsl"] }]);
    expect(tsv).toContain("#guid column:1");
    expect(tsv).toContain("fluent365-1\tcommute\ttravel to work\tngsl");
    expect(ankiImport("#separator:tab\n#html:true\nhello\t<b>greeting</b>\nworld\tthe earth\n")).toEqual([{ w: "hello", d: "greeting" }, { w: "world", d: "the earth" }]);
  });
});

describe("design: skill of each session step", () => {
  it("maps steps to the six skills for colour lines and labels", async () => {
    const { skillOf } = await import("./session");
    const step = (kind: SessionStep["kind"], title = "", ref: SessionStep["ref"] = {}) => ({ id: "x", kind, title, why: "", minutes: 5, ref }) as SessionStep;
    expect(skillOf(step("review"))).toBe("words");
    expect(skillOf(step("grammar-review"))).toBe("grammar");
    expect(skillOf(step("dictation"))).toBe("listening");
    expect(skillOf(step("input", "Lesson 3 · Listening", { lesson: 3, step: 1 }))).toBe("listening");
    expect(skillOf(step("input", "Lesson 3 · Reading", { lesson: 3, step: 2 }))).toBe("reading");
    expect(skillOf(step("input", "IELTS practice", { course: "ielts-listening-tests", unit: "t1-part1" }))).toBe("listening");
    expect(skillOf(step("output", "Writing · Task 2", { prompt: "p1" }))).toBe("writing");
    expect(skillOf(step("output", "Speaking practice", { cue: "c1" }))).toBe("speaking");
    expect(skillOf(step("fluency"))).toBe("speaking");
    expect(skillOf(step("wrap"))).toBeUndefined();
  });
});

describe("reading ladder", () => {
  const para = (n: number) => ({ type: "p" as const, text: Array.from({ length: n }, (_, i) => `word${i}`).join(" ") });
  const book = { id: "b1", title: "B", author: "A", blocks: [{ type: "h2" as const, text: "Chapter I" }, para(200), para(200), para(200), { type: "h2" as const, text: "Chapter II" }, para(100)] };
  const info = { id: "b1", title: "B", author: "A", level: "B1", year: 1900, words: 704, blocks: 6, chapters: [] };
  it("splits pages at about 350 words and at chapter headings", async () => {
    const { pageAt } = await import("./reading");
    expect(pageAt(book, 0)).toEqual({ start: 0, end: 3, words: 402 });
    expect(pageAt(book, 3).end).toBe(4); // stops before the next chapter heading
  });
  it("counts words once, even after going back a page, and tracks today", async () => {
    const { recordPage, setPosition, readToday, progressOf } = await import("./reading");
    await replaceState(emptyState());
    recordPage(book, info, 0, 3);
    setPosition("b1", 0);
    recordPage(book, info, 0, 3);
    expect(progressOf(getState(), "b1").words).toBe(402);
    expect(readToday()).toBe(402);
    recordPage(book, info, 3, 6);
    expect(progressOf(getState(), "b1").finished).toBeTruthy();
  });
  it("sets a daily target that finishes the ladder within the plan", async () => {
    const { dailyTarget } = await import("./reading");
    await replaceState(emptyState());
    const books = [{ ...info, words: 365_000 }];
    expect(dailyTarget(getState(), books)).toBe(1000);
  });
});
