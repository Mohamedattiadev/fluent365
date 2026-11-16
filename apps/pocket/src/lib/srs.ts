// FSRS scheduling with ts-fsrs (MIT). Used for vocabulary cards and grammar topics.
import { DefaultScheduler, Rating, type Grade } from "ts-fsrs";
import type { StoredCard } from "./types";

export { Rating };
export type { Grade };

type Scheduler = Awaited<ReturnType<typeof DefaultScheduler>>;
let schedulerPromise: Promise<Scheduler> | null = null;

export const loadScheduler = () =>
  (schedulerPromise ??= DefaultScheduler({
    desiredRetention: 0.9,
    enableFuzz: true,
    enableShortTerm: true,
    learningSteps: ["1m", "10m"],
    relearningSteps: ["10m"],
    allowModelOverride: false,
  } as never));

function revive(card: StoredCard) {
  return { ...card, dueAt: new Date(card.dueAt), lastReviewAt: card.lastReviewAt ? new Date(card.lastReviewAt) : null } as unknown as ReturnType<Scheduler["newCard"]>;
}

export async function schedule(card: StoredCard | undefined, grade: Grade, now = new Date()): Promise<StoredCard> {
  const s = await loadScheduler();
  const c = card ? revive(card) : s.newCard({ now } as never);
  const next = s.review({ card: c as never, grade, now } as never).card;
  return JSON.parse(JSON.stringify(next)) as StoredCard;
}

/** Preview the next interval for each grade (for button labels). */
export async function preview(card: StoredCard | undefined, now = new Date()) {
  const out: Record<number, string> = {};
  for (const g of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as Grade[]) {
    const n = await schedule(card, g, now);
    out[g] = interval(new Date(n.dueAt).getTime() - now.getTime());
  }
  return out;
}

export function interval(ms: number) {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  if (d < 31) return `${d} day${d === 1 ? "" : "s"}`;
  const mo = Math.round(d / 30);
  return mo < 12 ? `${mo} mo` : `${(d / 365).toFixed(1)} y`;
}

export const isDue = (card: StoredCard | undefined, now = Date.now()) => !!card && new Date(card.dueAt).getTime() <= now;
export const LEARNED_DAYS = 21;
export const statusOf = (card: StoredCard | undefined) => (!card ? "new" : card.stability >= LEARNED_DAYS ? "learned" : card.state === 2 ? "review" : "learning");

/** Grade a grammar practice block from its accuracy. */
export const gradeFromAccuracy = (acc: number): Grade => (acc < 0.6 ? Rating.Again : acc < 0.8 ? Rating.Hard : acc < 0.95 ? Rating.Good : Rating.Easy) as Grade;
