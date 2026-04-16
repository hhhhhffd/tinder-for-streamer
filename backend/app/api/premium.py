"""
StreamMatch — Premium API Router.

Endpoints for premium subscription management:
- GET /status: current premium status and available features
- POST /activate: admin-only, set is_premium=true for a user
- POST /deactivate: admin-only, set is_premium=false for a user
- GET /liked-me: premium-only, list of users who liked current user
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user, get_db, require_admin
from app.models.match import Like, LikeType, Match
from app.models.report import Block
from app.models.user import User
from app.schemas.user import UserProfile

router = APIRouter(prefix="/api/premium", tags=["premium"])


# ---- Schemas ----

class PremiumFeatures(BaseModel):
    """Detailed feature breakdown for premium vs free tier."""

    likes_per_day: int
    super_likes_per_day: int
    cross_league_up_per_day: int
    undo_available: bool
    can_see_who_liked: bool
    feed_priority_boost: bool


class PremiumStatusResponse(BaseModel):
    """Current premium status and feature set."""

    is_premium: bool
    features: PremiumFeatures


class PremiumToggleRequest(BaseModel):
    """Request body for admin premium toggle."""

    user_id: uuid.UUID


class PremiumToggleResponse(BaseModel):
    """Response after toggling premium status."""

    user_id: uuid.UUID
    is_premium: bool
    detail: str


class LikedMeItem(BaseModel):
    """A user who has liked the current user."""

    model_config = {"from_attributes": True}

    like_type: str
    is_cross_league_up: bool
    liked_at: str
    user: UserProfile


class LikedMeResponse(BaseModel):
    """Paginated list of users who liked the current user."""

    users: list[LikedMeItem]
    total: int


# ---- Endpoints ----

@router.get(
    "/status",
    response_model=PremiumStatusResponse,
    summary="Статус Premium-подписки",
)
async def premium_status(
    current_user: User = Depends(get_current_user),
) -> PremiumStatusResponse:
    """
    Return the current user's premium status and full feature breakdown.

    Free users see their limited features, premium users see enhanced ones.
    """
    if current_user.is_premium:
        features = PremiumFeatures(
            likes_per_day=40,
            super_likes_per_day=5,
            cross_league_up_per_day=5,
            undo_available=True,
            can_see_who_liked=True,
            feed_priority_boost=True,
        )
    else:
        features = PremiumFeatures(
            likes_per_day=20,
            super_likes_per_day=0,
            cross_league_up_per_day=1,
            undo_available=False,
            can_see_who_liked=False,
            feed_priority_boost=False,
        )

    return PremiumStatusResponse(
        is_premium=current_user.is_premium,
        features=features,
    )


@router.post(
    "/activate",
    response_model=PremiumToggleResponse,
    summary="Активировать Premium (admin)",
)
async def activate_premium(
    body: PremiumToggleRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> PremiumToggleResponse:
    """
    Admin-only: activate premium for a user.

    Sets is_premium=True on the target user account.
    In the future this will be triggered by payment integration.
    """
    result = await db.execute(select(User).where(User.id == body.user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден",
        )

    user.is_premium = True
    await db.flush()

    return PremiumToggleResponse(
        user_id=user.id,
        is_premium=True,
        detail=f"Premium активирован для {user.display_name}",
    )


@router.post(
    "/deactivate",
    response_model=PremiumToggleResponse,
    summary="Деактивировать Premium (admin)",
)
async def deactivate_premium(
    body: PremiumToggleRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> PremiumToggleResponse:
    """
    Admin-only: deactivate premium for a user.

    Sets is_premium=False on the target user account.
    """
    result = await db.execute(select(User).where(User.id == body.user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден",
        )

    user.is_premium = False
    await db.flush()

    return PremiumToggleResponse(
        user_id=user.id,
        is_premium=False,
        detail=f"Premium деактивирован для {user.display_name}",
    )


@router.get(
    "/liked-me",
    response_model=LikedMeResponse,
    summary="Кто лайкнул вас (Premium)",
)
async def liked_me(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LikedMeResponse:
    """
    Premium-only: see which users have liked the current user
    but the current user hasn't acted on yet.

    Returns user profiles with the like type and timestamp.
    Free users receive a 403 error.
    """
    if not current_user.is_premium:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Эта функция доступна только для Premium-пользователей",
        )

    # Find likes targeting current user where current user hasn't responded
    already_acted_subq = (
        select(Like.to_user_id)
        .where(Like.from_user_id == current_user.id)
        .scalar_subquery()
    )

    # Exclude blocked users
    blocked_by_me_subq = (
        select(Block.blocked_id)
        .where(Block.blocker_id == current_user.id)
        .scalar_subquery()
    )
    blocked_me_subq = (
        select(Block.blocker_id)
        .where(Block.blocked_id == current_user.id)
        .scalar_subquery()
    )

    # Base query: likes toward me, where I haven't acted, not blocked
    query = (
        select(Like)
        .join(User, User.id == Like.from_user_id)
        .options(
            selectinload(Like.from_user).selectinload(User.stats),
            selectinload(Like.from_user).selectinload(User.categories),
        )
        .where(
            Like.to_user_id == current_user.id,
            Like.from_user_id.not_in(already_acted_subq),
            Like.from_user_id.not_in(blocked_by_me_subq),
            Like.from_user_id.not_in(blocked_me_subq),
            User.is_banned.is_(False),
        )
        .order_by(Like.created_at.desc())
    )

    # Count total
    from sqlalchemy import func
    count_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = count_result.scalar() or 0

    # Paginate
    result = await db.execute(query.offset(offset).limit(limit))
    likes = list(result.scalars().unique().all())

    items: list[LikedMeItem] = []
    for like in likes:
        liker = like.from_user
        if liker is None:
            continue
        items.append(LikedMeItem(
            like_type=like.type.value,
            is_cross_league_up=like.is_cross_league_up,
            liked_at=like.created_at.isoformat(),
            user=UserProfile.model_validate(liker),
        ))

    return LikedMeResponse(users=items, total=total)
