# Third-party licences

Fluent365's own code is MIT (see `LICENSE`); its original learning content is CC BY-SA 4.0 (see `docs/CONTENT_LICENSING.md`).
The app ships these third-party components. Full licence texts are published with the app in `apps/pocket/public/licenses/`.

| Component | Version | Licence | Where |
|---|---|---|---|
| Roboto (font files from the Fontsource package `@fontsource/roboto`) | 5.3.0 | SIL Open Font License 1.1 | `apps/pocket/src/assets/fonts/` (woff2: 400, 500, 700, 400 italic; Latin + Latin Extended). Licence: `public/licenses/roboto-OFL.txt` |
| Material Symbols Rounded (`@material-symbols/svg-400`, paths generated into `src/components/icons.gen.ts`) | 0.48.2 | Apache-2.0 | Bundled. Licence: `public/licenses/material-symbols-Apache-2.0.txt` |
| Material Color Utilities (`@material/material-color-utilities`, build-time only: generates `src/theme.gen.css`) | 0.4.0 | Apache-2.0 | Not shipped; the generated colour values are |
| React, React DOM | 18.3.1 | MIT | Bundled |
| ts-fsrs | 6.0.0 | MIT | Bundled |
| pdf.js (`pdfjs-dist`) | 4.10.38 | Apache-2.0 | Bundled (PDF import) |
| Supabase JS client (`@supabase/supabase-js` with auth-js, postgrest-js, realtime-js, storage-js, functions-js) | 2.119.0 | MIT | Bundled as a separate file, loaded only for the optional account |

Fonts are self-hosted and precached by the service worker. The app makes no requests to Google Fonts or any other CDN.
