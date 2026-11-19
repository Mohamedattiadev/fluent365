// Shared by both opt-in backups (own GitHub repo: cloud.ts; own Supabase account: account.ts):
// the same payload (makeBackup / checkBackup), the same once-a-day rule, the same first-sync
// decision and the same restore with a safety copy. "Newest wins": a backup always replaces the
// one in the cloud; nothing is merged item by item.
import * as db from "./db";
import { makeBackup, type BackupCheck } from "./portability";
import { replaceState, type AppState } from "./store";

/** Automatic backups: at most one per this many hours. */
export const AUTO_EVERY_H = 20;

/** Due for an automatic backup. Never before the first (deliberate) backup from this device. */
export const dueSince = (last: string | undefined, now = Date.now()) => !!last && now - Date.parse(last) >= AUTO_EVERY_H * 3600e3;

/** This device has learning progress worth keeping (settings alone do not count). */
export const hasProgress = (s: AppState) =>
  Object.keys(s.cards).length > 0 || Object.keys(s.days).length > 0 || Object.keys(s.grammar).length > 0 || s.mistakes.length > 0 || s.writing.length > 0;

export type FirstSync = "upload" | "restore" | "ask";
/** First connection on a device: nothing in the cloud → upload; an empty device → restore by
 *  itself; both have progress → ask ("Restore it here / Replace it with this device"). */
export const firstSync = (localHasProgress: boolean, remoteExists: boolean): FirstSync =>
  !remoteExists ? "upload" : localHasProgress ? "ask" : "restore";

/** Replace this device's progress with a checked backup; the current data is kept as a safety copy. */
export async function restoreFrom(check: BackupCheck) {
  await db.set("kv", "backup:before-restore", makeBackup());
  await replaceState(check.state);
}
