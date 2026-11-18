import { describe, expect, it } from "vitest";
import { lastAt } from "./edgebooks";
import { chapterSentences, lineAt, mapChapters, sentenceAt, sentenceStarts, splitSentences } from "./transcript";
import type { Audiobook, Book } from "./types";

const book: Book = { id: "b", title: "B", author: "A", blocks: [
  { type: "h2", text: "I. A SCANDAL IN BOHEMIA" }, { type: "p", text: "One. Two." }, { type: "h2", text: "I." }, { type: "p", text: "Three." },
  { type: "h2", text: "II. THE GARDEN" }, { type: "p", text: "Mr. Four went in. Five. Six. Seven." },
] };
const audio = (titles: string[]): Audiobook => ({ archive: "", reader: "", title: "", licence: "", source: "", bytes: 0, seconds: 0, chapters: titles.map((title) => ({ title, file: "", bytes: 0, seconds: 10 })) });

describe("transcript", () => {
  it("finds the spoken line from start times", () => {
    expect(lineAt([0, 11.2, 16], 0)).toBe(0);
    expect(lineAt([0, 11.2, 16], 13)).toBe(1);
    expect(lineAt([0, 11.2, 16], 99)).toBe(2);
  });
  it("maps audio chapters to book chapters by title, including parts", () => {
    const m = mapChapters(book, audio(["01 - A Scandal in Bohemia", "02 - The Garden, Part 1", "03 - The Garden, Part 2"]));
    expect(m.map((x) => [x.start, x.end, x.from, x.to])).toEqual([[0, 4, 0, 1], [4, 6, 0, 0.5], [4, 6, 0.5, 1]]);
    expect(chapterSentences(book, audio(["01 - A Scandal in Bohemia", "02 - The Garden"]), 1)[0].text).toBe("Mr. Four went in.");
  });
  it("falls back to the whole book when titles do not match", () => {
    const m = mapChapters(book, audio(["Chapter 1", "Chapter 2"]));
    expect(m[1]).toMatchObject({ start: 0, end: 6, from: 0.5, to: 1 });
  });
  it("splits sentences without breaking after Mr.", () => {
    expect(splitSentences("Mr. Bennet came. He sat.")).toEqual(["Mr. Bennet came.", "He sat."]);
    expect(sentenceAt([{ at: 0 }, { at: 0.5 }], 0.6)).toBe(1);
  });
});

describe("exact word times (Edge voices)", () => {
  it("finds the word where each sentence starts, like the audio generator", () => {
    expect(sentenceStarts("Mr. Bennet came. He sat down. “Oh!” she cried.")).toEqual([0, 3, 6, 7]);
    expect(sentenceStarts("“Yes!”she said. No.")).toEqual([0, 0, 2]);
    expect(sentenceStarts("One two.")).toEqual([0]);
  });
  it("marks the last word that has started", () => {
    expect(lastAt([1, 1.5, 2], 0.5)).toBe(-1);
    expect(lastAt([1, 1.5, 2], 1.6)).toBe(1);
    expect(lastAt([1, 1.5, 2], 9)).toBe(2);
  });
});

