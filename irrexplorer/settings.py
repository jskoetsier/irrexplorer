from ipaddress import IPv4Network, IPv6Network
from typing import Tuple, Union

import databases
from irrexplorer.state import RIR
from starlette.config import Config

config = Config(".env")

DEBUG = config("DEBUG", cast=bool, default=False)
TESTING = config("TESTING", cast=bool, default=False)

# CORS Configuration
ALLOWED_ORIGINS = ["*"] if DEBUG else config("ALLOWED_ORIGINS", default="").split(",")

HTTP_PORT = config("HTTP_PORT", cast=int, default=8000)
HTTP_WORKERS = config("HTTP_WORKERS", cast=int, default=4)

# BGP Data Sources
BGP_SOURCE = config("BGP_SOURCE", default="https://bgp.tools/table.jsonl")
BGP_SOURCES = [
    BGP_SOURCE,
    config(
        "BGP_SOURCE_SECONDARY", default="https://stat.ripe.net/data/bgp-state/data.json"
    ),
]
BGP_SOURCE_MINIMUM_HITS = config("BGP_SOURCE_MINIMUM_HITS", default=20, cast=int)

# Additional IRR Sources
ADDITIONAL_IRR_SOURCES = config(
    "ADDITIONAL_IRR_SOURCES",
    default="RADB,ALTDB,BELL,LEVEL3,RGNET,APNIC,JPIRR,ARIN,BBOI,NTTCOM",
).split(",")

# Looking Glass Configuration
LOOKING_GLASS_URL = config("LOOKING_GLASS_URL", default="https://lg.ring.nlnog.net")

# RDAP Configuration
RDAP_TIMEOUT = config("RDAP_TIMEOUT", cast=int, default=30)

# PeeringDB Configuration
PEERINGDB_TIMEOUT = config("PEERINGDB_TIMEOUT", cast=int, default=30)

DATABASE_URL = config("DATABASE_URL", cast=databases.DatabaseURL)

if TESTING:
    DATABASE_URL = DATABASE_URL.replace(database="test_" + DATABASE_URL.database)
else:  # pragma: no cover
    # IRRD_ENDPOINT is read at connection time to allow tests to change it,
    # load it here if not testing to trigger an error earlier if it's missing.
    try:
        config("IRRD_ENDPOINT")
    except KeyError:
        # In CI/CD environments, IRRD_ENDPOINT may not be required for migrations
        pass

RIRSTATS_URL = {
    RIR.RIPENCC: config(
        key="RIRSTATS_URL_RIPENCC",
        default="https://ftp.ripe.net/ripe/stats/delegated-ripencc-latest",
    ),
    RIR.ARIN: config(
        key="RIRSTATS_URL_ARIN",
        default="https://ftp.arin.net/pub/stats/arin/delegated-arin-extended-latest",
    ),
    RIR.AFRINIC: config(
        key="RIRSTATS_URL_AFRINIC",
        default="https://ftp.afrinic.net/pub/stats/afrinic/delegated-afrinic-latest",
    ),
    RIR.LACNIC: config(
        key="RIRSTATS_URL_LACNIC",
        default="https://ftp.lacnic.net/pub/stats/lacnic/delegated-lacnic-latest",
    ),
    RIR.APNIC: config(
        key="RIRSTATS_URL_APNIC",
        default="https://ftp.apnic.net/stats/apnic/delegated-apnic-latest",
    ),
}
REGISTROBR_URL = "https://ftp.registro.br/pub/numeracao/origin/nicbr-asn-blk-latest.txt"

BGP_IPV4_LENGTH_CUTOFF = config("BGP_IPV4_LENGTH_CUTOFF", cast=int, default=29)
BGP_IPV6_LENGTH_CUTOFF = config("BGP_IPV6_LENGTH_CUTOFF", cast=int, default=124)

MINIMUM_PREFIX_SIZE = {
    4: config("MINIMUM_PREFIX_SIZE_IPV4", cast=int, default=9),
    6: config("MINIMUM_PREFIX_SIZE_IPV6", cast=int, default=29),
}

SPECIAL_USE_SPACE: Tuple[Tuple[str, Union[IPv4Network, IPv6Network]], ...] = (
    ("RFC1122", IPv4Network("0.0.0.0/8")),
    ("RFC1918", IPv4Network("10.0.0.0/8")),
    ("RFC6598", IPv4Network("100.64.0.0/10")),
    ("LOOPBACK", IPv4Network("127.0.0.0/8")),
    ("RFC1918", IPv4Network("172.16.0.0/12")),
    ("RFC5736", IPv4Network("192.0.0.0/24")),
    ("RFC1918", IPv4Network("192.168.0.0/16")),
    ("RFC3927", IPv4Network("169.254.0.0/16")),
    ("RFC5737", IPv4Network("192.0.2.0/24")),
    ("RFC2544", IPv4Network("198.18.0.0/15")),
    ("RFC5737", IPv4Network("198.51.100.0/24")),
    ("RFC5737", IPv4Network("203.0.113.0/24")),
    ("CLASS-E", IPv4Network("240.0.0.0/4")),
    ("IPv4-mapped", IPv6Network("::ffff:0:0/96")),
    ("IPv4-compatible", IPv6Network("::/96")),
    ("IPv6-ULA", IPv6Network("fc00::/7")),
)
