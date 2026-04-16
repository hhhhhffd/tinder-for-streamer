"""
StreamMatch — Async Redis Connection Pool.

Provides a shared Redis client and a FastAPI dependency for accessing it.
"""

from redis.asyncio import ConnectionPool, Redis

from app.config import get_settings

settings = get_settings()

# Global connection pool — reused across the application lifetime
redis_pool = ConnectionPool.from_url(
    settings.redis_url,
    max_connections=50,
    decode_responses=True,
)


def get_redis_client() -> Redis:
    """Create a Redis client from the shared connection pool."""
    return Redis(connection_pool=redis_pool)


async def close_redis() -> None:
    """Gracefully close the Redis connection pool on shutdown."""
    await redis_pool.aclose()
