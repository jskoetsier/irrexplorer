"""
PeeringDB backend integration.

Provides peering and interconnection data from PeeringDB.
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional

import aiohttp

logger = logging.getLogger(__name__)


class PeeringDBClient:
    """Client for PeeringDB API queries."""

    API_BASE_URL = "https://api.peeringdb.com/api"

    def __init__(self, timeout: int = 30):
        """
        Initialize PeeringDB client.

        Args:
            timeout: Request timeout in seconds
        """
        self.timeout = aiohttp.ClientTimeout(total=timeout)

    async def query_asn(self, asn: int) -> Dict[str, Any]:
        """
        Query PeeringDB for ASN information.

        Args:
            asn: Autonomous System Number

        Returns:
            Dictionary with network and peering information
        """
        try:
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                url = f"{self.API_BASE_URL}/net?asn={asn}"
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        networks = data.get("data", [])
                        if networks:
                            return await self._enrich_network_data(networks[0], session)
                        return {"asn": asn, "error": "Not found"}
                    else:
                        return {
                            "asn": asn,
                            "error": f"API error: {response.status}",
                        }
        except asyncio.TimeoutError:
            logger.error(f"Timeout querying PeeringDB for ASN {asn}")
            return {"asn": asn, "error": "Query timeout"}
        except Exception as e:
            logger.error(f"Error querying PeeringDB for ASN {asn}: {e}")
            return {"asn": asn, "error": str(e)}

    async def query_facility(self, facility_id: int) -> Dict[str, Any]:
        """
        Query PeeringDB for facility information.

        Args:
            facility_id: Facility ID

        Returns:
            Dictionary with facility information
        """
        try:
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                url = f"{self.API_BASE_URL}/fac/{facility_id}"
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        facilities = data.get("data", [])
                        if facilities:
                            return self._parse_facility(facilities[0])
                        return {"facility_id": facility_id, "error": "Not found"}
                    else:
                        return {
                            "facility_id": facility_id,
                            "error": f"API error: {response.status}",
                        }
        except Exception as e:
            logger.error(f"Error querying PeeringDB for facility {facility_id}: {e}")
            return {"facility_id": facility_id, "error": str(e)}

    async def query_ix(self, ix_id: int) -> Dict[str, Any]:
        """
        Query PeeringDB for Internet Exchange information.

        Args:
            ix_id: Exchange ID

        Returns:
            Dictionary with IX information
        """
        try:
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                url = f"{self.API_BASE_URL}/ix/{ix_id}"
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        ixs = data.get("data", [])
                        if ixs:
                            return self._parse_ix(ixs[0])
                        return {"ix_id": ix_id, "error": "Not found"}
                    else:
                        return {
                            "ix_id": ix_id,
                            "error": f"API error: {response.status}",
                        }
        except Exception as e:
            logger.error(f"Error querying PeeringDB for IX {ix_id}: {e}")
            return {"ix_id": ix_id, "error": str(e)}

    async def search_networks(self, query: str) -> List[Dict[str, Any]]:
        """
        Search for networks by name or other criteria.

        Args:
            query: Search query string

        Returns:
            List of matching networks
        """
        try:
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                url = f"{self.API_BASE_URL}/net?name__contains={query}"
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        networks = data.get("data", [])
                        return [self._parse_network_basic(net) for net in networks[:20]]
                    return []
        except Exception as e:
            logger.error(f"Error searching PeeringDB networks: {e}")
            return []

    async def _enrich_network_data(
        self, network: Dict[str, Any], session: aiohttp.ClientSession
    ) -> Dict[str, Any]:
        """Enrich network data with additional PeeringDB information."""
        net_id = network.get("id")

        if not net_id:
            # Return basic network data if no ID
            return self._parse_network_basic(network)

        # Fetch additional data in parallel
        facilities_task = self._fetch_network_facilities(net_id, session)
        ix_connections_task = self._fetch_network_ix_connections(net_id, session)

        facilities, ix_connections = await asyncio.gather(
            facilities_task, ix_connections_task, return_exceptions=True
        )

        # Handle exceptions from gather
        if isinstance(facilities, Exception):
            facilities = []
        if isinstance(ix_connections, Exception):
            ix_connections = []

        return {
            "asn": network.get("asn"),
            "name": network.get("name"),
            "aka": network.get("aka"),
            "website": network.get("website"),
            "looking_glass": network.get("looking_glass"),
            "route_server": network.get("route_server"),
            "irr_as_set": network.get("irr_as_set"),
            "info_type": network.get("info_type"),
            "info_scope": network.get("info_scope"),
            "info_prefixes4": network.get("info_prefixes4"),
            "info_prefixes6": network.get("info_prefixes6"),
            "info_traffic": network.get("info_traffic"),
            "info_ratio": network.get("info_ratio"),
            "info_unicast": network.get("info_unicast"),
            "info_multicast": network.get("info_multicast"),
            "info_ipv6": network.get("info_ipv6"),
            "info_never_via_route_servers": network.get("info_never_via_route_servers"),
            "policy_general": network.get("policy_general"),
            "policy_locations": network.get("policy_locations"),
            "policy_ratio": network.get("policy_ratio"),
            "policy_contracts": network.get("policy_contracts"),
            "facilities": facilities,
            "ix_connections": ix_connections,
            "notes": network.get("notes"),
            "created": network.get("created"),
            "updated": network.get("updated"),
        }

    async def _fetch_network_facilities(
        self, net_id: int, session: aiohttp.ClientSession
    ) -> List[Dict[str, Any]]:
        """Fetch facilities for a network."""
        try:
            url = f"{self.API_BASE_URL}/netfac?net_id={net_id}"
            async with session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    return [
                        {
                            "facility_id": fac.get("fac_id"),
                            "name": fac.get("name"),
                            "city": fac.get("city"),
                            "country": fac.get("country"),
                        }
                        for fac in data.get("data", [])
                    ]
        except Exception as e:
            logger.error(f"Error fetching facilities for network {net_id}: {e}")
        return []

    async def _fetch_network_ix_connections(
        self, net_id: int, session: aiohttp.ClientSession
    ) -> List[Dict[str, Any]]:
        """Fetch IX connections for a network."""
        try:
            url = f"{self.API_BASE_URL}/netixlan?net_id={net_id}"
            async with session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    return [
                        {
                            "ix_id": ix.get("ix_id"),
                            "name": ix.get("name"),
                            "ipaddr4": ix.get("ipaddr4"),
                            "ipaddr6": ix.get("ipaddr6"),
                            "speed": ix.get("speed"),
                            "is_rs_peer": ix.get("is_rs_peer"),
                            "operational": ix.get("operational"),
                        }
                        for ix in data.get("data", [])
                    ]
        except Exception as e:
            logger.error(f"Error fetching IX connections for network {net_id}: {e}")
        return []

    def _parse_network_basic(self, network: Dict[str, Any]) -> Dict[str, Any]:
        """Parse basic network information."""
        return {
            "asn": network.get("asn"),
            "name": network.get("name"),
            "aka": network.get("aka"),
            "website": network.get("website"),
            "info_type": network.get("info_type"),
            "info_scope": network.get("info_scope"),
        }

    def _parse_facility(self, facility: Dict[str, Any]) -> Dict[str, Any]:
        """Parse facility information."""
        return {
            "id": facility.get("id"),
            "name": facility.get("name"),
            "aka": facility.get("aka"),
            "website": facility.get("website"),
            "clli": facility.get("clli"),
            "rencode": facility.get("rencode"),
            "npanxx": facility.get("npanxx"),
            "address1": facility.get("address1"),
            "address2": facility.get("address2"),
            "city": facility.get("city"),
            "state": facility.get("state"),
            "zipcode": facility.get("zipcode"),
            "country": facility.get("country"),
            "latitude": facility.get("latitude"),
            "longitude": facility.get("longitude"),
            "available_voltage_services": facility.get("available_voltage_services"),
            "diverse_serving_substations": facility.get("diverse_serving_substations"),
            "property": facility.get("property"),
        }

    def _parse_ix(self, ix: Dict[str, Any]) -> Dict[str, Any]:
        """Parse Internet Exchange information."""
        return {
            "id": ix.get("id"),
            "name": ix.get("name"),
            "aka": ix.get("aka"),
            "name_long": ix.get("name_long"),
            "city": ix.get("city"),
            "country": ix.get("country"),
            "region_continent": ix.get("region_continent"),
            "media": ix.get("media"),
            "proto_unicast": ix.get("proto_unicast"),
            "proto_multicast": ix.get("proto_multicast"),
            "proto_ipv6": ix.get("proto_ipv6"),
            "website": ix.get("website"),
            "url_stats": ix.get("url_stats"),
            "tech_email": ix.get("tech_email"),
            "tech_phone": ix.get("tech_phone"),
            "policy_email": ix.get("policy_email"),
            "policy_phone": ix.get("policy_phone"),
        }


# Global client instance
_peeringdb_client: Optional[PeeringDBClient] = None


def get_peeringdb_client() -> PeeringDBClient:
    """Get or create the global PeeringDB client instance."""
    global _peeringdb_client
    if _peeringdb_client is None:
        _peeringdb_client = PeeringDBClient()
    return _peeringdb_client
