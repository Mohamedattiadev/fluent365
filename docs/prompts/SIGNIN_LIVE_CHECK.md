# Prompt: live check of Google sign-in (paste into a new Claude Code session in this repo)

```
Fluent365: live check of the optional Google sign-in + Supabase backup (status doc "Next steps" 2b).
Reply to me in Turkish, short. Use Claude in Chrome (my Brave; the extension is logged in with the same
claude.ai account as this Claude Code session; if it is not connected, tell me to run /chrome → Reconnect).

Read first: CLAUDE.md, docs/DEVELOPMENT_STATUS.md (Next steps 2 and 2b), docs/SUPABASE_SETUP.md,
apps/pocket/src/lib/account.ts, apps/pocket/src/screens/Setup.tsx.

Facts: live app https://mohamedattiadev.github.io/fluent365/ ; Supabase project "my-apps"
(ref tsnlhzuhbteqgjvxobbx, dashboard at supabase.com, I am logged in); Google Cloud project
my-apps-515214 (consent screen "My apps", Testing). Test users: mohattiads@gmail.com,
mohamedattia.dev@gmail.com. I am already signed in to Google in Brave with them.

Rules: never type a password, code or secret. You may choose one of my test accounts on Google's
account chooser and continue on the "unverified app" screen: I approve that for this check.
Do not delete anything except the test rows this check creates (step c).

Do, in a new tab, with fresh site data for the app (Brave: site settings → clear data for
mohamedattiadev.github.io, or a private window if the extension works there):
a) New learner: setup → step 5 → "Sign in with Google" → mohattiads@gmail.com → expect Today,
   toast "Backup saved to your account"; Settings → Account shows the email; "Back up now" works;
   Supabase Table Editor → backups has one row with a fresh updated_at.
b) Returning learner: clear the app's site data again → welcome → "Already using Fluent365? Sign in"
   → same account → setup skipped, progress restored (same name/settings), no upload before restore.
c) Settings → Account → "Delete my cloud data" (type DELETE) → row gone, signed out.
d) Repeat a) with mohamedattia.dev@gmail.com → its own row; check in the table that the two rows
   have different user_id; then delete that row too via the app.
e) Only if I give you another Gmail that is NOT a test user: expect Google "access blocked".
Also check the console for errors on each step.

Report a table: step / OK or what you saw (screenshot when not OK). Fix any bug you find in
apps/pocket (tests: pnpm test, pnpm build && pnpm e2e), small commits, push to main, check the
live site again. Update docs/DEVELOPMENT_STATUS.md (2b → Done) and memory.
```
