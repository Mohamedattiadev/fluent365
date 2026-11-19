// Shared helpers: every test fails on a console error, a page error or a request that leaves localhost
// (learner data must never go over the network).
import { test as base, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const data = <T,>(f: string): T => JSON.parse(readFileSync(fileURLToPath(new URL(`../public/data/${f}`, import.meta.url)), "utf8")) as T;

// `allowHosts`: a test that mocks a service with page.route (e.g. Supabase) names its fake host here;
// every other external request still fails the test.
export const test = base.extend<{ guard: void; allowHosts: string[] }>({
  allowHosts: [[], { option: true }],
  guard: [async ({ page, allowHosts }, use) => {
    const problems: string[] = [];
    page.on("console", (m) => { if (m.type() === "error") problems.push(`console: ${m.text()}`); });
    page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (!["127.0.0.1", "localhost", ...allowHosts].includes(u.hostname) && !["data:", "blob:"].includes(u.protocol)) problems.push(`network: ${r.url()}`);
    });
    await use();
    expect(problems, problems.join("\n")).toEqual([]);
  }, { auto: true }],
});
export { expect };

/** First run: the four setup steps with their defaults (B1, IELTS General Training, 1 hour, English). */
export async function setup(page: Page) {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Welcome to Fluent365" })).toBeVisible({ timeout: 30_000 });
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: /^(Next|Start learning)/ }).click();
  await expect(page.getByRole("button", { name: "Study now" })).toBeVisible();
}

const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** Write learner state straight into IndexedDB (as a restored backup would), then reload. */
export async function seed(page: Page, kv: Record<string, unknown>) {
  await page.goto("./");
  await page.waitForTimeout(300);
  await page.evaluate(async ({ kv, day }) => {
    const settings = { name: "", level: "B1", goal: "ielts-gt", target: 7, minutes: 60, explainLang: "en", textSize: "m", highContrast: false, theme: "light", reduceMotion: true, comfortable: false, newWords: 15, setupDone: true, startDate: day, phaseReached: "B1" };
    const db = await new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open("fluent365", 1); r.onupgradeneeded = () => { for (const s of ["kv", "blobs", "inbox"]) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    await new Promise((res, rej) => {
      const tx = db.transaction("kv", "readwrite");
      const store = tx.objectStore("kv");
      store.put({ ...settings, ...((kv.settings as object) ?? {}) }, "settings");
      for (const [k, v] of Object.entries(kv)) if (k !== "settings") store.put(v, k);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, { kv, day: localDay() });
  await page.reload();
}

/** A one-step session for today, so a test can open exactly that step. */
export const oneStep = (step: Record<string, unknown>) => ({ date: localDay(), minutes: 60, index: 0, started: new Date().toISOString(), steps: [{ id: "e2e", minutes: 10, why: "E2E test step, chosen by the test.", ...step }, { id: "wrap", kind: "wrap", title: "Done", why: "End of the session.", minutes: 0 }] });
