"""
API endpoints for additional data sources.

Provides endpoints for:
- BGP Looking Glass queries
- RDAP registration data
- PeeringDB interconnection data
"""

import logging

from starlette.requests import Request
from starlette.responses import JSONResponse

from irrexplorer.backends.lookingglass import get_looking_glass_client
from irrexplorer.backends.peeringdb import get_peeringdb_client
from irrexplorer.backends.rdap import get_rdap_client

logger = logging.getLogger(__name__)


async def looking_glass_prefix(request: Request) -> JSONResponse:
    """
    Query BGP Looking Glass for prefix information.

    Args:
        request: Starlette request object with 'prefix' path parameter

    Returns:
        JSON response with looking glass data
    """
    prefix = request.path_params.get("prefix")

    if not prefix:
        return JSONResponse({"error": "Prefix parameter required"}, status_code=400)

    try:
        lg_client = get_looking_glass_client()
        result = await lg_client.query_prefix(prefix)

        return JSONResponse(result)
    except Exception as e:
        logger.error(f"Error querying looking glass for prefix {prefix}: {e}")
        return JSONResponse({"error": "Internal server error"}, status_code=500)


async def looking_glass_asn(request: Request) -> JSONResponse:
    """
    Query BGP Looking Glass for ASN information.

    Args:
        request: Starlette request object with 'asn' path parameter

    Returns:
        JSON response with looking glass data
    """
    asn_str = request.path_params.get("asn")

    if not asn_str:
        return JSONResponse({"error": "ASN parameter required"}, status_code=400)

    try:
        asn = int(asn_str.replace("AS", "").replace("as", ""))
        lg_client = get_looking_glass_client()
        result = await lg_client.query_asn(asn)

        return JSONResponse(result)
    except ValueError:
        return JSONResponse({"error": "Invalid ASN format"}, status_code=400)
    except Exception as e:
        logger.error(f"Error querying looking glass for ASN {asn_str}: {e}")
        return JSONResponse({"error": "Internal server error"}, status_code=500)


async def looking_glass_route(request: Request) -> JSONResponse:
    """
    Query detailed BGP route information.

    Args:
        request: Starlette request object with 'prefix' path parameter
                 and optional 'peer' query parameter

    Returns:
        JSON response with detailed route data
    """
    prefix = request.path_params.get("prefix")
    peer = request.query_params.get("peer")

    if not prefix:
        return JSONResponse({"error": "Prefix parameter required"}, status_code=400)

    try:
        lg_client = get_looking_glass_client()
        result = await lg_client.query_bgp_route(prefix, peer)

        return JSONResponse(result)
    except Exception as e:
        logger.error(f"Error querying BGP route for {prefix}: {e}")
        return JSONResponse({"error": "Internal server error"}, status_code=500)


async def looking_glass_peers(request: Request) -> JSONResponse:
    """
    Get list of available BGP peers.

    Returns:
        JSON response with list of peers
    """
    try:
        lg_client = get_looking_glass_client()
        peers = await lg_client.get_peers()

        return JSONResponse({"peers": peers})
    except Exception as e:
        logger.error(f"Error fetching BGP peers: {e}")
        return JSONResponse({"error": "Internal server error"}, status_code=500)


async def rdap_ip(request: Request) -> JSONResponse:
    """
    Query RDAP for IP address registration data.

    Args:
        request: Starlette request object with 'ip' path parameter
                 and optional 'rir' query parameter

    Returns:
        JSON response with RDAP data
    """
    ip_address = request.path_params.get("ip")
    rir = request.query_params.get("rir")

    if not ip_address:
        return JSONResponse({"error": "IP address parameter required"}, status_code=400)

    try:
        rdap_client = get_rdap_client()
        result = await rdap_client.query_ip(ip_address, rir)

        return JSONResponse(result)
    except Exception as e:
        logger.error(f"Error querying RDAP for IP {ip_address}: {e}")
        return JSONResponse({"error": "Internal server error"}, status_code=500)


async def rdap_asn(request: Request) -> JSONResponse:
    """
    Query RDAP for ASN registration data.

    Args:
        request: Starlette request object with 'asn' path parameter
                 and optional 'rir' query parameter

    Returns:
        JSON response with RDAP data
    """
    asn_str = request.path_params.get("asn")
    rir = request.query_params.get("rir")

    if not asn_str:
        return JSONResponse({"error": "ASN parameter required"}, status_code=400)

    try:
        asn = int(asn_str.replace("AS", "").replace("as", ""))
        rdap_client = get_rdap_client()
        result = await rdap_client.query_asn(asn, rir)

        return JSONResponse(result)
    except ValueError:
        return JSONResponse({"error": "Invalid ASN format"}, status_code=400)
    except Exception as e:
        logger.error(f"Error querying RDAP for ASN {asn_str}: {e}")
        return JSONResponse({"error": "Internal server error"}, status_code=500)


async def rdap_domain(request: Request) -> JSONResponse:
    """
    Query RDAP for domain registration data.

    Args:
        request: Starlette request object with 'domain' path parameter

    Returns:
        JSON response with RDAP data
    """
    domain = request.path_params.get("domain")

    if not domain:
        return JSONResponse({"error": "Domain parameter required"}, status_code=400)

    try:
        rdap_client = get_rdap_client()
        result = await rdap_client.query_domain(domain)

        return JSONResponse(result)
    except Exception as e:
        logger.error(f"Error querying RDAP for domain {domain}: {e}")
        return JSONResponse({"error": "Internal server error"}, status_code=500)


async def peeringdb_asn(request: Request) -> JSONResponse:
    """
    Query PeeringDB for ASN information.

    Args:
        request: Starlette request object with 'asn' path parameter

    Returns:
        JSON response with PeeringDB data
    """
    asn_str = request.path_params.get("asn")

    if not asn_str:
        return JSONResponse({"error": "ASN parameter required"}, status_code=400)

    try:
        asn = int(asn_str.replace("AS", "").replace("as", ""))
        pdb_client = get_peeringdb_client()
        result = await pdb_client.query_asn(asn)

        return JSONResponse(result)
    except ValueError:
        return JSONResponse({"error": "Invalid ASN format"}, status_code=400)
    except Exception as e:
        logger.error(f"Error querying PeeringDB for ASN {asn_str}: {e}")
        return JSONResponse({"error": "Internal server error"}, status_code=500)


async def peeringdb_facility(request: Request) -> JSONResponse:
    """
    Query PeeringDB for facility information.

    Args:
        request: Starlette request object with 'facility_id' path parameter

    Returns:
        JSON response with facility data
    """
    facility_id_str = request.path_params.get("facility_id")

    if not facility_id_str:
        return JSONResponse(
            {"error": "Facility ID parameter required"}, status_code=400
        )

    try:
        facility_id = int(facility_id_str)
        pdb_client = get_peeringdb_client()
        result = await pdb_client.query_facility(facility_id)

        return JSONResponse(result)
    except ValueError:
        return JSONResponse({"error": "Invalid facility ID format"}, status_code=400)
    except Exception as e:
        logger.error(f"Error querying PeeringDB for facility {facility_id_str}: {e}")
        return JSONResponse({"error": "Internal server error"}, status_code=500)


async def peeringdb_ix(request: Request) -> JSONResponse:
    """
    Query PeeringDB for Internet Exchange information.

    Args:
        request: Starlette request object with 'ix_id' path parameter

    Returns:
        JSON response with IX data
    """
    ix_id_str = request.path_params.get("ix_id")

    if not ix_id_str:
        return JSONResponse({"error": "IX ID parameter required"}, status_code=400)

    try:
        ix_id = int(ix_id_str)
        pdb_client = get_peeringdb_client()
        result = await pdb_client.query_ix(ix_id)

        return JSONResponse(result)
    except ValueError:
        return JSONResponse({"error": "Invalid IX ID format"}, status_code=400)
    except Exception as e:
        logger.error(f"Error querying PeeringDB for IX {ix_id_str}: {e}")
        return JSONResponse({"error": "Internal server error"}, status_code=500)


async def peeringdb_search(request: Request) -> JSONResponse:
    """
    Search PeeringDB networks.

    Args:
        request: Starlette request object with 'q' query parameter

    Returns:
        JSON response with search results
    """
    query = request.query_params.get("q", "")

    if not query or len(query) < 2:
        return JSONResponse(
            {"error": "Query parameter must be at least 2 characters"},
            status_code=400,
        )

    try:
        pdb_client = get_peeringdb_client()
        results = await pdb_client.search_networks(query)

        return JSONResponse({"results": results, "total": len(results)})
    except Exception as e:
        logger.error(f"Error searching PeeringDB: {e}")
        return JSONResponse({"error": "Internal server error"}, status_code=500)
