"""
Advanced search functionality with filters and query syntax support
"""

import re
from enum import Enum
from typing import Any, Dict, List

from irrexplorer.api import queries

from starlette.requests import Request
from starlette.responses import JSONResponse


class ResourceType(str, Enum):
    ASN = "asn"
    PREFIX = "prefix"
    AS_SET = "as-set"
    ROUTE_SET = "route-set"
    ALL = "all"


class Status(str, Enum):
    VALID = "valid"
    INVALID = "invalid"
    UNKNOWN = "unknown"
    ALL = "all"


class QueryParser:
    """Parse advanced query syntax"""

    @staticmethod
    def parse(query_string: str) -> Dict[str, Any]:
        """
        Parse advanced query syntax.

        Supported syntax:
        - type:asn query
        - type:prefix query
        - status:valid query
        - status:invalid query
        - query (plain search)

        Examples:
        - "type:asn 64512"
        - "status:valid 192.0.2.0/24"
        - "type:as-set status:valid AS-EXAMPLE"
        """
        filters = {
            "resource_type": ResourceType.ALL,
            "status": Status.ALL,
            "query": query_string.strip(),
        }

        # Extract type: filter
        type_match = re.search(r"type:(\w+(?:-\w+)?)", query_string)
        if type_match:
            try:
                filters["resource_type"] = ResourceType(type_match.group(1))
                query_string = query_string.replace(type_match.group(0), "").strip()
            except ValueError:
                pass

        # Extract status: filter
        status_match = re.search(r"status:(\w+)", query_string)
        if status_match:
            try:
                filters["status"] = Status(status_match.group(1))
                query_string = query_string.replace(status_match.group(0), "").strip()
            except ValueError:
                pass

        filters["query"] = query_string.strip()
        return filters


def filter_results_by_status(results: List[Dict], status_filter: Status) -> List[Dict]:
    """Filter results by RPKI/IRR validation status"""
    if status_filter == Status.ALL:
        return results

    filtered = []
    for result in results:
        result_status = determine_status(result)
        if status_filter == Status.VALID and result_status == "valid":
            filtered.append(result)
        elif status_filter == Status.INVALID and result_status == "invalid":
            filtered.append(result)
        elif status_filter == Status.UNKNOWN and result_status == "unknown":
            filtered.append(result)

    return filtered


def determine_status(result: Dict) -> str:
    """Determine the validation status of a result"""
    category = result.get("category", "")
    messages = result.get("messages", [])

    if category == "error":
        return "invalid"
    elif category == "warning":
        return "unknown"
    elif category == "success":
        return "valid"

    # Check messages for status indicators
    for msg in messages:
        msg_lower = msg.lower()
        if "invalid" in msg_lower or "not found" in msg_lower:
            return "invalid"
        if "valid" in msg_lower:
            return "valid"

    return "unknown"


def search_within_results(results: List[Dict], search_term: str) -> List[Dict]:
    """Search within existing results for a specific term"""
    if not search_term:
        return results

    search_lower = search_term.lower()
    filtered = []

    for result in results:
        # Search in all string fields
        result_str = str(result).lower()
        if search_lower in result_str:
            filtered.append(result)
            continue

        # Check specific fields
        if "prefix" in result and search_lower in str(result["prefix"]).lower():
            filtered.append(result)
        elif "asn" in result and search_lower in str(result["asn"]).lower():
            filtered.append(result)
        elif "set_name" in result and search_lower in str(result["set_name"]).lower():
            filtered.append(result)

    return filtered


async def advanced_search(request: Request):
    """
    Advanced search endpoint with filters and query syntax.

    Query parameters:
    - q: Search query (supports advanced syntax)
    - type: Resource type filter (asn, prefix, as-set, route-set, all)
    - status: Status filter (valid, invalid, unknown, all)
    - search: Search within results
    """
    query_param = request.query_params.get("q", "").strip()
    resource_type = request.query_params.get("type", "all")
    status_filter = request.query_params.get("status", "all")
    within_search = request.query_params.get("search", "").strip()

    if not query_param:
        return JSONResponse(
            {"error": "Query parameter 'q' is required"}, status_code=400
        )

    # Parse advanced query syntax
    parsed = QueryParser.parse(query_param)

    # Override with explicit parameters if provided
    if resource_type != "all":
        try:
            parsed["resource_type"] = ResourceType(resource_type)
        except ValueError:
            pass

    if status_filter != "all":
        try:
            parsed["status"] = Status(status_filter)
        except ValueError:
            pass

    # Clean and determine query category
    clean_result = await queries.clean_query(request)
    if isinstance(clean_result, JSONResponse):
        clean_data = clean_result.body.decode()
        import json

        clean_data = json.loads(clean_data)
    else:
        clean_data = clean_result

    if "error" in clean_data:
        return JSONResponse(clean_data, status_code=400)

    detected_category = clean_data.get("category", "")
    cleaned_value = clean_data.get("cleanedValue", parsed["query"])

    # Apply resource type filter
    if parsed["resource_type"] != ResourceType.ALL:
        if parsed["resource_type"].value != detected_category:
            return JSONResponse(
                {
                    "results": [],
                    "message": f"Query type mismatch: expected {parsed['resource_type'].value}, got {detected_category}",
                    "filters": {
                        "resource_type": parsed["resource_type"].value,
                        "status": parsed["status"].value,
                        "within_search": within_search,
                    },
                }
            )

    # Fetch results based on category
    results = []
    if detected_category == "asn":
        result = await queries.prefixes_asn(request)
    elif detected_category == "prefix":
        result = await queries.prefixes_prefix(request)
    elif detected_category in ["as-set", "route-set"]:
        result = await queries.set_expansion(request)
    else:
        return JSONResponse({"error": "Unknown query category"}, status_code=400)

    # Parse response
    if isinstance(result, JSONResponse):
        result_data = result.body.decode()
        import json

        result_data = json.loads(result_data)
    else:
        result_data = result

    # Extract results array
    if "prefixes" in result_data:
        results = result_data["prefixes"]
    elif "members" in result_data:
        results = result_data["members"]
    elif isinstance(result_data, list):
        results = result_data
    else:
        results = [result_data]

    # Apply status filter
    results = filter_results_by_status(results, parsed["status"])

    # Apply search within results
    if within_search:
        results = search_within_results(results, within_search)

    return JSONResponse(
        {
            "results": results,
            "count": len(results),
            "query": cleaned_value,
            "filters": {
                "resource_type": parsed["resource_type"].value,
                "status": parsed["status"].value,
                "within_search": within_search,
            },
        }
    )


async def get_filter_options(_request: Request):
    """Get available filter options for advanced search"""
    return JSONResponse(
        {
            "resource_types": [t.value for t in ResourceType],
            "statuses": [s.value for s in Status],
            "syntax_help": {
                "type_filter": "type:asn|prefix|as-set|route-set <query>",
                "status_filter": "status:valid|invalid|unknown <query>",
                "combined": "type:asn status:valid AS64512",
                "search_within": "Use 'search' parameter to filter results",
            },
            "examples": [
                "type:asn 64512",
                "status:valid 192.0.2.0/24",
                "type:as-set AS-EXAMPLE",
                "status:invalid type:prefix 10.0.0.0/8",
            ],
        }
    )
