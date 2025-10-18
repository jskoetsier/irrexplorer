"""
Redis-based caching utilities for IRRExplorer.
"""

import hashlib
import json
import pickle
from functools import wraps
from typing import Any, Callable, Dict, Optional

import redis

from irrexplorer.settings import config

# Redis connection
_redis_client: Optional[redis.Redis] = None

# Cache TTL in seconds
DEFAULT_TTL = 300  # 5 minutes
ASN_SUMMARY_TTL = 600  # 10 minutes for ASN summaries
METADATA_TTL = 3600  # 1 hour for metadata


def get_redis() -> Optional[redis.Redis]:
    """Get Redis client, create if doesn't exist."""
    global _redis_client

    if _redis_client is None:
        redis_url = config("REDIS_URL", default=None)
        if redis_url:
            try:
                _redis_client = redis.from_url(
                    redis_url,
                    decode_responses=False,
                    socket_connect_timeout=2,
                    socket_timeout=2,
                )
                # Test connection
                _redis_client.ping()
            except (redis.ConnectionError, redis.TimeoutError) as e:
                print(f"Redis connection failed: {e}. Caching disabled.")
                _redis_client = None

    return _redis_client


def cache_key(prefix: str, *args, **kwargs) -> str:
    """Generate a cache key from arguments."""
    key_data = {
        "args": [str(arg) for arg in args],
        "kwargs": {k: str(v) for k, v in sorted(kwargs.items())},
    }
    key_str = json.dumps(key_data, sort_keys=True)
    hash_key = hashlib.md5(key_str.encode()).hexdigest()
    return f"irrexplorer:{prefix}:{hash_key}"


def cached(ttl: int = DEFAULT_TTL, key_prefix: Optional[str] = None):
    """
    Decorator to cache function results in Redis.

    Args:
        ttl: Time-to-live in seconds
        key_prefix: Custom key prefix (defaults to function name)
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

            try:
                # Try to get from cache
                cached_value = redis_client.get(key)
                if cached_value is not None:
                    # Cache hit
                    redis_client.incr(f"irrexplorer:stats:hits")
                    return pickle.loads(cached_value)

                # Cache miss
                redis_client.incr(f"irrexplorer:stats:misses")

            except (redis.ConnectionError, redis.TimeoutError, Exception) as e:
                print(f"Redis get error: {e}")
                # Continue without cache on error

            # Execute function
            result = await func(*args, **kwargs)

            try:
                # Store in cache
                serialized = pickle.dumps(result)
                redis_client.setex(key, ttl, serialized)
            except (redis.ConnectionError, redis.TimeoutError, Exception) as e:
                print(f"Redis set error: {e}")
                # Continue without caching on error

            return result

        return wrapper

    return decorator


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
        if keys:
            return redis_client.delete(*keys)
        return 0
    except Exception as e:
        print(f"Redis clear error: {e}")
        return 0


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
