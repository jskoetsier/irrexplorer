"""
BGP Looking Glass backend integration.

Provides BGP routing information via looking glass servers.
Uses the lg.ring.nlnog.net API for route queries.
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional

import aiohttp

logger = logging.getLogger(__name__)


class LookingGlassClient:
    """Client for BGP Looking Glass queries."""

    def __init__(self, base_url: str = "https://lg.ring.nlnog.net"):
        """
        Initialize Looking Glass client.

        Args:
            base_url: Base URL for the looking glass API
        """
        self.base_url = base_url.rstrip("/")
        self.timeout = aiohttp.ClientTimeout(total=30)

    async def query_prefix(self, prefix: str) -> Dict[str, Any]:
        """
        Query BGP routes for a specific prefix.

        Args:
            prefix: IP prefix to query (e.g., '192.0.2.0/24')

        Returns:
            Dictionary with routing information
        """
        try:
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                url = f"{self.base_url}/api/v1/prefix/{prefix}"
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        return self._parse_prefix_response(data)
                    elif response.status == 404:
                        return {"prefix": prefix, "routes": [], "error": "Not found"}
                    else:
                        logger.error(f"Looking glass API error: {response.status}")
                        return {
                            "prefix": prefix,
                            "routes": [],
                            "error": f"API error: {response.status}",
                        }
        except asyncio.TimeoutError:
            logger.error(f"Timeout querying looking glass for prefix {prefix}")
            return {"prefix": prefix, "routes": [], "error": "Query timeout"}
        except Exception as e:
            logger.error(
                f"Error querying looking glass for prefix {prefix}: {e}",
                exc_info=True,
            )
            return {"prefix": prefix, "routes": [], "error": str(e)}

    async def query_asn(self, asn: int) -> Dict[str, Any]:
        """
        Query BGP routes for a specific ASN.

        Args:
            asn: Autonomous System Number

        Returns:
            Dictionary with ASN routing information
        """
        try:
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                url = f"{self.base_url}/api/v1/asn/{asn}"
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        return self._parse_asn_response(data, asn)
                    elif response.status == 404:
                        return {
                            "asn": asn,
                            "prefixes": [],
                            "error": "Not found",
                        }
                    else:
                        logger.error(f"Looking glass API error: {response.status}")
                        return {
                            "asn": asn,
                            "prefixes": [],
                            "error": f"API error: {response.status}",
                        }
        except asyncio.TimeoutError:
            logger.error(f"Timeout querying looking glass for ASN {asn}")
            return {"asn": asn, "prefixes": [], "error": "Query timeout"}
        except Exception as e:
            logger.error(
                f"Error querying looking glass for ASN {asn}: {e}", exc_info=True
            )
            return {"asn": asn, "prefixes": [], "error": str(e)}

    async def query_bgp_route(
        self, prefix: str, peer: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Query detailed BGP route information.

        Args:
            prefix: IP prefix to query
            peer: Optional specific peer to query

        Returns:
            Dictionary with detailed route information
        """
        try:
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                url = f"{self.base_url}/api/v1/route/{prefix}"
                if peer:
                    url += f"?peer={peer}"

                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        return self._parse_route_response(data)
                    elif response.status == 404:
                        return {
                            "prefix": prefix,
                            "peer": peer,
                            "route": None,
                            "error": "Not found",
                        }
                    else:
                        logger.error(f"Looking glass API error: {response.status}")
                        return {
                            "prefix": prefix,
                            "peer": peer,
                            "route": None,
                            "error": f"API error: {response.status}",
                        }
        except asyncio.TimeoutError:
            logger.error(f"Timeout querying BGP route for {prefix}")
            return {
                "prefix": prefix,
                "peer": peer,
                "route": None,
                "error": "Query timeout",
            }
        except Exception as e:
            logger.error(f"Error querying BGP route for {prefix}: {e}", exc_info=True)
            return {
                "prefix": prefix,
                "peer": peer,
                "route": None,
                "error": str(e),
            }

    async def get_peers(self) -> List[Dict[str, Any]]:
        """
        Get list of available BGP peers.

        Returns:
            List of peer information dictionaries
        """
        try:
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                url = f"{self.base_url}/api/v1/peers"
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get("peers", [])
                    else:
                        logger.error(f"Looking glass API error: {response.status}")
                        return []
        except Exception as e:
            logger.error(f"Error fetching peers: {e}", exc_info=True)
            return []

    def _parse_prefix_response(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Parse prefix query response."""
        routes = []
        for route in data.get("routes", []):
            routes.append(
                {
                    "prefix": route.get("prefix"),
                    "as_path": route.get("as_path", []),
                    "origin_asn": (
                        route.get("as_path", [])[-1] if route.get("as_path") else None
                    ),
                    "next_hop": route.get("next_hop"),
                    "peer": route.get("peer"),
                    "communities": route.get("communities", []),
                    "local_pref": route.get("local_pref"),
                    "med": route.get("med"),
                }
            )

        return {
            "prefix": data.get("prefix"),
            "routes": routes,
            "total_routes": len(routes),
        }

    def _parse_asn_response(self, data: Dict[str, Any], asn: int) -> Dict[str, Any]:
        """Parse ASN query response."""
        prefixes = []
        for prefix_data in data.get("prefixes", []):
            prefixes.append(
                {
                    "prefix": prefix_data.get("prefix"),
                    "origin": prefix_data.get("origin"),
                    "peers": prefix_data.get("peers", []),
                }
            )

        return {
            "asn": asn,
            "prefixes": prefixes,
            "total_prefixes": len(prefixes),
            "as_name": data.get("as_name"),
        }

    def _parse_route_response(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Parse detailed route query response."""
        route = data.get("route")
        if not route:
            return {"route": None}

        return {
            "prefix": route.get("prefix"),
            "as_path": route.get("as_path", []),
            "origin_asn": (
                route.get("as_path", [])[-1] if route.get("as_path") else None
            ),
            "next_hop": route.get("next_hop"),
            "peer": route.get("peer"),
            "communities": route.get("communities", []),
            "local_pref": route.get("local_pref"),
            "med": route.get("med"),
            "atomic_aggregate": route.get("atomic_aggregate", False),
            "aggregator": route.get("aggregator"),
            "originator_id": route.get("originator_id"),
            "cluster_list": route.get("cluster_list", []),
        }


# Global client instance
_looking_glass_client: Optional[LookingGlassClient] = None


def get_looking_glass_client() -> LookingGlassClient:
    """Get or create the global looking glass client instance."""
    global _looking_glass_client
    if _looking_glass_client is None:
        _looking_glass_client = LookingGlassClient()
    return _looking_glass_client
