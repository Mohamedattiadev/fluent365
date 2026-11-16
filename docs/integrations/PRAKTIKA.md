# Praktika integration

**Automatic Praktika account synchronisation is not currently available.** Praktika publishes no public API, OAuth or developer programme, and its Terms forbid scraping and reverse engineering (research and sources: [PRAKTIKA_API_RESEARCH.md](PRAKTIKA_API_RESEARCH.md), checked 2026-11-16). Fluent365 therefore never claims to be "connected" to a Praktika account.

## What works today

| Method | How |
|---|---|
| Share from Android | Download a lesson summary PDF in Praktika → Share → Fluent365. The PWA is a Web Share Target (`share_target` in `apps/pocket/public/manifest.webmanifest`, handled in `public/sw.js`). Files wait in IndexedDB (`inbox`) until the Import Centre opens. |
| Choose a file | Settings → Import Centre → Choose a PDF or text file. |
| Paste text | Copy text from Praktika (or anywhere) into the Import Centre. |
| Log minutes | With Praktika tools enabled: log a practice session. Kept separate from Fluent365 active time. |

PDF text is extracted **on the device** with pdf.js. Scanned PDFs (images only) are detected and the learner is told OCR isn't available yet.

## What gets extracted (only clear patterns)

- Vocabulary: lines like `word – meaning`, `word: meaning`, or a list under a "Vocabulary / New words / Expressions" heading.
- Corrections: `original → corrected`, or `You said: …` / `Corrected: …` pairs, with an optional `Explanation:` line.
- Session info: date, `Topic:` line, `N min`.

Nothing is invented: no definitions, pronunciation scores or grammar labels are added. Every item is shown for review. Only approved items are applied:
- Words → flashcards (FSRS), maximum 30 new cards per import to avoid overload; duplicates are matched to existing words.
- Corrections → the mistake notebook (practised in "Fix old mistakes") and a personal "My corrections" grammar topic.
- Session → external practice history (not counted as Fluent365 active time).

## Privacy

Imports stay in the browser. Nothing is uploaded. Settings → Import Centre → *Delete all imported data* removes imported words, corrections, sessions and the personal topic. See [PRAKTIKA_PRIVACY.md](PRAKTIKA_PRIVACY.md).

## Ready for an official connector

If Praktika ever offers an authorised API, add `integrations/praktika/connector` that produces the same `ImportItem` objects (`apps/pocket/src/lib/types.ts`), so review/approval and the learning engine stay unchanged. Until then: no scraping, no private APIs, no token extraction, no stored passwords.

## Tests

`apps/pocket/src/lib/core.test.ts` covers the parser (words, both correction formats, session fields, text with no patterns). Manual checks still to do on a real phone: Android share of a PDF and of text, scanned PDF, offline import.
