# What is stored where

**Short version:** everything personal stays in your browser on your device. The website only delivers the app and public learning content.

| Data | Where | Leaves the device? |
|---|---|---|
| Settings, word cards, review history, grammar mastery, mistakes, lesson progress, writing, test scores, imported Praktika items | Browser IndexedDB (`fluent365` database) | Only if *you* download a backup or Anki export |
| Speaking recordings | IndexedDB (`blobs`) | Never (not included in backups) |
| Files shared from other apps (PDF/text) | Read on the device; only the extracted words/corrections you approve are kept | Never |
| Public content (lessons, words, grammar) | Downloaded from the site, cached for offline use | n/a |

- No accounts, analytics, cookies, trackers or AI services.
- Browser storage belongs to one browser on one device and to one web address. Clearing site data, uninstalling the browser or changing the app's address loses it. **Download a backup regularly** (Settings → Backup).
- Fluent365 asks the browser for persistent storage; installed apps usually get it.
- There is no automatic sync between devices. Move data with a backup file.

## Active-time tracking

Time is counted only while the page is visible **and** you did something meaningful in the last 75 seconds (answered, checked, rated a card, typed in a writing task, played audio, recorded). An idle tab is not counted. There is no keystroke logging or mouse tracking: the app only notes "something happened" and which activity it was. Active time is an estimate, not proof of attention. External practice (e.g. Praktika minutes you log) is shown separately and never added to Fluent365 active time.

## Deleting data

- Settings → Start over → type DELETE: removes everything on the device.
- Settings → Import Centre → Delete all imported data: removes only imported items.
