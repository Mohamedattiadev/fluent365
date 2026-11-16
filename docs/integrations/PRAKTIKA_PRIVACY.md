# Praktika data in Fluent365: privacy

- Imported Praktika material (PDFs, text, extracted words and corrections, logged sessions) is stored only in the learner's browser (IndexedDB) on their device.
- Original PDFs are not kept: they are read once on the device; only the items the learner approves are stored.
- Nothing is sent to Praktika, to the Fluent365 site, or to anyone else.
- No Praktika passwords, tokens or account details are requested or stored.
- Imported data is never committed to GitHub: the repository contains no learner data, and `.gitignore` excludes backup files.
- Each Fluent365 installation is independent: another user's Pocket never sees your imports.
- Delete: Settings → Import Centre → Delete all imported data. Or Settings → Start over to delete everything.
- Backups you download include imported items, so store backup files privately.
