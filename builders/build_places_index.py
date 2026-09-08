#!/usr/bin/env python3
"""Build a unified Great Britain name index from OS Open Names and Overture Places."""

from __future__ import annotations

import argparse
import json
import shutil
import tempfile
from pathlib import Path

from .build_os_open_names_index import build, read_names, release_from_redirect
from .build_overture_places_index import latest_release, place_assets, read_places
from .config import GB_NAME_INDEX_PRODUCT_NAME, OS_OPEN_NAMES_DOWNLOAD_URL, OVERTURE_OVERLAP_CATEGORIES, OVERTURE_STAC_CATALOG


def selected_os_records(records: list[dict[str, object]]) -> list[dict[str, object]]:
    """Tag OS Open Names records with their source for the unified index."""
    return [{**record, "SOURCE": "OS Open Names"} for record in records]


def selected_overture_records(records: list[dict[str, object]]) -> list[dict[str, object]]:
    """Tag and retain Overture records that do not overlap OS Open Names coverage."""
    return [
        {**record, "SOURCE": "Overture Places"}
        for record in records
        if record.get("TYPE") not in OVERTURE_OVERLAP_CATEGORIES
    ]


def main() -> int:
    """Build the unified index from the selected OS and Overture record sets."""
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
    parser.add_argument("--output", type=Path, default=Path(__file__).parent.parent / "build" / "data" / "names")
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
    os_records = selected_os_records(read_names(archive, args.max_os_records))
    overture_records = selected_overture_records(
        read_places(
            overture_source,
            "GB",
            None,
            args.minimum_confidence,
            args.max_overture_records,
            args.memory_limit,
        )
    )
    records = os_records + overture_records
    releases = f"OS Open Names {os_release}; Overture Places {overture_release}"
    with tempfile.TemporaryDirectory() as temporary:
        staging = Path(temporary) / "prefixes"
        build(records, staging, releases, "OS Open Names and Overture Places public downloads")
        manifest_path = staging / "index.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["product"] = GB_NAME_INDEX_PRODUCT_NAME
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