import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AUTO_EVERY_H, backupNow, connect, disconnect, fetchBackup, findRepos, getCloud, isDue, toBase64 } from "./cloud";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(async () => { vi.unstubAllGlobals(); await disconnect(); });

describe("cloud backup (own private GitHub repo)", () => {
  it("base64 is UTF-8 safe (Turkish/Arabic)", () => {
    const text = "çğış ünlü — مرحبا";
    const back = new TextDecoder().decode(Uint8Array.from(atob(toBase64(text)), (ch) => ch.charCodeAt(0)));
    expect(back).toBe(text);
  });

  it("only private repos the key can write to are offered", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json([
      { full_name: "me/public", default_branch: "main", private: false, permissions: { push: true } },
      { full_name: "me/data", default_branch: "main", private: true, permissions: { push: true } },
      { full_name: "me/readonly", default_branch: "main", private: true, permissions: { push: false } },
    ])));
    expect((await findRepos("k".repeat(30))).map((r) => r.full_name)).toEqual(["me/data"]);
  });

  it("a rejected key gives a clear message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({}, 401)));
    await expect(findRepos("bad")).rejects.toThrow(/did not accept the key/);
  });

  it("the first backup is a deliberate tap; then at most once a day", () => {
    const now = Date.now();
    expect(isDue(undefined, now)).toBe(false);
    expect(isDue({ token: "t", repo: "me/data", branch: "main" }, now)).toBe(false);
    expect(isDue({ token: "t", repo: "me/data", branch: "main", last: new Date(now - 3600e3).toISOString() }, now)).toBe(false);
    expect(isDue({ token: "t", repo: "me/data", branch: "main", last: new Date(now - AUTO_EVERY_H * 3600e3).toISOString() }, now)).toBe(true);
  });

  it("backs up with the current sha and never puts the key in the file", async () => {
    await connect("github_pat_secret_123456789", { full_name: "me/data", default_branch: "main" });
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return init?.method === "PUT" ? json({ content: {} }, 200) : json({ sha: "abc" });
    }));
    await backupNow();
    const put = calls.find((c) => c.init?.method === "PUT")!;
    expect(put.url).toBe("https://api.github.com/repos/me/data/contents/fluent365-backup.json");
    const body = JSON.parse(String(put.init!.body));
    expect(body.sha).toBe("abc");
    const file = new TextDecoder().decode(Uint8Array.from(atob(body.content), (ch) => ch.charCodeAt(0)));
    expect(JSON.parse(file).app).toBe("fluent365");
    expect(file).not.toContain("github_pat_secret");
    expect((await getCloud())?.last).toBeTruthy();
  });

  it("restore reads and checks the backup", async () => {
    await connect("github_pat_secret_123456789", { full_name: "me/data", default_branch: "main" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ app: "fluent365", format: 1, data: { cards: {} } }))));
    expect((await fetchBackup()).ok).toBe(true);
    vi.stubGlobal("fetch", vi.fn(async () => json({}, 404)));
    expect(await fetchBackup()).toEqual({ ok: false, error: "There is no backup in this repo yet." });
  });
});
