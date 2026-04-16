"""
StreamMatch — Twitch OAuth 2.0 Authentication Endpoints.

Handles the full OAuth flow:
1. /api/auth/twitch — redirect user to Twitch for authorization
2. /api/auth/twitch/callback — handle Twitch redirect, create/update user, set JWT cookie
3. /api/auth/me — return current authenticated user's profile
4. /api/auth/logout — clear auth cookie and Redis session
"""

import logging
import secrets
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import RedirectResponse
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.dependencies import get_current_user, get_db, get_redis
from app.models.user import User, UserCategory, UserStats
from app.schemas.user import UserProfile
from app.services.auth import AUTH_COOKIE_NAME, AuthService
from app.services.league import calculate_league
from app.services.twitch import TwitchAPIError, TwitchService

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Redis key prefixes
OAUTH_STATE_PREFIX = "oauth_state:"
TWITCH_TOKEN_PREFIX = "twitch_token:"


def _get_twitch_service(http_client: httpx.AsyncClient) -> TwitchService:
    """Create a TwitchService instance with the shared HTTP client."""
    return TwitchService(
        http_client=http_client,
        client_id=settings.twitch_client_id,
        client_secret=settings.twitch_client_secret,
        redirect_uri=settings.twitch_redirect_uri,
    )


@router.get("/twitch")
async def auth_twitch_redirect(
    redis: Redis = Depends(get_redis),
) -> RedirectResponse:
    """
    Initiate the Twitch OAuth flow.

    Generates a cryptographically random state parameter, stores it in
    Redis with a 10-minute TTL for CSRF protection, and redirects the
    user to Twitch's authorization page.
    """
    state = secrets.token_urlsafe(32)

    # Store state in Redis with 10-minute expiry
    await redis.setex(f"{OAUTH_STATE_PREFIX}{state}", 600, "1")

    async with httpx.AsyncClient(timeout=10.0) as client:
        twitch = _get_twitch_service(client)
        auth_url = twitch.get_auth_url(state)

    return RedirectResponse(url=auth_url, status_code=status.HTTP_302_FOUND)


@router.get("/twitch/callback")
async def auth_twitch_callback(
    code: str = Query(..., description="Authorization code from Twitch"),
    state: str = Query(..., description="CSRF state parameter"),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> RedirectResponse:
    """
    Handle the Twitch OAuth callback.

    Validates the state parameter, exchanges the authorization code for tokens,
    fetches user data from Twitch, creates or updates the User/UserStats/UserCategories
    in the database, stores Twitch tokens in Redis, creates a JWT, sets the
    auth cookie, and redirects to the frontend.
    """
    # ---- 1. Validate OAuth state (CSRF protection) ----
    redis_key = f"{OAUTH_STATE_PREFIX}{state}"
    state_valid = await redis.get(redis_key)
    if state_valid is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Невалидный или истёкший state-параметр. Попробуйте войти заново.",
        )
    # Delete state immediately to prevent reuse
    await redis.delete(redis_key)

    # ---- 2. Exchange code for tokens ----
    async with httpx.AsyncClient(timeout=15.0) as client:
        twitch = _get_twitch_service(client)

        try:
            tokens = await twitch.exchange_code(code)
        except TwitchAPIError as exc:
            logger.error("Token exchange failed: %s", exc.detail)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Ошибка авторизации через Twitch. Попробуйте позже.",
            )

        twitch_access_token = tokens["access_token"]

        # ---- 3. Fetch user data from Twitch ----
        try:
            twitch_user = await twitch.get_user(twitch_access_token)
        except TwitchAPIError as exc:
            logger.error("Failed to fetch Twitch user: %s", exc.detail)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Не удалось получить профиль Twitch.",
            )

        # ---- 4. Fetch additional data (followers, channel info) ----
        follower_count = await twitch.get_followers_count(
            twitch_access_token, twitch_user["id"],
        )
        channel_info = await twitch.get_channel_info(
            twitch_access_token, twitch_user["id"],
        )
        stream_data = await twitch.get_streams(
            twitch_access_token, twitch_user["id"],
        )

    # Determine average viewers — use current stream viewers if live, else 0
    avg_viewers = stream_data["viewer_count"] if stream_data else 0
    league = calculate_league(avg_viewers)
    stream_language = channel_info.get("broadcaster_language", "ru")

    # ---- 5. Create or update user in DB ----
    result = await db.execute(
        select(User).where(User.twitch_id == twitch_user["id"]),
    )
    existing_user = result.scalar_one_or_none()
    is_new_user = existing_user is None

    if existing_user is None:
        # Create new user
        user = User(
            twitch_id=twitch_user["id"],
            login=twitch_user["login"],
            display_name=twitch_user["display_name"],
            email=twitch_user.get("email"),
            profile_image_url=twitch_user.get("profile_image_url", ""),
            broadcaster_type=twitch_user.get("broadcaster_type", ""),
            bio=twitch_user.get("description", ""),
        )
        db.add(user)
        await db.flush()

        # Create initial stats
        user_stats = UserStats(
            user_id=user.id,
            follower_count=follower_count,
            avg_viewers=avg_viewers,
            league=league,
            stream_language=stream_language,
            last_synced_at=datetime.now(timezone.utc),
        )
        db.add(user_stats)
    else:
        # Update existing user with latest Twitch data
        user = existing_user
        user.login = twitch_user["login"]
        user.display_name = twitch_user["display_name"]
        user.email = twitch_user.get("email")
        user.profile_image_url = twitch_user.get("profile_image_url", "")
        user.broadcaster_type = twitch_user.get("broadcaster_type", "")

        # Update stats
        if user.stats is not None:
            user.stats.follower_count = follower_count
            user.stats.avg_viewers = avg_viewers
            user.stats.league = league
            user.stats.stream_language = stream_language
            user.stats.last_synced_at = datetime.now(timezone.utc)
        else:
            user_stats = UserStats(
                user_id=user.id,
                follower_count=follower_count,
                avg_viewers=avg_viewers,
                league=league,
                stream_language=stream_language,
                last_synced_at=datetime.now(timezone.utc),
            )
            db.add(user_stats)

    # ---- 6. Update categories from channel info ----
    if channel_info.get("game_id") and channel_info.get("game_name"):
        # Check if this category already exists for this user
        existing_cat = await db.execute(
            select(UserCategory).where(
                UserCategory.user_id == user.id,
                UserCategory.category_id == channel_info["game_id"],
            ),
        )
        if existing_cat.scalar_one_or_none() is None:
            category = UserCategory(
                user_id=user.id,
                category_id=channel_info["game_id"],
                category_name=channel_info["game_name"],
                box_art_url="",
            )
            db.add(category)

    await db.flush()

    # ---- 7. Store Twitch tokens in Redis ----
    token_ttl = tokens.get("expires_in", 14400)
    await redis.setex(
        f"{TWITCH_TOKEN_PREFIX}{user.id}",
        token_ttl,
        tokens["access_token"],
    )
    # Store refresh token without TTL (it doesn't expire)
    if tokens.get("refresh_token"):
        await redis.set(
            f"{TWITCH_TOKEN_PREFIX}{user.id}:refresh",
            tokens["refresh_token"],
        )

    # ---- 8. Create JWT and set cookie ----
    jwt_token = AuthService.create_jwt(str(user.id))
    redirect_path = "/onboarding" if is_new_user else "/feed"

    # Determine frontend URL for redirect
    frontend_url = settings.cors_origins_list[0] if settings.cors_origins_list else "http://localhost:5173"
    redirect_url = f"{frontend_url}{redirect_path}"

    response = RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)
    AuthService.set_auth_cookie(response, jwt_token)

    logger.info(
        "User %s (%s) authenticated via Twitch — %s",
        user.login, user.id, "new" if is_new_user else "returning",
    )

    return response


@router.get("/me", response_model=UserProfile)
async def get_me(
    current_user: User = Depends(get_current_user),
) -> UserProfile:
    """
    Return the authenticated user's full profile.

    Includes stats (league, viewers, followers) and stream categories.
    Requires a valid JWT in the streammatch_token cookie.
    """
    return UserProfile.model_validate(current_user)


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    response: Response,
    current_user: User = Depends(get_current_user),
    redis: Redis = Depends(get_redis),
) -> dict:
    """
    Log out the current user.

    Clears the auth cookie and removes Twitch tokens from Redis.
    """
    # Remove Twitch tokens from Redis
    await redis.delete(f"{TWITCH_TOKEN_PREFIX}{current_user.id}")
    await redis.delete(f"{TWITCH_TOKEN_PREFIX}{current_user.id}:refresh")

    # Clear auth cookie
    AuthService.clear_auth_cookie(response)

    return {"detail": "Вы успешно вышли из аккаунта"}
