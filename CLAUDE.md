# Fluent365 — project rules

- Read `PLAN.md` (product) and `docs/DEVELOPMENT_STATUS.md` (current state) first.
- App: `apps/pocket` (Vite + React + TS PWA). Public content: `content/` → `pnpm content` → `apps/pocket/public/data` (generated, git-ignored).
- The learner should not have to make choices: the daily session (`src/lib/session.ts`) decides, and every step says why. Design rules: `docs/research/HOW_PEOPLE_LEARN_LANGUAGES.md` §15.
- Paths must stay relative (hash router, `./` base). Never hardcode a GitHub user, repo or domain.
- Private data lives only in IndexedDB. No network calls with learner data (two opt-in exceptions: the backup to the learner's own private GitHub repo, `lib/cloud.ts`, and the backup to the learner's own account in a Supabase project, Sign in with Google, `lib/account.ts` + `lib/supa.ts`, RLS `user_id = auth.uid()`, public anon key only), no analytics, no required API keys.
- Accessibility: large text, ≥ 44 px targets, labels on controls, one primary action (bottom `ActionBar`).
- Never invent definitions, scores or Praktika capabilities. Keep practice scores distinct from official IELTS results.
- Content must be original or verifiably licensed; record it in `docs/CONTENT_LICENSING.md`.
- Run `pnpm test` and `pnpm build` before committing; keep the status doc current; small commits.
