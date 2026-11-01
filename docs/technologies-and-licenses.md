---
layout: default
title: Technologies and licenses
---

# Technologies and Licenses

The project code is licensed under the [MIT License](../LICENSE). The libraries, font, theme, and source datasets have their own terms; the project license does not replace them.

## Core technologies

- **Python** reads the source data and builds the combined index.
- **JavaScript** provides the client that searches the published index.
- **Svelte and Vite** build the interactive search harness.
- **Jekyll and Cayman** render the documentation. Cayman supplies the page layout and base styles; the project adds its font and diagram styling.
- **GitHub Pages** hosts the static documentation, client, harness, and index. **GitHub Actions** runs tests and publishes updates.

## Direct libraries

License names below are taken from the libraries' package or distribution metadata. `package.json`, `package-lock.json`, and `requirements.txt` record the dependency versions.

| Library | Used for | License |
| --- | --- | --- |
| DuckDB | Read and filter Overture GeoParquet data | MIT |
| pyproj | Convert coordinates to WGS 84 | MIT |
| Requests | Download OS and Overture source data | Apache-2.0 |
| Svelte | Build the search harness interface | MIT |
| Vite | Run and bundle the harness | MIT |
| esbuild | Bundle ESM, CommonJS, and browser client files | MIT |
| `@sveltejs/vite-plugin-svelte` | Connect Svelte to Vite | MIT |
| Pico CSS | Provide the harness's browser-style baseline | MIT |
| Lucide Svelte | Provide filter ordering icons | ISC |
| Fontsource Manrope | Supply the self-hosted Manrope font | OFL-1.1 |
| Jekyll | Build the documentation site | MIT |
| Cayman | Provide the GitHub Pages theme | CC0-1.0 |
| Mermaid | Render diagrams in the documentation | MIT |

## Source data and attribution

The two source datasets have separate terms from the project code and libraries:

- **OS Open Names** is available under the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/). Apps using its records must show the credit in [Attribution](attribution.md).
- **Overture Places** uses CDLA-Permissive 2.0 or Apache 2.0, depending on source. Follow the [Overture attribution guidance](https://docs.overturemaps.org/attribution/) and review its [Places licensing details](https://docs.overturemaps.org/guides/places/).

The required credits and links are also included in [`ATTRIBUTION.md`](../ATTRIBUTION.md).
