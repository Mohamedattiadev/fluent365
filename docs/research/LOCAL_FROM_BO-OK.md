# Fluent365 Local, built from Bo-ok (notes, 2026-11-17)

The owner's idea: use the Bo-ok project (`../bo-ok`, private repo, about 20,000 lines) as the base of Fluent365 Local
instead of starting from scratch. Its UI is good; it needs a few changes later and must stay in sync with Pocket.
These notes are from reading Bo-ok's README, NEXT.md, PLAN.md, IELTS.md and the code (2026-11-17). Nothing is built yet.

## What Bo-ok already has (compared with PLAN.md §3.1, the Local app)

| Local needs (PLAN §3.1) | In Bo-ok | Notes |
|---|---|---|
| Book library and reader | Yes: 81 public-domain books (70 English), three.js cover carousel, a reader with a WebGL page turn, real HTML text, the place kept to the character, light/sepia/dark | The 8 Pocket ladder books came from here |
| Private book import | Partly: `modules/imports` (PDF → local reader) | EPUB/DOCX/TXT import not done |
| Word card from the text | Yes: Wiktionary meanings, the meaning that fits the sentence, IPA, picture, translations | Live lookups (Wikimedia, MyMemory) need the internet |
| Vocabulary + SRS | Yes: ts-fsrs **6.0.0 (same version as Pocket)**, new / multiple choice / typing / gap / listening questions, NGSL and NAWL decks, Anki export | The record shape differs from Pocket (see "Sync") |
| Highlights, notes, notebook, pen on pages | Yes: highlights in 4 colours, notes page, pen notebook, drawings hang on words | iPad + Pencil focus |
| Read aloud and voices | Yes: Edge neural voices (unofficial endpoint, server), Piper and Woof in the browser (offline), sentence highlight | Woof is non-commercial (fine for personal use); Edge has no redistribution licence |
| Listening | Courses have a listening player | No LibriVox/background player like Pocket's |
| Writing (IELTS) | `modules/ielts/WritingPage.tsx` + `analyse.ts` | AI feedback needs a Gemini key |
| Speaking | Recorder, cue cards, Gemini Live conversation with corrections, band chart | Gemini Live needs a key and was never tried with a real one |
| Courses / lessons | `/dersler`: unit format (text, word box, T/F/NG, gaps, multiple choice), 1 original unit | Pocket has 40 lessons + 6 courses in its own format |
| Daily plan | `modules/plan` (today session, path) | Pocket's `session.ts` is the evidence-based one (HOW_PEOPLE_LEARN_LANGUAGES §15) |
| Progress, history | Band chart, shelves, reading progress | Less than Pocket's tracking (active time, accuracy, checkpoint) |
| Backup and sync | Yes: local-first records, `/api/sync` with Node's built-in SQLite on the laptop (`web/.data/sync.db`), devices sync every 15 s over Tailscale; backup every 10 min to the private repo `bo-ok-data` (systemd timer); download/restore JSON | This is most of the "cloud backup" idea that was paused on 2026-11-17 |
| Interface | Turkish, English, Arabic; "Liquid Glass" look; 44 px targets on touch | The owner likes this UI |

## Where it differs from the Fluent365 rules and plan

1. **Stack.** PLAN §12 says FastAPI + Python + SQLAlchemy for Local. Bo-ok is Next.js 16 + React 19 + Node SQLite.
   Recommendation: keep Bo-ok's stack and change PLAN §12 (one language, already works, same React/ts-fsrs as Pocket).
2. **No required API keys** (CLAUDE.md). Bo-ok's AI parts (Gemini: word sense, translations, writing feedback,
   Gemini Live, Gemini TTS) must stay optional extras; everything must work without a key.
3. **Licences.** Remove the unofficial Google speech fallback; keep Edge only for personal use (known risk, see
   CONTENT_LICENSING); Woof stays personal-use only with its credit. The downloaded dalilk4ielts subtitles (scratchpad,
   not in the repo) must never come in. The 81 books' descriptions were written by AI and were never checked
   (Bo-ok PLAN §7): check before anything is public.
4. **No hardcoded domains** (CLAUDE.md). Bo-ok docs name the owner's Tailscale host; the app must take the server
   address from settings.
5. **Private vs public.** Fluent365 is public; Bo-ok is private and holds the owner's set-up (backup repo name,
   host). Learner data (`.data/`, `bo-ok-data`) never goes into the public repo.
6. **Content.** Pocket's content (5,223 words, 58 grammar topics with the Instinct Trainer, 40 lessons, IELTS
   prompts) and the guided session are not in Bo-ok. Local should use Pocket's content and session, and Bo-ok's
   reader, library, word card, notes, pen and voices.

## Sync with Pocket (the key decision)

Both apps already think in "records": Bo-ok syncs one word, one highlight or one book's progress at a time
(`key`, `id`, `value`, `updated_at`, `device`, `seq`; the later change wins; deletions are kept as empty rows).
Pocket keeps slices in IndexedDB (`settings`, `cards`, `days`, `mistakes`, `grammar`, `reading`, `listening`, …),
which split naturally into records: one card per word id, one day per date, one mistake per id, one book's reading
place, one recording's position, one grammar topic, settings as one record.

Options for Pocket (on GitHub Pages, on the phone) to reach Local (on the laptop):

- **A. Opt-in "Connect to my computer"** in Pocket settings: the learner types their own server address (for
  example their Tailscale address); Pocket uses Bo-ok's `/api/sync` protocol. Off by default. Needs CORS on the
  server and a small change to the CLAUDE.md rule: "no network calls with learner data, except to a server or
  private repo the learner sets up themselves, opt-in".
- **B. Private GitHub repo as the meeting point** (the paused cloud-backup design): Pocket writes its records to the
  owner's private repo with a pasted token; Local reads and writes the same repo (Bo-ok already pushes to
  `bo-ok-data`). Works when the laptop is off. Same rule change.
- **C. Files only:** Pocket's backup JSON exported and imported by hand (already works). No rule change, but manual.

Recommendation: A for daily use (instant when the laptop is on) plus B as the backup when it is off; C stays.

Word mapping: Pocket card keys are word-list ids (`"1234"`) or `c:<word>` for custom words; Bo-ok entries have
their own ids with the word, lemma, sentence and book. A shared `word key` (lemma + language, plus the word-list id
when there is one) lets one review history serve both; the FSRS state is the same library and version.
Conflicts: start with "later change wins" per card (as Bo-ok does); later merge review logs.

## Suggested order (after the voices and the phrases)

1. Owner decides: Bo-ok becomes Fluent365 Local (rename and brand with the G1 logo), in its own private repo or as
   `apps/local` in this repo (then the owner's set-up moves to settings and `.gitignore`d files).
2. A shared package (`packages/core`): types, FSRS helpers, the record mapping for sync, and the content (words,
   grammar, lessons) used by both apps.
3. Sync: record protocol in Pocket (option A, opt-in) against Bo-ok's `/api/sync`; then option B.
4. Bring Pocket's guided session, grammar trainer, lessons and checkpoint into Local; Bo-ok keeps its reader,
   library, word card, highlights, notes, pen, voices, writing and speaking.
5. Clean-up for the rules: AI optional, licences, no hardcoded host, checked book descriptions.
6. The owner's UI changes on top of Bo-ok's look (to be listed with the owner).

## Owner's decisions (2026-11-17)

- **Repo:** Fluent365. Local lives in this repo as `apps/local` (Bo-ok's files copied in, not its private history).
  The repo is public, so the owner's set-up (Tailscale host, backup repo name, `.data/`) moves to settings and
  git-ignored files; no learner data in the repo.
- **Sync: both.** Option A (Pocket → "Connect to my computer", the learner's own server address, Bo-ok's `/api/sync`)
  and option B (both apps write to the owner's private GitHub repo). If one does not work, the other does. The
  CLAUDE.md rule changes to: "no network calls with learner data, except to a server or private repo the learner
  sets up themselves, opt-in".
- **Languages:** keep the Turkish, English and Arabic interface.
- **Look:** the same as Pocket: accent colour (violet by default, Settings: Violet / Blue / Orange / Black),
  green/red only for right/wrong, Roboto, Material Symbols, the G1 logo, light/dark. Bo-ok's layout and features stay.

## Open questions for the owner (answered above)

- Same repo (`apps/local`) or keep Bo-ok's private repo as Fluent365 Local?
- Sync: A + B as recommended, or only one?
- Keep Turkish/Arabic and the other languages in Local, or English only like Fluent365?
- Which Bo-ok parts stay as they are and which "few changes" to the UI?
