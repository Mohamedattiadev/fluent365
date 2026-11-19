# Supabase setup: Sign in with Google + cloud backup (owner)

This turns on **Settings → Account** in Pocket: the learner signs in with Google and the progress is
backed up to their own row in your Supabase project (once a day and when the app is left; a new phone
restores it). It is optional: until these steps are done the Account row is simply hidden, and the app
and the GitHub backup work as before.

You need: a Google account, a GitHub account with this repo, ~20 minutes. Everything here is free.
In the steps, `<you>` is your GitHub user name and `<repo>` this repo's name, so the live app is at
`https://<you>.github.io/<repo>/` (GitHub → repo → Settings → Pages shows the exact address).

Never put a **secret** / **service_role** key anywhere: the app only needs the public key.

---

## 1. Create the Supabase project

1. Go to <https://supabase.com> → **Start your project** → sign in (with GitHub is easiest).
2. **New project**: organisation = your personal one, name `fluent365`, a strong database password
   (save it in your password manager; the app never needs it), region close to you
   (e.g. *Central EU (Frankfurt)*), plan **Free** → **Create new project**.
3. Wait 1–2 minutes until the project dashboard is ready.

**What you should see:** the project home page with "Project Status: Healthy" (or similar), and on the
left the menu with *Table Editor*, *SQL Editor*, *Authentication*.

> **Free tier:** a free project is **paused after about one week with no activity**. Daily backups count
> as activity, but if nobody uses the app for a week, open the Supabase dashboard and press
> **Restore project** (data is kept). While paused, sign-in and backup fail with a connection error;
> the app itself keeps working.

## 2. Run `supabase/schema.sql`

1. In the dashboard: **SQL Editor** → **New query**.
2. Open [`supabase/schema.sql`](../supabase/schema.sql) from this repo, copy all of it, paste it, press **Run**.

**What you should see:** "Success. No rows returned". Then **Table Editor** shows a table **backups**
(columns `user_id`, `data`, `updated_at`) with the label **RLS enabled** (not "RLS disabled" / "Unrestricted").

## 3. Google Cloud: OAuth client

1. First copy the **callback URL** from Supabase: **Authentication** → **Sign In / Providers** → **Google**.
   The panel shows *Callback URL (for OAuth)*: `https://<project-ref>.supabase.co/auth/v1/callback`. Keep it.
2. Go to <https://console.cloud.google.com> → top bar project picker → **New project** → name `fluent365` → **Create**, and select it.
3. Menu → **APIs & Services** → **OAuth consent screen** (newer consoles call it **Google Auth Platform**) → **Get started**:
   - App name `Fluent365`, user support email = your email → **Next**;
   - Audience: **External** → **Next**; contact email = your email → **Next** → agree → **Create**.
   - Under **Audience**: either add your own Gmail under **Test users** (only listed people can sign in), or press
     **Publish app** so anyone can. The app asks only for name and email (no sensitive scopes), so no Google
     review is needed.
4. **Clients** (or *Credentials* → **Create credentials** → **OAuth client ID**):
   - Application type **Web application**, name `Fluent365 Supabase`;
   - **Authorized JavaScript origins**: `https://<you>.github.io`;
   - **Authorized redirect URIs**: the Supabase callback URL from 3.1;
   - **Create**.

**What you should see:** a dialog "OAuth client created" with a **Client ID** (`…apps.googleusercontent.com`)
and a **Client secret** (`GOCSPX-…`). Copy both (the secret goes only into Supabase, step 4, never into the repo).

## 4. Supabase: turn on Google and set the addresses

1. **Authentication** → **Sign In / Providers** → **Google** → switch **Enable Sign in with Google** on,
   paste **Client ID** and **Client Secret** → **Save**.
2. **Authentication** → **URL Configuration**:
   - **Site URL**: `https://<you>.github.io/<repo>/`
   - **Redirect URLs** → **Add URL**: `https://<you>.github.io/<repo>/**`
     (optional for local testing: `http://localhost:5173/**`) → **Save**.
3. Get the two values for step 5: click **Connect** at the top of the dashboard (or **Project Settings** → **API Keys**):
   - the **Project URL**: `https://<project-ref>.supabase.co`
   - the public key: **Publishable key** (`sb_publishable_…`) or, on the *Legacy API keys* tab, **anon public** (`eyJ…`).
     Either works. **Not** the *secret* / *service_role* key.

**What you should see:** Google shows "Enabled" in the provider list; URL Configuration shows your Pages address.

## 5. GitHub: set the two repo Variables and redeploy

1. GitHub → this repo → **Settings** → **Secrets and variables** → **Actions** → tab **Variables** (not *Secrets*)
   → **New repository variable**, twice:
   - `VITE_SUPABASE_URL` = the Project URL (no slash at the end)
   - `VITE_SUPABASE_ANON_KEY` = the publishable / anon public key
2. **Actions** → **Deploy Pocket to GitHub Pages** → **Run workflow** → **Run workflow** (main).
3. Wait until it is green (~2–3 min), then open the live app and reload it once (the app updates itself;
   an installed app may need to be closed and opened again).

**What you should see:**
- **Settings** → under *Your data* a new row **Account** ("Optional: sign in with Google…").
- **Account** → **Sign in with Google** → Google's account chooser (it says it continues to
  `<project-ref>.supabase.co`) → back in Fluent365 on the Account page with "Signed in as *your email*"
  and a toast "Backup saved to your account" (or, if the account already had a backup, the question
  **Restore it here / Replace it with this device**).
- In Supabase **Table Editor → backups**: one row with your user id and a fresh `updated_at`.

Then do step 5 of [PHONE_CHECKLIST.md](PHONE_CHECKLIST.md) on the phone.

---

### If something goes wrong

| What you see | Usually means |
|---|---|
| No **Account** row after deploying | The Variables are not set, are under *Secrets* instead of *Variables*, or the app was not reloaded. |
| Google: "Error 400: redirect_uri_mismatch" | The redirect URI in Google (3.4) is not exactly the Supabase callback URL. |
| Google: "Access blocked … has not completed the Google verification process" | The app is in *Testing* and your Gmail is not a test user (3.3). |
| Back in the app but on the start page of Supabase or "requested path is invalid" | Site URL / Redirect URLs (4.2) do not match the Pages address. |
| "Could not save the backup: … row-level security" | `schema.sql` was not run, or not completely (step 2). |
| "No connection to the server" | No internet, or the free project is paused (step 1 note). |

**Someone else running their own copy** can either set their own Variables (as above) or, without
rebuilding, enter their project in **Settings → Backup, restore and Anki → Use my own Supabase**.
