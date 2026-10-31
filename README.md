# GB Name Index

A static, prefix-sharded index of Great Britain names. It combines authoritative OS Open Names records with Overture Places records and publishes a small JavaScript client for searching the index.

The generated index is published to the `gh-pages` branch of this repository. Generated data is not stored on `main`.

## Components

This repository consists of the following key components:

- **Build scripts** (`build_places_index.py`, `build_os_open_names_index.py`, `build_overture_places_index.py`) - Python scripts that download and combine OS Open Names and Overture Places data into prefix-sharded JSON indexes stored in `build/data/`

- **JavaScript client** (`src/index.js`) - A lightweight, reusable JavaScript module that provides a `search()` function for querying the index with support for source and type filtering and prioritization

- **Test harness** (`web/`) - A Svelte-based search interface that demonstrates the JavaScript client capabilities and provides an interactive way to search the index

- **Build utilities** (`scripts/`) - Node.js utilities for building and validating the project, including page size checks

- **Generated data** (`build/data/`) - The output of the build scripts: prefix-sharded JSON files containing indexed place names

## Getting Started

These instructions set up a local checkout for building the index, developing the JavaScript client, and running the Svelte search harness.

### Prerequisites

- Python 3.9 or later, built with OpenSSL 1.1.1 or later
- Node.js and npm
- Internet access to download the OS Open Names release and Overture Places data

### Installing

Create a Python virtual environment and install the data-build dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Install the JavaScript development dependencies:

```bash
npm install
```

## Building the Data Index

Build the combined index:

```bash
.venv/bin/python builders/build_places_index.py
```

The generated files are written to `build/data/`. The OS archive and release marker are cached in `.os-open-names-cache/`.

For a smaller local test build, use `--max-os-records` and `--max-overture-records`:

```bash
.venv/bin/python builders/build_places_index.py \
 --max-os-records 1000 \
 --max-overture-records 1000
```

The build also supports `--os-download-url`, `--overture-release`, `--overture-input`, `--minimum-confidence`, `--memory-limit`, and `--output` to override its default sources and output location.

## Category Catalog and Pick-and-Mix Defaults

The index is built from an explicit catalog of categories available from each source. This is defined in `builders/config.py` as `SOURCE_TYPE_CATALOG` and `SOURCE_TYPE_DEFAULTS`. The `postcode` category refers to actual postcode records from the source, while `POSTCODE_DISTRICT` remains a separate context field for district-style values.

The catalog is the master list of what each source can contribute, and the defaults decide what ships by default. You can override either one at build time using the CLI flags below:

```bash
.venv/bin/python builders/build_places_index.py \
  --include-os-type postcode \
  --exclude-os-type other \
  --include-overture-type park \
  --exclude-overture-type airport
```

This is the pick-and-mix model: every category is listed up front, defaults are defined centrally, and the CLI lets you include or exclude specific categories without editing the source code. The source overlap list is still kept separate as a deduplication policy for Overture layers that are already represented by OS Open Names.

### Available OS Open Names categories

- `hydrography`
- `landcover`
- `landform`
- `other`
- `populatedPlace`
- `postcode`
- `transportNetwork`

### Available Overture categories

- `airport`
- `beach`
- `bridge`
- `canal`
- `castle`
- `cemetery`
- `forest`
- `garden`
- `historic_site`
- `island`
- `lake`
- `land_feature`
- `marina`
- `monument`
- `mountain`
- `national_park`
- `nature_reserve`
- `park`
- `pier`
- `public_fountain`
- `public_plaza`
- `rail_facility_or_service`
- `recreational_trail_or_path`
- `river`
- `train_station`
- `waterfall`

When both an include and exclude override are supplied for the same category, the explicit exclusion wins.

## Using the JavaScript Client

Install the package once published:

```bash
npm install @geovation/gb-name-index
```

Search the deployed index by name:

```js
import { search } from "@geovation/gb-name-index";

const results = await search("St John's");
```

For an alternative deployment, configure the index base URL:

```js
import { createNameIndex } from "@geovation/gb-name-index";

const names = createNameIndex({
	baseUrl: "https://example.com/data"
});
const results = await names.search("Baker Street");
```

Results are ordered by exact name, source priority, type priority, then stable display fields. The default prioritizes `OS Open Names` ahead of `Overture Places`. Configure a type order when your product has a preferred category taxonomy:

```js
const names = createNameIndex({
	sourcePriority: ["OS Open Names", "Overture Places"],
	typePriority: ["populatedPlace", "restaurant", "cafe"],
});

const results = await names.search("Baker Street", {
	typePriority: ["transportNetwork", "populatedPlace"],
});
```

To exclude sources or restrict results to specific types, pass `sources` or `types` to `search`. The selected arrays also provide sensible priority defaults when passed as the corresponding priority option:

```js
const results = await names.search("Baker Street", {
	sources: ["OS Open Names"],
	types: ["transportNetwork", "populatedPlace"],
	sourcePriority: ["OS Open Names"],
	typePriority: ["populatedPlace", "transportNetwork"],
});
```

CommonJS consumers can use `require("@geovation/gb-name-index")`. The browser-global bundle is available as `dist/index.global.js` and exposes `NameIndex`.

## Data Format

`index.json` records the source releases, compact record schema, and adaptive shard layout. The index starts with three-character prefixes, preserving those shards when they are small and splitting only high-volume prefixes until each ordinary shard is at most 64 KiB:

```text
https://<owner>.github.io/<repository>/data/<shard>.json
```

Names are case-folded and stripped of non-alphanumeric characters before sharding. For example, a small `Baker` group can be stored in `bak.json`, while a high-volume `St John's` group may be split to a longer leaf prefix. The client follows manifest routing metadata and filters the leaf shard for the complete query. Unsplittable exact-name groups are capped at 50 records so autocomplete responses remain bounded.

The manifest schema is `NAME1`, `TYPE`, `LOCAL_TYPE`, `LOCALITY`, `POSTCODE_DISTRICT`, `REGION`, `LONGITUDE`, `LATITUDE`, and `SOURCE`. `TYPE` is the broad, filterable classification; `LOCAL_TYPE` preserves a more specific source subtype when available, such as `Named Road`. `LOCALITY` and `POSTCODE_DISTRICT` are populated from each source where available and are treated as separate contextual fields rather than being folded into the generic `transportNetwork` bucket. Coordinates use WGS 84 and are rounded to the manifest's `coordinatePrecision` value, currently five decimal places. Its `sources` and `types` arrays enumerate filter choices. `typesBySource` groups raw type identifiers by dataset, while `typeLabelsBySource` supplies source-aware labels for user interfaces.

### Using Shards Directly

Use the JavaScript client above when possible. To consume the static files from scratch, load `index.json` once, normalize the query, and follow `routes` until reaching a leaf shard. A route value is the set of available next characters. `_` represents the end of a normalized name, such as an exact `InPost` query.

```js
const baseUrl = "https://<owner>.github.io/<repository>/data";

function normalize(value) {
	return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function shardFor(query, manifest) {
	const prefix = normalize(query);
	if (prefix.length < manifest.minimumQueryLength) return;

	let shard = prefix.slice(0, manifest.minimumQueryLength);
	while (Object.hasOwn(manifest.routes, shard)) {
		const next = prefix[shard.length] ?? "_";
		if (!manifest.routes[shard].includes(next)) return;
		shard += next;
	}
	return shard;
}

function decode(row, manifest) {
	return Object.fromEntries(
		manifest.schema.map((field, index) => [
			field,
			field === "SOURCE" && Number.isInteger(row[index])
				? manifest.sources[row[index]]
				: row[index],
		]).filter(([, value]) => value != null && value !== ""),
	);
}

const manifest = await fetch(`${baseUrl}/index.json`).then((response) => response.json());
const query = "Baker Street";
const shard = shardFor(query, manifest);
const rows = shard
	? await fetch(`${baseUrl}/${encodeURIComponent(shard)}.json`).then((response) => response.json())
	: [];
const results = rows
	.map((row) => decode(row, manifest))
	.filter((record) => normalize(record.NAME1).startsWith(normalize(query)));

const totalMatches = manifest.truncated[shard] ?? results.length;
const isTruncated = totalMatches > results.length;
```

Each ordinary shard is at most `maxShardBytes` (currently 64 KiB). A value in `truncated` means the leaf represents an exact-name group with more than `maxResultsPerShard` matches; use `totalMatches` to disclose that the returned shortlist is incomplete and let the user refine the query.

OS Open Names contributes place names, roads, postcodes, transport features, and geographic features. Overture contributes Great Britain places of interest at confidence `0.8` or higher, excluding categories that overlap with OS geographic, natural, heritage, and transport data. `SOURCE` identifies each record's dataset. Exact duplicate names and locations may remain when a commercial place is also an OS feature.

## Building the Client

Build the distributable client and compiled Svelte harness:

```bash
npm run build
```

Run the Svelte harness locally:

```bash
npm run dev
```

Check that generated data pages remain below the configured size limit:

```bash
npm run check-pages-size
```

## Deployment

The **Update GB Name Index** workflow runs monthly without API keys or repository secrets. It resolves the latest public source releases, builds the index, and rewrites `gh-pages` with a single current-state commit containing the data, client bundle, and autocomplete harness.

Before publishing, the workflow rejects an index larger than 900 MB and any shard larger than 95 MiB, preserving headroom for GitHub Pages' 1 GB site limit and Git's 100 MiB file limit.

## Built With

- [DuckDB](https://duckdb.org/) for processing Overture Places data
- [pyproj](https://pyproj4.github.io/pyproj/stable/) for coordinate transformation
- [Requests](https://requests.readthedocs.io/) for source downloads
- [esbuild](https://esbuild.github.io/) for JavaScript bundles
- [Svelte](https://svelte.dev/) and [Vite](https://vite.dev/) for the GitHub Pages search harness

## Contributing

Open an issue or pull request in the repository with a focused description of the proposed change. Run the relevant build checks before submitting a pull request.

## Versioning

The npm package follows the version in `package.json`. Published package versions and repository tags are the source of truth for available releases.

## Authors

- [Geovation](https://github.com/Geovation)

See the repository's contributor history for everyone who has participated.

## License

This project is licensed under the terms in [LICENSE](LICENSE).

## Acknowledgments

- [Ordnance Survey](https://www.ordnancesurvey.co.uk/) for OS Open Names
- [Overture Maps Foundation](https://overturemaps.org/) for Places data
- [PurpleBooth](https://github.com/PurpleBooth/a-good-readme-template) for the README structure
