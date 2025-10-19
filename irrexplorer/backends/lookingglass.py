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
    """Client for NLNOG BGP Looking Glass queries."""

    def __init__(self, base_url: str = "https://lg.ring.nlnog.net"):
        """
        Initialize Looking Glass client.

        Args:
            base_url: Base URL for the looking glass (default: NLNOG Ring)
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
                # NLNOG API uses query parameters
                url = f"{self.base_url}/api/prefix?q={prefix}&all=all"
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        return self._parse_prefix_response(data, prefix)
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

        Note: NLNOG LG doesn't have a direct ASN endpoint, so we return
        a message indicating limited support.

        Args:
            asn: Autonomous System Number

        Returns:
            Dictionary with ASN information
        """
        return {
            "asn": asn,
            "prefixes": [],
            "total_prefixes": 0,
            "as_name": None,
            "error": "ASN queries not supported by NLNOG Looking Glass. Use prefix queries instead.",
        }

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

    def _parse_prefix_response(
        self, data: Dict[str, Any], prefix: str
    ) -> Dict[str, Any]:
        """Parse prefix query response from NLNOG Looking Glass API."""
        routes = []

        # NLNOG API returns routes keyed by prefix
        routes_data = data.get("routes", {})
        for prefix_key, route_list in routes_data.items():
            for route in route_list:
                # Extract AS path from aspath field
                as_path = []
                if "aspath" in route and isinstance(route["aspath"], list):
                    as_path = [
                        asn[0] if isinstance(asn, list) else str(asn)
                        for asn in route["aspath"]
                    ]

                # Extract communities
                communities = []
                if "communities" in route and isinstance(route["communities"], list):
                    communities = [
                        comm[0] if isinstance(comm, list) else str(comm)
                        for comm in route["communities"]
                    ]

                routes.append(
                    {
                        "prefix": prefix_key,
                        "as_path": as_path,
                        "origin_asn": as_path[-1] if as_path else None,
                        "next_hop": route.get("exit_nexthop"),
                        "peer": route.get("ip"),
                        "communities": communities,
                        "local_pref": route.get("local_prf"),
                        "med": route.get("med"),
                    }
                )

        return {
            "prefix": prefix,
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
