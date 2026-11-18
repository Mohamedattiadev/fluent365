// Opt-in automatic backup to the learner's OWN private GitHub repo (GitHub Contents API).
// The key (a fine-grained token limited to that one repo) is pasted once and kept only in
// IndexedDB on this device; it is never part of the backup file. Public repos are refused.
// Every backup is a commit, so the repo's history keeps the older versions.
import * as db from "./db";
import { checkBackup, makeBackup, type BackupCheck, type BackupError } from "./portability";

const API = "https://api.github.com";
export const BACKUP_PATH = "fluent365-backup.json";
const KEY = "cloud";
/** Automatic backups: at most one per this many hours. */
export const AUTO_EVERY_H = 20;

export interface CloudConfig { token: string; repo: string; branch: string; last?: string; lastError?: string }
export interface RepoChoice { full_name: string; default_branch: string }

/** GitHub's page for a new fine-grained key, pre-filled where GitHub supports it. */
export const NEW_KEY_URL = "https://github.com/settings/personal-access-tokens/new?name=Fluent365%20backup&description=Backup%20of%20my%20Fluent365%20progress&contents=write";

export const getCloud = () => db.get<CloudConfig>("kv", KEY).catch(() => undefined);
const setCloud = (c: CloudConfig) => db.set("kv", KEY, c);
export const disconnect = () => db.del("kv", KEY);

const headers = (token: string, extra: Record<string, string> = {}) => ({ Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28", Accept: "application/vnd.github+json", ...extra });

async function gh(token: string, path: string, init: RequestInit = {}, accept?: string) {
  const res = await fetch(API + path, { ...init, cache: "no-store", headers: headers(token, accept ? { Accept: accept } : {}) });
  if (res.status === 401) throw new Error("GitHub did not accept the key. It may have expired: make a new one and paste it again.");
  if (res.status === 403) throw new Error("The key has no permission to write. Give it “Contents: Read and write” for your backup repo.");
  return res;
}

/** Private repos this key can write to. */
export async function findRepos(token: string): Promise<RepoChoice[]> {
  const res = await gh(token, "/user/repos?per_page=100&sort=updated");
  if (!res.ok) throw new Error(`GitHub answered ${res.status}. Check your internet connection and try again.`);
  const list = (await res.json()) as { full_name: string; default_branch: string; private: boolean; permissions?: { push?: boolean } }[];
  return list.filter((r) => r.private && r.permissions?.push !== false).map((r) => ({ full_name: r.full_name, default_branch: r.default_branch || "main" }));
}

export async function connect(token: string, repo: RepoChoice) {
  await setCloud({ token: token.trim(), repo: repo.full_name, branch: repo.default_branch });
}

// UTF-8 safe base64 (the backup has Turkish and Arabic text).
export function toBase64(text: string) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const fileUrl = (c: CloudConfig) => `/repos/${c.repo}/contents/${BACKUP_PATH}`;

async function currentSha(c: CloudConfig): Promise<string | undefined> {
  const res = await gh(c.token, `${fileUrl(c)}?ref=${encodeURIComponent(c.branch)}`);
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`GitHub answered ${res.status}.`);
  return ((await res.json()) as { sha: string }).sha;
}

/** Upload the current progress. Returns the time of the backup. */
export async function backupNow(): Promise<string> {
  const c = await getCloud();
  if (!c) throw new Error("Not connected.");
  try {
    const content = toBase64(JSON.stringify(makeBackup()));
    const put = async (sha?: string) =>
      gh(c.token, fileUrl(c), { method: "PUT", body: JSON.stringify({ message: `Fluent365 backup ${new Date().toISOString().slice(0, 16).replace("T", " ")}`, content, branch: c.branch, ...(sha ? { sha } : {}) }) });
    let res = await put(await currentSha(c));
    // Another device wrote in between: the newest backup wins (older ones stay in the repo history).
    if (res.status === 409 || res.status === 422) res = await put(await currentSha(c));
    if (!res.ok) throw new Error(`GitHub answered ${res.status}.`);
    const last = new Date().toISOString();
    await setCloud({ ...c, last, lastError: undefined });
    return last;
  } catch (e) {
    const msg = e instanceof Error && e.message !== "Failed to fetch" ? e.message : "No connection to GitHub. It will try again later.";
    await setCloud({ ...c, lastError: msg });
    throw new Error(msg);
  }
}

/** Read the backup from the repo and check it (nothing is replaced here). */
export async function fetchBackup(): Promise<BackupCheck | BackupError> {
  const c = await getCloud();
  if (!c) return { ok: false, error: "Not connected." };
  const res = await gh(c.token, `${fileUrl(c)}?ref=${encodeURIComponent(c.branch)}`, {}, "application/vnd.github.raw+json");
  if (res.status === 404) return { ok: false, error: "There is no backup in this repo yet." };
  if (!res.ok) return { ok: false, error: `GitHub answered ${res.status}.` };
  return checkBackup(await res.text());
}

/** Due for an automatic backup. The first backup from a device is always a deliberate tap
 *  (so a new, empty phone never overwrites a good backup before it is restored). */
export const isDue = (c: CloudConfig | undefined, now = Date.now()) => !!c?.last && now - Date.parse(c.last) >= AUTO_EVERY_H * 3600e3;

let running = false;
/** Automatic backup: when the app is left or opened, at most once a day. Silent on failure. */
export async function autoBackup() {
  if (running || (typeof navigator !== "undefined" && navigator.onLine === false)) return;
  running = true;
  try {
    if (isDue(await getCloud())) await backupNow();
  } catch {
    /* recorded in lastError, shown in Settings */
  } finally {
    running = false;
  }
}
