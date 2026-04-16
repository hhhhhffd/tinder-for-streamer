"""
StreamMatch — FastAPI Application Factory.

Creates and configures the FastAPI app with:
- CORS middleware
- Lifespan handler (DB + Redis connect/disconnect)
- Health check endpoint
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.router import api_router
from app.config import get_settings
from app.database import engine
from app.redis import close_redis, get_redis_client
from app.ws.chat import router as ws_chat_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Manage application startup and shutdown lifecycle.

    On startup: verify database and Redis connections.
    On shutdown: dispose engine and close Redis pool.
    """
    # Startup — verify database connection
    async with engine.begin() as conn:
        await conn.execute(text("SELECT 1"))

    # Startup — verify Redis connection
    redis = get_redis_client()
    await redis.ping()
    await redis.aclose()

    yield

    # Shutdown — clean up connections
    await engine.dispose()
    await close_redis()


def create_app() -> FastAPI:
    """Build and return the configured FastAPI application."""
    application = FastAPI(
        title="StreamMatch API",
        description="Tinder-style matching platform for Twitch streamers",
        version="1.0.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    # CORS middleware
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Health check endpoint
    @application.get("/api/health", tags=["health"])
    async def health_check() -> dict:
        """
        Health check endpoint — verifies database and Redis connectivity.

        Returns service status for each dependency.
        """
        health: dict = {"status": "ok", "services": {"db": "ok", "redis": "ok"}}

        # Check database
        try:
            async with engine.begin() as conn:
                await conn.execute(text("SELECT 1"))
        except Exception as exc:
            health["status"] = "degraded"
            health["services"]["db"] = f"error: {exc}"

        # Check Redis
        try:
            redis = get_redis_client()
            await redis.ping()
            await redis.aclose()
        except Exception as exc:
            health["status"] = "degraded"
            health["services"]["redis"] = f"error: {exc}"

        return health

    # Include API routes
    application.include_router(api_router)

    # Include WebSocket routes
    application.include_router(ws_chat_router)

    return application


# Application instance — used by uvicorn
app = create_app()
