---
layout: page
title: Build and size checks
---

# Build and Size Checks

GitHub Pages lets this project serve the full lookup as static files, with no search service for app teams to run. The tradeoff is that the generated site and each file must stay within GitHub's publishing limits. These scripts build the static client and harness, then stop a data update before it exceeds those limits.

## Build outputs

Run `npm run build` from the repository root. `scripts/build.mjs` uses esbuild to create:

- `dist/index.js`: ESM client.
- `dist/index.cjs`: CommonJS client.
- `dist/index.global.js`: browser-global client exposed as `NameIndex`.

It also runs the Vite build for `web/`, which bundles Pico's classless CSS baseline and the harness stylesheet. It writes the app to `build/harness-preview/harness/` and the client files to `build/harness-preview/client/`. GitHub Pages' Jekyll build renders the README and component guides directly from Markdown; a small browser adapter renders their Mermaid diagrams. Generated files are not committed on `main`.

## Pages size check

After the data build, run:

```bash
npm run check-pages-size
```

`scripts/check-pages-size.mjs` walks the directory passed to it (the default command passes `build/data`). It fails if the total data is over 900 MB or if a single file is over 95 MiB. Those limits leave room below GitHub Pages' site limit and GitHub's per-file limit.
The check measures `build/data/` and fails above 900 MB total or 95 MiB for one file. These thresholds leave room below GitHub Pages' 1 GB site limit and Git's 100 MiB file limit, so a growing source release cannot make the public update fail unexpectedly.

The publishing workflow runs this guard before the Jekyll build and Pages deployment, so an oversized release cannot replace the last working public index.