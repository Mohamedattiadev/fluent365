# Content sources and licences

| Content | Source | Licence | Notes |
|---|---|---|---|
| Reading ladder: *The Wonderful Wizard of Oz* (Baum), *The Secret Garden* (Burnett), *The Call of the Wild* (London), *The Time Machine* (Wells), *Around the World in Eighty Days* (Verne, tr. G. M. Towle 1873), *The Adventures of Sherlock Holmes* and *The Hound of the Baskervilles* (Conan Doyle), *Pride and Prejudice* (Austen) — `content/books/` | Project Gutenberg transcriptions (ebooks 55, 113, 215, 35, 103, 1661, 2852, 1342), cleaned and split into chapters in the owner's Bo-ok project; copied from `bo-ok/web/public/books/` | Public domain (published before 1929; all authors and the translator died more than 70 years ago) | Project Gutenberg licence header/footer and trademark removed; plain public-domain text only. Levels in `ladder.json` are rough estimates. |
| Book covers for the 8 ladder books — `content/books/covers/` (200 px JPEGs) | Copied from the owner's Bo-ok project (`bo-ok/web/public/covers/`). Sources recorded there (`web/src/data/cover-sources.json`): Project Gutenberg ebook cover images for ebooks 55, 215, 35, 103, 1661, 2852, 1342; *The Secret Garden*: Wikimedia Commons, "Houghton AC85 B9345 911s - Secret Garden, 1911 - cover.jpg" (scan of the 1911 first edition) | Secret Garden: public domain (1911). PG covers: mostly scans of pre-1929 editions or images released with the ebook; **per-cover licence not yet verified** (Bo-ok notes "cover rights need a check before publishing") | Check each PG cover's licence note before the public deploy; replace any that are not public domain with a plain generated cover. |
| NGSL 1.2, NGSL-Spoken 1.2, NAWL 1.2, TSL 1.2 word lists + definitions | Browne, C., Culligan, B. & Phillips, J. — newgeneralservicelist.com (downloaded 2026-11-05 / 2026-11-16) | CC BY-SA 4.0 | Converted to CSV, otherwise unchanged. Derived `vocab.json` shared under CC BY-SA 4.0. |
| Word frequency ranks | wordfreq 3.1.1 (Robyn Speer) | CC BY-SA 4.0 (word lists) | Ranks only. |
| Example quotes in `daily-en.json` | Public-domain books (Project Gutenberg), selected for Bo-ok | Public domain | |
| 40 path lessons, 6 courses, IELTS Part 1 topics, cue cards, writing prompts | Written for Bo-ok by the same owner, reused here | CC BY-SA 4.0 | Original content. Task 1 data is invented practice data. |
| 18 Grammar Instinct topics, phrasal verbs, collocations, linking words, GT letter prompts | Written for Fluent365 | CC BY-SA 4.0 | Original content. |
| Official IELTS practice links (`content/ielts/official-tests.json`) | ielts.org, IDP, Cambridge | Links and metadata only | No official test content is copied. See docs/research/IELTS_OFFICIAL_MATERIALS.md. |

## Software dependencies

React (MIT), ts-fsrs (MIT), pdf.js / pdfjs-dist (Apache-2.0), Vite (MIT). Dev: Vitest (MIT), fake-indexeddb (Apache-2.0), TypeScript (Apache-2.0).

## Rules for contributions

- Only add content you wrote yourself or that has a verified licence allowing redistribution and modification. Record it in this table.
- "Publicly downloadable" is not the same as "reusable". Check the terms.
- Never add copyrighted book text, Cambridge IELTS book material, official test passages/audio, or pirated PDFs.
- ShareAlike: content derived from CC BY-SA sources must stay CC BY-SA.
