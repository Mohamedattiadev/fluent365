// Screenshots of the built app at phone (390×844) and laptop (1366×768) sizes, with demo data.
// Usage: pnpm build && node scripts/screenshots.mjs <output-dir>
// Needs a local Chromium (default /usr/bin/chromium, or set CHROMIUM=/path). Nothing leaves the machine:
// the app is served from apps/pocket/dist on localhost and the demo data is invented on the spot.
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const OUT = process.argv[2] ?? "screenshots";
const PORT = 4321;
const BASE = `http://127.0.0.1:${PORT}/`;
mkdirSync(OUT, { recursive: true });

const srv = spawn("pnpm", ["--filter", "pocket", "exec", "vite", "preview", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"], { stdio: "ignore" });
const stop = () => { try { srv.kill(); } catch { /* already gone */ } };
process.on("exit", stop);
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(BASE)).ok) break; } catch { /* not up yet */ }
  await new Promise((r) => setTimeout(r, 250));
}

const grammar = JSON.parse(readFileSync(new URL("../apps/pocket/public/data/grammar.json", import.meta.url), "utf8"));
const topics = Array.isArray(grammar) ? grammar : grammar.topics ?? grammar.items;
const topic = topics.find((t) => t.track === "core" && t.compare);

/** Demo learner: a few study days this week, some due cards, two open mistakes. */
async function seed(page, extra = {}) {
  await page.goto(BASE);
  await page.waitForTimeout(400);
  await page.evaluate(async (extra) => {
    const vocab = await (await fetch("./data/vocab.json")).json();
    const picks = vocab.items.filter((v) => v.d && v.ex && v.r > 900 && v.r < 1400 && !v.w.includes(" ")).slice(0, 24);
    const pad = (n) => String(n).padStart(2, "0");
    const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const now = new Date();
    const today = key(now);
    const days = {};
    for (const back of [1, 2, 4, 8, 9, 11, 15, 16, 17, 22, 23, 30, 31, 36, 40]) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
      days[key(d)] = { active: 1200 + ((back * 397) % 2400), byKind: { vocabulary: 600, grammar: 420, reading: 300, listening: 240, speaking: 180, writing: back % 2 ? 300 : 0 }, attempts: 30, correct: 25, reviews: 20, newWords: 8, sessionDone: back % 3 !== 0 };
    }
    const past = new Date(Date.now() - 3600_000).toISOString();
    const cards = Object.fromEntries(picks.map((v) => [String(v.id), { card: { dueAt: past, stability: 0, difficulty: 0, state: 0, reps: 0, lapses: 0, lastReviewAt: null, fresh: true }, added: today }]));
    const settings = { name: "", level: "B1", goal: "ielts-gt", target: 7.5, minutes: 60, explainLang: "en", textSize: "m", highContrast: false, theme: "system", reduceMotion: true, comfortable: false, newWords: 15, setupDone: true, startDate: key(new Date(now.getTime() - 40 * 86400000)), ...extra };
    const mistakes = [
      { id: "m1", at: past, kind: "grammar", prompt: "I ___ in Cairo since 2015.", given: "lived", expected: "have lived", why: "since + a point in time: present perfect.", fixed: false },
      { id: "m2", at: past, kind: "imported", prompt: "Correct: I am agree with you", given: "I am agree with you", expected: "I agree with you", fixed: false, source: "Pasted text" },
      { id: "m3", at: past, kind: "grammar", prompt: "She ___ to work every day.", given: "go", expected: "goes", fixed: false },
    ];
    const db = await new Promise((res, rej) => { const r = indexedDB.open("fluent365", 1); r.onupgradeneeded = () => { for (const s of ["kv", "blobs", "inbox"]) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    await new Promise((res, rej) => {
      const tx = db.transaction("kv", "readwrite");
      const kv = tx.objectStore("kv");
      kv.put(settings, "settings"); kv.put(cards, "cards"); kv.put(days, "days"); kv.put(mistakes, "mistakes"); kv.delete("session");
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, extra);
  await page.reload();
  await page.waitForTimeout(700);
}

const shot = async (page, name, full = false) => {
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: full });
  console.log(join(OUT, `${name}.png`));
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium", args: ["--disable-gpu"] });
const sizes = [
  { tag: "phone", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { tag: "desktop", viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 },
];
try {
  for (const size of sizes) {
    const { tag, ...opts } = size;
    const ctx = await browser.newContext({ ...opts, serviceWorkers: "block", colorScheme: "light", reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await seed(page);

    await shot(page, `${tag}-01-home`);
    if (tag === "phone") await shot(page, `${tag}-01b-home-full`, true);

    await page.goto(`${BASE}#/session`);
    await page.waitForTimeout(600);
    await shot(page, `${tag}-02-session-flashcard`);
    await page.getByRole("button", { name: "Show answer" }).click();
    await shot(page, `${tag}-03-flashcard-answer`);

    if (topic) {
      await page.goto(`${BASE}#/grammar/${topic.id}`);
      await page.waitForTimeout(400);
      await shot(page, `${tag}-04-grammar-notice`);
      await page.getByRole("button", { name: /^Next/ }).click();
      await page.getByRole("button", { name: "Show the difference" }).click();
      await shot(page, `${tag}-05-grammar-compare`);
      await page.getByRole("button", { name: /^Next/ }).click();
      await page.getByRole("button", { name: /Start practice/ }).click();
      const options = page.getByRole("radio");
      if (await options.count()) {
        const ex = [...topic.exercises].sort((a, b) => rank(a) - rank(b))[0];
        const wrong = ex.options ? (ex.answer === 0 ? 1 : 0) : 0;
        await options.nth(wrong).click();
        await page.getByRole("button", { name: "Check" }).click();
        await page.waitForTimeout(400);
        await shot(page, `${tag}-06-grammar-feedback`);
      }
    }

    for (const [route, name] of [["/practice", "07-practice"], ["/progress", "08-progress"], ["/settings", "09-settings"], ["/words", "10-words"]]) {
      await page.goto(`${BASE}#${route}`);
      await page.waitForTimeout(500);
      await shot(page, `${tag}-${name}`);
    }
    await ctx.close();

    // Dark theme and the largest text size.
    const dark = await browser.newContext({ ...opts, serviceWorkers: "block", colorScheme: "dark", reducedMotion: "reduce" });
    const p2 = await dark.newPage();
    await seed(p2);
    await shot(p2, `${tag}-11-home-dark`);
    await dark.close();
    const xl = await browser.newContext({ ...opts, serviceWorkers: "block", colorScheme: "light", reducedMotion: "reduce" });
    const p3 = await xl.newPage();
    await seed(p3, { textSize: "xl", highContrast: true });
    await shot(p3, `${tag}-12-home-xl-high-contrast`);
    await xl.close();
  }
} finally {
  await browser.close();
  stop();
}

function rank(e) {
  return ["choose", "compare", "find", "predict", "tfng"].includes(e.type) ? 0 : e.type === "produce" ? 2 : 1;
}
