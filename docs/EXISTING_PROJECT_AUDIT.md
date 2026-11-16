# Existing project audit (2026-11-16)

Inspected read-only, with the owner's approval: `../bo-ok`, `../CoCo-work`, `../Project_manager_suit`. Nothing in those projects was changed.

| Project | What it is | Stack | Reused in Fluent365 |
|---|---|---|---|
| **bo-ok** | Reading library + language learning + IELTS (owner's project) | Next.js 16, React 19, ts-fsrs 6, SQLite sync server, Gemini (optional) | **Content:** 40 IELTS-path lessons, 6 courses (General A1–C2, IELTS reading/listening/writing/vocabulary), IELTS Part 1 topics, 24 cue cards, 16 writing prompts, NGSL/NAWL CSVs (CC BY-SA), `daily-en.json` (1,924 words with public-domain example quotes), wordfreq ranks. **Code ideas:** FSRS setup, plan structure, essay counts (`analyse`), step formats. |
| **CoCo-work** | Personal assistant (scholarships, jobs, trading) | Next.js + Python services | Pattern only: one-command setup and plain-language docs. No code copied. |
| **Project_manager_suit (Igrek)** | Desktop app for Claude Code/Codex | Bun, Vite + React, Tauri | Patterns: Vite + React layout, palettes as CSS tokens, e2e crawl and bundle-budget checks. No code copied (owner may relicense later if useful). |

## Why a new app instead of extending bo-ok

bo-ok needs a running Next.js server, ships 55 MB of books and a WebGL reader, and has Gemini-dependent features. The Fluent365 plan needs a static PWA anyone can host on GitHub Pages with no API key. So Fluent365 reuses bo-ok's **content format** (lesson/course JSON is read as-is) and its proven FSRS settings, in a small Vite app.

## Architecture chosen (smallest safe path)

- `apps/pocket` — Vite + React + TypeScript PWA. Hash routing and relative paths → works under any GitHub Pages sub-path or custom domain. IndexedDB storage, custom service worker (offline + Android Web Share Target).
- `content/` — public learning content (source of truth) → `scripts/build-content.mjs` → `apps/pocket/public/data/*.json`.
- `docs/research/` — evidence behind the session design, IELTS materials, distribution/Anki, Praktika.
- **Local app (FastAPI + SQLite + book library):** deferred. Pocket runs on the laptop too (`pnpm dev` / installed PWA), which covers daily use now. See DEVELOPMENT_STATUS.md.
