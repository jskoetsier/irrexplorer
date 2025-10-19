"""
Predictive caching module for IRRExplorer.

Pre-fetches related queries to improve user experience.
"""

import asyncio
import logging
from typing import List, Set

from databases import Database

from irrexplorer.api.collectors import PrefixCollector

logger = logging.getLogger(__name__)


async def prefetch_asn_neighbors(database: Database, asn: int) -> List[int]:
    """
    Prefetch cache for AS neighbors based on BGP relationships.

    This predictively caches related ASNs that are likely to be queried next,
    such as upstream/downstream ASNs.

    Args:
        database: Database connection
        asn: ASN to find neighbors for

    Returns:
        List of neighbor ASNs that were cached
    """
    try:
        collector = PrefixCollector(database)

        # Get the ASN's prefixes to find related ASNs
        asn_summary = await collector.asn_summary(asn)
        if not asn_summary or not asn_summary.direct_origin:
            return []

        # Extract unique ASNs from overlapping prefixes
        neighbor_asns: Set[int] = set()
        for prefix_summary in asn_summary.overlaps[:10]:  # Limit to first 10 overlaps
            # Get ASNs from BGP origins
            for bgp_asn in prefix_summary.bgp_origins:
                if bgp_asn and bgp_asn != asn:
                    neighbor_asns.add(bgp_asn)

        # Pre-fetch up to 5 neighbor ASNs
        cached_asns = []
        for neighbor_asn in list(neighbor_asns)[:5]:
            try:
                # This will cache the result
                await collector.asn_summary(neighbor_asn)
                cached_asns.append(neighbor_asn)
                logger.debug(
                    f"Predictively cached AS{neighbor_asn} (neighbor of AS{asn})"
                )
            except Exception as e:
                logger.warning(f"Failed to predictively cache AS{neighbor_asn}: {e}")

        if cached_asns:
            logger.info(f"Predictively cached {len(cached_asns)} neighbors for AS{asn}")

        return cached_asns

    except Exception as e:
        logger.error(f"Predictive caching failed for AS{asn}: {e}", exc_info=True)
        return []


async def prefetch_prefix_related(database: Database, prefix_str: str) -> List[str]:
    """
    Prefetch cache for related prefixes (parent/child blocks).

    Args:
        database: Database connection
        prefix_str: Prefix string (e.g., "8.8.8.0/24")

    Returns:
        List of related prefixes that were cached
    """
    try:
        from ipaddress import ip_network

        prefix = ip_network(prefix_str)
        collector = PrefixCollector(database)

        cached_prefixes = []

        # Cache parent prefix (less specific)
        if prefix.prefixlen > 8:  # Only if not too broad
            try:
                parent = prefix.supernet(prefixlen_diff=1)
                await collector.prefix_summary(parent)
                cached_prefixes.append(str(parent))
                logger.debug(f"Predictively cached parent {parent} for {prefix}")
            except Exception as e:
                logger.warning(f"Failed to cache parent prefix: {e}")

        # Note: We don't cache child prefixes as there could be too many

        if cached_prefixes:
            logger.info(
                f"Predictively cached {len(cached_prefixes)} related prefixes for {prefix}"
            )

        return cached_prefixes

    except Exception as e:
        logger.error(
            f"Predictive caching failed for prefix {prefix_str}: {e}", exc_info=True
        )
        return []


def schedule_predictive_cache(database: Database, resource_type: str, resource_id: str):
    """
    Schedule predictive caching in the background without blocking.

    Args:
        database: Database connection
        resource_type: Type of resource ("asn" or "prefix")
        resource_id: Resource identifier (ASN number or prefix string)
    """
    try:
        if resource_type == "asn":
            asyncio.create_task(prefetch_asn_neighbors(database, int(resource_id)))
        elif resource_type == "prefix":
            asyncio.create_task(prefetch_prefix_related(database, resource_id))
    except Exception as e:
        logger.error(
            f"Failed to schedule predictive cache for {resource_type} {resource_id}: {e}"
        )
