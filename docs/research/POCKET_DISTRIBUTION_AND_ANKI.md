# Fluent365 Pocket: distribution and Anki interoperability

Research date: 2026-11-16. All URLs below were accessed on 2026-11-16 unless noted. Facts marked *(unverified)* come from memory or secondary sources and were not confirmed against a primary source.

## TL;DR

- **Drop "every user deploys their own GitHub Pages copy" as the default path.** It adds the most friction (GitHub account, template, Actions, Pages settings) and gives **no privacy gain**: Pocket keeps data in the browser's IndexedDB either way, so a static page never sees user data no matter who hosts it. It also makes **updates hard**, because a repo created from a template has no upstream link.
- **Default: one shared, stable public Pocket URL** (the project's own GitHub Pages, ideally behind a custom domain the project controls). The learner opens a link, taps **Install**, and is done. Keep self-hosting as a documented option for people who want it.
- **Anki: do a CSV/TSV export now**, with Anki file headers and a GUID column, plus a ready-made note type and step-by-step instructions. Add **CSV import** from Anki's "Notes in Plain Text" export. Postpone `.apkg` generation. Do not bundle genanki-js unless Fluent365 picks an AGPL-compatible licence. Review history does **not** transfer through CSV. Moving FSRS state across is a later, optional `.apkg`+revlog project.

---

## 1. Distribution options for a non-technical learner (including an 80-year-old)

### 1.1 Comparison

| Option | Setup friction for the learner | Cost | Offline | Updates | Privacy | Verdict |
|---|---|---|---|---|---|---|
| **A. Per-user GitHub Pages (template + Actions)** | **Very high.** GitHub account (13+), email verification, "Use this template", enable Pages/Actions, wait for the build, find their URL, then install. Not realistic for an 80-year-old without help. | Free | Yes (service worker) | **Poor.** Template repos have no upstream history, so each user must re-copy or merge by hand. Forks can "Sync fork" but are still manual. | Same as B (data stays local). The user does own the host. | Keep only as an *advanced, optional* path |
| **B. One shared public Pocket URL** (project GitHub Pages / custom domain) | **Lowest.** Open link → Chrome menu "Install app" / "Add to Home screen". | Free (domain optional, about $10–15/yr *(unverified)*) | Yes | **Automatic.** A new service worker loads the new build; you control the rollout. | Same: IndexedDB is per device, and no server receives data. Add a no-analytics policy. | **Recommended default** |
| **C. Google Play via TWA** (Bubblewrap / PWABuilder) | Low for the learner (Play Store install). High for the maintainer. | $25 one-time + identity verification. New personal accounts need a closed test with **≥12 testers for 14 consecutive days**. | Yes (it is the same PWA in Chrome) | Web content updates instantly; the app shell rarely changes | Same as B | **Later**, once Pocket is stable and there is demand |
| **D. F-Droid** | Medium (install F-Droid first, then the app) | Free | Yes | F-Droid builds, often days behind | Excellent | **Later/maybe.** Wrapper apps must "provide native features". Signing and verification are in turmoil in 2026. |
| **E. Capacitor APK, sideloaded** | High: "unknown sources" warnings. From 2027, Android developer verification (or the "advanced flow") is needed globally on certified devices. | Free (limited-distribution account: ≤20 devices) or $25 | Yes | Manual APK updates | Excellent | **Not for target users** |
| **F. Anki shared deck / AnkiDroid only** | Low–medium (install AnkiDroid, import a file) | AnkiDroid free. AnkiMobile (iOS) is paid *(unverified price)*. | Yes | Re-import the deck. Existing notes update and keep their scheduling. | Excellent | **Complementary channel, not a replacement.** You lose Fluent365's exercises and UI. |

### 1.2 Key facts behind the table

**Chrome Android install (2026).** Installability needs HTTPS, a manifest with `name`/`short_name`, 192px and 512px icons, `start_url`, and `display` set to standalone (or similar), with `prefer_related_applications` absent or false. The user must also have interacted with the page (one click or tap, ≥30 s). <https://web.dev/articles/install-criteria>. A service worker is **no longer required for menu install** (Chrome 108+ on mobile). The automatic install *prompt* still looks for a `fetch` handler, so ship a real offline service worker anyway. <https://developer.chrome.com/blog/update-install-criteria>. GitHub Pages provides HTTPS, so both A and B qualify.

**Storage eviction.**
- Chromium does not prompt for `navigator.storage.persist()`. It **grants it automatically** for important sites: installed, bookmarked, high engagement, or with notification permission. Persistent storage is not evicted under storage pressure; only the user can clear it. <https://web.dev/articles/persistent-storage>. → Call `persist()` after install and show the result in Settings.
- Safari/WebKit: one origin may use up to 60% of disk in browser apps, and Home Screen web apps get the same quota. Eviction is LRU and best-effort unless the origin is persistent. WebKit grants `persist()` heuristically, for example when the site is opened as a Home Screen web app. <https://webkit.org/blog/14403/updates-to-storage-policy/>.
- Safari's ITP **7-day cap** deletes script-writable storage (IndexedDB, SW caches) after 7 days of Safari use without interaction. Home Screen web apps have their own day counter, and WebKit says it does "not expect" their first-party data to be deleted. <https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/>. → **iOS users must install to the Home Screen.** A Safari-tab-only user who skips a week can lose everything.
- iOS 26: any site added from Safari's Share → Add to Home Screen opens as a web app by default ("Open as Web App" toggle). There is still no install prompt. <https://www.macrumors.com/2025/06/18/safari-changes-on-ios-26/> (secondary source).
- **Origin lock-in (critical for every option).** IndexedDB belongs to the exact origin (`scheme://host`). If the Pocket URL ever changes (new username, a fork, a custom domain added later), users' data stays behind. → Choose the final origin **before** launch, ideally a project-owned custom domain. Also build **export/backup to a file** and make it prominent (for example, a monthly reminder).

**GitHub Pages limits and terms.** Sites up to 1 GB, a soft 100 GB/month bandwidth cap, and a soft 10 builds/hour limit that does not apply to custom Actions workflows. Pages is not for commercial SaaS or e-commerce, and must not handle sensitive data such as passwords or payment details. <https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits>. Pages is for "static web pages … as a showcase for personal and organizational projects", and **GitHub may reclaim any github.io subdomain**. <https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features>. A free, open-source learning PWA fits within these terms. The reclaim clause is another argument for a custom domain on the shared URL.

**Google Play / TWA.** The fee is US$25 one-time, with ID verification and verification of an Android device. <https://support.google.com/googleplay/android-developer/answer/6112435>. Accounts created after 2023-11-13 must run a closed test with ≥12 testers opted in for 14 consecutive days before production. <https://support.google.com/googleplay/android-developer/answer/14151465>. Bubblewrap (Apache-2.0, "not an officially supported Google product") builds the TWA. <https://github.com/GoogleChromeLabs/bubblewrap>. A TWA also needs Digital Asset Links (`/.well-known/assetlinks.json`) at the origin root *(from memory; not on the fetched page)*. On a project page like `user.github.io/fluent365`, the root belongs to `user.github.io`, which is another reason for a custom domain.

**Android developer verification (sideloading, F-Droid, Capacitor).** Enforcement starts on 2026-09-30 in Indonesia, Singapore and Thailand, and expands **globally to all apps on certified devices in 2027**. A full account costs $25. A free limited-distribution account allows ≤20 devices with no government ID. An "advanced flow" lets experienced users install apps from unverified developers. <https://support.google.com/android-developer-console/answer/16561738>. F-Droid publicly opposes the scheme. <https://f-droid.org/fr/2026/02/24/open-letter-opposing-developer-verification.html>. The fetched Google page does not say whether this applies to Chrome-installed PWAs/WebAPKs. Today PWAs are generally understood to be outside the scheme *(unverified)*. This makes **B (PWA via a URL) the most future-proof Android path.**

**F-Droid inclusion.** Requires FOSS, built from source with a FLOSS toolchain, and no Play Services or trackers. Website wrappers "should provide native features and enhancements". <https://f-droid.org/docs/Inclusion_Policy/>.

### 1.3 Why per-user GitHub Pages is not "best"

- The main privacy argument does not hold: hosting only serves static files, and all learner data lives on the device in IndexedDB.
- It fails the 80-year-old test. Every extra account and screen loses users.
- Updates and bug fixes do not reach users, and every user copy becomes its own unpatched fork.
- It buys real sovereignty only for technical users. Keep it as "Advanced: host your own copy".

---

## 2. Anki interoperability

### 2.1 How Anki users bring data in

- **CSV/TSV text import** (desktop; AnkiDroid also imports CSV *(unverified for current version)*). Files are UTF-8, separated by comma, semicolon or tab, and quoted fields may contain newlines. **File headers** (Anki 2.1.54+): `#separator:`, `#html:`, `#tags:`, `#columns:`, `#notetype:`, `#deck:`, `#notetype column:`, `#deck column:`, `#tags column:`, and `#guid column:`. A row whose GUID already exists **updates that note, and the note keeps its scheduling**. Otherwise the first field is the duplicate key. Media must be copied into `collection.media` manually; text can reference it as `<img src>` or `[sound:x.mp3]`. <https://docs.ankiweb.net/importing/text-files.html>.
- **`.apkg`**: a zip containing a SQLite collection and media. Modern exports hold the real data in `collection.anki21b` (zstd-compressed, schema v18), and `collection.anki2` is a placeholder that says "Please update to the latest Anki version". A legacy readable file appears only when the user ticks "Support older Anki versions" at export. <https://docs.ankiweb.net/exporting.html>, <https://forums.ankiweb.net/t/collection-anki2-in-exported-apkg-file/44380> (forum; observed behaviour). Import options (23.10+): "Import any learning progress", note-type merging, and update policy. <https://docs.ankiweb.net/importing/packaged-decks.html>. Anki still imports legacy `collection.anki2`-only packages, which is what genanki-style generators produce *(from experience; widely used)*.
- **AnkiConnect** (desktop add-on): an HTTP API on `localhost:8765`. Browser origins must be listed in `webCorsOriginList`. Actions include `addNotes` and `importPackage`. The GitHub repo was archived on 2025-11-04 and moved to SourceHut. <https://github.com/FooSoft/anki-connect>, <https://git.foosoft.net/alex/anki-connect/raw/tag/24.1.1.0/README.md>. It works only with desktop Anki open and needs config editing, so it is a **power-user** feature. A page on `https://` calling `http://localhost` is allowed in Chromium, but Private Network Access rules keep tightening *(unverified)*.
- **AnkiDroid API**: an Instant-Add library (LGPL) and a ContentProvider, gated by the `com.ichi2.anki.permission.READ_WRITE_DATABASE` permission. There is also an `ACTION_SEND` intent fallback (one card at a time, with user confirmation). <https://github.com/ankidroid/Anki-Android/wiki/AnkiDroid-API>. **None of this is reachable from a browser PWA**: it needs a native Android app (Capacitor/TWA plugin). For a PWA, the practical route is "download file → open with AnkiDroid" (or the Web Share API with a file *(unverified that AnkiDroid accepts shared CSV)*).

### 2.2 Licensing

- Anki: **AGPL-3.0-or-later**, with some parts BSD/MIT/CC. <https://github.com/ankitects/anki/blob/main/LICENSE>.
- AnkiDroid: **GPL-3.0**. Some backend code is AGPL-3.0, and the API library is **LGPL-3.0**. <https://github.com/ankidroid/Anki-Android>.
- Producing files that Anki reads, or reading Anki's file formats, does not make Fluent365 a derivative work. Only **copying or bundling their code** (or AGPL libraries such as genanki-js) brings in copyleft.
- Fluent365 has not chosen a licence yet (PLAN.md §4.5). If it picks MIT/Apache, **do not bundle genanki-js (AGPL-3.0)**.

### 2.3 FSRS in Anki and transferring progress

- FSRS ships in Anki 23.10+, AnkiMobile 23.10+, AnkiWeb, and AnkiDroid 2.17+. It is a global toggle. The optimizer derives parameters from the **review history (revlog)**, needs a few hundred reviews, and uses 90% desired retention by default. <https://docs.ankiweb.net/deck-options.html>.
- ts-fsrs (used by Pocket) implements the same FSRS family, but parameter versions differ (FSRS-4.5/5/6). Copying raw `stability`/`difficulty` values is fragile, and Anki advises against copying parameters from elsewhere.
- **The meaningful transfer is the review log, not the card state.** Anki rebuilds FSRS memory state from the revlog. Only `.apkg` can carry revlog rows (plus "Import any learning progress"). CSV cannot carry scheduling. GUID-based CSV updates *preserve* existing Anki scheduling but cannot *set* it.
- Fluent365 → Anki history transfer therefore means writing `.apkg` with `cards` + `revlog` tables that match Anki's schema. This is doable but needs care: ids, `ease` mapping Again/Hard/Good/Easy → 1–4, `ivl`, `factor`, `time`, and `type`. Treat it as a **later** feature. Anki → Fluent365 history import (parsing `collection.anki21b` with zstd + sql.js) is possible but rarely worth it at first.

### 2.4 Options for a browser-only static app

| Option | Effort | Robustness | Licence | Carries history? | Verdict |
|---|---|---|---|---|---|
| **CSV/TSV export + ready note type + instructions** | Low | High. Text format with official headers and stable `#guid column`, so re-export updates notes without duplicates. | None | No (but keeps Anki's own scheduling on re-import) | **Do now** |
| **Import Anki "Notes in Plain Text" CSV/TSV into Fluent365** | Low | High | None | No | **Do now** (lets Anki users bring their word lists) |
| **`.apkg` in browser via genanki-js + sql.js** | Medium | Medium. genanki-js's last commit was 2023-03-12, it has 80 stars and 3 open issues, and it writes the legacy schema. <https://github.com/krmanik/genanki-js>, <https://github.com/krmanik/genanki-js/commits/main>. sql.js is MIT, but **genanki-js is AGPL-3.0**. | AGPL | Not out of the box | **Avoid** (stale + AGPL) |
| **Own minimal `.apkg` writer** (sql.js MIT + JSZip MIT/GPL dual, legacy `collection.anki2` schema) | Medium–high | Good if tested against current Anki and AnkiDroid | Clean | Yes, if `revlog` is written | **Later**: one-tap import with note type/CSS bundled, plus optional history |
| **Import `.apkg` into Fluent365** | High (zstd + schema v18 + legacy + media) | Medium | Clean if self-written | Possible | **Later/only on demand** |
| **AnkiConnect live sync** | Medium | Low for target users (desktop only, config) | n/a | Could push reviews | **Optional power-user extra, much later** |

**CSV export spec (suggested):**
```
#separator:tab
#html:true
#notetype:Fluent365 Vocabulary
#deck:Fluent365::Vocabulary
#guid column:1
#tags column:9
#columns:GUID	Word	Meaning	Example	IPA	POS	Level	Audio	Tags
```
Ship a **"Fluent365 Vocabulary" note type** with matching fields as a one-time `.apkg` built and tested by maintainers on desktop Anki. This is a static file in the repo, not generated in the browser. Users then import it once, and every CSV after that maps automatically. Use stable GUIDs (for example, the Fluent365 item id) so re-exports update notes instead of duplicating them.

---

## 3. Recommendation

**Now**
1. Change the default distribution to **one shared Pocket URL** on a **stable, project-owned origin** (a custom domain pointing at the project's GitHub Pages). Write a one-page "Install on Android / iPhone" guide with large screenshots for older users. Move the template/self-host path to "Advanced".
2. Harden local data: register a real offline service worker, call `navigator.storage.persist()`, show the storage status, and offer **Export/Import backup (JSON)** with periodic reminders. Tell iOS users to install to the Home Screen.
3. **Anki export = CSV/TSV with headers + GUID column**, plus a static, pre-built "Fluent365 Vocabulary" note-type `.apkg` and illustrated instructions for Anki desktop and AnkiDroid. **Anki import = plain-text CSV/TSV.**
4. Choose the project licence. If it is not AGPL-compatible, record "no genanki-js".

**Later (when there is demand)**
- Own `.apkg` writer (sql.js) with bundled note type and optional **revlog export**, so Anki's FSRS can rebuild memory state.
- Google Play listing via a TWA once the custom domain and assetlinks are in place ($25 plus the 12-testers/14-days gate).
- F-Droid or Capacitor only if native features (AnkiDroid API, notifications) justify it. Watch the 2027 Android developer-verification rollout.
- AnkiConnect push for desktop power users. `.apkg` import into Fluent365.
