#!/usr/bin/env python3
"""Build the combined Great Britain search index from OS and Overture records."""

from __future__ import annotations

import argparse
import json
import shutil
import tempfile
from datetime import date
from pathlib import Path

from .build_os_open_names_index import build, read_names, release_from_redirect
from .build_overture_places_index import latest_release, place_assets, read_places
from .config import (
    GB_NAME_INDEX_PRODUCT_NAME,
    GB_BOUNDS,
    OS_OPEN_NAMES_DOWNLOAD_URL,
    OVERTURE_OVERLAP_CATEGORIES,
    OVERTURE_STAC_CATALOG,
    SOURCE_CATEGORY_CATALOG,
    SOURCE_CATEGORY_DEFAULTS,
)


def include_record_category(
    source: str,
    category_name: object,
    included_categories: set[str] | None = None,
    excluded_categories: set[str] | None = None,
) -> bool:
    """Decide whether a source category belongs in the combined index.

    OS categories must be in the supported catalog. Overture categories may be
    new, so unlisted categories are included by default. An explicit exclusion
    wins; an explicit include can opt an overlap category back in.
    """
    if category_name is None:
        return True
    category_key = str(category_name)
    catalog = SOURCE_CATEGORY_CATALOG.get(source, {})
    if source == "OS Open Names" and category_key not in catalog:
        return False
    if excluded_categories and category_key in excluded_categories:
        return False
    if included_categories and category_key in included_categories:
        return True
    defaults = SOURCE_CATEGORY_DEFAULTS.get(source, {})
    if source == "Overture Places" and category_key in OVERTURE_OVERLAP_CATEGORIES:
        return False
    return defaults.get(category_key, source == "Overture Places")


def selected_os_records(
    records: list[dict[str, object]],
    included_categories: set[str] | None = None,
    excluded_categories: set[str] | None = None,
) -> list[dict[str, object]]:
    """Keep enabled OS records and label them so users can filter by dataset."""
    return [
        {**record, "SOURCE": "OS Open Names"}
        for record in records
        if include_record_category(
            "OS Open Names",
            record.get("TYPE"),
            included_categories=included_categories,
            excluded_categories=excluded_categories,
        )
    ]


def selected_overture_records(
    records: list[dict[str, object]],
    included_categories: set[str] | None = None,
    excluded_categories: set[str] | None = None,
) -> list[dict[str, object]]:
    """Keep enabled, non-overlapping Overture records and label their source."""
    return [
        {**record, "SOURCE": "Overture Places"}
        for record in records
        if include_record_category(
            "Overture Places",
            record.get("TYPE"),
            included_categories=included_categories,
            excluded_categories=excluded_categories,
        )
    ]


def main() -> int:
    """Load both source releases, apply filters, and write the public combined index.

    The OS archive is reused from the local cache when its release is unchanged.
    Overture records are queried from the selected release and filtered to GB.
    The finished output directory is replaced only after the new index is built.
    """
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--os-download-url", default=OS_OPEN_NAMES_DOWNLOAD_URL)
    parser.add_argument("--os-cache", type=Path, default=Path(__file__).parent.parent / ".os-open-names-cache")
    parser.add_argument("--overture-release", help="Overture release identifier; defaults to the latest STAC release")
    parser.add_argument("--overture-input", help="Parquet file, glob, or URL; defaults to the latest public Overture Places release")
    parser.add_argument("--overture-stac-catalog", default=OVERTURE_STAC_CATALOG)
    parser.add_argument("--minimum-confidence", type=float, default=0.8)
    parser.add_argument("--memory-limit", default="1GB")
    parser.add_argument("--max-os-records", type=int, help="Optional OS Open Names limit for a small test build")
    parser.add_argument("--max-overture-records", type=int, help="Optional Overture Places limit for a small test build")
    parser.add_argument(
        "--include-os-category",
        action="append",
        default=[],
        choices=sorted(SOURCE_CATEGORY_CATALOG["OS Open Names"]),
        help="OS Open Names category to include; may be specified multiple times",
    )
    parser.add_argument(
        "--exclude-os-category",
        action="append",
        default=[],
        choices=sorted(SOURCE_CATEGORY_CATALOG["OS Open Names"]),
        help="OS Open Names category to exclude; may be specified multiple times",
    )
    parser.add_argument(
        "--include-overture-category",
        action="append",
        default=[],
        help="Overture category to include; may be specified multiple times",
    )
    parser.add_argument(
        "--exclude-overture-category",
        action="append",
        default=[],
        help="Overture category to exclude; may be specified multiple times",
    )
    parser.add_argument("--output", type=Path, default=Path(__file__).parent.parent / "build" / "data")
    args = parser.parse_args()
    if not 0 <= args.minimum_confidence <= 1:
        parser.error("--minimum-confidence must be between 0 and 1")
    for option, limit in (("--max-os-records", args.max_os_records), ("--max-overture-records", args.max_overture_records)):
        if limit is not None and limit < 1:
            parser.error(f"{option} must be positive")

    os_release = release_from_redirect(args.os_download_url)
    args.os_cache.mkdir(parents=True, exist_ok=True)
    archive = args.os_cache / "os-open-names.zip"
    release_file = args.os_cache / "release.txt"
    cached_release = release_file.read_text(encoding="utf-8").strip() if release_file.exists() else ""
    if not archive.exists() or cached_release != os_release:
        import requests

        with requests.get(args.os_download_url, stream=True, timeout=60) as response:
            response.raise_for_status()
            with archive.open("wb") as destination:
                for chunk in response.iter_content(chunk_size=1024 * 1024):
                    if chunk:
                        destination.write(chunk)
        release_file.write_text(os_release + "\n", encoding="utf-8")

    overture_release = args.overture_release or latest_release(args.overture_stac_catalog)
    overture_source = args.overture_input or place_assets(overture_release)
    os_included_categories = set(args.include_os_category)
    os_excluded_categories = set(args.exclude_os_category)
    overture_included_categories = set(args.include_overture_category)
    overture_excluded_categories = set(args.exclude_overture_category)

    os_records = selected_os_records(
        read_names(archive, args.max_os_records),
        included_categories=os_included_categories,
        excluded_categories=os_excluded_categories,
    )
    overture_records = selected_overture_records(
        read_places(
            overture_source,
            "GB",
            GB_BOUNDS,
            args.minimum_confidence,
            args.max_overture_records,
            args.memory_limit,
        ),
        included_categories=overture_included_categories,
        excluded_categories=overture_excluded_categories,
    )
    records = os_records + overture_records
    releases = f"OS Open Names {os_release}; Overture Places {overture_release}"
    with tempfile.TemporaryDirectory() as temporary:
        staging = Path(temporary) / "prefixes"
        build(records, staging, releases, "OS Open Names and Overture Places public downloads")
        manifest_path = staging / "index.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["product"] = GB_NAME_INDEX_PRODUCT_NAME
        manifest["attribution"] = {
            "osOpenNames": f"Contains OS data \u00a9 Crown copyright and database rights Ordnance Survey {date.today().year}.",
            "osOpenNamesSource": "https://www.ordnancesurvey.co.uk/products/os-open-names",
            "osOpenNamesLicense": "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
            "overturePlaces": "Overture Maps Foundation, overturemaps.org",
            "overtureLicense": "CDLA-Permissive-2.0 and Apache-2.0, depending on source.",
            "overtureLicenseDetails": "https://docs.overturemaps.org/guides/places/",
            "overtureAttribution": "https://docs.overturemaps.org/attribution/",
        }
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        if args.output.exists():
            shutil.rmtree(args.output)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(staging, args.output)
    print(
        f"Built {args.output}: {len(records)} records "
        f"({len(os_records)} OS Open Names, {len(overture_records)} Overture Places)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())