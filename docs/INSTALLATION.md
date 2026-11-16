# Run Fluent365 on your computer

You need **Node.js 22+** and **pnpm** (`npm install -g pnpm`).

```bash
git clone <your Fluent365 repository URL> fluent365
cd fluent365
pnpm install
pnpm dev
```

Open http://localhost:5173. Your progress is stored in that browser.

## Use it daily without the terminal

```bash
pnpm build
pnpm preview      # http://localhost:4173
```

Then in Chrome or Edge: address bar → *Install* icon. Fluent365 opens as a desktop app and works offline. (Data in `localhost:5173` and `localhost:4173` are separate because they are different addresses.)

## Developers

```bash
pnpm content      # rebuild public/data from content/
pnpm test         # unit tests (Vitest)
pnpm build        # production build in apps/pocket/dist
```

Project layout: `apps/pocket` (the app), `content/` (public learning content), `scripts/build-content.mjs`, `docs/`.
