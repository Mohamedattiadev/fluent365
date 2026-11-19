// End-to-end tests against the built app (`vite preview` of dist/), at phone and laptop sizes.
// Run: pnpm build && pnpm e2e   (CHROMIUM=/path uses a local Chromium instead of Playwright's own)
import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const executablePath = process.env.CHROMIUM || undefined;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.e2e\.ts$/,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    reducedMotion: "reduce",
    serviceWorkers: "block", // the offline test turns it on
    launchOptions: { executablePath, args: ["--autoplay-policy=no-user-gesture-required"] },
    trace: "on-first-retry",
  },
  projects: [
    { name: "phone", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: false, hasTouch: true } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } } },
  ],
  webServer: {
    command: `pnpm exec vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
