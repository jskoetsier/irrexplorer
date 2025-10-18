import asyncio
import contextlib
import os
import signal
import sys
import threading
import traceback

import databases

from irrexplorer.api import queries, search_navigation
from irrexplorer.api.caching import clear_cache, get_cache_stats
from irrexplorer.api.utils import DefaultIndexStaticFiles
from irrexplorer.settings import ALLOWED_ORIGINS, DATABASE_URL, DEBUG, TESTING
from slowapi import _rate_limit_exceeded_handler, Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from starlette.routing import Mount, Route

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
    from starlette.responses import JSONResponse

    return JSONResponse(get_cache_stats())


async def cache_clear(request):
    """Endpoint to clear cache (admin only)."""
    from starlette.responses import JSONResponse

    clear_cache()
    return JSONResponse({"status": "cleared"})


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
    Mount(
        "/",
        DefaultIndexStaticFiles(
            directory="frontend/build",
            html=True,
            defaulted_paths=["prefix/", "asn/", "as-set/", "status"],
        ),
    ),
]

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
