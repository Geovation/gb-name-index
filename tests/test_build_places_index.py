import json
import tempfile
import unittest
from pathlib import Path

from builders.build_os_open_names_index import build
from builders.build_places_index import include_record_category, selected_os_records, selected_overture_records


class BuildPlacesIndexTests(unittest.TestCase):
    def test_category_defaults_and_overrides(self):
        self.assertTrue(include_record_category("OS Open Names", "populatedPlace"))
        self.assertFalse(include_record_category("OS Open Names", "not-a-category"))
        self.assertFalse(
            include_record_category(
                "OS Open Names",
                "populatedPlace",
                included_categories={"populatedPlace"},
                excluded_categories={"populatedPlace"},
            )
        )

    def test_source_selection_tags_records_and_respects_overlap_policy(self):
        os_records = selected_os_records([{"NAME1": "Bath", "TYPE": "populatedPlace"}])
        overture_records = selected_overture_records(
            [
                {"NAME1": "Independent Cafe", "TYPE": "cafe"},
                {"NAME1": "Park", "TYPE": "park"},
            ]
        )

        self.assertEqual(os_records[0]["SOURCE"], "OS Open Names")
        self.assertEqual([record["NAME1"] for record in overture_records], ["Independent Cafe"])
        self.assertEqual(overture_records[0]["SOURCE"], "Overture Places")
        self.assertFalse(include_record_category("Overture Places", "park"))
        self.assertTrue(
            include_record_category(
                "Overture Places",
                "park",
                included_categories={"park"},
            )
        )
        self.assertTrue(include_record_category("Overture Places", "artist_studio"))

    def test_build_writes_routable_manifest_and_source_labels(self):
        records = [
            {
                "NAME1": "Baker Street",
                "TYPE": "transportNetwork",
                "LOCAL_TYPE": "Named Road",
                "LOCALITY": "Exampleton",
                "REGION": "Example Region",
                "SOURCE": "OS Open Names",
            },
            {
                "NAME1": "Baker Park",
                "TYPE": "park",
                "LOCAL_TYPE": "Garden",
                "LOCALITY": "Exampleton",
                "REGION": "Example Region",
                "SOURCE": "Overture Places",
                "bbox": [-0.123456, 51.234567, -0.12, 51.24],
            },
        ]
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary)
            build(records, output, "test-release", "test-source")
            manifest = json.loads((output / "index.json").read_text(encoding="utf-8"))
            shard_rows = json.loads((output / "bak.json").read_text(encoding="utf-8"))

        self.assertEqual(manifest["shards"], 1)
        self.assertEqual(
            manifest["schema"],
            ["name", "category", "subtype", "locality", "postcodeDistrict", "region", "longitude", "latitude", "bbox", "source"],
        )
        rows_by_name = {row[0]: row for row in shard_rows}
        self.assertIsNone(rows_by_name["Baker Street"][8])
        self.assertEqual(rows_by_name["Baker Park"][8], [-0.12346, 51.23457, -0.12, 51.24])
        self.assertEqual(manifest["categories"][rows_by_name["Baker Park"][1]], "park")
        self.assertEqual(manifest["subtypes"][rows_by_name["Baker Park"][2]], "Garden")
        self.assertEqual(manifest["localities"][rows_by_name["Baker Park"][3]], "Exampleton")
        self.assertEqual(manifest["regions"][rows_by_name["Baker Park"][5]], "Example Region")
        self.assertEqual(manifest["sources"][rows_by_name["Baker Park"][9]], "Overture Places")
        self.assertEqual(manifest["categoryLabelsBySource"]["OS Open Names"]["transportNetwork"], "Roads and transport")
        self.assertEqual(manifest["categoryLabelsBySource"]["Overture Places"]["park"], "Park")


if __name__ == "__main__":
    unittest.main()