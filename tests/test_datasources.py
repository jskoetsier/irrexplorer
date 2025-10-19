"""
Tests for data source integrations (Looking Glass, RDAP, PeeringDB)
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from irrexplorer.backends.lookingglass import LookingGlassClient
from irrexplorer.backends.peeringdb import PeeringDBClient
from irrexplorer.backends.rdap import RDAPClient


class TestLookingGlassClient:
    """Tests for BGP Looking Glass client"""

    @pytest.mark.asyncio
    async def test_query_prefix_success(self):
        """Test successful prefix query"""
        client = LookingGlassClient()

        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(
            return_value={
                "prefix": "192.0.2.0/24",
                "routes": [
                    {
                        "prefix": "192.0.2.0/24",
                        "as_path": [174, 13335],
                        "next_hop": "198.32.160.94",
                        "peer": "peer1",
                        "communities": ["174:21101"],
                        "local_pref": 100,
                        "med": None,
                    }
                ],
            }
        )

        with patch("aiohttp.ClientSession") as mock_session:
            mock_session.return_value.__aenter__.return_value.get.return_value.__aenter__.return_value = mock_response

            result = await client.query_prefix("192.0.2.0/24")

            assert result["prefix"] == "192.0.2.0/24"
            assert len(result["routes"]) == 1
            assert result["routes"][0]["origin_asn"] == 13335

    @pytest.mark.asyncio
    async def test_query_prefix_not_found(self):
        """Test prefix query with 404 response"""
        client = LookingGlassClient()

        mock_response = MagicMock()
        mock_response.status = 404

        with patch("aiohttp.ClientSession") as mock_session:
            mock_session.return_value.__aenter__.return_value.get.return_value.__aenter__.return_value = mock_response

            result = await client.query_prefix("192.0.2.0/24")

            assert "error" in result
            assert result["error"] == "Not found"

    @pytest.mark.asyncio
    async def test_query_asn_success(self):
        """Test successful ASN query"""
        client = LookingGlassClient()

        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(
            return_value={
                "prefixes": [
                    {
                        "prefix": "1.1.1.0/24",
                        "origin": "AS13335",
                        "peers": ["peer1", "peer2"],
                    }
                ],
                "as_name": "Cloudflare",
            }
        )

        with patch("aiohttp.ClientSession") as mock_session:
            mock_session.return_value.__aenter__.return_value.get.return_value.__aenter__.return_value = mock_response

            result = await client.query_asn(13335)

            assert result["asn"] == 13335
            assert result["as_name"] == "Cloudflare"
            assert len(result["prefixes"]) == 1


class TestRDAPClient:
    """Tests for RDAP client"""

    @pytest.mark.asyncio
    async def test_query_ip_success(self):
        """Test successful IP query"""
        client = RDAPClient()

        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(
            return_value={
                "startAddress": "8.8.8.0",
                "endAddress": "8.8.8.255",
                "ipVersion": "v4",
                "name": "GOOGLE",
                "country": "US",
                "type": "DIRECT ALLOCATION",
                "entities": [],
                "status": ["active"],
                "handle": "NET-8-8-8-0-1",
                "events": [{"eventAction": "registration", "eventDate": "2014-03-14"}],
            }
        )

        with patch("aiohttp.ClientSession") as mock_session:
            mock_session.return_value.__aenter__.return_value.get.return_value.__aenter__.return_value = mock_response

            result = await client.query_ip("8.8.8.8", "arin")

            assert result["start_address"] == "8.8.8.0"
            assert result["name"] == "GOOGLE"
            assert result["country"] == "US"
            assert result["rir"] == "arin"

    @pytest.mark.asyncio
    async def test_query_asn_success(self):
        """Test successful ASN query"""
        client = RDAPClient()

        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(
            return_value={
                "startAutnum": 13335,
                "name": "Cloudflare",
                "type": "DIRECT ALLOCATION",
                "country": "US",
                "entities": [],
                "status": ["active"],
                "handle": "AS13335",
                "events": [{"eventAction": "registration", "eventDate": "2010-07-14"}],
            }
        )

        with patch("aiohttp.ClientSession") as mock_session:
            mock_session.return_value.__aenter__.return_value.get.return_value.__aenter__.return_value = mock_response

            result = await client.query_asn(13335, "arin")

            assert result["asn"] == 13335
            assert result["name"] == "Cloudflare"
            assert result["country"] == "US"

    @pytest.mark.asyncio
    async def test_query_domain_success(self):
        """Test successful domain query"""
        client = RDAPClient()

        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(
            return_value={
                "ldhName": "example.com",
                "nameservers": [{"ldhName": "ns1.example.com"}],
                "entities": [],
                "status": ["active"],
                "events": [
                    {"eventAction": "registration", "eventDate": "1995-08-14"},
                    {"eventAction": "expiration", "eventDate": "2025-08-13"},
                ],
            }
        )

        with patch("aiohttp.ClientSession") as mock_session:
            mock_session.return_value.__aenter__.return_value.get.return_value.__aenter__.return_value = mock_response

            result = await client.query_domain("example.com")

            assert result["domain"] == "example.com"
            assert len(result["nameservers"]) == 1


class TestPeeringDBClient:
    """Tests for PeeringDB client"""

    @pytest.mark.asyncio
    async def test_query_asn_success(self):
        """Test successful ASN query"""
        client = PeeringDBClient()

        mock_network_response = MagicMock()
        mock_network_response.status = 200
        mock_network_response.json = AsyncMock(
            return_value={
                "data": [
                    {
                        "id": 1,
                        "asn": 13335,
                        "name": "Cloudflare",
                        "website": "https://www.cloudflare.com",
                        "irr_as_set": "AS-CLOUDFLARE",
                        "policy_general": "Open",
                        "info_prefixes4": 100,
                        "info_prefixes6": 50,
                    }
                ]
            }
        )

        mock_facilities_response = MagicMock()
        mock_facilities_response.status = 200
        mock_facilities_response.json = AsyncMock(return_value={"data": []})

        mock_ix_response = MagicMock()
        mock_ix_response.status = 200
        mock_ix_response.json = AsyncMock(return_value={"data": []})

        with patch("aiohttp.ClientSession") as mock_session:
            mock_context = mock_session.return_value.__aenter__.return_value

            # Mock the sequence of GET calls
            mock_context.get.return_value.__aenter__.side_effect = [
                mock_network_response,
                mock_facilities_response,
                mock_ix_response,
            ]

            result = await client.query_asn(13335)

            assert result["asn"] == 13335
            assert result["name"] == "Cloudflare"
            assert result["policy_general"] == "Open"

    @pytest.mark.asyncio
    async def test_search_networks(self):
        """Test network search"""
        client = PeeringDBClient()

        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(
            return_value={
                "data": [
                    {
                        "asn": 13335,
                        "name": "Cloudflare",
                        "aka": "CF",
                        "website": "https://www.cloudflare.com",
                        "info_type": "Content",
                        "info_scope": "Global",
                    }
                ]
            }
        )

        with patch("aiohttp.ClientSession") as mock_session:
            mock_session.return_value.__aenter__.return_value.get.return_value.__aenter__.return_value = mock_response

            results = await client.search_networks("cloudflare")

            assert len(results) == 1
            assert results[0]["asn"] == 13335
            assert results[0]["name"] == "Cloudflare"


class TestDataSourceParsing:
    """Tests for data parsing functions"""

    def test_looking_glass_parse_prefix_response(self):
        """Test parsing of Looking Glass prefix response"""
        client = LookingGlassClient()

        data = {
            "prefix": "192.0.2.0/24",
            "routes": [
                {
                    "prefix": "192.0.2.0/24",
                    "as_path": [174, 13335],
                    "next_hop": "198.32.160.94",
                    "peer": "peer1",
                }
            ],
        }

        result = client._parse_prefix_response(data)

        assert result["prefix"] == "192.0.2.0/24"
        assert result["total_routes"] == 1
        assert result["routes"][0]["origin_asn"] == 13335

    def test_rdap_parse_ip_response(self):
        """Test parsing of RDAP IP response"""
        client = RDAPClient()

        data = {
            "startAddress": "8.8.8.0",
            "endAddress": "8.8.8.255",
            "ipVersion": "v4",
            "name": "GOOGLE",
            "country": "US",
            "type": "DIRECT ALLOCATION",
            "entities": [],
            "status": ["active"],
            "handle": "NET-8-8-8-0-1",
            "events": [],
        }

        result = client._parse_ip_response(data, "arin")

        assert result["start_address"] == "8.8.8.0"
        assert result["end_address"] == "8.8.8.255"
        assert result["name"] == "GOOGLE"
        assert result["rir"] == "arin"

    def test_peeringdb_parse_network_basic(self):
        """Test parsing of PeeringDB basic network data"""
        client = PeeringDBClient()

        data = {
            "asn": 13335,
            "name": "Cloudflare",
            "aka": "CF",
            "website": "https://www.cloudflare.com",
            "info_type": "Content",
            "info_scope": "Global",
        }

        result = client._parse_network_basic(data)

        assert result["asn"] == 13335
        assert result["name"] == "Cloudflare"
        assert result["website"] == "https://www.cloudflare.com"
