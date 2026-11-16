# Official IELTS practice materials: what exists, terms of use, and how Fluent365 can use them

Researched and checked on **2026-11-16** (all "accessed" dates below are 2026-11-16 unless stated otherwise).
Machine-readable link list: [`content/ielts/official-tests.json`](../../content/ielts/official-tests.json). It holds 48 URLs, and every one returned HTTP 200 on 2026-11-16.

## TL;DR

- **Real live exam papers are not released to the public.** IELTS candidates must leave every test material in the room. Anyone who tries to remove it gets no result, and "reproducing any part of the test in any medium" is prohibited ([IDP India, Notice to Candidates PDF](https://www.ieltsidpindia.com/pdf/Pen%20and%20Paper%20based_IELTS_Notice_to_candidates.pdf)). No ielts.org, IDP or Cambridge page offers past papers for download.
- **The closest thing to "real past exams"** is Cambridge University Press & Assessment's numbered *Cambridge IELTS* books (IELTS 1–21, Academic and General Training editions). They are sold as "authentic" practice tests / "authentic examination papers" written by the test developer. Each book has four complete tests ([cambridgeenglish.org/ielts-practice](https://www.cambridgeenglish.org/ielts-practice); [Cambridge Shop, IELTS 20 GT](https://shop.cambridge.org/english/product/2700250104)). **They are paid, copyrighted products.** The PDFs on third-party sites (ieltsworldly, scribd, slideshare and similar) are pirated, so Fluent365 must never link to, mirror or bundle them.
- **Free official material that exists:** single-task samples (with audio) and full-length computer "familiarisation" tests. They come from ielts.org (the IELTS Partners), IDP and Cambridge, and all are free with no login.
- **Redistribution verdict: nothing can be bundled in a public repo.** That covers passages, questions, audio, transcripts, answer keys and PDFs. Every provider allows only personal, non-commercial use on its own site and forbids republishing elsewhere. **Linking out is fine.**

## 1. Do official past papers exist?

| Claim | Evidence |
|---|---|
| Live test papers stay in the test room and cannot be copied | Notice to Candidates: candidates must "leave all test materials in the test room"; removing them means no result; "reproducing any part of the test in any medium" is forbidden. [IDP India PDF](https://www.ieltsidpindia.com/pdf/Pen%20and%20Paper%20based_IELTS_Notice_to_candidates.pdf) (accessed 2026-11-16). The British Council national notices found via search say the same, e.g. britishcouncil.fr / .ro / .pl `ielts_notice_to_candidates.pdf` (search result only; BC hosts blocked automated fetch). |
| ielts.org offers samples, not past papers | ielts.org sample pages call their content "sample tests" / "official practice materials", and nothing on them mentions releasing past papers. [GT sample page](https://ielts.org/take-a-test/preparation-resources/sample-test-questions/general-training-test) (accessed 2026-11-16). |
| Cambridge sells "authentic" tests | cambridgeenglish.org describes IELTS 21 as "authentic practice tests" and says Cambridge "develop[s] and write[s] the IELTS test". [cambridgeenglish.org/ielts-practice](https://www.cambridgeenglish.org/ielts-practice) (accessed 2026-11-16). The Cambridge Shop lists IELTS 20 GT as four complete examination papers (ISBN 9781009814911, July 2025) via [shop.cambridge.org](https://shop.cambridge.org/english/product/2700250104) (HTTP 200 on 2026-11-16; details from a search snippet). |
| British Council says its free tests use "real IELTS questions from past papers" | Seen only in a search-result snippet of takeielts.britishcouncil.org. **Not verified**: the site blocks automated access (Akamai 403 / HTTP2 reset). Treat it as marketing wording. Even if true, the material is BC-hosted and not redistributable. |

**Conclusion:** no live exam is ever officially published in full for free. Official "real" content reaches the public in only two forms: (a) free sample/familiarisation items on the partners' sites, and (b) retired or authentic papers in paid, copyrighted Cambridge books.

## 2. Provider-by-provider findings

### 2.1 ielts.org (IELTS Partners: British Council, IDP, Cambridge)

- Hub: https://ielts.org/take-a-test/preparation-resources/sample-test-questions (accessed 2026-11-16). It links three pages: Academic, General Training and UKVI Life Skills.
- **General Training page:** https://ielts.org/take-a-test/preparation-resources/sample-test-questions/general-training-test
  - **Listening:** 8 interactive single-task extracts (MCQ ×2, plan/map/diagram, note, table, flow-chart, sentence, short answer) in the official Inspera computer player, **with audio**. Each has an answer key and a transcript PDF.
  - **GT Reading:** 7 interactive single-task extracts (MCQ, T/F/NG, matching information, matching features, summary, note, sentence completion), each with an answer key PDF.
  - **GT Writing:** Part 1 (letter) and Part 2 (essay), in both computer and Writing-on-Paper versions, plus a PDF of example responses with band scores and examiner comments.
  - **Speaking:** a 7-page sample-tasks PDF for Parts 1–3. It has no audio; it is the same for both modules.
  - **"Practice experience"** (the familiarisation test, see 2.6). The page itself says it uses Academic Reading/Writing questions, so GT candidates use it only to learn the platform, and it is untimed.
- **Academic page:** https://ielts.org/take-a-test/preparation-resources/sample-test-questions/academic-test
  - The same 8 Listening tasks.
  - 10 Academic Reading tasks.
  - Academic Writing Parts 1 and 2 (computer and on-paper versions), plus an examiner-commented responses PDF.
  - The same Speaking PDF.
- Free, no login. Accessed 2026-11-16.
- **Terms:** [IELTS copyright and trade mark statement](https://ielts.org/legal/ielts-copyright-and-trade-mark-statement) (accessed 2026-11-16).
  - Material is owned by or licensed to the IELTS Partners.
  - It is "made available to you for your personal and non-commercial use only".
  - Any other use needs written permission. That explicitly includes commercial use, republishing on another website, modification and removing notices.
  - There is no educational or teacher exception. The statement says nothing about linking.

### 2.2 British Council: Take IELTS / Prepare for IELTS free practice tests

- URLs found via search (accessed 2026-11-16):
  - https://takeielts.britishcouncil.org/prepare/ielts-free-practice-mock-tests
  - `.../general-training`
  - `.../academic`
  - https://takeielts.britishcouncil.org/ielts-free-practice-mock-tests/ielts-familiarisation-test
- Search snippets describe free mock tests for all four skills, Academic and GT. They say the familiarisation test scores Listening and Reading automatically (Writing and Speaking are not marked). Booking a BC test reportedly unlocks "40 free practice tests" and IELTS Ready Premium.
- **Could not verify:** every request to `*.britishcouncil.org` failed from the research environment, including WebFetch timeouts, curl HTTP 403 and HTTP/2 resets, and the browser extension was unavailable.
  - **These pages are left out of the JSON** on purpose, because the brief allows only verified URLs. A maintainer should open them in a normal browser and, if they work, add them.
  - BC's own terms of use also could not be read. Assume the same personal, non-commercial, no-republishing rule as the other Partners (the ielts.org statement covers all three Partners' material on ielts.org).

### 2.3 IDP IELTS

- Practice hub: https://ielts.idp.com/prepare/all-test-types/all-skills/practice-test (HTTP 200 via curl on 2026-11-16; WebFetch got 403). It lists "72 preparation materials":
  - Computer familiarisation tests for Listening, Reading and Writing, with answer-key PDFs.
  - Speaking Parts 1–3, each a prompt + transcript PDF **plus a sample-recording mp3**.
  - Academic Writing-on-Paper Parts 1 and 2.
- GT filter: https://ielts.idp.com/prepare/all-skills/general-training-and-ukvi/practice-test. It has 7 GT Reading task PDFs (short answer, matching information, matching headings, matching features, identifying information, flow-chart, sentence completion) and the Listening familiarisation test.
- Academic filter: https://ielts.idp.com/prepare/all-skills/academic-and-ukvi/practice-test
- Free, no login.
- **Terms:** [IDP legal notices](https://ielts.idp.com/legal-notices) (accessed 2026-11-16). The material, including "text, graphics, images, photographs and sound", is copyright under the Australian Copyright Act 1968. Users "must not alter, reproduce, store in retrieval system or transmit" it unless IDP authorises this in writing or the Act permits it. The only carve-out mentioned is saving or printing a copy for personal, non-commercial use.

### 2.4 Cambridge University Press & Assessment

- https://www.cambridgeenglish.org/ielts-practice (accessed 2026-11-16). It points to the ielts.org samples and to the guides below. Paid products include IELTS 21 Academic/GT "authentic practice tests", the Official Cambridge Guide to IELTS (8 tests), IELTS Test & Train and Mindset.
- **Legacy sample papers zip:** https://www.cambridgeenglish.org/Images/23435-ielts-sample-papers.zip (8.2 MB, files dated 2011; HTTP 200 on 2026-11-16).
  - Contents: task-type PDFs for Listening, Academic Reading/Writing, GT Reading/Writing (Task 1 letter, Task 2 essay, sample scripts) and Speaking Parts 1–3 with transcripts.
  - It also has 7 mp3 files.
  - It reflects the older paper-based format but is still valid for task types.
- Guides (not tests): [Guide for Test Takers PDF](https://www.cambridgeenglish.org/Images/23436-ielts-guide-for-test-takers.pdf), [GT FAQs](https://www.cambridgeenglish.org/Images/269899-ielts-general-training-faqs.pdf), [Academic FAQs](https://www.cambridgeenglish.org/Images/269898-ielts-academic-faqs.pdf).
- Cambridge One free online listening/reading tests that come with IELTS 19+: third-party reports say they need a free Cambridge account. **Not verified**, and not listed in the JSON.
- **Terms:** the cambridgeenglish.org footer redirects to https://www.cambridge.org/legal/website-terms-of-use, which returned 403 to automated fetch, so its wording could not be read. Cambridge material is © Cambridge University Press & Assessment and the ielts.org statement above also covers it. Book contents are standard all-rights-reserved publishing.
- **Cambridge IELTS 1–19 (and 20–21) books are copyrighted and must not be pirated, mirrored, transcribed, or linked from unofficial PDF sites.**

### 2.5 Road to IELTS (British Council)

- https://www.roadtoielts.com/ and `/test-drive.html` both returned HTTP 200 on 2026-11-16. The page claims a free "Test Drive" (1 practice test across all four modules, 30+ activities) and credits "The British Council & Clarity Language Consultants Ltd".
- **Caution:** it is a small static page with a placeholder `#signup` anchor, and its `/terms.html` returns 404. I could not confirm that it is the genuine British Council platform. **Not listed in the JSON.** Historically Road to IELTS was offered free to BC test bookers through takeielts.britishcouncil.org, and a maintainer should reach it that way.

### 2.6 IELTS Ready (British Council)

- https://ieltsready.britishcouncil.org/ was unreachable (connection reset) on 2026-11-16. Search snippets describe a free tier plus Premium for BC test bookers. **Not verified; not listed.**

### 2.7 Computer-delivered IELTS familiarisation tests (shared by ielts.org and IDP)

These are full-length tests in the real Inspera test player, linked from both the ielts.org sample pages ("practice experience") and the IDP hub.

| Test | URL | Length | Audio |
|---|---|---|---|
| Listening (both modules) | https://demo-ielts.inspera.com/player/?assessmentRunId=131012334&context=exam | 4 parts, 40 questions (from IDP answer key) | Yes |
| Academic Reading | https://demo-ielts.inspera.com/player/?assessmentRunId=131013388&context=exam | 3 parts, 40 questions | n/a |
| Academic Writing | https://demo-ielts.inspera.com/player/?assessmentRunId=131013741&context=exam | Task 1 + Task 2 | n/a |
| Academic Writing on Paper | https://ielts.inspera.com/player/?assessmentRunId=502166894&context=exam | Task 1 + Task 2 | n/a |

- They are untimed, so they differ slightly from the live test.
- **No full-length GT Reading or GT Writing familiarisation test exists.** GT learners practise those skills with the single-task samples on ielts.org and IDP.

## 3. Coverage summary per skill (free and verified)

| Skill | Official free material (verified) | Audio |
|---|---|---|
| Listening | 1 full 40-question familiarisation test + 8 single-task extracts (ielts.org), plus the legacy Cambridge zip | Yes |
| Reading GT | 7 interactive tasks (ielts.org) + 7 task PDFs (IDP GT hub) + legacy zip. **No full-length GT Reading test.** | n/a |
| Reading Academic | 1 full 40-question familiarisation test + 10 interactive tasks (ielts.org) | n/a |
| Writing GT Task 1 (letter) | ielts.org computer + on-paper sample, examiner-commented responses PDF, legacy zip | n/a |
| Writing Task 2 | GT and Academic Task 2 samples on ielts.org, familiarisation Academic Writing | n/a |
| Speaking | ielts.org Speaking PDF (Parts 1–3); IDP Parts 1–3 prompt + transcript PDFs with sample mp3s; legacy zip mp3s | IDP/Cambridge: yes |

**For a GT 7.5 learner:** official free material is enough for format familiarity and task-type drilling. It is not enough for repeated full GT mock exams. Full GT mocks require the paid Cambridge IELTS GT books (or BC's booking-linked practice tests).

## 4. What can and cannot go into the public Fluent365 repo

| Item | Bundle in repo? | Why |
|---|---|---|
| URLs, titles, provider, skill, module, timing, question counts (metadata) | **Yes** | These are facts and links, not copyrighted expression. Linking is not prohibited by any terms read. |
| Passages, questions, prompts, cue cards, transcripts, answer keys | **No** | ielts.org: personal non-commercial use only, no republishing. IDP: no reproducing, storing or transmitting. Cambridge: all rights reserved. |
| Audio (mp3) or video | **No** | Same reasons. IDP explicitly names "sound". |
| PDFs or zip files (including the Cambridge sample zip) | **No** | Redistribution counts as republishing. |
| Content from Cambridge IELTS 1–21 books | **No, never** | Commercial copyrighted books, and pirated PDFs are illegal. |
| Embedding the Inspera players in an iframe inside the app | **Avoid** | Could be read as republishing or framing. A plain outbound link is safer. |
| Using IELTS logos or trade marks | **No** | Trade mark statement forbids it. Plain-text "IELTS" for descriptive reference is fine. |
| Paraphrased task-type explanations and original practice items written by Fluent365 | **Yes** | Original work, provided nothing is copied or closely paraphrased from the official items. |

## 5. Recommended way for Fluent365 to use official materials

1. **Link out only.** Render `content/ielts/official-tests.json` as an "Official practice" list grouped by skill, with module filters (General / Academic). Open each URL in a new tab on the provider's site, and label each entry "Official sample – © IELTS Partners / Cambridge".
2. **Learners record their results in the app.** After an attempt, the learner enters a raw score (e.g. 31/40 Listening). The app converts it to an estimated band with an approximate published conversion table, and the table must be clearly labelled as an estimate. For Writing and Speaking the learner records a self-assessed band against the public band descriptors. Store only the learner's own numbers locally (`testId`, date, raw score, band, notes), never test content.
3. **Bring-your-own legally obtained copies, local only.** A learner who owns Cambridge IELTS books (or BC Premium access) can log their scores against a "Cambridge IELTS N, Test M" template that holds only book and test numbers. Optionally the learner can import their own files (audio/PDF they own) into browser-local storage (IndexedDB/OPFS) for convenience. The import must never sync, upload or share them, and the UI should say: "Import only material you legally own; it stays on this device."
4. **Never bundle or proxy official content.** Do not fetch and cache official pages in the service worker. Keep outbound links out of the PWA precache.
5. **Re-check the links regularly.** Inspera `assessmentRunId` links and Contentful asset URLs can change. Re-verify the JSON each quarter and update `checked`.
6. **Follow-ups for a maintainer with a normal browser:**
   - Verify the British Council free practice pages, IELTS Ready and the genuine Road to IELTS free tier, then add them if they work.
   - Read the cambridge.org and takeielts terms of use and record their exact wording here.
   - If Fluent365 ever wants to embed official content, request written permission through ielts.org's copyright request process. The statement says that submitting the form "alone does not constitute a valid licence".

## Sources (all accessed 2026-11-16)

- https://ielts.org/take-a-test/preparation-resources/sample-test-questions
- https://ielts.org/take-a-test/preparation-resources/sample-test-questions/general-training-test
- https://ielts.org/take-a-test/preparation-resources/sample-test-questions/academic-test
- https://ielts.org/legal/ielts-copyright-and-trade-mark-statement
- https://ielts.org/legal/ielts-terms-conditions (defers test-day terms to each partner)
- https://ielts.idp.com/prepare/all-test-types/all-skills/practice-test
- https://ielts.idp.com/prepare/all-skills/general-training-and-ukvi/practice-test
- https://ielts.idp.com/legal-notices
- https://www.ieltsidpindia.com/pdf/Pen%20and%20Paper%20based_IELTS_Notice_to_candidates.pdf
- https://www.cambridgeenglish.org/ielts-practice
- https://www.cambridgeenglish.org/Images/23435-ielts-sample-papers.zip (contents listed, not redistributed)
- https://shop.cambridge.org/english/product/2700250104
- https://www.roadtoielts.com/test-drive.html (authenticity unconfirmed)
- Unreachable or blocked: takeielts.britishcouncil.org, ieltsready.britishcouncil.org, cambridge.org/legal/website-terms-of-use
