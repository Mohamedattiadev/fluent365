import { expect, setup, test } from "./fixtures";

test.use({ serviceWorkers: "allow" });

test("offline: after the first load the app opens without network", async ({ page, context }) => {
  test.setTimeout(90_000);
  await setup(page);
  // Wait until the service worker has installed (it caches the app and its content on install).
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 30_000 }).toBeTruthy();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "Study now" })).toBeVisible();
  await page.goto("./#/learn/grammar/g-present-simple-continuous");
  await expect(page.getByRole("heading", { name: "How it works" })).toBeVisible();
  await context.setOffline(false);
});
