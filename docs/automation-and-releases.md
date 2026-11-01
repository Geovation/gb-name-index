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

### Automatic release (recommended)

Do not commit feature work directly to `main`. Work on a branch and open a normal pull request into `main`.

1. Use a Conventional Commit for the change. The pull request title should also use that format, especially when the PR will be squash-merged.
2. Merge the feature pull request into `main`. This does **not** publish a release. It asks Release Please to open or update a separate release pull request.
3. Review the release pull request. It updates the version in `package.json` and summarizes the changes that will be released.
4. Merge the release pull request. Release Please creates the matching `vX.Y.Z` tag and GitHub Release. The workflow checks the tag against `package.json`, builds the client archive, and attaches it to the release.

The commit type controls the requested version change:

- `feat:` requests a minor version.
- `fix:` or `perf:` requests a patch version.
- `feat!:` or a `BREAKING CHANGE:` footer requests a major version.
- `docs:`, `test:`, and `chore:` do not request a release by themselves.

Allow GitHub Actions to create pull requests in the repository's Actions settings. The workflow requests `contents: write` and `pull-requests: write` permissions.

### Manual release

Use this only when you want to choose the version yourself. Update `version` in `package.json`, commit and push that change to `main`, then create and push a tag with the exact same version. For version `0.1.0`, use `v0.1.0`:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Pushing the tag runs the release workflow, which checks that it matches `package.json`, tests and builds the client, and creates the GitHub Release with `gb-name-index-client-vX.Y.Z.zip`. Do not draft the release in the GitHub UI; the workflow creates it. Consumers can install the package from the tag with npm; it is not published to the npm registry.