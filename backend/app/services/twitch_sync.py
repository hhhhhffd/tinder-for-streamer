"""
StreamMatch — Twitch Data Sync Service.

Async function that syncs a single user's data from the Twitch Helix API:
- Fetches fresh profile, followers, stream, and channel info
- Updates UserStats (avg_viewers, follower_count, league, language)
- Replaces UserCategories with the latest categories from the channel
- Handles token refresh when the stored access token has expired

Called by Celery tasks via asyncio.run() bridge.
"""

import logging
import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import async_session_factory
from app.models.user import User, UserCategory, UserStats
from app.redis import get_redis_client
from app.services.league import calculate_league
from app.services.twitch import TWITCH_TOKEN_URL, TwitchAPIError, TwitchService

logger = logging.getLogger(__name__)
settings = get_settings()

# Redis key prefixes (must match api/auth.py)
TWITCH_TOKEN_PREFIX = "twitch_token:"

# Maximum number of recent categories to store per user
MAX_CATEGORIES = 5


async def _refresh_twitch_token(user_id: uuid.UUID) -> str | None:
    """
    Attempt to refresh a Twitch access token using the stored refresh token.

    If successful, stores the new access token in Redis and returns it.
    If no refresh token exists or refresh fails, returns None.
    """
    redis = get_redis_client()
    try:
        refresh_token = await redis.get(f"{TWITCH_TOKEN_PREFIX}{user_id}:refresh")
        if not refresh_token:
            logger.warning("No refresh token for user %s", user_id)
            return None

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                TWITCH_TOKEN_URL,
                data={
                    "client_id": settings.twitch_client_id,
                    "client_secret": settings.twitch_client_secret,
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                },
            )

        if response.status_code != 200:
            logger.error(
                "Token refresh failed for user %s: %s %s",
                user_id, response.status_code, response.text,
            )
            return None

        data = response.json()
        new_access_token = data["access_token"]
        new_refresh_token = data.get("refresh_token", refresh_token)
        expires_in = data.get("expires_in", 14400)

        # Store new tokens in Redis
        await redis.setex(
            f"{TWITCH_TOKEN_PREFIX}{user_id}",
            expires_in,
            new_access_token,
        )
        await redis.set(
            f"{TWITCH_TOKEN_PREFIX}{user_id}:refresh",
            new_refresh_token,
        )

        logger.info("Refreshed Twitch token for user %s", user_id)
        return new_access_token
    finally:
        await redis.aclose()


async def _get_valid_token(user_id: uuid.UUID) -> str | None:
    """
    Retrieve a valid Twitch access token for a user.

    First checks Redis for a cached token. If expired or missing,
    attempts a refresh. Returns None if no valid token is available.
    """
    redis = get_redis_client()
    try:
        token = await redis.get(f"{TWITCH_TOKEN_PREFIX}{user_id}")
    finally:
        await redis.aclose()

    if token:
        return token

    # Token expired — try refreshing
    return await _refresh_twitch_token(user_id)


async def sync_user_data(user_id: uuid.UUID) -> bool:
    """
    Sync a single user's data from the Twitch Helix API.

    Fetches the latest profile info, follower count, stream status,
    and channel categories. Updates UserStats and UserCategories in
    the database. Recalculates the user's league based on avg_viewers.

    Returns True on success, False if sync failed (no token, API error, etc.).
    """
    # 1. Get a valid Twitch token
    access_token = await _get_valid_token(user_id)
    if not access_token:
        logger.warning("Skipping sync for user %s: no valid Twitch token", user_id)
        return False

    async with httpx.AsyncClient(timeout=15.0) as http_client:
        twitch = TwitchService(
            http_client=http_client,
            client_id=settings.twitch_client_id,
            client_secret=settings.twitch_client_secret,
            redirect_uri=settings.twitch_redirect_uri,
        )

        try:
            # 2. Fetch user profile from Twitch
            twitch_user = await twitch.get_user(access_token)

            # 3. Fetch follower count
            follower_count = await twitch.get_followers_count(
                access_token, twitch_user["id"],
            )

            # 4. Fetch current stream (for viewer count)
            stream_data = await twitch.get_streams(access_token, twitch_user["id"])

            # 5. Fetch channel info (for language and current category)
            channel_info = await twitch.get_channel_info(
                access_token, twitch_user["id"],
            )
        except TwitchAPIError as exc:
            logger.error("Twitch API error syncing user %s: %s", user_id, exc.detail)
            return False

    # 6. Calculate avg_viewers — use live viewer count if streaming
    avg_viewers = stream_data["viewer_count"] if stream_data else 0
    league = calculate_league(avg_viewers)
    stream_language = channel_info.get("broadcaster_language", "ru")

    # 7. Update database
    async with async_session_factory() as db:
        try:
            # Update User basic fields
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            if user is None:
                logger.error("User %s not found in DB during sync", user_id)
                return False

            user.login = twitch_user["login"]
            user.display_name = twitch_user["display_name"]
            user.profile_image_url = twitch_user.get("profile_image_url", "")
            user.broadcaster_type = twitch_user.get("broadcaster_type", "")

            # Update or create UserStats
            stats_result = await db.execute(
                select(UserStats).where(UserStats.user_id == user_id),
            )
            user_stats = stats_result.scalar_one_or_none()

            if user_stats is not None:
                # Compute rolling avg: weight existing with new
                # If user is live, blend current viewers; otherwise keep old avg
                if stream_data:
                    # Weighted average: 70% historical, 30% current stream
                    user_stats.avg_viewers = int(
                        user_stats.avg_viewers * 0.7 + avg_viewers * 0.3,
                    )
                # Always update follower count and league
                user_stats.follower_count = follower_count
                user_stats.league = calculate_league(user_stats.avg_viewers)
                user_stats.stream_language = stream_language
                user_stats.last_synced_at = datetime.now(timezone.utc)
            else:
                user_stats = UserStats(
                    user_id=user_id,
                    follower_count=follower_count,
                    avg_viewers=avg_viewers,
                    league=league,
                    stream_language=stream_language,
                    last_synced_at=datetime.now(timezone.utc),
                )
                db.add(user_stats)

            # Update categories — add current game if not already present
            if channel_info.get("game_id") and channel_info.get("game_name"):
                # Check existing categories count
                existing_cats_result = await db.execute(
                    select(UserCategory)
                    .where(UserCategory.user_id == user_id)
                    .order_by(UserCategory.id),
                )
                existing_cats = list(existing_cats_result.scalars().all())

                # Check if this category already exists
                cat_ids = {c.category_id for c in existing_cats}
                if channel_info["game_id"] not in cat_ids:
                    # If at max capacity, remove the oldest
                    if len(existing_cats) >= MAX_CATEGORIES:
                        oldest = existing_cats[0]
                        await db.delete(oldest)

                    new_cat = UserCategory(
                        user_id=user_id,
                        category_id=channel_info["game_id"],
                        category_name=channel_info["game_name"],
                        box_art_url="",
                    )
                    db.add(new_cat)

            await db.commit()
            logger.info("Successfully synced user %s (%s)", user.login, user_id)
            return True

        except Exception:
            await db.rollback()
            logger.exception("Database error syncing user %s", user_id)
            return False


async def get_all_active_user_ids() -> list[uuid.UUID]:
    """
    Fetch IDs of all active (non-banned) users for bulk sync.

    Returns a list of user UUIDs that should be synced.
    """
    async with async_session_factory() as db:
        result = await db.execute(
            select(User.id).where(User.is_banned.is_(False)),
        )
        return list(result.scalars().all())
