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

# Catalog of every category each source can contribute.
# This is the pick-and-mix list: the caller chooses which categories to include,
# while the default values below establish the shipping defaults.
SOURCE_TYPE_CATALOG = {
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

# Defaults for the shipping build. Set a value to False to exclude a category
# even when it is available from the source.
SOURCE_TYPE_DEFAULTS = {
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

# Separate policy for source overlap: these are categories that are already
# supplied by OS Open Names and should be excluded from Overture even when the
# Overture type is otherwise enabled by the defaults.
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
