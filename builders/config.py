"""Configuration for GB Name Index builders."""

# Product names
OS_OPEN_NAMES_PRODUCT_NAME = "OS Open Names"
OVERTURE_PLACES_PRODUCT_NAME = "Overture Places"
GB_NAME_INDEX_PRODUCT_NAME = "Great Britain Name Index"

# Data sources
OS_OPEN_NAMES_DOWNLOAD_URL = "https://api.os.uk/downloads/v1/products/OpenNames/downloads?area=GB&format=CSV&redirect"
OVERTURE_STAC_CATALOG = "https://stac.overturemaps.org/catalog.json"
OVERTURE_PLACE_COLLECTION_URL = "https://stac.overturemaps.org/{release}/places/place/collection.json"

# Index tuning
MINIMUM_SHARD_LENGTH = 3
MAXIMUM_SHARD_BYTES = 64 * 1024
MAXIMUM_RESULTS_PER_SHARD = 50
COORDINATE_DECIMAL_PLACES = 5

# Record schema
RECORD_FIELDS = ("NAME1", "TYPE", "LOCAL_TYPE", "LOCALITY", "POSTCODE_DISTRICT", "REGION", "LONGITUDE", "LATITUDE", "SOURCE")
SOURCES = ("OS Open Names", "Overture Places")

# Type labels for OS Open Names
OS_OPEN_NAMES_TYPE_LABELS = {
    "hydrography": "Water features",
    "landcover": "Land cover",
    "landform": "Landforms",
    "other": "Other named features",
    "populatedPlace": "Settlements and localities",
    "transportNetwork": "Roads, postcodes and transport",
}

# Overture categories that overlap with OS Open Names (to exclude from Overture)
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
