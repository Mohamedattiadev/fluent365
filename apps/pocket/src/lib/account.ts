// Optional account: Sign in with Google (Supabase Auth) + backup of the progress to the learner's
// own row in Supabase (Row Level Security: user_id = auth.uid(); SQL in supabase/schema.sql).
// Opt-in only. Nothing is hardcoded: the project comes from VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
// at build time or from "Use my own Supabase" in Settings; with neither, the feature is hidden.
// This file stays small and is in the main bundle; @supabase/supabase-js is loaded (./supa) only
// when the Account screen is opened or this device is signed in.
import * as db from "./db";
import { makeBackup, type BackupCheck, type BackupError } from "./portability";
import { changedAt, flush, getState } from "./store";
import { firstSync, hasProgress, restoreFrom } from "./sync";

export interface AccountConfig { url: string; key: string }
export interface AccountState {
  on?: boolean; // signed in on this device (so the client is loaded at start)
  email?: string;
  last?: string; // last successful backup from this device
  lastError?: string;
  ask?: boolean; // first sign-in found a backup and progress here: the learner chooses
  pending?: string; // sign-in started: the route to come back to after Google
  synced?: string; // version (time) of the cloud copy this device last matched
  syncedLocal?: number; // this device's change time at that moment (see store.changedAt)
}

const CFG = "account-config";
const KEY = "account";

const clean = (c: Partial<AccountConfig> | undefined | null): AccountConfig | null => {
  const url = c?.url?.trim().replace(/\/+$/, "");
  const key = c?.key?.trim();
  return url && key && /^https:\/\/[^/\s]+$/.test(url) ? { url, key } : null;
};

/** Build-time config (repo Variables in the Pages workflow). */
export const envConfig = (env: Record<string, unknown> = import.meta.env ?? {}) =>
  clean({ url: env.VITE_SUPABASE_URL as string | undefined, key: env.VITE_SUPABASE_ANON_KEY as string | undefined });

export const getOwnConfig = () => db.get<AccountConfig>("kv", CFG).then(clean).catch(() => null);
export const setOwnConfig = async (c: AccountConfig | null) => {
  const ok = clean(c);
  if (c && !ok) throw new Error("Enter the project URL (https://….supabase.co) and the anon public key.");
  if (ok) await db.set("kv", CFG, ok); else await db.del("kv", CFG);
  return ok;
};
/** The learner's own project wins over the deployment's. null → the Account row is hidden. */
export async function accountConfig(env?: Record<string, unknown>): Promise<AccountConfig | null> {
  return (await getOwnConfig()) ?? envConfig(env);
}

export const getAccount = () => db.get<AccountState>("kv", KEY).then((a) => a ?? {}).catch(() => ({}) as AccountState);
export const patchAccount = async (p: Partial<AccountState>) => { const a = { ...(await getAccount()), ...p }; await db.set("kv", KEY, a); return a; };
const clearAccount = () => db.del("kv", KEY);

/** "Delete everything" on this device: forget the sign-in here too (the account state and the
 *  stored Supabase session), without the network. The cloud backup itself is kept. */
export async function forgetAccountHere() {
  const keys = (await db.entries("kv")).map(([k]) => k).filter((k) => k.startsWith("sb:"));
  await Promise.all([clearAccount(), ...keys.map((k) => db.del("kv", k))]);
}

/** What the app needs from Supabase (implemented in ./supa; replaced in unit tests). */
export interface AccountClient {
  signIn(redirectTo: string): Promise<void>;
  exchange(code: string): Promise<{ email?: string }>;
  email(): Promise<string | undefined>;
  /** The backup, with `stamp` = its version (the time it was saved). */
  load(): Promise<(BackupCheck & { stamp?: string }) | BackupError | null>;
  /** Only the version of the backup (cheap): null when there is none. */
  stamp(): Promise<string | null>;
  /** Saves the backup; its exportedAt becomes the version. */
  save(backup: { exportedAt: string }): Promise<void>;
  remove(): Promise<void>;
  signOut(): Promise<void>;
}
let testClient: AccountClient | null = null;
export const setClientForTests = (c: AccountClient | null) => { testClient = c; };

const client = async (): Promise<AccountClient> => {
  if (testClient) return testClient;
  const cfg = await accountConfig();
  if (!cfg) throw new Error("No Supabase project is set up.");
  return (await import("./supa")).supa(cfg);
};

const message = (e: unknown) => (e instanceof Error && e.message && e.message !== "Failed to fetch" ? e.message : "No connection to the server. It will try again later.");

/** Start "Sign in with Google": the browser goes to Google and comes back to this same page. */
export async function signIn(back?: string) {
  const route = back ?? (location.hash || "#/settings/account");
  await patchAccount({ pending: route });
  // Back to the current page without the hash (Supabase adds ?code=…); the route is restored after.
  await (await client()).signIn(location.origin + location.pathname);
}

/** Coming back from Google: ?code=… in the URL and a sign-in was started on this device. */
const callbackCode = () => new URLSearchParams(location.search).get("code");

/** Called once when the app starts. Finishes a sign-in, or syncs with the other devices. */
export async function accountStartup(): Promise<"signed-in" | "restored" | "ask" | "pulled" | void> {
  if (!(await accountConfig())) return;
  const a = await getAccount();
  const code = callbackCode();
  if (code && a.pending) {
    const back = a.pending;
    history.replaceState(null, "", location.pathname + back);
    try {
      const s = await (await client()).exchange(code);
      await patchAccount({ on: true, email: s.email, pending: undefined, lastError: undefined });
      const r = await afterSignIn();
      dispatchEvent(new HashChangeEvent("hashchange"));
      return r;
    } catch (e) {
      await patchAccount({ pending: undefined, lastError: message(e) });
      return;
    }
  }
  if (a.on) {
    const r = await syncNow();
    if (r === "pulled" || r === "ask") return r;
  }
}

/** First sync after signing in: upload, restore by itself (empty device) or ask. */
export async function afterSignIn(): Promise<"signed-in" | "restored" | "ask"> {
  const remote = await fetchAccountBackup();
  if (!remote.ok && remote.error !== NO_BACKUP) throw new Error(remote.error);
  const action = firstSync(hasProgress(getState()), remote.ok);
  if (action === "upload") { await accountBackupNow(); return "signed-in"; }
  if (action === "restore" && remote.ok) {
    await pull(remote);
    return "restored";
  }
  await patchAccount({ ask: true });
  return "ask";
}

export const NO_BACKUP = "There is no backup in your account yet.";

export async function fetchAccountBackup(): Promise<BackupCheck | BackupError> {
  try {
    return (await (await client()).load()) ?? { ok: false, error: NO_BACKUP };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

const markSynced = (stamp: string | undefined, local: number) =>
  patchAccount({ synced: stamp, syncedLocal: local, last: new Date().toISOString(), lastError: undefined, ask: false });

/** The cloud copy replaces this device's progress (safety copy kept); it counts as synced. */
async function pull(check: BackupCheck & { stamp?: string }) {
  const at = check.stamp ? Date.parse(check.stamp) : undefined;
  await restoreFrom(check, at);
  await markSynced(check.stamp, changedAt());
}

/** Upload the current progress (newest wins). Returns the time of the backup. */
export async function accountBackupNow(): Promise<string> {
  try {
    const local = changedAt();
    const backup = makeBackup();
    await (await client()).save(backup);
    const a = await markSynced(backup.exportedAt, local);
    return a.last!;
  } catch (e) {
    const msg = message(e);
    await patchAccount({ lastError: msg });
    throw new Error(msg);
  }
}

/** "Restore it here": the cloud backup replaces this device's progress (safety copy kept). */
export async function accountRestore(check: BackupCheck & { stamp?: string }) {
  await pull(check);
}

export async function signOut() {
  try { await (await client()).signOut(); } finally { await clearAccount(); }
}

/** "Delete my cloud data": delete the row, then sign out. */
export async function deleteCloudData() {
  await (await client()).remove();
  await signOut();
}

/** The signed-in email (loads the client). null when not signed in. */
export async function currentEmail(): Promise<string | null> {
  const a = await getAccount();
  if (!a.on) return null;
  try { return (await (await client()).email()) ?? a.email ?? null; } catch { return a.email ?? null; }
}

// ---------- Automatic sync between devices ----------
// One copy in the cloud, "newest wins", nothing merged item by item. Each device remembers which
// cloud version it last matched (synced) and its own change time then (syncedLocal):
// - only the cloud changed (another device) → take it;
// - only this device changed → upload it;
// - both changed (two devices used offline) → the newer one wins; the other side's data stays as
//   the safety copy on this device (backup:before-restore).
// Runs when the app opens, comes back to the screen, is left, and ~15 s after a change.

export type SyncAction = "pull" | "push" | "ask" | "none";
const same = (a?: string | null, b?: string | null) => !!a && !!b && Date.parse(a) === Date.parse(b);

/** Pure decision (tested). remote: version in the cloud; local: this device's change time. */
export function syncAction(a: Pick<AccountState, "synced" | "syncedLocal" | "last">, remote: string | null, local: number): SyncAction {
  if (!remote) return "push";
  if (a.synced === undefined) {
    // Signed in before the automatic sync existed: the cloud copy is ours if it was saved at our last backup.
    const ours = !!a.last && Math.abs(Date.parse(remote) - Date.parse(a.last)) < 120e3;
    return ours ? "push" : "ask";
  }
  const remoteChanged = !same(remote, a.synced);
  const localChanged = local !== a.syncedLocal;
  if (remoteChanged && localChanged) return Date.parse(remote) > local ? "pull" : "push";
  if (remoteChanged) return "pull";
  if (localChanged) return "push";
  return "none";
}

let running = false;
let again = false;
/** Sync this device with the account. Silent on failure (recorded in lastError, shown in Settings). */
export async function syncNow(): Promise<"pulled" | "pushed" | "ask" | void> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  if (running) { again = true; return; }
  running = true;
  try {
    const a = await getAccount();
    if (!a.on || a.ask || a.pending || !(await accountConfig())) return;
    await flush();
    const c = await client();
    const remote = await c.stamp();
    const action = syncAction(a, remote, changedAt());
    if (action === "push") { await accountBackupNow(); return "pushed"; }
    if (action === "ask") { await patchAccount({ ask: true }); return "ask"; }
    if (action === "pull") {
      const r = await c.load();
      if (r?.ok) { await pull(r); return "pulled"; }
    }
  } catch (e) {
    await patchAccount({ lastError: message(e) }).catch(() => undefined);
  } finally {
    running = false;
    if (again) { again = false; void syncNow(); }
  }
}
