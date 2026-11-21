import { describe, expect, it } from "vitest";
import { mergeStates } from "./merge";
import { emptyState, emptyDay, type AppState } from "./store";

const card = (reps: number, last: string | null = null) => ({ card: { reps, lastReviewAt: last, dueAt: "", stability: 0, difficulty: 0, state: 0, lapses: 0 }, added: "2026-11-01" });
const sess = (date: string, index: number, finished?: string) => ({ date, minutes: 20, steps: [], index, started: `${date}T08:00:00Z`, ...(finished ? { finished } : {}) });
const st = (p: Partial<AppState>): AppState => ({ ...emptyState(), ...p });

describe("combining two devices (both changed)", () => {
  it("phone at step 3, laptop at step 1 of the same day → step 3, whichever changed last", () => {
    const phone = st({ session: sess("2026-11-21", 3) });
    const laptop = st({ session: sess("2026-11-21", 1) });
    expect(mergeStates(laptop, phone, true).session?.index).toBe(3);
    expect(mergeStates(laptop, phone, false).session?.index).toBe(3);
    expect(mergeStates(st({ session: sess("2026-11-21", 5, "x") }), st({ session: sess("2026-11-21", 6) }), false).session?.finished).toBe("x");
    expect(mergeStates(st({ session: sess("2026-11-22", 0) }), st({ session: sess("2026-11-21", 6) }), false).session?.date).toBe("2026-11-22");
  });
  it("word cards: both sides' words; the same word → the one reviewed more", () => {
    const a = st({ cards: { w1: card(4), w2: card(1) } as never });
    const b = st({ cards: { w1: card(2), w3: card(1) } as never });
    const m = mergeStates(a, b, false);
    expect(Object.keys(m.cards).sort()).toEqual(["w1", "w2", "w3"]);
    expect(m.cards.w1.card.reps).toBe(4);
    const t = mergeStates(st({ cards: { w: card(2, "2026-11-20") } as never }), st({ cards: { w: card(2, "2026-11-21") } as never }), true);
    expect(t.cards.w.card.lastReviewAt).toBe("2026-11-21");
  });
  it("days: the most done of each field; lists: everything from both, a fixed mistake stays fixed", () => {
    const d = (x: number, done = false) => ({ ...emptyDay(), active: x, reviews: x, sessionDone: done, byKind: { words: x } });
    const a = st({ days: { "2026-11-21": d(300), "2026-11-20": d(100, true) }, mistakes: [{ id: "m1", at: "1", fixed: true } as never, { id: "m2", at: "2", fixed: false } as never] });
    const b = st({ days: { "2026-11-21": d(500, true) }, mistakes: [{ id: "m1", at: "1", fixed: false } as never, { id: "m3", at: "3", fixed: false } as never] });
    const m = mergeStates(a, b, false);
    expect(m.days["2026-11-21"]).toMatchObject({ active: 500, reviews: 500, sessionDone: true, byKind: { words: 500 } });
    expect(m.days["2026-11-20"].sessionDone).toBe(true);
    expect(m.mistakes.map((x) => x.id)).toEqual(["m1", "m2", "m3"]);
    expect(m.mistakes[0].fixed).toBe(true);
  });
  it("settings come from the side changed last; lessons and history are combined", () => {
    const a = st({ settings: { ...emptyState().settings, name: "phone" }, lessons: { l1: { done: [1, 2] } }, history: [sess("2026-11-19", 6, "a")] });
    const b = st({ settings: { ...emptyState().settings, name: "laptop" }, lessons: { l1: { done: [2, 3], finished: "f" } }, history: [sess("2026-11-20", 6, "b")] });
    expect(mergeStates(a, b, true).settings.name).toBe("phone");
    const m = mergeStates(a, b, false);
    expect(m.settings.name).toBe("laptop");
    expect(m.lessons.l1).toEqual({ done: [1, 2, 3], finished: "f" });
    expect(m.history.map((h) => h.date)).toEqual(["2026-11-19", "2026-11-20"]);
  });
});
