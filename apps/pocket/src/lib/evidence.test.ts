import { describe, expect, it } from "vitest";
import { comprehension, gateChecks, MIN_ANSWERS, reviewAccuracy } from "./evidence";
import { phaseHeld, phaseOf } from "./session";
import { emptyDay, emptyState, today, type AppState } from "./store";

const lessonsDone = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, { done: [], finished: "2026-11-01" }]));
const dayAgo = (n: number) => today(new Date(Date.now() - n * 86400000));

function learner(p: Partial<AppState> = {}, settings: Partial<AppState["settings"]> = {}): AppState {
  const s = emptyState();
  return { ...s, ...p, settings: { ...s.settings, setupDone: true, ...settings } };
}

describe("phase moves need evidence (design rule 16)", () => {
  it("lessons alone do not move a new learner past B1", () => {
    const s = learner({ lessons: lessonsDone(20) }, { phaseReached: "B1" });
    expect(phaseOf(s)).toBe("B1");
    expect(phaseHeld(s)).toBe(true);
    expect(phaseOf({ ...s, settings: { ...s.settings, phaseReached: "B2" } })).toBe("B2");
  });

  it("a learner who starts at B2 begins in the B2 phase; unrecorded = lesson phase", () => {
    expect(phaseOf(learner({}, { level: "B2", phaseReached: "B1" }))).toBe("B2");
    expect(phaseOf(learner({ lessons: lessonsDone(20) }))).toBe("B2");
  });

  it("comprehension and review accuracy count the last 30 days, with a minimum sample", () => {
    const days = {
      [dayAgo(0)]: { ...emptyDay(), reviews: 30, revOk: 27, comp: { listening: [8, 10] as [number, number] } },
      [dayAgo(40)]: { ...emptyDay(), comp: { listening: [0, 50] as [number, number] } },
    };
    const s = learner({ days });
    expect(comprehension(s, "listening")).toEqual({ acc: null, n: 10 });
    expect(reviewAccuracy(s).acc).toBeCloseTo(0.9);
    days[dayAgo(1)] = { ...emptyDay(), comp: { listening: [10, MIN_ANSWERS] } };
    expect(comprehension(learner({ days }), "listening").acc).toBeCloseTo(18 / 30);
  });

  it("the gate lists every target and passes only when all are met", () => {
    const good = { ...emptyDay(), reviews: 40, revOk: 36, comp: { listening: [18, 24] as [number, number], reading: [20, 25] as [number, number] } };
    const s = learner({ days: { [dayAgo(2)]: good } });
    expect(gateChecks(s, "B2", { vocab: 3200, grammar: 0.75 }).every((g) => g.ok)).toBe(true);
    const low = gateChecks(s, "B2", { vocab: 2500, grammar: 0.75 });
    expect(low.filter((g) => !g.ok).map((g) => g.label)).toEqual(["Words you know (estimate)"]);
    expect(gateChecks(learner(), "B2", { vocab: 3200, grammar: 0.8 }).find((g) => g.label.startsWith("Listening"))?.have).toMatch(/not enough practice/);
  });
});
