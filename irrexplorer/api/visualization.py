"""
API endpoints for data visualization features.

Provides endpoints for:
- Interactive prefix allocation maps
- ASN relationship graphs
- Historical timeline views
- Geographical RIR distribution maps
"""

from collections import defaultdict
from datetime import datetime, timedelta

from starlette.requests import Request
from starlette.responses import JSONResponse

from irrexplorer.api.caching import cached


@cached(ttl=3600, key_prefix="viz:prefix_allocation")
async def _get_prefix_allocation_data(database):
    """Fetch prefix allocation data from database."""
    # Get RIR allocations with counts
    rir_query = """
        SELECT
            rir::text as rir_name,
            COUNT(*) as prefix_count,
            SUM(
                CASE
                    WHEN family(prefix) = 4 THEN pow(2, 32 - masklen(prefix))
                    WHEN family(prefix) = 6 THEN pow(2, 128 - masklen(prefix))
                END
            ) as total_ips
        FROM rirstats
        GROUP BY rir
        ORDER BY total_ips DESC
    """

    rir_rows = await database.fetch_all(rir_query)

    # Get top ASNs by prefix count
    bgp_query = """
        SELECT
            asn,
            COUNT(*) as prefix_count,
            SUM(
                CASE
                    WHEN family(prefix) = 4 THEN pow(2, 32 - masklen(prefix))
                    WHEN family(prefix) = 6 THEN pow(2, 128 - masklen(prefix))
                END
            ) as total_ips
        FROM bgp
        GROUP BY asn
        ORDER BY prefix_count DESC
        LIMIT 100
    """

    bgp_rows = await database.fetch_all(bgp_query)

    # Format data for visualization
    rir_data = [
        {
            "name": row["rir_name"],
            "prefix_count": row["prefix_count"],
            "total_ips": float(row["total_ips"]) if row["total_ips"] else 0,
        }
        for row in rir_rows
    ]

    asn_data = [
        {
            "asn": row["asn"],
            "prefix_count": row["prefix_count"],
            "total_ips": float(row["total_ips"]) if row["total_ips"] else 0,
        }
        for row in bgp_rows
    ]

    return {
        "rir_allocations": rir_data,
        "top_asns": asn_data,
        "timestamp": datetime.utcnow().isoformat(),
    }


async def get_prefix_allocation_data(request: Request) -> JSONResponse:
    """Get prefix allocation data for interactive visualization."""
    database = request.app.state.database
    result = await _get_prefix_allocation_data(database)
    return JSONResponse(result)


@cached(ttl=1800, key_prefix="viz:asn_relationships")
async def _get_asn_relationships_data(database, asn_int: int):
    """Fetch ASN relationship data from database."""
    # Get prefixes for the target ASN
    target_prefixes_query = """
        SELECT prefix::text as prefix
        FROM bgp
        WHERE asn = :asn
        LIMIT 1000
    """

    target_rows = await database.fetch_all(target_prefixes_query, {"asn": asn_int})

    if not target_rows:
        return {
            "nodes": [{"id": asn_int, "label": f"AS{asn_int}", "prefix_count": 0}],
            "edges": [],
            "timestamp": datetime.utcnow().isoformat(),
        }

    # Find overlapping ASNs
    overlapping_asns_query = """
        WITH target_prefixes AS (
            SELECT prefix FROM bgp WHERE asn = :asn
        )
        SELECT DISTINCT
            b.asn,
            COUNT(DISTINCT b.prefix) as shared_count
        FROM bgp b
        JOIN target_prefixes tp ON (
            b.prefix << tp.prefix OR
            b.prefix >> tp.prefix OR
            b.prefix = tp.prefix
        )
        WHERE b.asn != :asn
        GROUP BY b.asn
        ORDER BY shared_count DESC
        LIMIT 50
    """

    related_rows = await database.fetch_all(overlapping_asns_query, {"asn": asn_int})

    # Build nodes and edges
    nodes = [
        {
            "id": asn_int,
            "label": f"AS{asn_int}",
            "prefix_count": len(target_rows),
            "type": "target",
        }
    ]

    edges = []

    for row in related_rows:
        nodes.append(
            {
                "id": row["asn"],
                "label": f"AS{row['asn']}",
                "prefix_count": row["shared_count"],
                "type": "related",
            }
        )
        edges.append(
            {
                "source": asn_int,
                "target": row["asn"],
                "weight": row["shared_count"],
                "type": "overlap",
            }
        )

    return {
        "nodes": nodes,
        "edges": edges,
        "timestamp": datetime.utcnow().isoformat(),
    }


async def get_asn_relationships(request: Request) -> JSONResponse:
    """Get ASN relationship data for graph visualization."""
    asn = request.path_params.get("asn")
    database = request.app.state.database

    if not asn:
        return JSONResponse({"error": "ASN parameter required"}, status_code=400)

    # Remove 'AS' prefix if present
    asn = str(asn).upper().replace("AS", "")

    try:
        asn_int = int(asn)
    except ValueError:
        return JSONResponse({"error": "Invalid ASN format"}, status_code=400)

    result = await _get_asn_relationships_data(database, asn_int)
    return JSONResponse(result)


@cached(ttl=900, key_prefix="viz:timeline")
async def _get_historical_timeline_data(database, days: int):
    """Fetch historical timeline data from database."""
    # Get query activity over time
    since_date = datetime.utcnow() - timedelta(days=days)

    timeline_query = """
        SELECT
            DATE(timestamp) as query_date,
            query_type,
            COUNT(*) as count
        FROM search_history
        WHERE timestamp >= :since_date
        GROUP BY DATE(timestamp), query_type
        ORDER BY query_date ASC
    """

    timeline_rows = await database.fetch_all(timeline_query, {"since_date": since_date})

    # Get top queries per day
    top_queries_query = """
        SELECT
            DATE(sh.timestamp) as query_date,
            sh.query,
            sh.query_type,
            COUNT(*) as daily_count
        FROM search_history sh
        WHERE sh.timestamp >= :since_date
        GROUP BY DATE(sh.timestamp), sh.query, sh.query_type
        ORDER BY query_date ASC, daily_count DESC
    """

    top_queries_rows = await database.fetch_all(
        top_queries_query, {"since_date": since_date}
    )

    # Organize timeline data
    timeline_data = defaultdict(lambda: {"asn": 0, "prefix": 0, "set": 0, "total": 0})

    for row in timeline_rows:
        date_key = row["query_date"].isoformat()
        query_type = row["query_type"]
        count = row["count"]

        timeline_data[date_key][query_type] = count
        timeline_data[date_key]["total"] += count

    # Organize top queries by date
    top_by_date = defaultdict(list)
    for row in top_queries_rows:
        date_key = row["query_date"].isoformat()
        if len(top_by_date[date_key]) < 5:
            top_by_date[date_key].append(
                {
                    "query": row["query"],
                    "type": row["query_type"],
                    "count": row["daily_count"],
                }
            )

    # Convert to sorted list
    timeline_list = [
        {"date": date, **data} for date, data in sorted(timeline_data.items())
    ]

    return {
        "timeline": timeline_list,
        "top_queries_by_date": dict(top_by_date),
        "days": days,
        "timestamp": datetime.utcnow().isoformat(),
    }


async def get_historical_timeline(request: Request) -> JSONResponse:
    """Get historical timeline data showing query activity over time."""
    database = request.app.state.database
    days = int(request.query_params.get("days", 30))

    if days < 1 or days > 90:
        days = 30

    result = await _get_historical_timeline_data(database, days)
    return JSONResponse(result)


@cached(ttl=3600, key_prefix="viz:rir_distribution")
async def _get_rir_distribution_data(database):
    """Fetch RIR distribution data from database."""
    # RIR geographical regions
    rir_regions = {
        "AFRINIC": {
            "continent": "Africa",
            "countries": ["ZA", "KE", "EG", "NG", "GH"],
            "coordinates": {"lat": -8.7832, "lng": 34.5085},
        },
        "APNIC": {
            "continent": "Asia-Pacific",
            "countries": ["CN", "JP", "AU", "IN", "KR"],
            "coordinates": {"lat": 34.0522, "lng": 118.2437},
        },
        "ARIN": {
            "continent": "North America",
            "countries": ["US", "CA", "MX"],
            "coordinates": {"lat": 37.0902, "lng": -95.7129},
        },
        "LACNIC": {
            "continent": "Latin America",
            "countries": ["BR", "AR", "MX", "CL", "CO"],
            "coordinates": {"lat": -14.2350, "lng": -51.9253},
        },
        "RIPE": {
            "continent": "Europe, Middle East, Central Asia",
            "countries": ["GB", "DE", "FR", "NL", "RU"],
            "coordinates": {"lat": 54.5260, "lng": 15.2551},
        },
    }

    # Get detailed RIR statistics
    rir_stats_query = """
        SELECT
            rir::text as rir_name,
            COUNT(*) as prefix_count,
            COUNT(CASE WHEN family(prefix) = 4 THEN 1 END) as ipv4_count,
            COUNT(CASE WHEN family(prefix) = 6 THEN 1 END) as ipv6_count,
            SUM(
                CASE
                    WHEN family(prefix) = 4 THEN pow(2, 32 - masklen(prefix))
                    ELSE 0
                END
            ) as total_ipv4_ips,
            SUM(
                CASE
                    WHEN family(prefix) = 6 THEN pow(2, 128 - masklen(prefix))
                    ELSE 0
                END
            ) as total_ipv6_ips
        FROM rirstats
        GROUP BY rir
        ORDER BY prefix_count DESC
    """

    rir_rows = await database.fetch_all(rir_stats_query)

    # Combine with geographical data
    distribution = []
    for row in rir_rows:
        rir_name = row["rir_name"]
        geo_info = rir_regions.get(rir_name, {})

        distribution.append(
            {
                "rir": rir_name,
                "continent": geo_info.get("continent", "Unknown"),
                "coordinates": geo_info.get("coordinates", {"lat": 0, "lng": 0}),
                "countries": geo_info.get("countries", []),
                "prefix_count": row["prefix_count"],
                "ipv4_count": row["ipv4_count"],
                "ipv6_count": row["ipv6_count"],
                "total_ipv4_ips": (
                    float(row["total_ipv4_ips"]) if row["total_ipv4_ips"] else 0
                ),
                "total_ipv6_ips": (
                    float(row["total_ipv6_ips"]) if row["total_ipv6_ips"] else 0
                ),
            }
        )

    return {
        "distribution": distribution,
        "timestamp": datetime.utcnow().isoformat(),
    }


async def get_rir_distribution(request: Request) -> JSONResponse:
    """Get geographical RIR distribution data."""
    database = request.app.state.database
    result = await _get_rir_distribution_data(database)
    return JSONResponse(result)


@cached(ttl=3600, key_prefix="viz:prefix_distribution")
async def _get_prefix_size_distribution_data(database):
    """Fetch prefix size distribution from database."""
    # Get prefix size distribution from BGP
    size_query = """
        SELECT
            masklen(prefix) as prefix_size,
            family(prefix) as ip_version,
            COUNT(*) as count
        FROM bgp
        GROUP BY masklen(prefix), family(prefix)
        ORDER BY ip_version, prefix_size
    """

    size_rows = await database.fetch_all(size_query)

    ipv4_distribution = []
    ipv6_distribution = []

    for row in size_rows:
        data_point = {"size": row["prefix_size"], "count": row["count"]}

        if row["ip_version"] == 4:
            ipv4_distribution.append(data_point)
        elif row["ip_version"] == 6:
            ipv6_distribution.append(data_point)

    return {
        "ipv4": ipv4_distribution,
        "ipv6": ipv6_distribution,
        "timestamp": datetime.utcnow().isoformat(),
    }


async def get_prefix_size_distribution(request: Request) -> JSONResponse:
    """Get prefix size distribution for visualization."""
    database = request.app.state.database
    result = await _get_prefix_size_distribution_data(database)
    return JSONResponse(result)
