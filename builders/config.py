"""Shared source names, record fields, and build rules for the index builders."""

# Names used in generated manifests and source filters.
OS_OPEN_NAMES_PRODUCT_NAME = "OS Open Names"
OVERTURE_PLACES_PRODUCT_NAME = "Overture Places"
GB_NAME_INDEX_PRODUCT_NAME = "Great Britain Name Index"

# Public endpoints used to discover source releases and downloads.
OS_OPEN_NAMES_DOWNLOAD_URL = "https://api.os.uk/downloads/v1/products/OpenNames/downloads?area=GB&format=CSV&redirect"
OVERTURE_STAC_CATALOG = "https://stac.overturemaps.org/catalog.json"
OVERTURE_PLACE_COLLECTION_URL = "https://stac.overturemaps.org/{release}/places/place/collection.json"

# Coarse GB envelope to prune remote Overture row groups before the exact country filter.
GB_BOUNDS = (-9.0, 49.0, 2.0, 61.0)

# Keep ordinary files small enough for quick prefix searches.
MINIMUM_SHARD_LENGTH = 3
MAXIMUM_SHARD_BYTES = 64 * 1024
MAXIMUM_RESULTS_PER_SHARD = 50
COORDINATE_DECIMAL_PLACES = 5

# User-facing names and their source-builder keys, in compact-row order.
RECORD_FIELDS = ("name", "category", "subtype", "locality", "postcodeDistrict", "region", "longitude", "latitude", "bbox", "source")
SOURCE_RECORD_FIELDS = ("NAME1", "TYPE", "LOCAL_TYPE", "LOCALITY", "POSTCODE_DISTRICT", "REGION", "LONGITUDE", "LATITUDE", "bbox", "SOURCE")
RECORD_DICTIONARIES = {
    "category": "categories",
    "subtype": "subtypes",
    "locality": "localities",
    "postcodeDistrict": "postcodeDistricts",
    "region": "regions",
    "source": "sources",
}
SOURCES = ("OS Open Names", "Overture Places")

# OS categories are exhaustive. Overture labels cover common basic categories;
# newly introduced Overture categories are accepted by the builder by default.
SOURCE_CATEGORY_CATALOG = {
    "OS Open Names": {
        "hydrography": "Water features",
        "landcover": "Land cover",
        "landform": "Landforms",
        "other": "Other named features",
        "populatedPlace": "Settlements and localities",
        "postcode": "Postcodes",
        "transportNetwork": "Roads and transport",
    },
    "Overture Places": {
        "airport": "Airport",
        "beach": "Beach",
        "bridge": "Bridge",
        "canal": "Canal",
        "castle": "Castle",
        "cemetery": "Cemetery",
        "forest": "Forest",
        "garden": "Garden",
        "historic_site": "Historic site",
        "island": "Island",
        "lake": "Lake",
        "land_feature": "Land feature",
        "marina": "Marina",
        "monument": "Monument",
        "mountain": "Mountain",
        "national_park": "National park",
        "nature_reserve": "Nature reserve",
        "park": "Park",
        "pier": "Pier",
        "public_fountain": "Public fountain",
        "public_plaza": "Public plaza",
        "rail_facility_or_service": "Rail facility or service",
        "recreational_trail_or_path": "Recreational trail or path",
        "river": "River",
        "train_station": "Train station",
        "waterfall": "Waterfall",
    },
}

OS_OPEN_NAMES_CATEGORY_LABELS = SOURCE_CATEGORY_CATALOG["OS Open Names"]

# Categories set to False are left out of the default combined build.
SOURCE_CATEGORY_DEFAULTS = {
    "OS Open Names": {
        "hydrography": True,
        "landcover": True,
        "landform": True,
        "other": True,
        "populatedPlace": True,
        "postcode": True,
        "transportNetwork": True,
    },
    "Overture Places": {
        "airport": True,
        "beach": True,
        "bridge": True,
        "canal": True,
        "castle": True,
        "cemetery": True,
        "forest": True,
        "garden": True,
        "historic_site": True,
        "island": True,
        "lake": True,
        "land_feature": True,
        "marina": True,
        "monument": True,
        "mountain": True,
        "national_park": True,
        "nature_reserve": True,
        "park": True,
        "pier": True,
        "public_fountain": True,
        "public_plaza": True,
        "rail_facility_or_service": True,
        "recreational_trail_or_path": True,
        "river": True,
        "train_station": True,
        "waterfall": True,
    },
}

# Overture categories already covered by OS Open Names. They are skipped unless
# the build explicitly includes that type.
OVERTURE_OVERLAP_CATEGORIES = {
    "air_transport_facility_or_service",
    "airport",
    "beach",
    "bridge",
    "canal",
    "castle",
    "cemetery",
    "ferry_service",
    "forest",
    "garden",
    "ground_transport_facility_or_service",
    "historic_site",
    "island",
    "lake",
    "land_feature",
    "lighthouse",
    "marina",
    "memorial_site",
    "monument",
    "mountain",
    "national_park",
    "nature_reserve",
    "park",
    "park_and_ride",
    "pier",
    "public_fountain",
    "public_plaza",
    "public_transit_facility_or_service",
    "rail_facility_or_service",
    "recreational_trail_or_path",
    "river",
    "train_station",
    "waterfall",
}
