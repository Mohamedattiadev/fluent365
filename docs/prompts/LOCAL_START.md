# Prompt: start Fluent365 Local from Bo-ok (paste into a new Claude Code session in this repo)

```
Fluent365: start the Local app (status doc "Next steps" 3). Reply to me in Turkish, short.

Read first: CLAUDE.md, PLAN.md (§3.1 Local, §12 stack), docs/DEVELOPMENT_STATUS.md (Next steps),
docs/research/LOCAL_FROM_BO-OK.md (my decisions of 2026-11-17 — follow them, don't re-ask),
docs/CONTENT_LICENSING.md, then ../bo-ok: README.md, NEXT.md, PLAN.md, web/package.json, web/AGENTS.md.
Don't change ../bo-ok itself (it stays my working private app); copy from it.

Decided (2026-11-17): Local = Bo-ok, copied into THIS repo as apps/local (files only, not Bo-ok's
private git history). Keep Bo-ok's stack (Next.js 16 + React 19 + Node's built-in SQLite) and its
layout and features (reader, library, word card, FSRS, highlights, notes, pen, voices, writing,
speaking). Look like Pocket: accent colour (Violet default; Violet/Blue/Orange/Black), green/red only
for right/wrong, Roboto, Material Symbols, the G1 logo, light/dark. UI in TR/EN/AR. Sync with Pocket:
both (A) Pocket "Connect to my computer" -> my own server address, Bo-ok's /api/sync protocol, opt-in;
(B) both apps write to my own private GitHub repo. AI (Gemini) stays optional: everything works with
no key.

NEW question to ask me first (one AskUserQuestion, with your recommendation): since 2026-11-19 Pocket
also backs up to my Supabase account (Sign in with Google, table `backups`, RLS, live-checked). Should
Local sync through the same Supabase account too — in addition to A/B, or instead of them?

Facts found while preparing (2026-11-19):
- Bo-ok last commit e0df597 (2026-11-12), clean tree. ~131 TS files, ~20k lines in web/src.
- web/public is 96 MB: books 55 MB, tts 31 MB (Piper/Woof models), words 4.9 MB, covers 3.7 MB.
  This repo is PUBLIC: don't commit big binaries or anything not clearly licensed. Woof is
  non-commercial; Edge voices have no redistribution licence; check every book/cover/word file's
  source before it goes in, record it in docs/CONTENT_LICENSING.md; otherwise git-ignore it and
  fetch/copy it with a script at setup time (like Pocket's audio in the fluent365-audio repo).
- Personal set-up to move out of code into settings / git-ignored files: web/scripts/backup_data.mjs
  (repo name bo-ok-data), USER_AGENT in web/src/modules/lookup/server.ts (contains my GitHub user —
  CLAUDE.md: never hardcode a GitHub user, repo or domain), Tailscale host, web/.data/.
- GEMINI_API_KEY is read in modules/ai/gemini.ts, voices/catalog.ts, i18n strings and two scripts:
  keep it optional and server-side only.
- This repo: pnpm workspace (apps/*), root scripts only build/test Pocket. Pocket must keep building,
  testing and deploying to GitHub Pages exactly as now; Local is NOT deployed to Pages (it runs on my
  laptop).

Plan for this session (stop and report after each numbered step; small commits; push to main):
1. Copy Bo-ok's web/ to apps/local (without node_modules, .next, .data, spike-output, big/unlicensed
   assets -> git-ignored + a setup script). Rename to "Fluent365 Local", package name "local".
   It must install, build and start (pnpm --filter local build / start) and its own checks must run
   (`pnpm check` in Bo-ok needs Chromium; run the core groups, say which ones you ran).
   Root: add scripts local:dev / local:build / local:check; keep `pnpm build`, `pnpm test`, `pnpm e2e`
   and the Pages workflow for Pocket unchanged and passing.
2. Rule clean-up: no hardcoded user/repo/domain; personal set-up in settings or a git-ignored
   config; AI optional; remove the unofficial Google speech fallback; licences recorded.
3. Write the sync design (A + B, plus Supabase if I say yes) as docs/research/LOCAL_SYNC.md: the
   record mapping between Pocket's slices and Bo-ok's records, the shared word key, conflict rule.
   Don't build sync yet — show me the design first.
Later sessions (not now): packages/core (shared types, FSRS helpers, record mapping, content),
the sync, Pocket's guided session/grammar/lessons into Local, the look, my UI changes.

Before each commit: Pocket's pnpm test + pnpm build (+ pnpm e2e when Pocket files changed), and
Local's build. Update docs/DEVELOPMENT_STATUS.md (Done + Next steps) and the memory.
At the end: a table step / done / what's left, and the next prompt in docs/prompts/.
```
