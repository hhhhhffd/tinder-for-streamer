"""
StreamMatch — Application Configuration.

Loads and validates all environment variables using Pydantic Settings.
Provides a cached singleton via get_settings() for use across the app.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ---- Database ----
    database_url: str = "postgresql+asyncpg://streammatch:streammatch_secret@postgres:5432/streammatch"

    # ---- Redis ----
    redis_url: str = "redis://redis:6379/0"

    # ---- Twitch OAuth 2.0 ----
    twitch_client_id: str = ""
    twitch_client_secret: str = ""
    twitch_redirect_uri: str = "https://streammatch.app/api/auth/callback"

    # ---- JWT ----
    jwt_secret_key: str = "change-this-to-a-random-secret-at-least-32-chars"
    jwt_algorithm: str = "HS256"
    jwt_expiration_minutes: int = 1440

    # ---- CORS ----
    cors_origins: str = "https://streammatch.app"

    # ---- Celery ----
    celery_broker_url: str = "redis://redis:6379/1"
    celery_result_backend: str = "redis://redis:6379/2"

    # ---- Web Push (VAPID) ----
    vapid_private_key: str = ""
    vapid_public_key: str = ""
    vapid_contact_email: str = "mailto:admin@streammatch.app"

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse comma-separated CORS origins into a list."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance (singleton)."""
    return Settings()
