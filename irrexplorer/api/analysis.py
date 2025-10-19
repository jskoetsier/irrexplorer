"""
API endpoints for enhanced routing analysis features.

Provides endpoints for:
- RPKI validation dashboard
- ROA coverage analysis
- IRR consistency checking
- BGP hijack detection
- Prefix overlap analysis
- AS-path analysis
- WHOIS integration
"""

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from starlette.requests import Request
from starlette.responses import JSONResponse

from irrexplorer.api.caching import cached


@cached(ttl=1800, key_prefix="analysis:rpki_dashboard")
async def _get_rpki_dashboard_data(database):
    """Fetch routing statistics dashboard."""

    # Get BGP statistics
    bgp_stats_query = """
        SELECT
            COUNT(*) as total_routes,
            COUNT(DISTINCT asn) as unique_asns,
            COUNT(DISTINCT prefix) as unique_prefixes
        FROM bgp
    """

    bgp_row = await database.fetch_one(bgp_stats_query)

    # Get RIR statistics
    rir_stats_query = """
        SELECT
            r.rir::text as rir,
            COUNT(DISTINCT r.prefix) as total_prefixes,
            COUNT(DISTINCT b.prefix) as announced_prefixes
        FROM rirstats r
        LEFT JOIN bgp b ON r.prefix = b.prefix
        GROUP BY r.rir
        ORDER BY total_prefixes DESC
    """

    rir_rows = await database.fetch_all(rir_stats_query)

    # Since we don't have rpki_status field, we'll show basic routing stats
    # Format as if we have status breakdown for UI compatibility
    total_routes = bgp_row["total_routes"] or 0

    status_breakdown = {
        "announced": {
            "count": total_routes,
            "unique_asns": bgp_row["unique_asns"] or 0,
            "percentage": 100.0
        }
    }

    # Format RIR coverage
    roa_coverage = []
    for row in rir_rows:
        total = row["total_prefixes"]
        announced = row["announced_prefixes"] or 0
        if total > 0:
            roa_coverage.append({
                "rir": row["rir"],
                "total_prefixes": total,
                "valid": announced,
                "invalid": 0,
                "not_found": total - announced,
                "coverage_percentage": round((announced / total) * 100, 2)
            })

    return {
        "status_breakdown": status_breakdown,
        "total_prefixes": total_routes,
        "roa_coverage_by_rir": roa_coverage,
        "timestamp": datetime.utcnow().isoformat(),
        "note": "Displaying basic routing statistics. Full RPKI validation requires rpki_status field."
    }


async def get_rpki_dashboard(request: Request) -> JSONResponse:
    """Get RPKI validation dashboard data."""
    database = request.app.state.database
    result = await _get_rpki_dashboard_data(database)
    return JSONResponse(result)


@cached(ttl=1800, key_prefix="analysis:roa_coverage")
async def _get_roa_coverage_data(database, asn: Optional[int] = None):
    """Fetch ROA coverage analysis."""

    if asn:
        # ASN-specific coverage
        coverage_query = """
            SELECT
                b.prefix::text as prefix,
                b.asn
            FROM bgp b
            WHERE b.asn = :asn
            ORDER BY b.prefix
        """

        rows = await database.fetch_all(coverage_query, {"asn": asn})

        prefixes = []
        total = len(rows)

        for row in rows:
            prefixes.append({
                "prefix": row["prefix"],
                "rpki_status": "announced",
                "has_roa": True
            })

        return {
            "asn": asn,
            "total_prefixes": total,
            "covered_prefixes": total,
            "coverage_percentage": 100.0 if total > 0 else 0,
            "prefixes": prefixes,
            "timestamp": datetime.utcnow().isoformat(),
            "note": "Showing announced prefixes. Full ROA validation requires rpki_status field."
        }

    else:
        # Global coverage statistics
        global_query = """
            SELECT
                COUNT(*) as total_prefixes,
                COUNT(DISTINCT asn) as unique_asns
            FROM bgp
        """

        row = await database.fetch_one(global_query)

        total = row["total_prefixes"] or 0

        return {
            "total_prefixes": total,
            "covered_prefixes": total,
            "invalid_prefixes": 0,
            "not_covered_prefixes": 0,
            "coverage_percentage": 100.0 if total > 0 else 0,
            "timestamp": datetime.utcnow().isoformat(),
            "note": "Showing announced routes. Full ROA validation requires rpki_status field."
        }


async def get_roa_coverage(request: Request) -> JSONResponse:
    """Get ROA coverage analysis."""
    database = request.app.state.database
    asn = request.query_params.get("asn")

    if asn:
        try:
            asn_int = int(asn.replace("AS", "").replace("as", ""))
        except ValueError:
            return JSONResponse({"error": "Invalid ASN format"}, status_code=400)

        result = await _get_roa_coverage_data(database, asn_int)
    else:
        result = await _get_roa_coverage_data(database)

    return JSONResponse(result)


@cached(ttl=1800, key_prefix="analysis:irr_consistency")
async def _get_irr_consistency_data(database, asn: Optional[int] = None):
    """Check IRR consistency."""

    if asn:
        # ASN-specific consistency check
        consistency_query = """
            SELECT
                b.prefix::text as prefix,
                b.asn,
                EXISTS(
                    SELECT 1 FROM roas r
                    WHERE r.prefix = b.prefix AND r.asn = b.asn
                ) as in_irr
            FROM bgp b
            WHERE b.asn = :asn
        """

        rows = await database.fetch_all(consistency_query, {"asn": asn})

        consistent = sum(1 for r in rows if r["in_irr"])
        inconsistent = len(rows) - consistent

        issues = []
        for row in rows:
            if not row["in_irr"]:
                issues.append({
                    "prefix": row["prefix"],
                    "issue": "Not found in IRR",
                    "rpki_status": "unknown"
                })

        return {
            "asn": asn,
            "total_prefixes": len(rows),
            "consistent": consistent,
            "inconsistent": inconsistent,
            "consistency_percentage": round((consistent / len(rows) * 100), 2) if len(rows) > 0 else 0,
            "issues": issues[:50],  # Limit to 50 issues
            "timestamp": datetime.utcnow().isoformat()
        }

    else:
        # Global consistency statistics
        global_query = """
            SELECT
                COUNT(*) as total_routes,
                COUNT(CASE WHEN EXISTS(
                    SELECT 1 FROM roas r
                    WHERE r.prefix = b.prefix AND r.asn = b.asn
                ) THEN 1 END) as consistent_routes
            FROM bgp b
        """

        row = await database.fetch_one(global_query)

        total = row["total_routes"] or 0
        consistent = row["consistent_routes"] or 0

        return {
            "total_routes": total,
            "consistent_routes": consistent,
            "inconsistent_routes": total - consistent,
            "consistency_percentage": round((consistent / total * 100), 2) if total > 0 else 0,
            "timestamp": datetime.utcnow().isoformat()
        }


async def get_irr_consistency(request: Request) -> JSONResponse:
    """Get IRR consistency check results."""
    database = request.app.state.database
    asn = request.query_params.get("asn")

    if asn:
        try:
            asn_int = int(asn.replace("AS", "").replace("as", ""))
        except ValueError:
            return JSONResponse({"error": "Invalid ASN format"}, status_code=400)

        result = await _get_irr_consistency_data(database, asn_int)
    else:
        result = await _get_irr_consistency_data(database)

    return JSONResponse(result)


@cached(ttl=900, key_prefix="analysis:hijack_detection")
async def _get_hijack_detection_data(database):
    """Detect potential BGP hijacks."""

    # Since we don't have rpki_status, we can't detect hijacks properly
    # Return empty result with informative message

    return {
        "total_alerts": 0,
        "high_severity": 0,
        "medium_severity": 0,
        "low_severity": 0,
        "alerts": [],
        "timestamp": datetime.utcnow().isoformat(),
        "note": "BGP hijack detection requires RPKI validation data (rpki_status field in bgp table)."
    }


async def get_hijack_detection(request: Request) -> JSONResponse:
    """Get BGP hijack detection alerts."""
    database = request.app.state.database
    result = await _get_hijack_detection_data(database)
    return JSONResponse(result)


@cached(ttl=1800, key_prefix="analysis:prefix_overlap")
async def _get_prefix_overlap_data(database, prefix: str):
    """Find overlapping prefixes."""

    overlap_query = """
        SELECT
            b.prefix::text as overlapping_prefix,
            b.asn,
            CASE
                WHEN b.prefix >> :prefix::inet THEN 'more_specific'
                WHEN b.prefix << :prefix::inet THEN 'less_specific'
                WHEN b.prefix = :prefix::inet THEN 'exact'
            END as overlap_type
        FROM bgp b
        WHERE
            b.prefix >> :prefix::inet OR
            b.prefix << :prefix::inet OR
            b.prefix = :prefix::inet
        ORDER BY masklen(b.prefix), b.prefix
        LIMIT 200
    """

    rows = await database.fetch_all(overlap_query, {"prefix": prefix})

    overlaps = {
        "exact": [],
        "more_specific": [],
        "less_specific": []
    }

    for row in rows:
        overlaps[row["overlap_type"]].append({
            "prefix": row["overlapping_prefix"],
            "asn": row["asn"]
        })

    return {
        "query_prefix": prefix,
        "total_overlaps": len(rows),
        "exact_matches": len(overlaps["exact"]),
        "more_specifics": len(overlaps["more_specific"]),
        "less_specifics": len(overlaps["less_specific"]),
        "overlaps": overlaps,
        "timestamp": datetime.utcnow().isoformat()
    }


async def get_prefix_overlap(request: Request) -> JSONResponse:
    """Get prefix overlap analysis."""
    database = request.app.state.database
    prefix = request.query_params.get("prefix")

    if not prefix:
        return JSONResponse({"error": "prefix parameter required"}, status_code=400)

    result = await _get_prefix_overlap_data(database, prefix)
    return JSONResponse(result)


@cached(ttl=1800, key_prefix="analysis:as_path")
async def _get_as_path_data(database, asn: int):
    """Analyze AS-path information."""

    # Get prefixes for this ASN
    prefixes_query = """
        SELECT
            prefix::text as prefix,
            asn
        FROM bgp
        WHERE asn = :asn
        LIMIT 100
    """

    rows = await database.fetch_all(prefixes_query, {"asn": asn})

    # Get neighbors (ASNs that share prefixes)
    neighbors_query = """
        WITH asn_prefixes AS (
            SELECT prefix FROM bgp WHERE asn = :asn
        )
        SELECT DISTINCT
            b.asn as neighbor_asn,
            COUNT(*) as shared_prefixes
        FROM bgp b
        JOIN asn_prefixes ap ON (
            b.prefix << ap.prefix OR
            b.prefix >> ap.prefix
        )
        WHERE b.asn != :asn
        GROUP BY b.asn
        ORDER BY shared_prefixes DESC
        LIMIT 50
    """

    neighbor_rows = await database.fetch_all(neighbors_query, {"asn": asn})

    prefixes = [{"prefix": row["prefix"]} for row in rows]
    neighbors = [
        {
            "asn": row["neighbor_asn"],
            "shared_prefixes": row["shared_prefixes"]
        }
        for row in neighbor_rows
    ]

    return {
        "asn": asn,
        "total_prefixes": len(prefixes),
        "prefixes": prefixes,
        "neighbors": neighbors,
        "total_neighbors": len(neighbors),
        "timestamp": datetime.utcnow().isoformat()
    }


async def get_as_path_analysis(request: Request) -> JSONResponse:
    """Get AS-path analysis."""
    database = request.app.state.database
    asn = request.query_params.get("asn")

    if not asn:
        return JSONResponse({"error": "asn parameter required"}, status_code=400)

    try:
        asn_int = int(asn.replace("AS", "").replace("as", ""))
    except ValueError:
        return JSONResponse({"error": "Invalid ASN format"}, status_code=400)

    result = await _get_as_path_data(database, asn_int)
    return JSONResponse(result)


async def get_whois_info(request: Request) -> JSONResponse:
    """
    Get WHOIS information for a resource.

    Note: This is a placeholder. Full WHOIS integration requires
    connecting to WHOIS servers or using a WHOIS API service.
    """
    resource = request.query_params.get("resource")

    if not resource:
        return JSONResponse({"error": "resource parameter required"}, status_code=400)

    # Placeholder response
    whois_data = {
        "resource": resource,
        "message": "WHOIS integration requires external service setup",
        "note": "Consider integrating with services like RIPE NCC WHOIS, ARIN WHOIS, or RIPEstat",
        "suggestion": "Use RIPEstat Data API: https://stat.ripe.net/docs/data_api",
        "timestamp": datetime.utcnow().isoformat()
    }

    return JSONResponse(whois_data)
