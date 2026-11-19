// Optional account (Sign in with Google + Supabase backup), with Supabase mocked by route
// interception: auth (authorize → back with ?code, token exchange, logout) and REST (backups).
// The fake project is the only external host allowed; Google itself is never contacted.
import type { Page } from "@playwright/test";
import { expect, seed, setup, test } from "./fixtures";

const HOST = "e2e-project.supabase.co";
const URL_ = `https://${HOST}`;
test.use({ allowHosts: [HOST] });

const USER = { id: "11111111-2222-3333-4444-555555555555", email: "learner@example.com" };
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
const JWT = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER.id, email: USER.email, role: "authenticated", aud: "authenticated", exp })}.sig`;
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS", "access-control-expose-headers": "*" };

/** A fake Supabase with one backups row; returns the calls it saw. */
async function mockSupabase(page: Page, row: { data: unknown; updated_at: string } | null = null) {
  const state = { row, calls: [] as string[] };
  await page.route(`${URL_}/**`, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    state.calls.push(`${req.method()} ${u.pathname}`);
    const json = (body: unknown, status = 200) => route.fulfill({ status, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(body) });
    if (u.pathname === "/auth/v1/authorize") {
      expect(u.searchParams.get("provider")).toBe("google");
      expect(u.searchParams.get("code_challenge")).toBeTruthy();
      const back = new URL(u.searchParams.get("redirect_to")!);
      back.searchParams.set("code", "e2e-auth-code");
      return route.fulfill({ status: 200, contentType: "text/html", body: `<script>location.replace(${JSON.stringify(back.href)})</script>` });
    }
    if (u.pathname === "/auth/v1/token") {
      const body = req.postDataJSON() as { auth_code?: string; code_verifier?: string };
      expect(body.auth_code).toBe("e2e-auth-code");
      expect(body.code_verifier).toBeTruthy();
      return json({ access_token: JWT, token_type: "bearer", expires_in: 86400, expires_at: exp, refresh_token: "e2e-refresh", user: { ...USER, aud: "authenticated", role: "authenticated", app_metadata: { provider: "google" }, user_metadata: {}, created_at: new Date().toISOString() } });
    }
    if (u.pathname === "/auth/v1/logout") return route.fulfill({ status: 204, headers: CORS });
    if (u.pathname === "/rest/v1/backups") {
      expect(req.headers()["authorization"]).toBe(`Bearer ${JWT}`);
      if (req.method() === "GET") {
        const rows = state.row ? [state.row] : [];
        if ((req.headers()["accept"] ?? "").includes("vnd.pgrst.object")) return state.row ? json(state.row) : json({ code: "PGRST116", message: "no rows" }, 406);
        return json(rows);
      }
      if (req.method() === "POST") {
        const body = req.postDataJSON() as { user_id: string; data: unknown; updated_at: string };
        expect(body.user_id).toBe(USER.id);
        state.row = { data: body.data, updated_at: body.updated_at };
        return route.fulfill({ status: 201, headers: CORS });
      }
      if (req.method() === "DELETE") { state.row = null; return route.fulfill({ status: 204, headers: CORS }); }
    }
    return json({ message: `unexpected ${req.method()} ${u.pathname}` }, 500);
  });
  return state;
}

async function useOwnSupabase(page: Page) {
  await page.goto("./#/settings/backup");
  await page.getByText("Use my own Supabase").click();
  await page.getByLabel("Project URL").fill(URL_);
  await page.getByLabel("Anon public key").fill("e2e-anon-key");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved. Account is now in Settings.")).toBeVisible();
}

const kv = (page: Page, key: string) => page.evaluate((key) => new Promise((res) => {
  const r = indexedDB.open("fluent365", 1);
  r.onsuccess = () => { const g = r.result.transaction("kv").objectStore("kv").get(key); g.onsuccess = () => res(g.result); };
}), key);

const day = { active: 600, byKind: {}, attempts: 3, correct: 2, reviews: 5, newWords: 1, sessionDone: true };

test("account: hidden without config; Google sign-in, back up, delete", async ({ page }) => {
  await setup(page);
  await page.goto("./#/settings");
  await expect(page.getByRole("button", { name: "Backup, restore and Anki" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Account/ })).toHaveCount(0); // no Supabase configured

  await seed(page, { days: { "2026-11-18": day }, settings: { name: "Device A" } });
  const sb = await mockSupabase(page);
  await useOwnSupabase(page);
  await page.goto("./#/settings");
  await page.getByRole("button", { name: /^Account/ }).click();
  await page.getByRole("button", { name: "Sign in with Google" }).click();

  // Back from "Google": the code is exchanged, nothing was in the cloud → this device is uploaded.
  await expect(page.getByText("Backup saved to your account")).toBeVisible();
  await expect(page).toHaveURL(/\/#\/settings\/account$/); // ?code= removed, route restored
  await expect(page.getByText("learner@example.com")).toBeVisible();
  expect(sb.calls).toContain("POST /auth/v1/token");
  expect((sb.row?.data as { data: { settings: { name: string } } }).data.settings.name).toBe("Device A");
  const auth = await kv(page, "sb:fluent365-auth");
  expect(auth).toBeTruthy(); // the session lives in IndexedDB…
  expect(JSON.stringify(sb.row)).not.toContain("e2e-refresh"); // …and never in the backup

  await page.getByRole("button", { name: "Back up now" }).click();
  await expect.poll(() => sb.calls.filter((c) => c === "POST /rest/v1/backups").length).toBe(2);
  await expect(page.getByText("Backup saved to your account")).toBeVisible();

  await page.getByRole("button", { name: "Delete my cloud data" }).click();
  await page.getByLabel(/Type DELETE/).fill("DELETE");
  await page.getByRole("button", { name: "Delete my cloud data" }).click();
  await expect(page.getByText("Your cloud data was deleted and you are signed out.")).toBeVisible();
  await expect.poll(() => sb.calls).toContain("POST /auth/v1/logout");
  expect(sb.calls).toContain("DELETE /rest/v1/backups");
  expect(sb.calls).toContain("POST /auth/v1/logout");
  expect(sb.row).toBeNull();
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
  expect(await kv(page, "days")).toHaveProperty("2026-11-18"); // progress on the device stays
});

test("account: a new, empty device restores by itself after sign-in", async ({ page }) => {
  const backup = { app: "fluent365", format: 1, exportedAt: new Date().toISOString(), data: { days: { "2026-11-17": day }, settings: { name: "From the cloud", setupDone: true, level: "B1", goal: "ielts-gt", minutes: 60 } } };
  const sb = await mockSupabase(page, { data: backup, updated_at: new Date().toISOString() });
  await setup(page);
  await useOwnSupabase(page);
  await page.goto("./#/settings/account");
  await page.getByRole("button", { name: "Sign in with Google" }).click();
  await expect(page.getByText(/Progress restored from your account/)).toBeVisible();
  expect(await kv(page, "days")).toHaveProperty("2026-11-17");
  expect(sb.calls).not.toContain("POST /rest/v1/backups"); // the empty device did not overwrite the backup
  await page.goto("./#/settings");
  await expect(page.getByLabel("Name")).toHaveValue("From the cloud");
});

test("account: Turkish strings and Arabic right-to-left", async ({ page }) => {
  await mockSupabase(page);
  await setup(page);
  await seed(page, { settings: { explainLang: "ar" } });
  await useOwnSupabase(page);
  await page.goto("./#/settings/account");
  const btn = page.getByRole("button", { name: "تسجيل الدخول باستخدام Google" });
  await expect(btn).toBeVisible();
  await expect(page.locator(".card[dir=rtl]")).toBeVisible();
  const box = await btn.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await seed(page, { settings: { explainLang: "tr" } });
  await page.goto("./#/settings/account");
  await expect(page.getByRole("button", { name: "Google ile giriş yap" })).toBeVisible();
});

/** First run with a Supabase project configured (as the live site has): write the config, reload. */
async function freshWithConfig(page: Page) {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Welcome to Fluent365" })).toBeVisible({ timeout: 30_000 });
  await page.evaluate((url) => new Promise((res) => {
    const r = indexedDB.open("fluent365", 1);
    r.onupgradeneeded = () => { for (const s of ["kv", "blobs", "inbox"]) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s); };
    r.onsuccess = () => { const tx = r.result.transaction("kv", "readwrite"); tx.objectStore("kv").put({ url, key: "e2e-anon-key" }, "account-config"); tx.oncomplete = () => { r.result.close(); res(null); }; };
  }), URL_);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Welcome to Fluent365" })).toBeVisible();
}

test("setup: last step offers Google or guest; guest goes straight to learning", async ({ page }) => {
  await mockSupabase(page);
  await freshWithConfig(page);
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: /^Next/ }).click();
  await expect(page.getByRole("heading", { name: "Keep your progress safe" })).toBeVisible();
  await expect(page.getByText("Step 5 of 5")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await expect(page.getByRole("button", { name: "Study now" })).toBeVisible();
});

test("setup: a returning learner signs in on the welcome screen and gets their progress back", async ({ page }) => {
  const backup = { app: "fluent365", format: 1, exportedAt: new Date().toISOString(), data: { days: { "2026-11-16": day }, settings: { name: "Returning", setupDone: true, level: "B2", goal: "ielts-gt", minutes: 60 } } };
  const sb = await mockSupabase(page, { data: backup, updated_at: new Date().toISOString() });
  await freshWithConfig(page);
  await page.getByRole("button", { name: /I already use Fluent365/ }).click();
  await expect(page.getByText(/Progress restored from your account/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hi, Returning" })).toBeVisible();
  expect(await kv(page, "days")).toHaveProperty("2026-11-16");
  expect(sb.calls).not.toContain("POST /rest/v1/backups");
});
