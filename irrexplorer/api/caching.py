"""
Redis-based caching utilities for IRRExplorer.
"""

import asyncio
import hashlib
import json
import logging
import pickle  # nosec B403 - Used for internal caching of trusted data only
import time
from functools import wraps
from typing import Any, Callable, Dict, Optional

import redis

from irrexplorer.settings import config

logger = logging.getLogger(__name__)

# Global Redis client instance
_redis_client: Optional[redis.Redis] = None

# Cache TTL in seconds
DEFAULT_TTL = 300  # 5 minutes
PREFIX_SUMMARY_TTL = 300  # 5 minutes for prefix summaries
ASN_SUMMARY_TTL = 600  # 10 minutes for ASN summaries
METADATA_TTL = 3600  # 1 hour for metadata

# Stale-while-revalidate settings
STALE_GRACE_PERIOD = 300  # 5 minutes - serve stale while refreshing
REVALIDATION_TIMEOUT = 30  # 30 seconds - max time for background refresh


def get_redis() -> Optional[redis.Redis]:
    """Get or create a Redis client instance with connection pooling."""
    global _redis_client

    if _redis_client is None:
        redis_url = config("REDIS_URL", default=None)
        if redis_url:
            try:
                # Create connection pool for better performance
                pool = redis.ConnectionPool.from_url(
                    redis_url,
                    decode_responses=False,
                    socket_connect_timeout=2,
                    socket_timeout=2,
                    max_connections=50,  # Pool size
                    retry_on_timeout=True,
                    health_check_interval=30,  # Check connection health every 30s
                )
                _redis_client = redis.Redis(connection_pool=pool)
                # Test connection
                _redis_client.ping()
            except (redis.ConnectionError, redis.TimeoutError) as e:
                logger.warning(f"Redis connection failed: {e}. Caching disabled.")
                _redis_client = None

    return _redis_client


def cache_key(prefix: str, *args, **kwargs) -> str:
    """Generate a cache key from arguments."""
    key_data = {
        "args": [str(arg) for arg in args],
        "kwargs": {k: str(v) for k, v in sorted(kwargs.items())},
    }
    key_str = json.dumps(key_data, sort_keys=True)
    hash_key = hashlib.md5(key_str.encode(), usedforsecurity=False).hexdigest()
    return f"irrexplorer:{prefix}:{hash_key}"


def cached(
    ttl: int = DEFAULT_TTL,
    key_prefix: Optional[str] = None,
    stale_while_revalidate: bool = False,
):
    """
    Decorator to cache function results in Redis with stale-while-revalidate support.

    Args:
        ttl: Time-to-live in seconds
        key_prefix: Custom key prefix (defaults to function name)
        stale_while_revalidate: Enable stale-while-revalidate pattern
    """

    def decorator(func: Callable):
        prefix = key_prefix or f"{func.__module__}.{func.__name__}"

        @wraps(func)
        async def wrapper(*args, **kwargs):
            redis_client = get_redis()

            # If Redis is not available, just execute the function
            if redis_client is None:
                return await func(*args, **kwargs)

            # Generate cache key - skip 'self' for instance methods
            cache_args = args[1:] if args and hasattr(args[0], "__dict__") else args
            key = cache_key(prefix, *cache_args, **kwargs)
            timestamp_key = f"{key}:timestamp"

            try:
                # Try to get from cache
                cached_value = redis_client.get(key)
                if cached_value is not None:
                    # Cache hit
                    redis_client.incr("irrexplorer:stats:hits")
                    # Used for internal caching of trusted data only
                    result = pickle.loads(cached_value)  # nosec B301

                    # Check if stale-while-revalidate is enabled
                    if stale_while_revalidate:
                        cached_time = redis_client.get(timestamp_key)
                        if cached_time:
                            age = time.time() - float(cached_time)
                            # If cache is stale but within grace period, refresh in background
                            if ttl < age < (ttl + STALE_GRACE_PERIOD):
                                logger.info(
                                    f"Cache stale for {key}, refreshing in background"
                                )
                                asyncio.create_task(
                                    _refresh_cache(
                                        func, key, timestamp_key, ttl, args, kwargs
                                    )
                                )

                    return result

                # Cache miss
                redis_client.incr("irrexplorer:stats:misses")

            except (redis.ConnectionError, redis.TimeoutError, Exception) as e:
                logger.error(f"Redis get error: {e}", exc_info=True)
                # Continue without cache on error

            # Execute function
            result = await func(*args, **kwargs)

            try:
                # Store in cache with timestamp
                serialized = pickle.dumps(result)
                redis_client.setex(key, ttl + STALE_GRACE_PERIOD, serialized)
                if stale_while_revalidate:
                    redis_client.setex(
                        timestamp_key, ttl + STALE_GRACE_PERIOD, str(time.time())
                    )
            except (redis.ConnectionError, redis.TimeoutError, Exception) as e:
                logger.error(f"Redis set error: {e}", exc_info=True)
                # Continue without caching on error

            return result

        return wrapper

    return decorator


async def _refresh_cache(func, key, timestamp_key, ttl, args, kwargs):
    """Background task to refresh stale cache."""
    try:
        redis_client = get_redis()
        if redis_client is None:
            return

        # Execute function with timeout
        result = await asyncio.wait_for(
            func(*args, **kwargs), timeout=REVALIDATION_TIMEOUT
        )

        # Update cache
        serialized = pickle.dumps(result)
        redis_client.setex(key, ttl + STALE_GRACE_PERIOD, serialized)
        redis_client.setex(timestamp_key, ttl + STALE_GRACE_PERIOD, str(time.time()))
        logger.info(f"Cache refreshed for {key}")
    except asyncio.TimeoutError:
        logger.warning(f"Cache refresh timeout for {key}")
    except Exception as e:
        logger.error(f"Cache refresh failed for {key}: {e}", exc_info=True)


def clear_cache(pattern: str = "*"):
    """
    Clear cache entries matching pattern.

    Args:
        pattern: Redis key pattern (default: all irrexplorer keys)
    """
    redis_client = get_redis()
    if redis_client is None:
        return 0

    try:
        keys = redis_client.keys(f"irrexplorer:{pattern}")
        timestamp_keys = redis_client.keys(f"irrexplorer:{pattern}:timestamp")
        all_keys = keys + timestamp_keys
        if all_keys:
            deleted = redis_client.delete(*all_keys)
            logger.info(f"Cleared {deleted} cache keys matching pattern: {pattern}")
            return deleted
        return 0
    except Exception as e:
        logger.error(f"Redis clear error: {e}", exc_info=True)
        return 0


def invalidate_cache_by_resource(
    resource_type: str, resource_id: str
) -> Dict[str, Any]:
    """
    Invalidate cache for a specific resource and related queries.

    Args:
        resource_type: Type of resource ("asn", "prefix", "set")
        resource_id: Resource identifier

    Returns:
        Dictionary with invalidation results
    """
    redis_client = get_redis()
    if redis_client is None:
        return {"status": "error", "message": "Redis not available"}

    try:
        # Clear cache for the specific resource
        if resource_type == "asn":
            pattern = f"*asn_summary*{resource_id}*"
        elif resource_type == "prefix":
            pattern = f"*prefix_summary*{resource_id}*"
        elif resource_type == "set":
            pattern = f"*set_expansion*{resource_id}*"
        else:
            return {
                "status": "error",
                "message": f"Unknown resource type: {resource_type}",
            }

        # Find and delete matching keys
        keys = redis_client.keys(f"irrexplorer:{pattern}")
        timestamp_keys = redis_client.keys(f"irrexplorer:{pattern}:timestamp")
        all_keys = keys + timestamp_keys

        deleted = 0
        if all_keys:
            deleted = redis_client.delete(*all_keys)
            logger.info(
                f"Invalidated {deleted} cache keys for {resource_type} {resource_id}"
            )

        return {
            "status": "success",
            "resource_type": resource_type,
            "resource_id": resource_id,
            "deleted": deleted,
        }

    except Exception as e:
        logger.error(f"Cache invalidation error: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}


def get_cache_stats() -> Dict[str, Any]:
    """Get cache statistics from Redis."""
    redis_client = get_redis()

    if redis_client is None:
        return {"enabled": False, "error": "Redis not configured or unavailable"}

    try:
        info = redis_client.info("stats")
        hits = int(redis_client.get("irrexplorer:stats:hits") or 0)
        misses = int(redis_client.get("irrexplorer:stats:misses") or 0)
        total = hits + misses

        # Get key count
        key_count = len(redis_client.keys("irrexplorer:*"))

        # Get memory usage
        memory_info = redis_client.info("memory")

        return {
            "enabled": True,
            "connected": True,
            "keys": key_count,
            "hits": hits,
            "misses": misses,
            "total_requests": total,
            "hit_rate": hits / total if total > 0 else 0,
            "memory_used_human": memory_info.get("used_memory_human"),
            "memory_peak_human": memory_info.get("used_memory_peak_human"),
            "total_connections": info.get("total_connections_received"),
            "total_commands": info.get("total_commands_processed"),
        }
    except Exception as e:
        return {"enabled": True, "connected": False, "error": str(e)}
