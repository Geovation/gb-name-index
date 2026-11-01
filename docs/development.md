---
layout: default
title: Develop and run tests
---

# Develop and Run Tests

You are welcome to fork the project, make changes on a branch, and open a pull request. This guide covers the local setup and checks used by the GitHub Actions workflows.

## Set up the project

Install Git, Node.js 24, and Python 3.12. From your terminal, clone the repository and install its dependencies:

```bash
git clone https://github.com/Geovation/gb-name-index.git
cd gb-name-index
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
npm ci
```

## Run the search harness

Start the local harness with:

```bash
npm run dev
```

Open the local address printed by Vite. If `build/data/index.json` exists when Vite starts, the harness uses that index; otherwise, it uses small sample records. To build the full index, see [Data builders](data-builders.md).

## Run tests and builds

Run the JavaScript and Python tests, then build the client and harness:

```bash
npm test
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
npm run build
```

The full data build downloads current source releases and can take considerably longer than the tests. See [Build and size checks](build-and-size-checks.md) for what the build creates and [Automation and releases](automation-and-releases.md) for the branch and pull request workflow.
