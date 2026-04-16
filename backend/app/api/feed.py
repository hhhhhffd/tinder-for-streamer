"""
StreamMatch — Swipe Feed Endpoints.

Provides the paginated feed of streamers to swipe on,
with optional filters for categories, viewers, followers, and language.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.feed import CategoriesResponse, CategoryItem, FeedFilters, FeedResponse
from app.schemas.user import UserProfile
from app.services.feed import get_all_categories, get_feed

router = APIRouter(prefix="/api/feed", tags=["feed"])


@router.get("", response_model=FeedResponse)
async def get_swipe_feed(
    categories: str | None = Query(
        default=None,
        description="Comma-separated category IDs to filter by",
    ),
    min_viewers: int | None = Query(default=None, ge=0),
    max_viewers: int | None = Query(default=None, ge=0),
    min_followers: int | None = Query(default=None, ge=0),
    max_followers: int | None = Query(default=None, ge=0),
    language: str | None = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FeedResponse:
    """
    Get a paginated feed of streamers to swipe on.

    The feed algorithm prioritizes:
    1. Users who super-liked the current user
    2. Users who cross-league-up liked the current user
    3. Same-league users
    4. All other users

    Excludes: current user, already-swiped users, blocked users, banned users.
    Supports optional filters for categories, viewer/follower ranges, and language.
    """
    # Parse comma-separated categories into a list
    category_list = None
    if categories:
        category_list = [c.strip() for c in categories.split(",") if c.strip()]

    filters = FeedFilters(
        categories=category_list,
        min_viewers=min_viewers,
        max_viewers=max_viewers,
        min_followers=min_followers,
        max_followers=max_followers,
        language=language,
    )

    profiles, total = await get_feed(
        db=db,
        user=current_user,
        filters=filters,
        offset=offset,
        limit=limit,
    )

    return FeedResponse(
        profiles=[UserProfile.model_validate(p) for p in profiles],
        total=total,
        has_more=(offset + limit) < total,
    )


@router.get("/categories", response_model=CategoriesResponse)
async def get_categories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CategoriesResponse:
    """
    Get all unique stream categories in the system.

    Used to populate the category filter dropdown in the feed panel.
    """
    raw_categories = await get_all_categories(db)
    return CategoriesResponse(
        categories=[
            CategoryItem(
                category_id=cat["category_id"],
                category_name=cat["category_name"],
            )
            for cat in raw_categories
        ],
    )
