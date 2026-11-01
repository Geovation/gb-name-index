#!/usr/bin/env python3
"""Download OS Open Names and turn its records into a searchable static index."""

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
    OS_OPEN_NAMES_CATEGORY_LABELS,
    RECORD_DICTIONARIES,
    RECORD_FIELDS,
    SOURCE_RECORD_FIELDS,
    SOURCES,
)

# Coordinate transformation
OSGB36_TO_WGS84 = Transformer.from_crs("EPSG:27700", "EPSG:4326", always_xy=True)


def release_from_redirect(download_url: str) -> str:
    """Read the OS release name from the archive URL returned by its download endpoint."""
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
    """Add named CSV rows as index records, converting valid grid coordinates to WGS 84.

    Return True as soon as `maximum_records` is reached so callers can stop reading
    a large archive early. Return False when the CSV ends before that limit.
    """
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
    """Read OS records from the downloaded ZIP, including both supported CSV layouts.

    OS archives may provide a separate header CSV or repeat the header in each
    data file. `maximum_records` is intended for small local builds and tests.
    """
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
    """Make a name suitable for prefix routing by removing case and punctuation differences."""
    return re.sub(r"[^a-z0-9]", "", str(value).casefold())


def compact_value(field: str, value: object) -> object:
    """Round coordinates to the published precision while leaving other values unchanged."""
    if field in ("longitude", "latitude") and isinstance(value, (int, float)) and math.isfinite(value):
        return round(value, COORDINATE_DECIMAL_PLACES)
    if field == "bbox" and isinstance(value, list) and len(value) == 4:
        return [
            round(coordinate, COORDINATE_DECIMAL_PLACES)
            if isinstance(coordinate, (int, float)) and math.isfinite(coordinate)
            else coordinate
            for coordinate in value
        ]
    return value


def display_category_label(source: str, category_name: str) -> str:
    """Show a readable category name instead of a source's raw identifier."""
    if source == "OS Open Names":
        return OS_OPEN_NAMES_CATEGORY_LABELS.get(category_name, category_name)
    return category_name.replace("_", " ").title()


def encoded_size(rows: list[list[object | None]]) -> int:
    """Measure the exact compact JSON file size used to decide whether a shard must split."""
    return len(json.dumps(rows, ensure_ascii=True, separators=(",", ":")).encode("utf-8")) + 1


def stable_sort(rows: list[list[object | None]]) -> list[list[object | None]]:
    """Put rows in a repeatable order so the same source data produces stable files."""
    return sorted(rows, key=lambda row: tuple("" if value is None else str(value) for value in row))


def split_shard(
    prefix: str,
    rows: list[list[object | None]],
    routes: dict[str, str],
    leaves: dict[str, list[list[object | None]]],
    truncated: dict[str, int],
) -> None:
    """Write small groups as leaf shards and split large groups into longer prefixes.

    `routes` records which next characters lead to child groups. If too many
    records share one exact name to split further, keep the configured shortlist
    and record the full count in `truncated`.
    """
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
    """Write compact shards and the manifest that explains how to search them.

    Each input record is encoded in the order listed by `RECORD_FIELDS`; the
    manifest includes source/type filters and the routing table used by the client.
    """
    roots: dict[str, list[list[object | None]]] = {}
    source_fields = dict(zip(RECORD_FIELDS, SOURCE_RECORD_FIELDS))
    dictionaries = {}
    for field in RECORD_DICTIONARIES:
        values = {
            str(value)
            for record in records
            if (value := record.get(source_fields[field], record.get(field))) not in (None, "")
        }
        if field == "source":
            values.update(SOURCES)
        dictionaries[field] = sorted(values)
    dictionary_indexes = {
        field: {value: index for index, value in enumerate(values)}
        for field, values in dictionaries.items()
    }
    for record in records:
        name = record.get(source_fields["name"], record.get("name", ""))
        normalized = normalize_name(name)
        if not normalized:
            continue
        shard = normalized[:MINIMUM_SHARD_LENGTH]
        values = []
        for field in RECORD_FIELDS:
            value = compact_value(
                field,
                record.get(source_fields[field], record.get(field)),
            )
            if field in dictionary_indexes and value not in (None, ""):
                value = dictionary_indexes[field][str(value)]
            values.append(value)
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
        "categories": dictionaries["category"],
        "subtypes": dictionaries["subtype"],
        "localities": dictionaries["locality"],
        "postcodeDistricts": dictionaries["postcodeDistrict"],
        "regions": dictionaries["region"],
        "sources": dictionaries["source"],
        "categoriesBySource": {
            source: sorted({str(record.get("TYPE")) for record in records if record.get("SOURCE") == source and record.get("TYPE")})
            for source in SOURCES
        },
        "categoryLabelsBySource": {
            source: {
                category_name: display_category_label(source, category_name)
                for category_name in sorted({str(record.get("TYPE")) for record in records if record.get("SOURCE") == source and record.get("TYPE")})
            }
            for source in SOURCES
        },
        "coordinatePrecision": COORDINATE_DECIMAL_PLACES,
        "format": "adaptive-prefix-record-arrays-v4",
        "normalization": "casefold; remove non-alphanumeric characters",
    }
    (output / "index.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    """Download or reuse the current OS archive, then build an OS-only index.

    Use `--max-records` for a small test output; normal builds read the complete
    source archive and replace the selected output directory.
    """
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