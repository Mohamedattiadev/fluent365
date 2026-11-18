import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Android only makes a real app (WebAPK, in the app drawer and search) from a valid manifest.
// "id" resolves against the site's origin, not the manifest: "./" became https://user.github.io/,
// outside the app's scope and shared with every other app on that account. Leave "id" out (it is
// then the start URL) or give a path that is inside the scope.
describe("PWA manifest", () => {
  const m = JSON.parse(readFileSync(join(__dirname, "../../public/manifest.webmanifest"), "utf8"));
  const base = "https://user.github.io/any-repo/manifest.webmanifest";
  it("app id stays inside the scope", () => {
    const start = new URL(m.start_url, base);
    const scope = new URL(m.scope, base);
    const id = m.id === undefined ? start : new URL(m.id, start.origin);
    expect(id.href.startsWith(scope.href)).toBe(true);
    expect(start.href.startsWith(scope.href)).toBe(true);
  });
  it("has what Chrome needs to install", () => {
    expect(m.display).toBe("standalone");
    expect(m.name && m.short_name).toBeTruthy();
    const sizes = m.icons.filter((i: { purpose?: string }) => !i.purpose || i.purpose.includes("any")).map((i: { sizes: string }) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(m.icons.some((i: { purpose?: string }) => i.purpose?.includes("maskable"))).toBe(true);
    expect(m.theme_color && m.background_color).toBeTruthy();
  });
});
