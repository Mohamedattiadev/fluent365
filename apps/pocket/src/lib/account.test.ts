import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  accountBackupNow, accountConfig, afterSignIn, deleteCloudData, syncAction, syncNow, envConfig, getAccount, patchAccount,
  forgetAccountHere, setClientForTests, setOwnConfig, type AccountClient,
} from "./account";
import * as db from "./db";
import { checkBackup } from "./portability";
import { changedAt, emptyState, flush, getState, replaceState, update } from "./store";
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
    async load() {
      calls.push("load");
      if (!row) return null;
      const c = checkBackup(JSON.stringify(row));
      return c.ok ? { ...c, stamp: (row as { exportedAt: string }).exportedAt } : c;
    },
    async stamp() { calls.push("stamp"); return row ? (row as { exportedAt: string }).exportedAt : null; },
    async save(b) { calls.push("save"); row = b; },
    async remove() { calls.push("remove"); row = null; },
    async signOut() { calls.push("signOut"); },
  };
  return c;
}

const withProgress = () => ({ ...emptyState(), cards: { "1": { due: "2026-11-19" } as never } });
const backupOf = (s: object, at = new Date().toISOString()) => ({ app: "fluent365", format: 1, exportedAt: at, data: s });

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
  it("both have progress → combined by itself (no question), uploaded, safety copy kept", async () => {
    const cloud = fakeCloud(); setClientForTests(cloud);
    cloud.put(backupOf({ ...emptyState(), cards: { "9": {} } }));
    await replaceState(withProgress());
    expect(await afterSignIn()).toBe("merged");
    expect(Object.keys(getState().cards).sort()).toEqual(["1", "9"]);
    expect(Object.keys((cloud.row() as { data: { cards: object } }).data.cards).sort()).toEqual(["1", "9"]);
    expect(await db.get("kv", "backup:before-restore")).toBeTruthy();
    expect((await getAccount()).ask).toBe(false);
  });
  it("a device left waiting for the old question is combined on its next sync", async () => {
    const cloud = fakeCloud(); setClientForTests(cloud);
    await setOwnConfig({ url: "https://mine.supabase.co", key: "k" });
    cloud.put(backupOf({ ...emptyState(), cards: { "9": {} } }));
    await replaceState(withProgress());
    await patchAccount({ on: true, ask: true });
    expect(await syncNow()).toBe("merged");
    expect(Object.keys(getState().cards).sort()).toEqual(["1", "9"]);
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

describe("automatic sync between devices", () => {
  const saves = (c: { calls: string[] }) => c.calls.filter((x) => x === "save").length;
  const signedIn = async (cloud: ReturnType<typeof fakeCloud>) => {
    setClientForTests(cloud);
    await setOwnConfig({ url: "https://mine.supabase.co", key: "k" });
    await patchAccount({ on: true });
  };

  it("decision table", () => {
    const t = "2026-11-21T10:00:00.000Z";
    const later = "2026-11-21T11:00:00.000Z";
    expect(syncAction({ synced: t, syncedLocal: 5 }, null, 5)).toBe("push");
    expect(syncAction({ synced: t, syncedLocal: 5 }, t, 5)).toBe("none");
    expect(syncAction({ synced: t, syncedLocal: 5 }, "2026-11-21T10:00:00+00:00", 5)).toBe("none"); // same time, Postgres format
    expect(syncAction({ synced: t, syncedLocal: 5 }, t, 6)).toBe("push");
    expect(syncAction({ synced: t, syncedLocal: 5 }, later, 5)).toBe("pull");
    // both changed: combined
    expect(syncAction({ synced: t, syncedLocal: 5 }, later, Date.parse(later) - 1000)).toBe("merge");
    expect(syncAction({ synced: t, syncedLocal: 5 }, later, Date.parse(later) + 1000)).toBe("merge");
    // signed in before the sync existed: ours if saved at our last backup, else combined
    expect(syncAction({ last: "2026-11-21T10:00:01.000Z" }, t, 9)).toBe("push");
    expect(syncAction({ last: "2026-11-20T10:00:00.000Z" }, t, 9)).toBe("merge");
  });

  it("stop on the phone at 3/6, go on on the laptop at 3/6", async () => {
    const cloud = fakeCloud(); await signedIn(cloud);
    // Laptop: in sync with yesterday's copy.
    cloud.put(backupOf({ ...withProgress(), session: { step: 1 } }, new Date(Date.now() - 86400e3).toISOString()));
    await replaceState(withProgress());
    await patchAccount({ synced: (cloud.row() as { exportedAt: string }).exportedAt, syncedLocal: changedAt() });
    // Phone uploads today's session.
    cloud.put(backupOf({ ...withProgress(), session: { step: 3 } }));
    expect(await syncNow()).toBe("pulled");
    expect(getState().session).toEqual({ step: 3 });
    expect(saves(cloud)).toBe(0);
    expect(await syncNow()).toBeUndefined(); // nothing new either side
    expect(saves(cloud)).toBe(0);
  });

  it("a change here is uploaded; with nothing new, nothing is sent", async () => {
    const cloud = fakeCloud(); await signedIn(cloud);
    await replaceState(withProgress());
    await accountBackupNow();
    expect(saves(cloud)).toBe(1);
    expect(await syncNow()).toBeUndefined();
    update((s) => ({ session: { step: 4 } as never }));
    await flush();
    expect(await syncNow()).toBe("pushed");
    expect((cloud.row() as { data: { session: unknown } }).data.session).toEqual({ step: 4 });
    expect(await syncNow()).toBeUndefined();
    expect(saves(cloud)).toBe(2);
  });

  it("not signed in → nothing happens", async () => {
    const cloud = fakeCloud(); setClientForTests(cloud);
    await setOwnConfig({ url: "https://mine.supabase.co", key: "k" });
    cloud.put(backupOf(withProgress()));
    expect(await syncNow()).toBeUndefined();
    expect(cloud.calls).toEqual([]);
  });
});
