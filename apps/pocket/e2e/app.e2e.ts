import { readFileSync } from "node:fs";
import { data, expect, oneStep, seed, setup, test } from "./fixtures";

type Q = { type: "choice"; options: string[]; answer: number } | { type: "gap"; answers: string[] } | { type: "tfng"; answer: string };
type Unit = { id: string; title: string; blocks: ({ type: string } & Partial<Q>)[] };

test("first open: setup, then Today shows the next step and why", async ({ page }) => {
  await setup(page);
  await expect(page.getByText("First", { exact: true })).toBeVisible();
  await expect(page.getByText(/Placement check · \d+ min/)).toBeVisible();
  await expect(page.getByText(/Not an official score/).first()).toBeVisible();
});

test("placement check runs to the result screen", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "Study now" }).click();
  await page.getByRole("button", { name: /^Start/ }).click();
  await expect(page.getByRole("heading", { name: "Which words do you know?" })).toBeVisible();
  const chips = page.locator(".vcheck .chip");
  for (let i = 0; i < 10; i++) await chips.nth(i).click();
  await page.getByRole("button", { name: /Next: grammar \(10 known\)/ }).click();
  for (let i = 0; i < 12; i++) {
    await page.locator(".options [role=radio]").first().click();
    await page.getByRole("button", { name: "Check" }).click();
    await page.locator(".actionbar .btn.primary").click();
  }
  await expect(page.getByText("Practice estimate · not an official score")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Your starting point: about (A2|B1|B2|C1)/ })).toBeVisible();
});

test("word review: flip, Again with a click, Good and Easy with keys", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "Add to my reviews" }).click();
  // Make three due cards from the one the app just made (same shape), then review them.
  const ids = data<{ items: { id: number; d?: string; ex?: string; w: string }[] }>("vocab.json").items.filter((v) => v.d && v.ex && !v.w.includes(" ")).slice(100, 103).map((v) => String(v.id));
  await expect.poll(() => page.evaluate(() => new Promise<number>((res) => { const r = indexedDB.open("fluent365", 1); r.onsuccess = () => { const q = r.result.transaction("kv").objectStore("kv").get("cards"); q.onsuccess = () => { res(Object.keys(q.result ?? {}).length); r.result.close(); }; }; }))).toBeGreaterThan(0);
  await page.evaluate((ids) => new Promise<void>((res) => {
    const r = indexedDB.open("fluent365", 1);
    r.onsuccess = () => {
      const store = r.result.transaction("kv", "readwrite").objectStore("kv");
      const q = store.get("cards");
      q.onsuccess = () => {
        const one = Object.values(q.result)[0] as { card: { dueAt: string } };
        const due = { ...one, card: { ...one.card, dueAt: new Date(Date.now() - 60_000).toISOString() } };
        store.put(Object.fromEntries(ids.map((id) => [id, due])), "cards").onsuccess = () => { r.result.close(); res(); };
      };
    };
  }), ids);
  await page.goto("./#/learn/words/review");
  await page.reload();
  const counter = page.locator(".counter span").first();
  await expect(counter).toHaveText(/^1 \/ 3/);
  await page.getByRole("button", { name: "Show answer" }).click();
  await page.getByRole("button", { name: /^Again/ }).click();
  await expect(counter).toHaveText(/^2 \//);
  await page.keyboard.press(" ");
  await page.keyboard.press("3");
  await expect(counter).toHaveText(/^3 \//);
  await page.keyboard.press(" ");
  await page.keyboard.press("4");
  await expect(counter).not.toHaveText(/^3 \//);
});

test("grammar topic: notice and explanation, then one right and one wrong answer with a hint", async ({ page }) => {
  await setup(page);
  const topic = data<{ topics: { id: string; title: string; track: string; exercises: ({ type: string; options?: string[]; answer?: number })[] }[] }>("grammar.json").topics.find((t) => t.id === "g-present-simple-continuous")!;
  await page.goto(`./#/learn/grammar/${topic.id}`);
  await expect(page.getByRole("heading", { name: topic.title })).toBeVisible();
  await expect(page.getByRole("heading", { name: "How it works" })).toBeVisible();
  await page.getByRole("button", { name: /^Practise/ }).click();
  // Recognition questions come first; answer them right, then get the first typed question wrong.
  const rank = (e: { type: string }) => (["choose", "compare", "find", "predict", "tfng"].includes(e.type) ? 0 : e.type === "produce" ? 2 : 1);
  const items = [...topic.exercises].sort((a, b) => rank(a) - rank(b));
  for (const ex of items.filter((e) => rank(e) === 0)) {
    await page.locator(".options [role=radio]").nth(ex.answer!).click();
    await page.getByRole("button", { name: "Check" }).click();
    await expect(page.getByText("Correct", { exact: true }).first()).toBeVisible();
    await page.locator(".actionbar .btn.primary").click();
  }
  await page.getByRole("textbox").fill("go");
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByText("Not quite. Try once more.")).toBeVisible();
  await expect(page.getByText(/^Hint:/)).toBeVisible();
});

test("General Training reading unit: answer every question and see the score", async ({ page }) => {
  const course = data<{ units: Unit[] }>("courses/ielts-reading-gt.json");
  const unit = course.units[0];
  await seed(page, { session: oneStep({ kind: "input", title: "General Training reading", ref: { course: "ielts-reading-gt", unit: unit.id } }) });
  await page.goto("./#/session");
  await expect(page.getByRole("heading", { name: unit.title })).toBeVisible();
  await page.getByRole("button", { name: "Answer the questions" }).click();
  const qs = unit.blocks.filter((b) => ["choice", "gap", "tfng"].includes(b.type)) as Q[];
  for (const q of qs) {
    if (q.type === "gap") await page.getByRole("textbox").fill(q.answers[0]);
    else await page.locator(".options [role=radio]").nth(q.type === "choice" ? q.answer : ["true", "false", "not given"].indexOf(q.answer)).click();
    await page.getByRole("button", { name: "Check" }).click();
    await expect(page.getByText("Correct", { exact: true }).first()).toBeVisible();
    await page.locator(".actionbar .btn.primary").click();
  }
  await expect(page.getByText("100%")).toBeVisible();
  await expect(page.getByText("correct on the first try")).toBeVisible();
});

test("Listen: a lesson plays and the transcript follows", async ({ page }) => {
  // Keep a handle on the player's (off-DOM) audio element to see that it really plays.
  await page.addInitScript(() => {
    const w = window as unknown as { __media: HTMLMediaElement[] };
    w.__media = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) { if (!w.__media.includes(this)) w.__media.push(this); return play.call(this); };
  });
  await setup(page);
  await page.goto("./#/listen");
  await page.getByText(/^Continue: Lesson 1/).click();
  const now = page.locator(".lyrics-line.now, .lyrics p.now, p.now").first();
  await expect(now).toBeVisible();
  const first = await now.textContent();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __media: HTMLMediaElement[] }).__media.some((a) => !a.paused && a.currentTime > 0)), { timeout: 20_000 }).toBeTruthy();
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await now.textContent()) !== first, { timeout: 10_000 }).toBeTruthy();
});

test("Settings: Arabic explanations are shown right-to-left", async ({ page }) => {
  await setup(page);
  await page.goto("./#/settings");
  await page.getByLabel("Explanations in").selectOption("ar");
  await page.goto("./#/learn/grammar/g-present-simple-continuous");
  const rtl = page.locator('p[dir="rtl"]').first();
  await expect(rtl).toBeVisible();
  await expect(rtl).toHaveText(/[؀-ۿ]/);
});

test("backup: download, change, restore from the file (no network)", async ({ page }, info) => {
  await setup(page);
  await page.goto("./#/settings");
  await page.getByLabel("Name").fill("Backup Tester");
  await page.goto("./#/settings/backup");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download backup" }).click()]);
  const file = info.outputPath("backup.json");
  await dl.saveAs(file);
  expect(JSON.parse(readFileSync(file, "utf8")).data.settings.name).toBe("Backup Tester");
  await page.goto("./#/settings");
  await page.getByLabel("Name").fill("Someone Else");
  await page.goto("./#/settings/backup");
  await page.locator('input[type="file"][accept^="application/json"]').setInputFiles(file);
  await expect(page.getByText("This backup contains:")).toBeVisible();
  await page.getByRole("button", { name: "Restore this backup" }).click();
  await page.goto("./#/settings");
  await expect(page.getByLabel("Name")).toHaveValue("Backup Tester");
});

test("full-screen player: the whole control area fits on a short phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 }); // a phone with the browser toolbar showing
  await setup(page);
  await page.goto("./#/listen");
  await page.getByText(/^Continue: Lesson 1/).click();
  await page.getByRole("button", { name: "Open the transcript in full screen" }).click();
  const extras = page.locator(".fp-extras");
  await expect(extras).toBeVisible();
  const box = await extras.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(640);
  await expect(page.getByRole("button", { name: "Next" }).last()).toBeInViewport();
});
