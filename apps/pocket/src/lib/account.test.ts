import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  accountBackupNow, accountConfig, afterSignIn, autoAccountBackup, deleteCloudData, envConfig, getAccount, patchAccount,
  forgetAccountHere, setClientForTests, setOwnConfig, type AccountClient,
} from "./account";
import * as db from "./db";
import { checkBackup } from "./portability";
import { emptyState, getState, replaceState } from "./store";
import { AUTO_EVERY_H, dueSince, firstSync, hasProgress } from "./sync";

// An in-memory "Supabase": one row, like the backups table for one user.
function fakeCloud() {
  const calls: string[] = [];
  let row: unknown = null;
  const c: AccountClient & { calls: string[]; row: () => unknown; put: (v: unknown) => void } = {
    calls, row: () => row, put: (v) => { row = v; },
    async signIn() { calls.push("signIn"); },
    async exchange() { calls.push("exchange"); return { email: "me@example.com" }; },
    async email() { return "me@example.com"; },
    async load() { calls.push("load"); return row ? checkBackup(JSON.stringify(row)) : null; },
    async save(b) { calls.push("save"); row = b; },
    async remove() { calls.push("remove"); row = null; },
    async signOut() { calls.push("signOut"); },
  };
  return c;
}

const withProgress = () => ({ ...emptyState(), cards: { "1": { due: "2026-11-19" } as never } });
const backupOf = (s: object) => ({ app: "fluent365", format: 1, exportedAt: new Date().toISOString(), data: s });

beforeEach(async () => { await db.del("kv", "account"); await db.del("kv", "account-config"); await replaceState(emptyState()); });
afterEach(() => setClientForTests(null));

describe("account config", () => {
  it("missing config → hidden (null)", async () => {
    expect(envConfig({})).toBeNull();
    expect(await accountConfig({})).toBeNull();
    expect(envConfig({ VITE_SUPABASE_URL: "https://x.supabase.co" })).toBeNull(); // key missing
    expect(envConfig({ VITE_SUPABASE_URL: "http://x.supabase.co", VITE_SUPABASE_ANON_KEY: "k" })).toBeNull(); // not https
  });
  it("build Variables are used; the learner's own project wins", async () => {
    const env = { VITE_SUPABASE_URL: "https://build.supabase.co/", VITE_SUPABASE_ANON_KEY: " anon " };
    expect(await accountConfig(env)).toEqual({ url: "https://build.supabase.co", key: "anon" });
    await setOwnConfig({ url: "https://mine.supabase.co", key: "k2" });
    expect(await accountConfig(env)).toEqual({ url: "https://mine.supabase.co", key: "k2" });
    await setOwnConfig(null);
    expect(await accountConfig({})).toBeNull();
    await expect(setOwnConfig({ url: "not a url", key: "k" })).rejects.toThrow(/project URL/);
  });
});

describe("first sync (same rules as the GitHub backup)", () => {
  it("decision table", () => {
    expect(firstSync(false, false)).toBe("upload");
    expect(firstSync(true, false)).toBe("upload");
    expect(firstSync(false, true)).toBe("restore");
    expect(firstSync(true, true)).toBe("ask");
    expect(hasProgress(emptyState())).toBe(false);
    expect(hasProgress(withProgress())).toBe(true);
  });
  it("nothing in the cloud → this device is uploaded", async () => {
    const cloud = fakeCloud(); setClientForTests(cloud);
    await replaceState(withProgress());
    expect(await afterSignIn()).toBe("signed-in");
    expect((cloud.row() as { data: { cards: object } }).data.cards).toHaveProperty("1");
    expect((await getAccount()).last).toBeTruthy();
  });
  it("a new, empty device restores by itself (safety copy kept)", async () => {
    const cloud = fakeCloud(); setClientForTests(cloud);
    cloud.put(backupOf(withProgress()));
    expect(await afterSignIn()).toBe("restored");
    expect(Object.keys(getState().cards)).toEqual(["1"]);
    expect(cloud.calls).not.toContain("save");
    expect(await db.get("kv", "backup:before-restore")).toBeTruthy();
  });
  it("both have progress → ask, and nothing is overwritten meanwhile", async () => {
    const cloud = fakeCloud(); setClientForTests(cloud);
    cloud.put(backupOf({ ...emptyState(), cards: { "9": {} } }));
    await replaceState(withProgress());
    expect(await afterSignIn()).toBe("ask");
    expect(cloud.calls).not.toContain("save");
    expect(Object.keys(getState().cards)).toEqual(["1"]);
    await patchAccount({ on: true, last: new Date(Date.now() - 48 * 3600e3).toISOString() });
    await autoAccountBackup(); // waiting for the choice: no automatic backup
    expect(cloud.calls).not.toContain("save");
  });
  it("newest wins: a backup replaces the row", async () => {
    const cloud = fakeCloud(); setClientForTests(cloud);
    cloud.put(backupOf({ ...emptyState(), cards: { "9": {} } }));
    await replaceState(withProgress());
    await accountBackupNow();
    expect(Object.keys((cloud.row() as { data: { cards: object } }).data.cards)).toEqual(["1"]);
  });
  it("delete removes the row, then signs out", async () => {
    const cloud = fakeCloud(); setClientForTests(cloud);
    await patchAccount({ on: true, email: "me@example.com" });
    cloud.put(backupOf(withProgress()));
    await deleteCloudData();
    expect(cloud.calls.slice(-2)).toEqual(["remove", "signOut"]);
    expect(cloud.row()).toBeNull();
    expect((await getAccount()).on).toBeUndefined();
  });
});

describe("Delete everything on this device", () => {
  it("forgets the sign-in here (account state and stored session), keeps other data", async () => {
    await patchAccount({ on: true, email: "a@b.c", pending: "#/" });
    await db.set("kv", "sb:fluent365-auth", "session");
    await db.set("kv", "sb:fluent365-auth-code-verifier", "v");
    await db.set("kv", "installDismissed", true);
    await forgetAccountHere();
    expect(await getAccount()).toEqual({});
    expect((await db.entries("kv")).map(([k]) => k).filter((k) => k.startsWith("sb:"))).toEqual([]);
    expect(await db.get("kv", "installDismissed")).toBe(true);
  });
});

describe("automatic backup: at most every ~20 h", () => {
  it("dueSince", () => {
    const now = Date.now();
    expect(dueSince(undefined, now)).toBe(false);
    expect(dueSince(new Date(now - (AUTO_EVERY_H - 1) * 3600e3).toISOString(), now)).toBe(false);
    expect(dueSince(new Date(now - AUTO_EVERY_H * 3600e3).toISOString(), now)).toBe(true);
  });
  it("only when signed in, configured and due", async () => {
    const cloud = fakeCloud(); setClientForTests(cloud);
    await setOwnConfig({ url: "https://mine.supabase.co", key: "k" });
    await patchAccount({ on: true, last: new Date(Date.now() - 3600e3).toISOString() });
    await autoAccountBackup();
    expect(cloud.calls).not.toContain("save");
    await patchAccount({ last: new Date(Date.now() - 21 * 3600e3).toISOString() });
    await autoAccountBackup();
    expect(cloud.calls.filter((c) => c === "save")).toHaveLength(1);
    await autoAccountBackup(); // just backed up
    expect(cloud.calls.filter((c) => c === "save")).toHaveLength(1);
    await patchAccount({ on: false, last: new Date(Date.now() - 48 * 3600e3).toISOString() });
    await autoAccountBackup();
    expect(cloud.calls.filter((c) => c === "save")).toHaveLength(1);
  });
});
