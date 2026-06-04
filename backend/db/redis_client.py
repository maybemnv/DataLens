import json
from typing import Any, Optional

from ..config import settings
from ..logger import get_logger

logger = get_logger(__name__)

# Try importing Upstash Redis (async HTTP-based client for Upstash)
try:
    from upstash_redis.asyncio import Redis as UpstashRedis
    _UPSTASH_AVAILABLE = True
except ImportError:
    _UPSTASH_AVAILABLE = False
    import redis.asyncio as redis
    _StandardRedis = redis.Redis


class RedisClient:
    def __init__(self, client: Any):
        self.client = client

    async def ping(self) -> bool:
        try:
            await self.client.set("ping_test", "pong", ex=10)
            result = await self.client.get("ping_test")
            await self.client.delete("ping_test")
            return result == "pong"
        except Exception:
            return False

    async def close(self) -> None:
        pass

    async def register_ws(self, session_id: str, ws_id: str, ttl: int = 3600) -> None:
        await self.client.setex(f"ws:{session_id}", ttl, ws_id)

    async def unregister_ws(self, session_id: str) -> None:
        await self.client.delete(f"ws:{session_id}")

    async def get_ws(self, session_id: str) -> Optional[str]:
        return await self.client.get(f"ws:{session_id}")

    async def set_streaming_state(
        self, session_id: str, state: dict[str, Any], ttl: int = 300
    ) -> None:
        key = f"agent_stream:{session_id}"
        await self.client.hset(key, mapping=state)
        await self.client.expire(key, ttl)

    async def get_streaming_state(
        self, session_id: str
    ) -> Optional[dict[str, Any]]:
        key = f"agent_stream:{session_id}"
        data = await self.client.hgetall(key)
        if data:
            return data
        return None

    async def clear_streaming_state(self, session_id: str) -> None:
        await self.client.delete(f"agent_stream:{session_id}")

    async def cache_set(self, key: str, value: Any, ttl: int = 3600) -> None:
        serialized = json.dumps(value)
        await self.client.setex(f"cache:{key}", ttl, serialized)

    async def cache_get(self, key: str) -> Optional[Any]:
        data = await self.client.get(f"cache:{key}")
        if data:
            return json.loads(data)
        return None

    async def cache_delete(self, key: str) -> None:
        await self.client.delete(f"cache:{key}")

    async def rate_limit(
        self, key: str, max_calls: int, window_seconds: int
    ) -> tuple[bool, int]:
        current = await self.client.incr(f"ratelimit:{key}")
        if current == 1:
            await self.client.expire(f"ratelimit:{key}", window_seconds)
        remaining = max(0, max_calls - current)
        return current <= max_calls, remaining


_redis_client: Optional[RedisClient] = None


def _raise_upstash_missing():
    raise ImportError(
        "Upstash Redis is configured but the `upstash-redis` package is not installed. "
        "Install it with: uv add upstash-redis"
    )


async def get_redis() -> RedisClient:
    global _redis_client
    if _redis_client is None:
        if settings.is_upstash_redis:
            if not _UPSTASH_AVAILABLE:
                _raise_upstash_missing()
            client = UpstashRedis(
                url=settings.upstash_redis_rest_url,
                token=settings.upstash_redis_rest_token
            )
            logger.info("Connected to Upstash Redis via REST API")
            _redis_client = RedisClient(client)
        else:
            redis_url = settings.redis_url
            if _UPSTASH_AVAILABLE and "upstash.io" in redis_url:
                from urllib.parse import urlparse
                parsed = urlparse(redis_url)
                token = parsed.username or ""
                scheme = parsed.scheme.replace("redis", "https").replace("rediss", "https")
                url = f"{scheme}://{parsed.hostname}"
                if parsed.port:
                    url += f":{parsed.port}"
                client = UpstashRedis(url=url, token=token)
                logger.info(f"Connected to Upstash Redis at {url}")
                _redis_client = RedisClient(client)
            else:
                client = _StandardRedis.from_url(redis_url)
                logger.info(f"Connected to standard Redis at {redis_url}")
                _redis_client = RedisClient(client)
    return _redis_client


async def close_redis() -> None:
    global _redis_client
    if _redis_client:
        await _redis_client.close()
        _redis_client = None
        logger.info("Redis connection closed")
