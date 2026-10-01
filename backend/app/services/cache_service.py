"""CivicAid Cache Service — Redis with in-memory fallback"""
import json
import time
import logging
from typing import Optional, Any
from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)
_memory_cache: dict[str, tuple[Any, float]] = {}


class CacheService:
    def __init__(self):
        self._redis = None
        self._use_memory = False
        self._connect()

    def _connect(self):
        try:
            import redis
            self._redis = redis.from_url(settings.redis_url, decode_responses=True, socket_timeout=2)
            self._redis.ping()
            logger.info("Redis connected")
        except Exception:
            logger.warning("Redis unavailable — using in-memory cache")
            self._use_memory = True

    def get(self, key: str) -> Optional[Any]:
        if self._use_memory:
            if key in _memory_cache:
                value, expiry = _memory_cache[key]
                if expiry == 0 or time.time() < expiry:
                    return value
                del _memory_cache[key]
            return None
        try:
            val = self._redis.get(key)
            return json.loads(val) if val else None
        except Exception:
            return None

    def set(self, key: str, value: Any, ttl: int = 300):
        if self._use_memory:
            _memory_cache[key] = (value, time.time() + ttl if ttl else 0)
            return
        try:
            self._redis.setex(key, ttl, json.dumps(value))
        except Exception:
            pass

    def increment(self, key: str, ttl: int = 86400) -> int:
        if self._use_memory:
            val, _ = _memory_cache.get(key, (0, 0))
            new_val = int(val) + 1
            _memory_cache[key] = (new_val, time.time() + ttl)
            return new_val
        try:
            pipe = self._redis.pipeline()
            pipe.incr(key)
            pipe.expire(key, ttl)
            return pipe.execute()[0]
        except Exception:
            return 0

    def delete(self, key: str) -> bool:
        if self._use_memory:
            if key in _memory_cache:
                del _memory_cache[key]
                return True
            return False
        try:
            return bool(self._redis.delete(key))
        except Exception:
            return False


_cache: Optional[CacheService] = None

def get_cache() -> CacheService:
    global _cache
    if _cache is None:
        _cache = CacheService()
    return _cache
