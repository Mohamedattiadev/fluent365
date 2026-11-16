# Deploy your own Fluent365 Pocket (GitHub Pages)

Most learners don't need this: they can use an existing Fluent365 link and install it (see ANDROID_INSTALLATION.md). Deploy your own copy if you want to change content or host it yourself. Your progress is private either way — it lives in your browser, not on the site.

## Option A — from the template (no coding)

1. Open the Fluent365 repository on GitHub and press **Use this template → Create a new repository**. Any name works.
2. In your new repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Open the **Actions** tab. If asked, press **I understand my workflows, enable them**.
4. Run **Deploy Pocket to GitHub Pages** (or push any change). Wait 2–3 minutes.
5. Your app is at `https://<your-username>.github.io/<your-repo-name>/`. Open it on your phone and install it.

Nothing in the code names a specific user or repository: the app uses relative paths, so any repository name and any sub-path work.

## Option B — custom domain

Add your domain under Settings → Pages → Custom domain. No code change needed (the build is path-independent). If you ever need an absolute base, build with `BASE_PATH=/ pnpm build`.

## Option C — any static host

```bash
pnpm install
pnpm build
# upload apps/pocket/dist/ to Netlify, Cloudflare Pages, your own server, etc.
```

## Important

- Browser data is tied to the exact web address. If you move your Pocket to a new address, download a backup first and restore it at the new address.
- Updates: a repository made from a template doesn't receive updates automatically. To update, copy the new release into your repository (or fork instead of using the template).
- GitHub Pages limits (about 1 GB per site, ~100 GB/month bandwidth) are far above what Fluent365 needs (~4 MB).

## Checking that it worked

- The page opens and shows the setup screen.
- In Chrome on Android: menu ⋮ → *Install app* / *Add to Home screen* is offered.
- After opening once, turn on airplane mode and reopen: it still works.
