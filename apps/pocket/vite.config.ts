import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";

// Writes the offline file list into dist/sw.js after the build, so the service worker can
// cache the whole app and its content. All paths are relative: the app works under any base path.
function offlineList(): Plugin {
  return {
    name: "fluent365-offline-list",
    apply: "build",
    closeBundle() {
      const dist = join(__dirname, "dist");
      const files: string[] = [];
      const walk = (dir: string) => {
        for (const f of readdirSync(dir)) {
          const p = join(dir, f);
          if (statSync(p).isDirectory()) walk(p);
          else files.push(relative(dist, p).split("\\").join("/"));
        }
      };
      walk(dist);
      const list = ["./", ...files.filter((f) => f !== "sw.js" && !f.endsWith(".map")).map((f) => `./${f}`)];
      const hash = createHash("sha1");
      for (const f of files) if (f !== "sw.js") hash.update(readFileSync(join(dist, f)));
      const sw = join(dist, "sw.js");
      const code = readFileSync(sw, "utf8")
        .replace("const FILES = self.__FILES__;", `const FILES = ${JSON.stringify(list)};`)
        .replace('const VERSION = "__VERSION__";', `const VERSION = "${hash.digest("hex").slice(0, 10)}";`);
      if (code.includes("__FILES__") || code.includes("__VERSION__")) throw new Error("sw.js placeholders were not filled");
      writeFileSync(sw, code);
    },
  };
}

export default defineConfig({
  // Relative base: the same build runs at https://user.github.io/any-repo/ or on a custom domain.
  base: process.env.BASE_PATH ?? "./",
  plugins: [react(), offlineList()],
  build: { target: "es2020", chunkSizeWarningLimit: 900 },
  test: { environment: "node" },
} as never);
