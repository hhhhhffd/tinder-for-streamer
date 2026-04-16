"""
StreamMatch — User Profile Endpoints.

Provides read/update access to user profiles:
- Own profile (full, editable)
- Public profiles (for viewing cards, respects blocks/bans)
"""

import uuid as uuid_mod

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user, get_db
from app.models.report import Block
from app.models.user import User
from app.schemas.user import UserProfile, UserUpdate

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me/profile", response_model=UserProfile)
async def get_own_profile(
    current_user: User = Depends(get_current_user),
) -> UserProfile:
    """
    Return the authenticated user's full profile.

    Includes stats (league, viewers, followers) and stream categories.
    The user is already eager-loaded with stats and categories
    by the get_current_user dependency.
    """
    return UserProfile.model_validate(current_user)


@router.patch("/me/profile", response_model=UserProfile)
async def update_own_profile(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserProfile:
    """
    Update the authenticated user's bio.

    Only the bio field is editable — all other profile data
    is synced from Twitch and cannot be changed manually.
    Bio is limited to 500 characters.
    """
    current_user.bio = payload.bio
    db.add(current_user)
    await db.flush()
    await db.refresh(current_user)

    return UserProfile.model_validate(current_user)


@router.get("/{user_id}/profile", response_model=UserProfile)
async def get_user_profile(
    user_id: uuid_mod.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserProfile:
    """
    Return the public profile of any user by ID.

    Used when viewing streamer cards in the feed or match list.
    Returns 404 if the user is banned, does not exist, or if the
    current user has blocked (or been blocked by) the target user.
    """
    # Fetch target user with eager-loaded relationships
    result = await db.execute(
        select(User)
        .options(selectinload(User.stats), selectinload(User.categories))
        .where(User.id == user_id),
    )
    target_user = result.scalar_one_or_none()

    if target_user is None or target_user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден",
        )

    # Check if either direction of block exists
    block_result = await db.execute(
        select(Block.id).where(
            (
                (Block.blocker_id == current_user.id)
                & (Block.blocked_id == user_id)
            )
            | (
                (Block.blocker_id == user_id)
                & (Block.blocked_id == current_user.id)
            ),
        ),
    )
    if block_result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден",
        )

    return UserProfile.model_validate(target_user)
