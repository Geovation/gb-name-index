---
layout: default
title: Automation and releases
---

# Automation and Releases

## Why automation matters

OS and Overture release data independently. Without automation, the public lookup could go stale or the client and data could drift out of step. GitHub Actions tests the common schema, rebuilds the index, and publishes the docs, harness, client, and data together. Jekyll renders the Markdown sources during the Pages build; generated files stay out of the source history.

## Tests

`.github/workflows/test.yml` runs for pushes to branches and pull requests. It installs the Python and JavaScript dependencies, runs the Node client tests and Python builder tests, and builds the client and harness.

The Pages rebuild and release workflows also run both test suites before publishing. A failing test prevents that workflow from publishing.

## GitHub Pages rebuild

`.github/workflows/update-places.yml` publishes monthly, on manual dispatch, and when relevant source or documentation files change on `main`. It builds the client, tests the project, and publishes the full Pages site. The data index is rebuilt on schedule, when no recent cached copy is available, or when you force a refresh.

On a manual run, select **Force index refresh** to rebuild the data even when a recent copy is cached. Otherwise, a cached index younger than 30 days is reused. Changes under `builders/` or to `requirements.txt` change the cache key and trigger a new build.

Set the repository's Pages source to **GitHub Actions**. Jekyll renders `README.md` as the home page and the linked component guides as pages. Runtime assets are added alongside them:

```text
/
  index.html                 Home page rendered from README.md
  docs/                      Jekyll-rendered component guides
  assets/                    Cayman theme and compiled harness files
  data/                      Current index manifest and shards
  client/                    Latest ESM, CommonJS, and browser bundles
  harness/index.html         Interactive search harness
```

The workflow requests `pages: write` and `id-token: write` to deploy the Pages artifact. It does not push a `gh-pages` branch. Generated build output is ignored by Git, the workflow clears its Pages staging folders before each build, and the uploaded Pages artifact is retained for one day.

## Catalyst documentation export

Run `npm run export:catalyst-docs` to create `build/catalyst-docs/gb-name-index/`. The export has one landing page and all guides at the same level, plus `harness/` and `assets/` for the runnable demo. It adapts the guide front matter and local Markdown links for Just the Docs. The harness reads the public index from this project's Pages site, so the export does not duplicate the data shards.

The `catalyst-docs` sync workflow can run this command from a checkout of this repository, then copy `build/catalyst-docs/gb-name-index/` into its root `gb-name-index/` directory and commit changes, following the existing Catalist sync pattern.

## Versioned client release

Update the version in `package.json`, commit the change, then push a matching tag. For version `0.1.0`, the tag is `v0.1.0`:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Push [Conventional Commits](https://www.conventionalcommits.org/) to `main` to open or update a release PR:

- `feat:` requests a minor version.
- `fix:` or `perf:` requests a patch version.
- `feat!:` or a `BREAKING CHANGE:` footer requests a major version.
- `docs:`, `test:`, and `chore:` do not request a release by themselves.

Merge the release PR to create the GitHub Release. `.github/workflows/release.yml` tests the code, builds the client, checks that the tag matches `package.json`, and attaches `gb-name-index-client-vX.Y.Z.zip`. Consumers can install the package from that Git tag with npm; the package remains unpublished to the npm registry. Manual `vX.Y.Z` tags remain supported.

For automatic release PRs, allow GitHub Actions to create pull requests in the repository's Actions settings. The workflow requests `contents: write` and `pull-requests: write` permissions.