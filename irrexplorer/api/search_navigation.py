"""
API endpoints for search navigation features:
- Autocomplete
- Search history
- Bookmarks
- Popular/trending queries
"""

import logging
import uuid
from datetime import datetime, timedelta

from sqlalchemy import and_, desc, func, or_, select
from starlette.requests import Request
from starlette.responses import JSONResponse

from irrexplorer.storage.tables import bookmarks, query_stats, search_history

logger = logging.getLogger(__name__)


def get_or_create_session_id(request: Request) -> str:
    """Get session ID from cookie or create a new one."""
    session_id = request.cookies.get("session_id")
    if not session_id:
        session_id = str(uuid.uuid4())
    return session_id


async def autocomplete(request: Request):
    """
    Autocomplete endpoint for ASN/prefix/set names.
    Returns suggestions based on query stats and search history.
    """
    query_param = request.path_params.get("query", "").strip()
    limit = int(request.query_params.get("limit", "10"))

    if not query_param or len(query_param) < 2:
        return JSONResponse({"suggestions": []})

    database = request.app.state.database
    session_id = get_or_create_session_id(request)

    # Search in query_stats for popular queries matching the prefix
    query_pattern = f"{query_param}%"
    stmt = (
        select(query_stats.c.query, query_stats.c.query_type, query_stats.c.count)
        .where(
            or_(
                query_stats.c.query.ilike(query_pattern),
                query_stats.c.query.ilike(f"%{query_param}%"),
            )
        )
        .order_by(desc(query_stats.c.count))
        .limit(limit)
    )

    results = await database.fetch_all(stmt)

    suggestions = [
        {"query": row["query"], "type": row["query_type"], "popularity": row["count"]}
        for row in results
    ]

    response = JSONResponse({"suggestions": suggestions})
    response.set_cookie("session_id", session_id, max_age=31536000)  # 1 year
    return response


async def add_search_history(request: Request):
    """Add a query to search history."""
    data = await request.json()
    query = data.get("query", "").strip()
    query_type = data.get("query_type", "").strip()

    if not query or not query_type:
        return JSONResponse({"error": "Missing query or query_type"}, status_code=400)

    database = request.app.state.database
    session_id = get_or_create_session_id(request)

    # Add to search history
    stmt = search_history.insert().values(
        session_id=session_id,
        query=query,
        query_type=query_type,
        timestamp=datetime.now(),
    )
    await database.execute(stmt)

    # Update query stats
    # Try to increment existing, or insert new
    update_stmt = (
        query_stats.update()
        .where(
            and_(query_stats.c.query == query, query_stats.c.query_type == query_type)
        )
        .values(count=query_stats.c.count + 1, last_accessed=datetime.now())
    )
    result = await database.execute(update_stmt)

    if result == 0:  # No rows updated, insert new
        insert_stmt = query_stats.insert().values(
            query=query, query_type=query_type, count=1, last_accessed=datetime.now()
        )
        try:
            await database.execute(insert_stmt)
        except Exception as e:
            # Race condition: another request already inserted this record
            # This is expected in high-concurrency scenarios and can be safely ignored
            logger.debug(f"Query stats insert race condition: {e}")

    response = JSONResponse({"status": "success"})
    response.set_cookie("session_id", session_id, max_age=31536000)
    return response


async def get_search_history(request: Request):
    """Get search history for the current session."""
    limit = int(request.query_params.get("limit", "20"))

    database = request.app.state.database
    session_id = get_or_create_session_id(request)

    stmt = (
        select(
            search_history.c.id,
            search_history.c.query,
            search_history.c.query_type,
            search_history.c.timestamp,
        )
        .where(search_history.c.session_id == session_id)
        .order_by(desc(search_history.c.timestamp))
        .limit(limit)
    )

    results = await database.fetch_all(stmt)

    history = [
        {
            "id": row["id"],
            "query": row["query"],
            "type": row["query_type"],
            "timestamp": row["timestamp"].isoformat(),
        }
        for row in results
    ]

    response = JSONResponse({"history": history})
    response.set_cookie("session_id", session_id, max_age=31536000)
    return response


async def clear_search_history(request: Request):
    """Clear search history for the current session."""
    database = request.app.state.database
    session_id = get_or_create_session_id(request)

    stmt = search_history.delete().where(search_history.c.session_id == session_id)
    await database.execute(stmt)

    response = JSONResponse({"status": "success"})
    response.set_cookie("session_id", session_id, max_age=31536000)
    return response


async def add_bookmark(request: Request):
    """Add a bookmark."""
    data = await request.json()
    query = data.get("query", "").strip()
    query_type = data.get("query_type", "").strip()
    name = data.get("name", "").strip()

    if not query or not query_type:
        return JSONResponse({"error": "Missing query or query_type"}, status_code=400)

    database = request.app.state.database
    session_id = get_or_create_session_id(request)

    # Check if bookmark already exists
    check_stmt = select(bookmarks.c.id).where(
        and_(
            bookmarks.c.session_id == session_id,
            bookmarks.c.query == query,
            bookmarks.c.query_type == query_type,
        )
    )
    existing = await database.fetch_one(check_stmt)

    if existing:
        return JSONResponse({"error": "Bookmark already exists"}, status_code=409)

    # Add bookmark
    stmt = bookmarks.insert().values(
        session_id=session_id,
        query=query,
        query_type=query_type,
        name=name if name else None,
        timestamp=datetime.now(),
    )

    try:
        await database.execute(stmt)
        response = JSONResponse({"status": "success"})
    except Exception as e:
        response = JSONResponse({"error": str(e)}, status_code=500)

    response.set_cookie("session_id", session_id, max_age=31536000)
    return response


async def get_bookmarks(request: Request):
    """Get all bookmarks for the current session."""
    database = request.app.state.database
    session_id = get_or_create_session_id(request)

    stmt = (
        select(
            bookmarks.c.id,
            bookmarks.c.query,
            bookmarks.c.query_type,
            bookmarks.c.name,
            bookmarks.c.timestamp,
        )
        .where(bookmarks.c.session_id == session_id)
        .order_by(desc(bookmarks.c.timestamp))
    )

    results = await database.fetch_all(stmt)

    bookmark_list = [
        {
            "id": row["id"],
            "query": row["query"],
            "type": row["query_type"],
            "name": row["name"],
            "timestamp": row["timestamp"].isoformat(),
        }
        for row in results
    ]

    response = JSONResponse({"bookmarks": bookmark_list})
    response.set_cookie("session_id", session_id, max_age=31536000)
    return response


async def delete_bookmark(request: Request):
    """Delete a bookmark by ID."""
    bookmark_id = request.path_params.get("bookmark_id")

    database = request.app.state.database
    session_id = get_or_create_session_id(request)

    # Only allow deleting own bookmarks
    stmt = bookmarks.delete().where(
        and_(bookmarks.c.id == bookmark_id, bookmarks.c.session_id == session_id)
    )

    result = await database.execute(stmt)

    if result == 0:
        return JSONResponse({"error": "Bookmark not found"}, status_code=404)

    response = JSONResponse({"status": "success"})
    response.set_cookie("session_id", session_id, max_age=31536000)
    return response


async def get_popular_queries(request: Request):
    """Get popular/trending queries."""
    limit = int(request.query_params.get("limit", "10"))
    days = int(request.query_params.get("days", "7"))

    database = request.app.state.database

    # Get queries accessed in the last N days
    since = datetime.now() - timedelta(days=days)

    stmt = (
        select(
            query_stats.c.query,
            query_stats.c.query_type,
            query_stats.c.count,
            query_stats.c.last_accessed,
        )
        .where(query_stats.c.last_accessed >= since)
        .order_by(desc(query_stats.c.count))
        .limit(limit)
    )

    results = await database.fetch_all(stmt)

    popular = [
        {
            "query": row["query"],
            "type": row["query_type"],
            "count": row["count"],
            "last_accessed": row["last_accessed"].isoformat(),
        }
        for row in results
    ]

    return JSONResponse({"popular_queries": popular})


async def get_trending_queries(request: Request):
    """Get trending queries (queries with recent spike in popularity)."""
    limit = int(request.query_params.get("limit", "10"))

    database = request.app.state.database

    # Get queries from the last 24 hours
    since = datetime.now() - timedelta(days=1)

    stmt = (
        select(
            search_history.c.query,
            search_history.c.query_type,
            func.count().label("recent_count"),
        )
        .where(search_history.c.timestamp >= since)
        .group_by(search_history.c.query, search_history.c.query_type)
        .order_by(desc("recent_count"))
        .limit(limit)
    )

    results = await database.fetch_all(stmt)

    trending = [
        {
            "query": row["query"],
            "type": row["query_type"],
            "recent_count": row["recent_count"],
        }
        for row in results
    ]

    return JSONResponse({"trending_queries": trending})
