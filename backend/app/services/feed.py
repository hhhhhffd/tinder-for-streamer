"""
StreamMatch — Feed Algorithm Service.

Builds the swipe feed for a user:
1. Same-league users, excluding already-interacted and blocked
2. Priority ordering: super-liked by target → cross-league-up liked → random
3. Optional filters: categories, viewer/follower ranges, language
"""

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.match import Like, LikeType
from app.models.report import Block
from app.models.user import User, UserCategory, UserStats
from app.schemas.feed import FeedFilters


async def get_feed(
    db: AsyncSession,
    user: User,
    filters: FeedFilters,
    offset: int = 0,
    limit: int = 20,
) -> tuple[list[User], int]:
    """
    Build the swipe feed for the given user.

    Returns a tuple of (list of User objects with loaded relationships, total count).

    Algorithm:
    1. Base set: all non-banned users excluding the current user
    2. Exclusions: already liked/disliked by current user, blocked in either direction
    3. Priority: users who super-liked current user first, then cross-league-up likers,
       then same-league users, then everyone else — randomized within each tier
    4. Filters: categories, viewer range, follower range, language
    """
    current_user_id = user.id
    current_league = user.stats.league if user.stats else None

    # ---- Subqueries for exclusions ----

    # Users the current user has already liked (any type)
    already_liked_subq = (
        select(Like.to_user_id)
        .where(Like.from_user_id == current_user_id)
        .correlate(User)
        .scalar_subquery()
    )

    # Users blocked in either direction
    blocked_by_me_subq = (
        select(Block.blocked_id)
        .where(Block.blocker_id == current_user_id)
        .correlate(User)
        .scalar_subquery()
    )
    blocked_me_subq = (
        select(Block.blocker_id)
        .where(Block.blocked_id == current_user_id)
        .correlate(User)
        .scalar_subquery()
    )

    # ---- Priority subquery: did this user like me? ----
    # super_like by them → priority 0, cross_league_up by them → priority 1,
    # same league → priority 2, else → priority 3
    incoming_super_like_subq = (
        select(Like)
        .where(
            Like.from_user_id == User.id,
            Like.to_user_id == current_user_id,
            Like.type == LikeType.super_like,
        )
        .correlate(User)
        .exists()
    )
    incoming_cross_league_subq = (
        select(Like)
        .where(
            Like.from_user_id == User.id,
            Like.to_user_id == current_user_id,
            Like.is_cross_league_up.is_(True),
        )
        .correlate(User)
        .exists()
    )

    # Priority ordering expression
    # Premium users get a small boost (priority 2.5 → shown after super-likes
    # and cross-league-up, but before regular same-league users)
    priority_expr = case(
        (incoming_super_like_subq, 0),
        (incoming_cross_league_subq, 1),
        (User.is_premium.is_(True), 2),
        else_=4,
    )

    # If current user has a league, give same-league users priority 3
    if current_league is not None:
        priority_expr = case(
            (incoming_super_like_subq, 0),
            (incoming_cross_league_subq, 1),
            (User.is_premium.is_(True), 2),
            (UserStats.league == current_league, 3),
            else_=4,
        )

    # ---- Build main query ----
    query = (
        select(User)
        .join(UserStats, UserStats.user_id == User.id, isouter=True)
        .options(selectinload(User.stats), selectinload(User.categories))
        .where(
            User.id != current_user_id,
            User.is_banned.is_(False),
            User.id.not_in(already_liked_subq),
            User.id.not_in(blocked_by_me_subq),
            User.id.not_in(blocked_me_subq),
        )
    )

    # ---- Apply filters ----
    if filters.language is not None:
        query = query.where(UserStats.stream_language == filters.language)

    if filters.min_viewers is not None:
        query = query.where(UserStats.avg_viewers >= filters.min_viewers)

    if filters.max_viewers is not None:
        query = query.where(UserStats.avg_viewers <= filters.max_viewers)

    if filters.min_followers is not None:
        query = query.where(UserStats.follower_count >= filters.min_followers)

    if filters.max_followers is not None:
        query = query.where(UserStats.follower_count <= filters.max_followers)

    if filters.categories:
        # Match users who have ANY of the specified categories
        cat_subq = (
            select(UserCategory.user_id)
            .where(UserCategory.category_id.in_(filters.categories))
            .distinct()
            .scalar_subquery()
        )
        query = query.where(User.id.in_(cat_subq))

    # ---- Count total matching profiles ----
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # ---- Order by priority then random, paginate ----
    query = (
        query
        .order_by(priority_expr, func.random())
        .offset(offset)
        .limit(limit)
    )

    result = await db.execute(query)
    profiles = list(result.scalars().unique().all())

    return profiles, total


async def get_all_categories(db: AsyncSession) -> list[dict]:
    """
    Fetch all unique categories in the system.

    Used to populate the filter dropdown in the feed panel.
    Returns a list of dicts with category_id and category_name.
    """
    result = await db.execute(
        select(UserCategory.category_id, UserCategory.category_name)
        .group_by(UserCategory.category_id, UserCategory.category_name)
        .order_by(UserCategory.category_name),
    )
    return [
        {"category_id": row.category_id, "category_name": row.category_name}
        for row in result.all()
    ]
