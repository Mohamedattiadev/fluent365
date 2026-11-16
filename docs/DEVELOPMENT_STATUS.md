# Development status

_Last updated: 2026-11-16_

## Current milestone: Pocket MVP (usable daily on laptop and phone)

### Done and tested
- **UI: Material 3 (Material You), like a native Android app**, chosen by the owner on 2026-11-17 after rejecting "Ink & Paper" as generic, too plain and too big (and two earlier looks). Roboto (self-hosted, OFL), Material Symbols Rounded (Apache-2.0), colour roles generated with Material Color Utilities (`pnpm gen:material` → `src/theme.gen.css`, `src/components/icons.gen.ts`). Four colour themes (violet default, blue, green, orange), light/dark, high contrast, text size S–XL (16 px default). Phone: bottom navigation bar. Tablet/laptop (≥ 900 px): a full-width website with a top navigation bar, wide content and card grids (owner's decision 2026-11-17; the Pages app is a web app in its own right, separate from the planned Local app). Home: hero card with progress ring and Start, three stat tiles, plan list with skill badges and "Up next", week card. Session: top bar with close (Material dialog), linear progress, skill chip. Flashcards, radio-card options with icon + word, tonal feedback, segmented buttons, switches, outlined fields, snackbar. Screenshots: `pnpm screenshots` (playwright-core + local Chromium, demo data, localhost only). Awaiting the owner's approval.
- **Guided daily session** (`src/lib/session.ts`): reviews → new words → grammar → input → dictation → output → 4·3·2 fluency → mistakes → wrap-up. 25/60/90-minute budgets per phase (B1, B2, IELTS) from `docs/research/HOW_PEOPLE_LEARN_LANGUAGES.md`. Lesson steps fill the slots in path order (≈ 2 days per lesson); empty slots get core grammar, frequency words, course units or IELTS prompts. Reviews always come first. New words drop when the review backlog grows or accuracy is below 80%. Task repetition for speaking (cue cards repeat after 2 and 7 days). Resumes mid-session.
- **Grammar Instinct Trainer**: 18 original core topics (180 exercises) + 40 lesson grammar topics. Exercise types: choose, compare, find the unnatural one, predict, gap, fix, rewrite, build from blocks, produce (pattern check + model + self-rating). Hint on the first miss, then a word diff and a retype of the correct form. Mastery tracked in 4 dimensions. Topics are FSRS-scheduled for interleaved review.
- **Vocabulary**: 5,223 unique entries. FSRS (ts-fsrs, 90% retention). Recall direction switches from word→meaning to meaning→word once a card is stable. Search and filters (frequency band, collection, my/difficult/known).
- **Lessons and courses**: 40 lessons and 6 courses (bo-ok format). Listening uses device TTS, one voice per speaker; exam mode plays once.
- **IELTS**: 28 writing prompts (12 General Training), 24 cue cards, 12 Part 1 topics, 2 listening tests and a reading mock with saved scores, 48 official free test links with score logging.
- **Writing and speaking**: timer, saved drafts, counts (words, paragraphs, linking words, contractions), model answer, self-check, rewrite step; Part 1 → prep → 2-minute talk, local recording, self-check.
- **Tracking**: active time (75 s idle limit, visible page only), per-activity minutes, attempts and accuracy, mistake notebook, progress page, 365-day guide.
- **Data**: IndexedDB, persistent-storage request, versioned JSON backup with validation and summary, a safety copy before restore, Anki TSV export (GUIDs) and plain-text import.
- **Praktika Import Centre**: honest "no automatic sync" status, PDF (pdf.js, on device, scan detection), text, paste, Android Web Share Target, review and approve, personal corrections topic, external minutes kept separate, delete imported data.
- **PWA**: manifest, maskable icons, offline service worker (precaches app and content, ~5 MB), relative paths (tested under `/my-repo/`), GitHub Pages and CI workflows.
- **Tests**: 19 Vitest unit tests covering answer checking, content integrity, FSRS, persistence after reload, mastery, mistakes, session building, backlog rules, backup validation, the import parser and Anki.

### Known limitations
- Listening audio uses device voices (quality depends on the phone). There are no recorded human voices yet.
- Writing and speaking feedback is self-assessed with counts and checklists. There is no automated band score (by design: no paid API).
- OCR for scanned PDFs is not available.
- Placement is by self-reported level. There is no placement test yet.
- Phase advancement uses lesson progress. The monthly checkpoint test is not built yet.

### Next steps
1. Real-phone checks: Android install, share a Praktika PDF, offline mode.
2. Monthly checkpoint (vocabulary size + listening + reading + timed writing) and evidence-based phase gates.
3. Local app (FastAPI + SQLite) with a private book library (PDF/EPUB/DOCX/TXT import, reading plans), as in PLAN.md P0 items 4 and 12.
4. More content: B2/C1 core grammar topics, more GT reading passages and letters, Turkish/Arabic explanations for the core topics.
5. A `.apkg` export with review history (sql.js) and a placement test.
6. Playwright e2e in CI.
