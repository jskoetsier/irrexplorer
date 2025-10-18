"""
Caching utilities for IRRExplorer.
"""

import hashlib
import json
import time
from functools import wraps
from typing import Any, Callable, Dict, Optional

# Simple in-memory cache
_cache: Dict[str, tuple[float, Any]] = {}
_cache_hits = 0
_cache_misses = 0

# Cache TTL in seconds
DEFAULT_TTL = 300  # 5 minutes
ASN_SUMMARY_TTL = 600  # 10 minutes for ASN summaries (they're expensive)


def cache_key(*args, **kwargs) -> str:
    """Generate a cache key from arguments."""
    key_data = {
        "args": [str(arg) for arg in args],
        "kwargs": {k: str(v) for k, v in sorted(kwargs.items())},
    }
    key_str = json.dumps(key_data, sort_keys=True)
    return hashlib.md5(key_str.encode()).hexdigest()


def cached(ttl: int = DEFAULT_TTL):
    """
    Decorator to cache function results.

    Args:
        ttl: Time-to-live in seconds
    """

    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            global _cache_hits, _cache_misses

            # Generate cache key
            key = f"{func.__module__}.{func.__name__}:{cache_key(*args, **kwargs)}"

            # Check cache
            if key in _cache:
                expiry, value = _cache[key]
                if time.time() < expiry:
                    _cache_hits += 1
                    return value
                else:
                    # Expired, remove from cache
                    del _cache[key]

            # Cache miss, execute function
            _cache_misses += 1
            result = await func(*args, **kwargs)

            # Store in cache
            _cache[key] = (time.time() + ttl, result)

            # Cleanup old entries if cache is too large
            if len(_cache) > 1000:
                _cleanup_cache()

            return result

        return wrapper

    return decorator


def _cleanup_cache():
    """Remove expired entries from cache."""
    global _cache
    current_time = time.time()
    expired_keys = [k for k, (expiry, _) in _cache.items() if current_time >= expiry]
    for key in expired_keys:
        del _cache[key]


def clear_cache():
    """Clear all cached entries."""
    global _cache, _cache_hits, _cache_misses
    _cache.clear()
    _cache_hits = 0
    _cache_misses = 0


def get_cache_stats() -> Dict[str, Any]:
    """Get cache statistics."""
    return {
        "size": len(_cache),
        "hits": _cache_hits,
        "misses": _cache_misses,
        "hit_rate": (
            _cache_hits / (_cache_hits + _cache_misses)
            if (_cache_hits + _cache_misses) > 0
            else 0
        ),
    }
