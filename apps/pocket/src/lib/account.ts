// Optional account: Sign in with Google (Supabase Auth) + backup of the progress to the learner's
// own row in Supabase (Row Level Security: user_id = auth.uid(); SQL in supabase/schema.sql).
// Opt-in only. Nothing is hardcoded: the project comes from VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
// at build time or from "Use my own Supabase" in Settings; with neither, the feature is hidden.
// This file stays small and is in the main bundle; @supabase/supabase-js is loaded (./supa) only
// when the Account screen is opened or this device is signed in.
import * as db from "./db";
import { makeBackup, type BackupCheck, type BackupError } from "./portability";
import { getState } from "./store";
import { dueSince, firstSync, hasProgress, restoreFrom } from "./sync";

export interface AccountConfig { url: string; key: string }
export interface AccountState {
  on?: boolean; // signed in on this device (so the client is loaded at start)
  email?: string;
  last?: string; // last successful backup from this device
  lastError?: string;
  ask?: boolean; // first sign-in found a backup and progress here: the learner chooses
  pending?: string; // sign-in started: the route to come back to after Google
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

/** What the app needs from Supabase (implemented in ./supa; replaced in unit tests). */
export interface AccountClient {
  signIn(redirectTo: string): Promise<void>;
  exchange(code: string): Promise<{ email?: string }>;
  email(): Promise<string | undefined>;
  load(): Promise<BackupCheck | BackupError | null>;
  save(backup: unknown): Promise<void>;
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

/** Called once when the app starts. Finishes a sign-in, or makes an automatic backup when due. */
export async function accountStartup(): Promise<"signed-in" | "restored" | "ask" | void> {
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
    void import("./supa"); // ready for the backup when the app is left
    await autoAccountBackup();
  }
}

/** First sync after signing in: upload, restore by itself (empty device) or ask. */
export async function afterSignIn(): Promise<"signed-in" | "restored" | "ask"> {
  const remote = await fetchAccountBackup();
  if (!remote.ok && remote.error !== NO_BACKUP) throw new Error(remote.error);
  const action = firstSync(hasProgress(getState()), remote.ok);
  if (action === "upload") { await accountBackupNow(); return "signed-in"; }
  if (action === "restore" && remote.ok) {
    await restoreFrom(remote);
    await patchAccount({ last: new Date().toISOString(), ask: false });
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

/** Upload the current progress (newest wins). Returns the time of the backup. */
export async function accountBackupNow(): Promise<string> {
  try {
    await (await client()).save(makeBackup());
    const last = new Date().toISOString();
    await patchAccount({ last, lastError: undefined, ask: false });
    return last;
  } catch (e) {
    const msg = message(e);
    await patchAccount({ lastError: msg });
    throw new Error(msg);
  }
}

/** "Restore it here": the cloud backup replaces this device's progress (safety copy kept). */
export async function accountRestore(check: BackupCheck) {
  await restoreFrom(check);
  await patchAccount({ last: new Date().toISOString(), ask: false });
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

let running = false;
/** Automatic backup when the app is opened or left: at most once per ~20 h. Silent on failure. */
export async function autoAccountBackup() {
  if (running || (typeof navigator !== "undefined" && navigator.onLine === false)) return;
  running = true;
  try {
    const a = await getAccount();
    if (a.on && !a.ask && dueSince(a.last) && (await accountConfig())) await accountBackupNow();
  } catch {
    /* recorded in lastError, shown in Settings */
  } finally {
    running = false;
  }
}
