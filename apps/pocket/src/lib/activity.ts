// Active learning time (an estimate, documented in docs/DATA_PRIVACY.md):
// time counts only while the page is visible AND the learner did something meaningful
// (answered, checked, rated a card, typed in a writing task, played audio, recorded) in the last
// IDLE_LIMIT seconds. No keystroke logging, no mouse tracking: only "something happened" pings.
import { bumpDay } from "./store";

export const IDLE_LIMIT = 75; // seconds
const TICK = 5;
let last = 0;
let kind = "other";
let started = false;

/** Call on every meaningful learning event. */
export function ping(activity?: string) {
  last = Date.now();
  if (activity) kind = activity;
}

export const isActive = () => typeof document !== "undefined" && document.visibilityState === "visible" && Date.now() - last < IDLE_LIMIT * 1000;

export function startTracking() {
  if (started || typeof window === "undefined") return;
  started = true;
  let prev = Date.now();
  setInterval(() => {
    const now = Date.now();
    const elapsed = Math.min((now - prev) / 1000, TICK * 2);
    prev = now;
    if (!isActive()) return;
    const k = kind;
    bumpDay((d) => ({ ...d, active: d.active + elapsed, byKind: { ...d.byKind, [k]: (d.byKind[k] ?? 0) + elapsed } }));
  }, TICK * 1000);
}
