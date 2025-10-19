"""
RDAP (Registration Data Access Protocol) backend integration.

Provides domain and IP registration data from RDAP servers.
"""

import asyncio
import logging
from typing import Any, Dict, Optional
from urllib.parse import quote

import aiohttp

logger = logging.getLogger(__name__)


class RDAPClient:
    """Client for RDAP queries."""

    # Bootstrap servers for different RIRs
    BOOTSTRAP_SERVERS = {
        "arin": "https://rdap.arin.net/registry",
        "ripe": "https://rdap.db.ripe.net",
        "apnic": "https://rdap.apnic.net",
        "lacnic": "https://rdap.lacnic.net/rdap",
        "afrinic": "https://rdap.afrinic.net/rdap",
    }

    def __init__(self, timeout: int = 30):
        """
        Initialize RDAP client.

        Args:
            timeout: Request timeout in seconds
        """
        self.timeout = aiohttp.ClientTimeout(total=timeout)

    async def query_ip(
        self, ip_address: str, rir: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Query RDAP for IP address registration data.

        Args:
            ip_address: IP address to query
            rir: Optional specific RIR to query (arin, ripe, etc.)

        Returns:
            Dictionary with registration data
        """
        if rir and rir.lower() in self.BOOTSTRAP_SERVERS:
            return await self._query_rir(ip_address, rir.lower(), "ip")

        # Try all RIRs if no specific one provided
        for rir_name in self.BOOTSTRAP_SERVERS:
            result = await self._query_rir(ip_address, rir_name, "ip")
            if result and not result.get("error"):
                return result

        return {"ip": ip_address, "error": "Not found in any RIR"}

    async def query_asn(self, asn: int, rir: Optional[str] = None) -> Dict[str, Any]:
        """
        Query RDAP for ASN registration data.

        Args:
            asn: Autonomous System Number
            rir: Optional specific RIR to query

        Returns:
            Dictionary with registration data
        """
        if rir and rir.lower() in self.BOOTSTRAP_SERVERS:
            return await self._query_rir(str(asn), rir.lower(), "autnum")

        # Try all RIRs if no specific one provided
        for rir_name in self.BOOTSTRAP_SERVERS:
            result = await self._query_rir(str(asn), rir_name, "autnum")
            if result and not result.get("error"):
                return result

        return {"asn": asn, "error": "Not found in any RIR"}

    async def query_domain(self, domain: str) -> Dict[str, Any]:
        """
        Query RDAP for domain registration data.

        Args:
            domain: Domain name to query

        Returns:
            Dictionary with registration data
        """
        try:
            # Use ICANN bootstrap for domain queries
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                url = f"https://rdap.org/domain/{quote(domain)}"
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        return self._parse_domain_response(data)
                    elif response.status == 404:
                        return {"domain": domain, "error": "Not found"}
                    else:
                        return {
                            "domain": domain,
                            "error": f"API error: {response.status}",
                        }
        except Exception as e:
            logger.error(f"Error querying RDAP for domain {domain}: {e}")
            return {"domain": domain, "error": str(e)}

    async def _query_rir(
        self, resource: str, rir: str, resource_type: str
    ) -> Dict[str, Any]:
        """
        Query specific RIR RDAP server.

        Args:
            resource: Resource to query (IP, ASN, etc.)
            rir: RIR name
            resource_type: Type of resource (ip, autnum, domain)

        Returns:
            Dictionary with registration data
        """
        try:
            base_url = self.BOOTSTRAP_SERVERS[rir]
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                url = f"{base_url}/{resource_type}/{quote(resource)}"
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        return self._parse_response(data, resource_type, rir)
                    elif response.status == 404:
                        return {"resource": resource, "rir": rir, "error": "Not found"}
                    else:
                        logger.warning(
                            f"RDAP query to {rir} returned {response.status}"
                        )
                        return {
                            "resource": resource,
                            "rir": rir,
                            "error": f"API error: {response.status}",
                        }
        except asyncio.TimeoutError:
            logger.error(f"Timeout querying RDAP for {resource} at {rir}")
            return {"resource": resource, "rir": rir, "error": "Query timeout"}
        except Exception as e:
            logger.error(
                f"Error querying RDAP for {resource} at {rir}: {e}", exc_info=True
            )
            return {"resource": resource, "rir": rir, "error": str(e)}

    def _parse_response(
        self, data: Dict[str, Any], resource_type: str, rir: str
    ) -> Dict[str, Any]:
        """Parse RDAP response based on resource type."""
        if resource_type == "ip":
            return self._parse_ip_response(data, rir)
        elif resource_type == "autnum":
            return self._parse_asn_response(data, rir)
        else:
            return data

    def _parse_ip_response(self, data: Dict[str, Any], rir: str) -> Dict[str, Any]:
        """Parse IP address RDAP response."""
        entities = []
        for entity in data.get("entities", []):
            entities.append(
                {
                    "handle": entity.get("handle"),
                    "name": self._get_entity_name(entity),
                    "roles": entity.get("roles", []),
                    "email": self._get_entity_email(entity),
                }
            )

        return {
            "start_address": data.get("startAddress"),
            "end_address": data.get("endAddress"),
            "ip_version": data.get("ipVersion"),
            "name": data.get("name"),
            "type": data.get("type"),
            "country": data.get("country"),
            "entities": entities,
            "status": data.get("status", []),
            "rir": rir,
            "handle": data.get("handle"),
            "registration_date": self._get_event_date(data, "registration"),
            "last_changed_date": self._get_event_date(data, "last changed"),
        }

    def _parse_asn_response(self, data: Dict[str, Any], rir: str) -> Dict[str, Any]:
        """Parse ASN RDAP response."""
        entities = []
        for entity in data.get("entities", []):
            entities.append(
                {
                    "handle": entity.get("handle"),
                    "name": self._get_entity_name(entity),
                    "roles": entity.get("roles", []),
                    "email": self._get_entity_email(entity),
                }
            )

        return {
            "asn": data.get("startAutnum"),
            "name": data.get("name"),
            "type": data.get("type"),
            "country": data.get("country"),
            "entities": entities,
            "status": data.get("status", []),
            "rir": rir,
            "handle": data.get("handle"),
            "registration_date": self._get_event_date(data, "registration"),
            "last_changed_date": self._get_event_date(data, "last changed"),
        }

    def _parse_domain_response(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Parse domain RDAP response."""
        nameservers = []
        for ns in data.get("nameservers", []):
            nameservers.append(ns.get("ldhName"))

        entities = []
        for entity in data.get("entities", []):
            entities.append(
                {
                    "handle": entity.get("handle"),
                    "name": self._get_entity_name(entity),
                    "roles": entity.get("roles", []),
                    "email": self._get_entity_email(entity),
                }
            )

        return {
            "domain": data.get("ldhName"),
            "unicode_name": data.get("unicodeName"),
            "status": data.get("status", []),
            "nameservers": nameservers,
            "entities": entities,
            "registration_date": self._get_event_date(data, "registration"),
            "expiration_date": self._get_event_date(data, "expiration"),
            "last_changed_date": self._get_event_date(data, "last changed"),
        }

    def _get_entity_name(self, entity: Dict[str, Any]) -> Optional[str]:
        """Extract entity name from vCard."""
        vcard_array = entity.get("vcardArray")
        if not vcard_array or len(vcard_array) < 2:
            return None

        for vcard_item in vcard_array[1]:
            if isinstance(vcard_item, list) and len(vcard_item) >= 4:
                if vcard_item[0] == "fn":
                    return vcard_item[3]
        return None

    def _get_entity_email(self, entity: Dict[str, Any]) -> Optional[str]:
        """Extract entity email from vCard."""
        vcard_array = entity.get("vcardArray")
        if not vcard_array or len(vcard_array) < 2:
            return None

        for vcard_item in vcard_array[1]:
            if isinstance(vcard_item, list) and len(vcard_item) >= 4:
                if vcard_item[0] == "email":
                    return vcard_item[3]
        return None

    def _get_event_date(self, data: Dict[str, Any], event_action: str) -> Optional[str]:
        """Extract event date from RDAP response."""
        events = data.get("events", [])
        for event in events:
            if event.get("eventAction") == event_action:
                return event.get("eventDate")
        return None


# Global client instance
_rdap_client: Optional[RDAPClient] = None


def get_rdap_client() -> RDAPClient:
    """Get or create the global RDAP client instance."""
    global _rdap_client
    if _rdap_client is None:
        _rdap_client = RDAPClient()
    return _rdap_client
