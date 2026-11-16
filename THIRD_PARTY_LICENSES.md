# Third-party licences

Fluent365's own code is MIT (see `LICENSE`); its original learning content is CC BY-SA 4.0 (see `docs/CONTENT_LICENSING.md`).
The app ships these third-party components. Full licence texts are published with the app in `apps/pocket/public/licenses/`.

| Component | Version | Licence | Where |
|---|---|---|---|
| Atkinson Hyperlegible Next (Braille Institute; font files from the Fontsource package `@fontsource/atkinson-hyperlegible-next` 5.3.0) | 5.3.0 | SIL Open Font License 1.1 | `apps/pocket/src/assets/fonts/` (woff2: 400, 600, 700, 400 italic; Latin + Latin Extended). Licence: `public/licenses/atkinson-hyperlegible-next-OFL.txt` |
| Lucide icons (`lucide-react`) | 1.62.0 | ISC; icons derived from Feather are MIT (© Cole Bemis) | Bundled into the app. Licence: `public/licenses/lucide-ISC-and-feather-MIT.txt` |
| React, React DOM | 18.3.1 | MIT | Bundled |
| ts-fsrs | 6.0.0 | MIT | Bundled |
| pdf.js (`pdfjs-dist`) | 4.10.38 | Apache-2.0 | Bundled (PDF import) |

The font is self-hosted and precached by the service worker. The app makes no requests to Google Fonts or any other font CDN.
