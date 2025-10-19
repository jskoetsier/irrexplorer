import asyncio
import contextlib
import os
import signal
import sys
import threading
import traceback

import databases
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from starlette.responses import JSONResponse
from starlette.routing import Mount, Route

from irrexplorer.api import (
    advanced_search,
    analysis,
    bgpalerter_manager,
    datasources,
    export,
    openapi,
    queries,
    search_navigation,
    visualization,
)
from irrexplorer.api.caching import clear_cache, get_cache_stats
from irrexplorer.api.utils import DefaultIndexStaticFiles
from irrexplorer.settings import ALLOWED_ORIGINS, DATABASE_URL, DEBUG, TESTING

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])


@contextlib.asynccontextmanager
async def lifespan(app):
    signal.signal(signal.SIGUSR1, sigusr1_handler)
    app.state.database = databases.Database(
        DATABASE_URL,
        force_rollback=TESTING,
        min_size=5,
        max_size=20,
        max_queries=50000,
        max_inactive_connection_lifetime=300,
    )
    await app.state.database.connect()

    # Warm cache on startup (run in background)
    if not TESTING:
        from irrexplorer.api.cache_warmer import warm_cache_on_startup

        asyncio.create_task(warm_cache_on_startup(app.state.database))

    yield
    await app.state.database.disconnect()


async def cache_stats(request):
    """Endpoint to view cache statistics."""
    return JSONResponse(get_cache_stats())


async def cache_clear(request):
    """Endpoint to clear cache (admin only)."""
    clear_cache()
    return JSONResponse({"status": "cleared"})


async def root_handler(request):
    """Root handler for testing or when frontend not built."""
    return JSONResponse({"status": "ok", "testing": TESTING})


routes = [
    Route("/api/metadata/", queries.metadata),
    Route("/api/cache/stats", cache_stats),
    Route("/api/cache/clear", cache_clear),
    Route("/api/clean_query/{query:path}", queries.clean_query),
    Route("/api/prefixes/asn/AS{asn:int}", queries.prefixes_asn),
    Route("/api/prefixes/asn/{asn:int}", queries.prefixes_asn),
    Route("/api/prefixes/prefix/{prefix:path}", queries.prefixes_prefix),
    Route("/api/sets/member-of/{object_class}/{target}", queries.member_of),
    # legacy endpoint before object class was added:
    Route("/api/sets/member-of/{target}", queries.member_of),
    Route("/api/sets/expand/{target}", queries.set_expansion),
    # Search & Navigation endpoints
    Route("/api/autocomplete/{query:path}", search_navigation.autocomplete),
    Route("/api/search-history", search_navigation.get_search_history),
    Route(
        "/api/search-history", search_navigation.add_search_history, methods=["POST"]
    ),
    Route(
        "/api/search-history/clear",
        search_navigation.clear_search_history,
        methods=["DELETE"],
    ),
    Route("/api/bookmarks", search_navigation.get_bookmarks),
    Route("/api/bookmarks", search_navigation.add_bookmark, methods=["POST"]),
    Route(
        "/api/bookmarks/{bookmark_id:int}",
        search_navigation.delete_bookmark,
        methods=["DELETE"],
    ),
    Route("/api/popular", search_navigation.get_popular_queries),
    Route("/api/trending", search_navigation.get_trending_queries),
    # Advanced search endpoints
    Route("/api/advanced-search", advanced_search.advanced_search),
    Route("/api/filter-options", advanced_search.get_filter_options),
    # Visualization endpoints
    Route("/api/viz/prefix-allocation", visualization.get_prefix_allocation_data),
    Route("/api/viz/asn-relationships/{asn}", visualization.get_asn_relationships),
    Route("/api/viz/timeline", visualization.get_historical_timeline),
    Route("/api/viz/rir-distribution", visualization.get_rir_distribution),
    Route("/api/viz/prefix-distribution", visualization.get_prefix_size_distribution),
    # Export & Reporting endpoints
    Route("/api/export/csv", export.export_to_csv, methods=["POST"]),
    Route("/api/export/json", export.export_to_json, methods=["POST"]),
    Route("/api/export/pdf", export.generate_pdf_report, methods=["POST"]),
    Route("/api/bulk-query", export.bulk_query, methods=["POST"]),
    # API Documentation endpoints
    Route("/api/docs/openapi.json", openapi.openapi_schema),
    Route("/api/docs", openapi.swagger_ui),
    # Enhanced Analysis endpoints
    Route("/api/analysis/rpki-dashboard", analysis.get_rpki_dashboard),
    Route("/api/analysis/roa-coverage", analysis.get_roa_coverage),
    Route("/api/analysis/irr-consistency", analysis.get_irr_consistency),
    Route("/api/analysis/hijack-detection", analysis.get_hijack_detection),
    Route("/api/analysis/prefix-overlap", analysis.get_prefix_overlap),
    Route("/api/analysis/as-path", analysis.get_as_path_analysis),
    Route("/api/analysis/whois", analysis.get_whois_info),
    # Data Sources endpoints - Looking Glass
    Route("/api/datasources/lg/prefix/{prefix:path}", datasources.looking_glass_prefix),
    Route("/api/datasources/lg/asn/{asn}", datasources.looking_glass_asn),
    Route("/api/datasources/lg/route/{prefix:path}", datasources.looking_glass_route),
    Route("/api/datasources/lg/peers", datasources.looking_glass_peers),
    # Data Sources endpoints - RDAP
    Route("/api/datasources/rdap/ip/{ip:path}", datasources.rdap_ip),
    Route("/api/datasources/rdap/asn/{asn}", datasources.rdap_asn),
    Route("/api/datasources/rdap/domain/{domain:path}", datasources.rdap_domain),
    # Data Sources endpoints - PeeringDB
    Route("/api/datasources/peeringdb/asn/{asn}", datasources.peeringdb_asn),
    Route(
        "/api/datasources/peeringdb/facility/{facility_id:int}",
        datasources.peeringdb_facility,
    ),
    Route("/api/datasources/peeringdb/ix/{ix_id:int}", datasources.peeringdb_ix),
    Route("/api/datasources/peeringdb/search", datasources.peeringdb_search),
    # BGPalerter Management endpoints
    Route("/api/bgpalerter/status", bgpalerter_manager.get_bgpalerter_status),
    Route("/api/bgpalerter/monitored-asns", bgpalerter_manager.get_monitored_asns),
    Route(
        "/api/bgpalerter/monitored-asns",
        bgpalerter_manager.add_monitored_asn,
        methods=["POST"],
    ),
    Route(
        "/api/bgpalerter/monitored-asns/{asn}",
        bgpalerter_manager.delete_monitored_asn,
        methods=["DELETE"],
    ),
    Route("/api/bgpalerter/alerts", bgpalerter_manager.get_recent_alerts),
    Route(
        "/api/bgpalerter/webhook/{alert_type}",
        bgpalerter_manager.webhook_receiver,
        methods=["POST"],
    ),
]

# Only mount static files if not testing and directory exists
if not TESTING and os.path.exists("frontend/build"):
    routes.append(
        Mount(
            "/",
            DefaultIndexStaticFiles(
                directory="frontend/build",
                html=True,
                defaulted_paths=["prefix/", "asn/", "as-set/", "status"],
            ),
        )
    )
else:
    # In testing or when frontend not built, add a simple root route
    routes.append(Route("/", root_handler))

middleware = [
    Middleware(GZipMiddleware, minimum_size=1000),
    Middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_headers=["Cache-Control", "Pragma", "Expires"],
        allow_methods=["GET", "OPTIONS"],
        max_age=3600,
    ),
]

app = Starlette(
    debug=DEBUG,
    routes=routes,
    middleware=middleware,
    lifespan=lifespan,
)

# Add rate limiter state and exception handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


def sigusr1_handler(signal, frame):  # pragma: no cover
    thread_names = {th.ident: th.name for th in threading.enumerate()}
    code = [f"Traceback follows for all threads of process {os.getpid()}:"]
    for thread_id, stack in sys._current_frames().items():
        thread_name = thread_names.get(thread_id, "")
        code.append(f"\n## Thread: {thread_name}({thread_id}) ##\n")
        code += traceback.format_list(traceback.extract_stack(stack))
    print("".join(code))
