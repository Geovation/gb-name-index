#!/usr/bin/env python3
"""Download OS Open Names and build a static prefix index."""

from __future__ import annotations

import argparse
import csv
import io
import json
import math
import re
import shutil
import tempfile
import zipfile
from pathlib import Path
from urllib.parse import urlparse

from pyproj import Transformer
import requests

from .config import (
    COORDINATE_DECIMAL_PLACES,
    MAXIMUM_RESULTS_PER_SHARD,
    MAXIMUM_SHARD_BYTES,
    MINIMUM_SHARD_LENGTH,
    OS_OPEN_NAMES_DOWNLOAD_URL,
    OS_OPEN_NAMES_PRODUCT_NAME,
    OS_OPEN_NAMES_TYPE_LABELS,
    RECORD_FIELDS,
    SOURCES,
)

# Coordinate transformation
OSGB36_TO_WGS84 = Transformer.from_crs("EPSG:27700", "EPSG:4326", always_xy=True)


def release_from_redirect(download_url: str) -> str:
    """Return the OS Open Names release identifier from a download redirect."""
    response = requests.get(download_url, allow_redirects=False, timeout=60)
    response.raise_for_status()
    location = response.headers.get("Location")
    response.close()
    if not location:
        raise RuntimeError("The OS Open Names download URL did not redirect to a release archive")
    path = urlparse(location).path.split("/")
    try:
        return path[path.index("OpenNames") + 1]
    except (ValueError, IndexError) as error:
        raise RuntimeError("Could not determine the OS Open Names release from the download redirect") from error


def append_names(
    reader: csv.DictReader,
    columns: dict[str, str],
    records: list[dict[str, object]],
    maximum_records: int | None,
) -> bool:
    """Append CSV records and report whether the optional record limit was reached."""
    for row in reader:
        name = (row.get(columns["NAME1"]) or "").strip()
        if not name:
            continue
        record = {
            key: (row.get(columns[key]) or "").strip()
            for key in ("NAME1", "TYPE", "LOCAL_TYPE", "LOCALITY", "REGION", "COUNTRY")
            if key in columns and row.get(columns[key])
        }
        populated_place = (row.get(columns.get("POPULATED_PLACE", "")) or "").strip()
        if populated_place:
            record["LOCALITY"] = populated_place
        postcode_district = (row.get(columns.get("POSTCODE_DISTRICT", "")) or "").strip()
        if postcode_district:
            record["POSTCODE_DISTRICT"] = postcode_district
        try:
            east = float((row.get(columns.get("GEOMETRY_X", "")) or "").strip())
            north = float((row.get(columns.get("GEOMETRY_Y", "")) or "").strip())
        except ValueError:
            pass
        else:
            longitude, latitude = OSGB36_TO_WGS84.transform(east, north)
            record["LONGITUDE"] = longitude
            record["LATITUDE"] = latitude
        records.append(record)
        if maximum_records is not None and len(records) >= maximum_records:
            return True
    return False


def read_names(archive: Path, maximum_records: int | None = None) -> list[dict[str, object]]:
    """Read OS Open Names records from an archive, optionally stopping at a limit."""
    records: list[dict[str, object]] = []
    with zipfile.ZipFile(archive) as zipped:
        csv_names = [name for name in zipped.namelist() if name.lower().endswith(".csv")]
        if not csv_names:
            raise RuntimeError("The downloaded archive contains no CSV file")
        header_name = next((name for name in csv_names if "header" in Path(name).stem.casefold()), None)
        if header_name:
            with zipped.open(header_name) as stream:
                header = next(csv.reader(io.TextIOWrapper(stream, encoding="utf-8-sig", newline="")), [])
            columns = {column.upper(): column for column in header}
            if "NAME1" not in columns:
                raise RuntimeError("The OS Open Names header CSV does not contain the expected NAME1 column")
            for csv_name in csv_names:
                if not csv_name.lower().startswith("data/"):
                    continue
                with zipped.open(csv_name) as stream:
                    reader = csv.DictReader(
                        io.TextIOWrapper(stream, encoding="utf-8-sig", newline=""),
                        fieldnames=header,
                    )
                    if append_names(reader, columns, records, maximum_records):
                        return records
            return records
        for csv_name in csv_names:
            with zipped.open(csv_name) as stream:
                text = io.TextIOWrapper(stream, encoding="utf-8-sig", newline="")
                reader = csv.DictReader(text)
                columns = {column.upper(): column for column in reader.fieldnames or []}
                if "NAME1" not in columns:
                    continue
                append_names(reader, columns, records, maximum_records)
                return records
    raise RuntimeError("The downloaded archive contains no CSV with the expected NAME1 column")


def normalize_name(value: object) -> str:
    """Return a case-insensitive alphanumeric key for a place name."""
    return re.sub(r"[^a-z0-9]", "", str(value).casefold())


def compact_value(field: str, value: object) -> object:
    """Round geographic coordinates while preserving every other field value."""
    if field in ("LONGITUDE", "LATITUDE") and isinstance(value, (int, float)) and math.isfinite(value):
        return round(value, COORDINATE_DECIMAL_PLACES)
    return value


def display_type_label(source: str, type_name: str) -> str:
    """Return a user-facing label for a source-specific type value."""
    if source == "OS Open Names":
        return OS_OPEN_NAMES_TYPE_LABELS.get(type_name, type_name)
    return type_name.replace("_", " ").title()


def encoded_size(rows: list[list[object | None]]) -> int:
    """Return the UTF-8 byte size of a shard's compact JSON representation."""
    return len(json.dumps(rows, ensure_ascii=True, separators=(",", ":")).encode("utf-8")) + 1


def stable_sort(rows: list[list[object | None]]) -> list[list[object | None]]:
    """Return rows in a deterministic order, including rows with empty values."""
    return sorted(rows, key=lambda row: tuple("" if value is None else str(value) for value in row))


def split_shard(
    prefix: str,
    rows: list[list[object | None]],
    routes: dict[str, str],
    leaves: dict[str, list[list[object | None]]],
    truncated: dict[str, int],
) -> None:
    """Split rows into size-bounded prefix leaves, recording routes and truncation."""
    rows = stable_sort(rows)
    names = {normalize_name(row[0]) for row in rows}
    if len(names) == 1 and len(rows) > MAXIMUM_RESULTS_PER_SHARD:
        name = names.pop()
        if len(prefix) >= len(name):
            leaves[prefix] = rows[:MAXIMUM_RESULTS_PER_SHARD]
            truncated[prefix] = len(rows)
            return
        if prefix != name:
            next_character = name[len(prefix)]
            routes[prefix] = next_character
            split_shard(prefix + next_character, rows, routes, leaves, truncated)
            return
        leaves[prefix] = rows[:MAXIMUM_RESULTS_PER_SHARD]
        if len(rows) > MAXIMUM_RESULTS_PER_SHARD:
            truncated[prefix] = len(rows)
        return

    if encoded_size(rows) <= MAXIMUM_SHARD_BYTES:
        leaves[prefix] = rows
        return

    groups: dict[str, list[list[object | None]]] = {}
    for row in rows:
        name = normalize_name(row[0])
        character = name[len(prefix)] if len(name) > len(prefix) else "_"
        groups.setdefault(character, []).append(row)
    routes[prefix] = "".join(sorted(groups))
    for character, child_rows in groups.items():
        split_shard(prefix + character, child_rows, routes, leaves, truncated)


def build(records: list[dict[str, object]], output: Path, release: str, source_url: str) -> None:
    """Build an adaptive-prefix index and manifest from normalized place records."""
    roots: dict[str, list[list[object | None]]] = {}
    for record in records:
        normalized = normalize_name(record["NAME1"])
        if not normalized:
            continue
        shard = normalized[:MINIMUM_SHARD_LENGTH]
        values = [compact_value(field, record.get(field)) for field in RECORD_FIELDS]
        if values[-1] in SOURCES:
            values[-1] = SOURCES.index(values[-1])
        roots.setdefault(shard, []).append(values)

    output.mkdir(parents=True, exist_ok=True)
    routes: dict[str, str] = {}
    leaves: dict[str, list[list[object | None]]] = {}
    truncated: dict[str, int] = {}
    for shard, values in roots.items():
        split_shard(shard, values, routes, leaves, truncated)
    for shard, values in leaves.items():
        path = output / f"{shard}.json"
        path.write_text(json.dumps(values, ensure_ascii=True, separators=(",", ":")) + "\n", encoding="utf-8")
    manifest = {
        "product": OS_OPEN_NAMES_PRODUCT_NAME,
        "release": release,
        "source": source_url,
        "records": len(records),
        "shards": len(leaves),
        "minimumQueryLength": MINIMUM_SHARD_LENGTH,
        "maxShardBytes": MAXIMUM_SHARD_BYTES,
        "maxResultsPerShard": MAXIMUM_RESULTS_PER_SHARD,
        "routes": routes,
        "truncated": truncated,
        "schema": RECORD_FIELDS,
        "sources": SOURCES,
        "types": sorted({str(record.get("TYPE")) for record in records if record.get("TYPE")}),
        "typesBySource": {
            source: sorted({str(record.get("TYPE")) for record in records if record.get("SOURCE") == source and record.get("TYPE")})
            for source in SOURCES
        },
        "typeLabelsBySource": {
            source: {
                type_name: display_type_label(source, type_name)
                for type_name in sorted({str(record.get("TYPE")) for record in records if record.get("SOURCE") == source and record.get("TYPE")})
            }
            for source in SOURCES
        },
        "coordinatePrecision": COORDINATE_DECIMAL_PLACES,
        "format": "adaptive-prefix-record-arrays-v1",
        "normalization": "casefold; remove non-alphanumeric characters",
    }
    (output / "index.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    """Download OS Open Names if needed and write its static prefix index."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--download-url", default=OS_OPEN_NAMES_DOWNLOAD_URL)
    parser.add_argument("--output", type=Path, default=Path(__file__).parent.parent / "build" / "data" / "os-open-names")
    parser.add_argument("--cache", type=Path, default=Path(__file__).parent.parent / ".os-open-names-cache")
    parser.add_argument("--max-records", type=int, help="Optional limit for a small comparison build")
    args = parser.parse_args()
    if args.max_records is not None and args.max_records < 1:
        parser.error("--max-records must be positive")

    release = release_from_redirect(args.download_url)
    args.cache.mkdir(parents=True, exist_ok=True)
    archive = args.cache / "os-open-names.zip"
    release_file = args.cache / "release.txt"
    cached_release = release_file.read_text(encoding="utf-8").strip() if release_file.exists() else ""
    if not archive.exists() or cached_release != release:
        with requests.get(args.download_url, stream=True, timeout=60) as response:
            response.raise_for_status()
            with archive.open("wb") as destination:
                for chunk in response.iter_content(chunk_size=1024 * 1024):
                    if chunk:
                        destination.write(chunk)
        release_file.write_text(release + "\n", encoding="utf-8")

    with tempfile.TemporaryDirectory() as temporary:
        staging = Path(temporary) / "prefixes"
        build(read_names(archive, args.max_records), staging, release, args.download_url)
        if args.output.exists():
            shutil.rmtree(args.output)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(staging, args.output)
    print(f"Built {args.output} for {OS_OPEN_NAMES_PRODUCT_NAME} release {release}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())