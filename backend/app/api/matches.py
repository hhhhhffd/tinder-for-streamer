"""
StreamMatch — Matches API Router.

Endpoints for the like/dislike/match system:
- POST /like: like or super-like another user
- POST /dislike: skip a user (won't appear again)
- GET /: list all active matches for the current user
- GET /limits: current daily usage and maximums
- POST /undo: premium-only undo of the last like
"""

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, get_redis
from app.models.user import User
from app.models.match import LikeType
from app.schemas.match import (
    DailyLimitsResponse,
    DislikeCreate,
    LikeCreate,
    LikeResponse,
    MatchListResponse,
    MatchRead,
    UndoResponse,
)
from app.schemas.user import UserProfile
from app.services.matching import (
    dislike_user,
    get_daily_limits,
    get_user_matches,
    like_user,
    undo_last_like,
)
from app.services.notifications import (
    notify_cross_league_like,
    notify_new_match,
    notify_super_like,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/matches", tags=["matches"])


@router.post(
    "/like",
    response_model=LikeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Лайк или супер-лайк пользователя",
)
async def like(
    body: LikeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> LikeResponse:
    """
    Send a like or super-like to another user.

    If a mutual match is created, is_match=True and match_id is set.
    Returns remaining daily limits after the action.
    """
    try:
        like_type = LikeType(body.type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный тип: допустимы 'like' или 'super_like'",
        )

    try:
        result = await like_user(
            db=db,
            redis=redis,
            from_user=current_user,
            to_user_id=body.to_user_id,
            like_type=like_type,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    # ---- Send push notifications (fire-and-forget, errors logged but not raised) ----
    try:
        if result.is_match:
            # Notify the target user about the new match
            await notify_new_match(db, body.to_user_id, current_user.display_name)
        if like_type == LikeType.super_like:
            await notify_super_like(db, body.to_user_id, current_user.display_name)
        elif result.like.is_cross_league_up:
            from_league = current_user.stats.league.value if current_user.stats else "bronze"
            await notify_cross_league_like(
                db, body.to_user_id, current_user.display_name, from_league,
            )
    except Exception:
        logger.warning("Failed to send push notification for like", exc_info=True)

    return LikeResponse(
        id=result.like.id,
        from_user_id=result.like.from_user_id,
        to_user_id=result.like.to_user_id,
        type=result.like.type.value,
        is_cross_league_up=result.like.is_cross_league_up,
        created_at=result.like.created_at,
        is_match=result.is_match,
        match_id=result.match_id,
        remaining=result.remaining,
    )


@router.post(
    "/dislike",
    status_code=status.HTTP_200_OK,
    summary="Пропустить пользователя",
)
async def dislike(
    body: DislikeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """
    Record a dislike (skip) so this user won't appear in the feed again.

    Dislikes are free and do not count toward daily limits.
    """
    try:
        await dislike_user(
            db=db,
            from_user=current_user,
            to_user_id=body.to_user_id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    return {"detail": "ok"}


@router.get(
    "",
    response_model=MatchListResponse,
    summary="Список мэтчей текущего пользователя",
)
async def list_matches(
    offset: int = Query(default=0, ge=0, description="Смещение для пагинации"),
    limit: int = Query(default=50, ge=1, le=100, description="Количество записей"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MatchListResponse:
    """
    Fetch all active matches for the authenticated user.

    Returns partner profile info and match metadata, sorted by most recent first.
    """
    match_list, total = await get_user_matches(
        db=db,
        user_id=current_user.id,
        offset=offset,
        limit=limit,
    )

    matches = [
        MatchRead(
            id=m["id"],
            partner=UserProfile.model_validate(m["partner"]),
            created_at=m["created_at"],
            is_active=m["is_active"],
        )
        for m in match_list
    ]

    return MatchListResponse(matches=matches, total=total)


@router.get(
    "/limits",
    response_model=DailyLimitsResponse,
    summary="Текущие дневные лимиты",
)
async def daily_limits(
    current_user: User = Depends(get_current_user),
    redis: Redis = Depends(get_redis),
) -> DailyLimitsResponse:
    """
    Return the current user's daily like usage and maximums.

    Includes counters for same-league, cross-league-up, and super-likes.
    """
    limits = await get_daily_limits(redis=redis, user=current_user)

    return DailyLimitsResponse(
        same_league_used=limits.same_league_used,
        same_league_max=limits.same_league_max,
        cross_up_used=limits.cross_up_used,
        cross_up_max=limits.cross_up_max,
        super_like_used=limits.super_like_used,
        super_like_max=limits.super_like_max,
    )


@router.post(
    "/undo",
    response_model=UndoResponse,
    summary="Отменить последний лайк (Premium)",
)
async def undo(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> UndoResponse:
    """
    Undo the most recent like (premium-only).

    Only works within 5 minutes and if no match was created from the like.
    Restores the corresponding daily limit counter.
    """
    try:
        success = await undo_last_like(db=db, redis=redis, user=current_user)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    return UndoResponse(success=success)
