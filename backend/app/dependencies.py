"""
StreamMatch — FastAPI Dependencies.

Reusable dependency functions for injection into route handlers:
- get_db: async database session
- get_current_user: extract and validate authenticated user from JWT cookie
- require_admin: ensure the current user has admin privileges
- get_redis: async Redis client
"""

from typing import AsyncGenerator

from fastapi import Cookie, Depends, HTTPException, status
from jose import JWTError, jwt
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.database import async_session_factory
from app.models.user import User, UserCategory, UserStats
from app.redis import get_redis_client as _get_redis_client
from app.services.auth import AUTH_COOKIE_NAME

settings = get_settings()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Yield an async database session for request-scoped use.

    Commits on success, rolls back on exception, always closes.
    """
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_redis() -> AsyncGenerator[Redis, None]:
    """
    Yield a Redis client for request-scoped use.

    Closes the client when the request completes.
    """
    client = _get_redis_client()
    try:
        yield client
    finally:
        await client.aclose()


async def get_current_user(
    streammatch_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Extract and validate the JWT from the httpOnly 'streammatch_token' cookie.

    Decodes the token, looks up the user by the embedded user_id claim
    with eager-loaded stats and categories, and returns the User model.
    Raises 401 if the token is missing, invalid, expired, or the user
    does not exist. Raises 403 if the user is banned.
    """
    if streammatch_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Требуется авторизация",
        )

    try:
        payload = jwt.decode(
            streammatch_token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Невалидный токен",
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалидный или истёкший токен",
        )

    # Query user with eager-loaded stats and categories
    result = await db.execute(
        select(User)
        .options(selectinload(User.stats), selectinload(User.categories))
        .where(User.id == user_id),
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден",
        )

    if user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Аккаунт заблокирован",
        )

    return user


async def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Ensure the authenticated user has admin privileges.

    Depends on get_current_user, so the user is already validated.
    Raises 403 if is_admin is False.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещён: требуются права администратора",
        )
    return current_user
