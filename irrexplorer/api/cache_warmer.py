"""
Cache warming module for IRRExplorer.

Pre-populates cache with popular queries on startup to improve initial response times.
"""

import logging
from typing import List, Optional

from databases import Database

from irrexplorer.api.collectors import PrefixCollector

logger = logging.getLogger(__name__)


# Popular ASNs to warm cache (top transit providers and CDNs)
POPULAR_ASNS = [
    174,  # Cogent
    3356,  # Level3/Lumen
    1299,  # Telia
    6939,  # Hurricane Electric
    7018,  # AT&T
    3257,  # GTT
    2914,  # NTT
    13335,  # Cloudflare
    15169,  # Google
    16509,  # Amazon
    8075,  # Microsoft
    32934,  # Facebook/Meta
]


async def warm_asn_cache(database: Database, asns: Optional[List[int]] = None):
    """
    Warm cache with popular ASN queries.

    Args:
        database: Database connection
        asns: List of ASNs to cache (default: POPULAR_ASNS)
    """
    if asns is None:
        asns = POPULAR_ASNS

    logger.info(f"Warming cache with {len(asns)} popular ASN queries...")

    collector = PrefixCollector(database)
    results = []

    for asn in asns:
        try:
            result = await collector.asn_summary(asn)
            results.append((asn, len(result.direct_origin) if result else 0))
        except Exception as e:
            logger.warning(f"Failed to warm cache for AS{asn}: {e}")

    success_count = sum(1 for _, count in results if count > 0)
    logger.info(
        f"Cache warming complete: {success_count}/{len(asns)} ASNs cached successfully"
    )

    return results


async def warm_cache_on_startup(database: Database):
    """
    Run cache warming in background on application startup.

    Args:
        database: Database connection
    """
    try:
        await warm_asn_cache(database)
    except Exception as e:
        logger.error(f"Cache warming failed: {e}", exc_info=True)
