# Praktika Integration Research (public sources only)

Subject: Praktika, the AI-avatar language tutor (praktika.ai). Android package `ai.praktika.android`; iOS App Store id 1624701477.
Method: only official or public sources were used: the website, the Intercom help centre, the Privacy Policy, the Terms, and search engines. Nothing was decompiled, intercepted, logged into, or probed.
Research date and access date for every source: **2026-11-16**.

---

## 1. VERIFIED facts (with source)

| # | Fact | Source (acc. 2026-11-16) |
|---|---|---|
| V1 | The operator is **Praktika.ai Company**, 919 N Market St, Ste 950, Wilmington, DE 19801. Contact: **support@praktika.ai**. | Privacy Policy https://praktika.ai/privacy (last updated **Aug 10, 2026**) |
| V2 | Site navigation links to: For business (`/b2b`), Affiliates (`/affiliate`), Scholarship, Blog, Careers, Support (Intercom help centre), Contact, Terms, Privacy, Cookie Policy. **There is no developer, API or docs link.** | https://praktika.ai |
| V3 | The help centre has 7 collections (General, Product & Features, Subscription, Technical, Refunds, Partnerships, Regulation & Compliance). **No article covers an API, integrations, OAuth or data export tooling.** | https://intercom.help/praktika-ai/en/ |
| V4 | The "Partnerships & Collaborations" collection has 3 articles: institution/business partnership, curriculum customization, and the affiliate program. **None is a developer or API program.** | https://intercom.help/praktika-ai/en/collections/14643818-partnerships-collaborations |
| V5 | The B2B page lists a monitoring dashboard, "SSO and audit logs" on the Scale and Enterprise plans, and dashboards and analytics. It says the product deploys without complex integrations. **It does not mention an API, LMS integration or data export.** | https://praktika.ai/b2b |
| V6 | Searches for a Praktika developer portal, an `api.praktika.ai` host or public API documentation returned **nothing**. The only "API" hits describe Praktika as a *customer* of OpenAI's API, not a provider of one. | Web search 2026-11-16; OpenAI customer story https://openai.com/index/praktika |
| V7 | **Lesson PDFs.** "All your lessons are saved in the 'Completed lessons' section of your profile, and you can also download them as PDFs!" | Help: Learning Process https://intercom.help/praktika-ai/en/articles/10707916-learning-process |
| V8 | **Personal dictionary.** Words tapped during a lesson are "automatically added to your dictionary in the 'Profile' tab". **No export of the dictionary is documented.** | Same article as V7 |
| V9 | Lessons can be downloaded while online and practiced offline. Otherwise the app requires internet. | https://intercom.help/praktika-ai/en/articles/12009138-can-i-access-the-app-offline |
| V10 | Platforms: iOS and Android. "A desktop version is not available at the moment." | https://intercom.help/praktika-ai/en/articles/12009172-can-i-use-praktika-on-my-phone-tablet-and-laptop |
| V11 | Data collected includes "**Recordings and transcripts** of your conversations with the AI tutor", lesson plan and progress, profile, and usage data. | Privacy Policy https://praktika.ai/privacy |
| V12 | **GDPR (EEA/UK) rights** in the policy: access ("a copy of the Personal Data we hold about you"), rectification, erasure, and **portability in a "structured, commonly used, machine-readable format"**. Requests go to the contact details at the top of the notice (support@praktika.ai). | Privacy Policy https://praktika.ai/privacy |
| V13 | **CCPA**: right to know and right to delete. The response comes within 45 days (extendable by 45). The company will "select a format … that is readily usable". | Privacy Policy https://praktika.ai/privacy |
| V14 | Help centre: "Email support@praktika.ai for formally requesting a data viewing or data cancellation from our servers." | https://intercom.help/praktika-ai/en/articles/12009611-can-i-request-to-see-or-delete-my-data |
| V15 | Deletion of data or the account can be requested at any time. The company cites GDPR, CCPA and COPPA. | https://intercom.help/praktika-ai/en/articles/12009645-can-i-delete-my-voice-data-or-account |
| V16 | "We don't sell your data". Only minimal information is shared with providers such as payment processors. | https://intercom.help/praktika-ai/en/articles/12009627-is-my-data-shared-with-anyone |
| V17 | **Terms** (last updated **Aug 10, 2026**) forbid users to "reverse engineer, decompile, disassemble, or translate the Application". They state: "You may not use any data mining, robots, scraping, or similar data gathering". Application Content may not be "modified, copied, distributed, framed, reproduced, republished, downloaded, scraped" except as the Terms expressly allow. | Terms https://praktika.ai/terms |
| V18 | Terms: data and materials generated from your use of activities ("**Activity Materials**", including Gen-AI inputs and outputs) "shall be exclusively owned by the Company", and users assign rights to the Company. | Terms https://praktika.ai/terms |
| V19 | The real-time feedback article covers pronunciation, grammar, vocabulary, pace and word choice. It does **not** document summaries, transcripts export, or sharing. | https://intercom.help/praktika-ai/en/articles/11684894-feedback-features |

## 2. UNKNOWN (not documented in any official source found)

- U1: Whether a **public or partner API** exists (none found; see V2–V6). Status: **unknown, with strong indication of no public API**.
- U2: Any **OAuth** / "Sign in with Praktika" / third-party authorization. Nothing found.
- U3: **How the lesson PDF is delivered on Android**: saved to Downloads, sent to the Android share sheet, or opened in a viewer. Also whether it works on both iOS and Android. Not documented.
- U4: **Contents of the PDF**: transcript, corrections, vocabulary, summary? Not documented.
- U5: Whether Praktika exposes any **Android share intent** for lesson summaries, progress or the dictionary. Only a non-official third-party FAQ mentions a "Share" button for progress, so this is unverified.
- U6: The **format and scope of a GDPR access/portability export** (JSON, CSV, PDF? audio included?). The policy promises machine-readable portability but does not specify a format. The timeframe for EEA/UK requests is not stated (the GDPR default is 1 month).
- U7: Whether the **personal dictionary** can be exported.
- U8: Webhooks, LMS connectors, or B2B reporting exports.

## 3. Conclusion

**Does a public API exist?** **No public API is documented. Formally the status is unknown, and every official channel indicates there is none.** No developer portal, docs, OAuth or partner API program was found. The Terms forbid scraping, data mining, robots and reverse engineering.

### Legitimate integration methods for Fluent365 (user-initiated, user-owned data)

1. **Manual PDF import via the Android Web Share Target (recommended, first to build).** In Praktika the user downloads a completed-lesson PDF (V7). From Android's share sheet or Files app, they share it to the installed Fluent365 PWA, which declares `share_target` in its web app manifest for `application/pdf`, `text/plain` and `text/*`. Fluent365 parses the text **locally, offline**, extracts vocabulary and corrections, and offers to add items to SRS. If the Praktika app cannot share directly (U3), the user shares from the Files/Downloads app instead. A plain "Import file" button is the fallback.
2. **Copy/paste.** A "Paste from another app" box accepts text the user copies (words from their dictionary, corrections, a tutor's phrases). It is parsed locally.
3. **GDPR / CCPA data export import.** The user emails support@praktika.ai to request access/portability (V12–V14). Fluent365 then offers a generic importer for whatever file the user receives (JSON/CSV/PDF/text). Detect the format at runtime and do not hard-code a schema until a real export has been inspected with the user's consent.
4. **Manual logging.** The user records "Praktika session: X minutes, topic Y" so the time counts toward Fluent365's speaking/output strand and the weekly plan adapts (for example, fewer speaking minutes that day).
5. **(Optional, future)** Ask Praktika for an official partnership or API through the partnership channel (V4) or support@praktika.ai. Integrate only under a written agreement.

Notes: imported content is the user's personal-study material. Keep it **on-device only**. Do not redistribute or republish it, and do not upload it to Fluent365 servers, in light of V17–V18. Show a short notice that imported content stays local.

### What must NOT be done

- **No scraping** of praktika.ai, the help centre, or in-app content (prohibited by V17).
- **No reverse engineering** of the Android/iOS app or its network traffic, and no reliance on discovered private endpoints (prohibited by V17).
- **No extraction of auth tokens, cookies or session data**, and no asking users for their Praktika credentials.
- **No automated access** (bots, headless browsers, accessibility-service automation of the Praktika app).
- **No invented endpoints** in code or docs. There is no documented API.
- **No use of Praktika branding** that implies partnership or endorsement. Refer to the source only neutrally, for example "Imported from Praktika PDF".
- **No redistribution** of imported Praktika content or AI outputs (Company-owned "Activity Materials", V18).
