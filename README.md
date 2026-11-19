# Fluent365

**Guided daily English practice: grammar, vocabulary, reading, listening, writing, speaking and IELTS.**
Open the app, press **Start today's session**, then **Next**. Fluent365 decides what to practise and tells you why.

- Free and open source. No account, no ads, no paid AI service.
- Your progress stays on your device (browser storage). Nothing is sent to a server (optional: automatic backup to your own private GitHub repo, or Sign in with Google for a backup in your own account when the deployment has a Supabase project — see `docs/SUPABASE_SETUP.md`).
- Works offline once it has opened, and installs on Android like an app.

## What's inside

| Area | Content |
|---|---|
| Guided daily session | Reviews → new words → grammar → reading/listening → dictation → speaking/writing → 4·3·2 fluency → fix mistakes. The mix follows [language-learning research](docs/research/HOW_PEOPLE_LEARN_LANGUAGES.md). 25, 60 or 90 minutes a day. |
| Grammar Instinct Trainer | 18 core B1 patterns + 40 lesson grammar points. Notice → Compare → Explain → Choose → Build → Produce → Recall later. Mastery is tracked in 4 separate parts: recognition, practice, production and automatic use. |
| Vocabulary | 5,200+ words and phrases (NGSL, NAWL, NGSL-Spoken, TOEIC lists, phrasal verbs, collocations, linking words) with FSRS spaced repetition (Again / Hard / Good / Easy). New words slow down automatically when reviews pile up. |
| Lessons | 40 topic lessons (B1 → B2+), each with words, listening, reading, grammar, writing and speaking. |
| IELTS | 2 listening practice tests, a reading mock, writing Task 1 and 2 (General Training letters and essays), 24 speaking cue cards, plus links to 48 free official practice tests where you record your score. |
| Your data | Mistake notebook, active-time tracking (idle time is not counted), progress page, JSON backup and restore, Anki export and import. |
| Import Centre | Bring in words and corrections from Praktika lesson PDFs or any text, shared straight from Android. You approve everything before it's added. |

## Use it

- **Easiest:** open a hosted Fluent365 Pocket link on your phone and choose *Add to Home screen*. See [docs/ANDROID_INSTALLATION.md](docs/ANDROID_INSTALLATION.md).
- **Your own copy on GitHub Pages:** [docs/POCKET_DEPLOYMENT.md](docs/POCKET_DEPLOYMENT.md).
- **On your computer:** [docs/INSTALLATION.md](docs/INSTALLATION.md).

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm test       # unit tests
pnpm build      # static site in apps/pocket/dist
```

## Documentation

[Quick start](docs/QUICK_START.md) · [Privacy](docs/DATA_PRIVACY.md) · [Content licences](docs/CONTENT_LICENSING.md) · [Praktika](docs/integrations/PRAKTIKA.md) · [Troubleshooting](docs/TROUBLESHOOTING.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Development status](docs/DEVELOPMENT_STATUS.md) · [Product plan](PLAN.md)

## Licences

Code: MIT ([LICENSE](LICENSE)). Learning content: CC BY-SA 4.0 ([content/LICENSE](content/LICENSE)) (word lists by Browne, Culligan & Phillips; original lessons and exercises); public-domain books, covers and LibriVox recordings stay public domain. Details in [docs/CONTENT_LICENSING.md](docs/CONTENT_LICENSING.md).
IELTS is a trademark of the British Council, IDP and Cambridge University Press & Assessment. Fluent365 is not affiliated with them and does not give official scores.
