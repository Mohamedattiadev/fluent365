# Contributing

Thanks for helping! Fluent365 must stay simple, fast, private and usable by non-technical learners.

1. Open an issue first for larger changes.
2. `pnpm install && pnpm test && pnpm build` must pass.
3. Keep dependencies minimal. Explain any new one in the PR.
4. Content: original or verifiably licensed only. Record sources in `docs/CONTENT_LICENSING.md`. Grammar topics live in `content/grammar/*.json`; the unit tests check that every exercise is valid and that model answers pass their own production checks.
5. Never commit personal data, books, recordings, backups or secrets.
6. Accessibility: large touch targets (≥ 44 px), visible labels, keyboard support, one primary action per screen.

## Versioning and releases

Semantic versioning (`MAJOR.MINOR.PATCH`). The backup file has its own `format` number: increase it only with a migration in `apps/pocket/src/lib/portability.ts`, and keep reading older formats.
