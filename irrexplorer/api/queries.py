import enum
import hashlib
import json
import re
from dataclasses import dataclass
from ipaddress import ip_network

import IPy
from dataclasses_json import dataclass_json, LetterCase

from irrexplorer.api.collectors import (
    collect_member_of,
    collect_set_expansion,
    PrefixCollector,
)
from irrexplorer.api.interfaces import ObjectClass
from irrexplorer.api.report import enrich_prefix_summaries_with_report
from irrexplorer.api.utils import DataClassJSONResponse
from irrexplorer.backends.irrd import IRRDQuery
from irrexplorer.backends.metadata import get_last_data_import
from irrexplorer.settings import MINIMUM_PREFIX_SIZE
from starlette.responses import PlainTextResponse, Response

# Pre-compiled regex pattern with caching
RE_RPSL_NAME = re.compile(r"^[A-Z][A-Z0-9_:-]*[A-Z0-9]$", re.IGNORECASE)

# Maximum query length to prevent DoS
MAX_QUERY_LENGTH = 255


def add_cache_headers(
    response: Response, max_age: int = 300, content: str | None = None
):
    """
    Add HTTP cache headers to response.

    Args:
        response: Starlette Response object
        max_age: Cache duration in seconds (default: 300 = 5 minutes)
        content: Optional content for ETag generation
    """
    response.headers["Cache-Control"] = f"public, max-age={max_age}"

    if content:
        # Generate ETag from content hash
        etag = hashlib.md5(content.encode()).hexdigest()
        response.headers["ETag"] = f'"{etag}"'

    return response


class InvalidQueryError(Exception):
    pass


class QueryCategory(enum.Enum):
    ASN = "asn"
    PREFIX = "prefix"
    ASSET = "as-set"
    ROUTESET = "route-set"


@dataclass_json(letter_case=LetterCase.CAMEL)
@dataclass
class Query:
    category: QueryCategory
    cleaned_value: str

    def __init__(self, raw_query: str):
        raw_query = raw_query.strip()

        # Input length validation to prevent DoS
        if len(raw_query) > MAX_QUERY_LENGTH:
            raise InvalidQueryError(
                f"Query too long (max {MAX_QUERY_LENGTH} characters)"
            )

        try:
            is_asn = raw_query.upper().startswith(
                "AS"
            ) and not raw_query.upper().startswith("AS-")
            trimmed = raw_query[2:] if is_asn else raw_query
            self.cleaned_value = "AS" + str(int(trimmed))
            self.category = QueryCategory.ASN
            return
        except ValueError:
            pass

        try:
            prefix = IPy.IP(raw_query, make_net=True)
            self.cleaned_value = str(prefix)
            self.category = QueryCategory.PREFIX
            minimum_length = MINIMUM_PREFIX_SIZE[prefix.version()]
            if minimum_length > prefix.prefixlen():
                raise InvalidQueryError(
                    f"Query too large: the minimum prefix length is {minimum_length}."
                )
            return
        except ValueError:
            pass

        if RE_RPSL_NAME.match(raw_query):
            self.cleaned_value = raw_query.upper()
            if self.cleaned_value.startswith("RS-") or ":RS-" in self.cleaned_value:
                self.category = QueryCategory.ROUTESET
            else:
                self.category = QueryCategory.ASSET
            return

        raise InvalidQueryError("Not a valid prefix, IP, ASN or AS-set.")


async def metadata(request):
    data = {
        "last_update": {
            "irr": await IRRDQuery().query_last_update(),
            "importer": await get_last_data_import(),
        }
    }
    content = json.dumps(data, default=str)
    response = Response(content, media_type="application/json")
    return add_cache_headers(response, max_age=60, content=content)  # 1 minute cache


async def clean_query(request):
    try:
        return DataClassJSONResponse(Query(request.path_params["query"]))
    except InvalidQueryError as iqe:
        return PlainTextResponse(status_code=400, content=str(iqe))


async def prefixes_prefix(request):
    try:
        parameter = ip_network(request.path_params["prefix"])
    except ValueError as ve:
        return PlainTextResponse(status_code=400, content=f"Invalid prefix: {ve}")
    summaries = await PrefixCollector(request.app.state.database).prefix_summary(
        parameter
    )
    enrich_prefix_summaries_with_report(summaries)
    response = DataClassJSONResponse(summaries)
    # Cache prefix queries for 5 minutes
    return add_cache_headers(response, max_age=300, content=response.body.decode())


async def prefixes_asn(request):
    asn = request.path_params["asn"]
    asn_prefixes = await PrefixCollector(request.app.state.database).asn_summary(asn)
    enrich_prefix_summaries_with_report(asn_prefixes.direct_origin)
    enrich_prefix_summaries_with_report(asn_prefixes.overlaps)
    response = DataClassJSONResponse(asn_prefixes)

    # Predictive caching: pre-fetch neighbor ASNs in background
    from irrexplorer.api.predictive_caching import schedule_predictive_cache

    schedule_predictive_cache(request.app.state.database, "asn", asn)

    # Cache ASN queries for 5 minutes
    return add_cache_headers(response, max_age=300, content=response.body.decode())


async def member_of(request):
    object_class_str = request.path_params.get("object_class", "as-set")
    object_class = next(
        (member for member in ObjectClass if member.value == object_class_str), None
    )
    if not object_class:
        return PlainTextResponse(
            status_code=404, content=f"Unknown object class: {object_class_str}"
        )
    sets = await collect_member_of(request.path_params["target"], object_class)
    response = DataClassJSONResponse(sets)
    # Cache set membership queries for 5 minutes
    return add_cache_headers(response, max_age=300, content=response.body.decode())


async def set_expansion(request):
    result = await collect_set_expansion(request.path_params["target"])
    response = DataClassJSONResponse(result)
    # Cache set expansion queries for 5 minutes
    return add_cache_headers(response, max_age=300, content=response.body.decode())
