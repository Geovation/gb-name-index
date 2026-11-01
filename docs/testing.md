---
layout: page
title: Tests
---

# Tests

The tests protect the promise that makes this project useful: two independently published datasets remain available through one compatible lookup. They catch regressions in search behavior and in the common record structure before tests, data, or code are published. Small fixtures keep the checks fast and independent of source download availability.

## Run locally

Install the JavaScript and Python dependencies, then run:

```bash
npm test
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
```

The JavaScript tests use Node's built-in test runner and a fake `fetch` function. They cover query normalization, shard requests, ordering, filters, previews, truncation status, attribution exports, and cache clearing.

The Python tests build small temporary indexes and cover category defaults and overrides, source tagging, overlap handling, manifest labels, and shard output. They do not access the network.

Run `npm run build` as well when changing the client or harness. This compiles the three client formats and the Svelte site.