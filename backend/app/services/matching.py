"""
StreamMatch — Like & Match Service.

Core business logic for the swipe system:
- Processing likes, super-likes, and dislikes
- Redis-based atomic daily rate limiting
- Mutual match detection
- Undo functionality (premium only)

Rate limit keys in Redis:
  "likes:{user_id}:{YYYY-MM-DD}" → Hash with fields:
    same_league, cross_up, super_like
  Each key expires at midnight UTC.
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import NamedTuple

from redis.asyncio import Redis
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.match import Like, LikeType, Match
from app.models.report import Block
from app.models.user import League, User, UserStats

logger = logging.getLogger(__name__)

# ---- League ordering for cross-league comparisons ----
LEAGUE_ORDER = {
    League.bronze: 0,
    League.silver: 1,
    League.gold: 2,
    League.platinum: 3,
}

# ---- Daily limits by tier ----
LIMITS_FREE = {"same_league": 20, "cross_up": 1, "super_like": 0}
LIMITS_PREMIUM = {"same_league": 40, "cross_up": 5, "super_like": 5}


class LikeResult(NamedTuple):
    """Result of a like/super-like action."""

    like: Like
    is_match: bool
    match_id: uuid.UUID | None
    remaining: dict[str, int]


class DailyLimits(NamedTuple):
    """Current daily usage and maximums for each limit type."""

    same_league_used: int
    same_league_max: int
    cross_up_used: int
    cross_up_max: int
    super_like_used: int
    super_like_max: int


def _get_limits(is_premium: bool) -> dict[str, int]:
    """Return the daily limit maximums for the user's tier."""
    return LIMITS_PREMIUM if is_premium else LIMITS_FREE


def _redis_limit_key(user_id: uuid.UUID) -> str:
    """Build the Redis hash key for today's like counters."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return f"likes:{user_id}:{today}"


def _seconds_until_midnight_utc() -> int:
    """Calculate seconds remaining until midnight UTC for key expiry."""
    now = datetime.now(timezone.utc)
    tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return max(int((tomorrow - now).total_seconds()), 1)


def _determine_league_relation(
    from_league: League | None,
    to_league: League | None,
) -> str:
    """
    Determine the league relationship between two users.

    Returns: "same", "down" (liking lower league), or "up" (liking higher league).
    """
    if from_league is None or to_league is None:
        return "same"
    from_order = LEAGUE_ORDER.get(from_league, 0)
    to_order = LEAGUE_ORDER.get(to_league, 0)
    if from_order == to_order:
        return "same"
    if from_order > to_order:
        return "down"
    return "up"


async def _get_usage(redis: Redis, user_id: uuid.UUID) -> dict[str, int]:
    """Read today's usage counters from Redis."""
    key = _redis_limit_key(user_id)
    raw = await redis.hgetall(key)
    return {
        "same_league": int(raw.get("same_league", 0)),
        "cross_up": int(raw.get("cross_up", 0)),
        "super_like": int(raw.get("super_like", 0)),
    }


# Lua script: atomically check limit, increment, and set TTL.
# Returns new value if under limit, -1 if limit exceeded.
_CHECK_AND_INCREMENT_LUA = """
local key = KEYS[1]
local field = ARGV[1]
local limit = tonumber(ARGV[2])
local ttl_seconds = tonumber(ARGV[3])
local current = tonumber(redis.call('HGET', key, field) or '0')
if current >= limit then
    return -1
end
local new_val = redis.call('HINCRBY', key, field, 1)
if redis.call('TTL', key) == -1 then
    redis.call('EXPIRE', key, ttl_seconds)
end
return new_val
"""


async def _check_and_increment(
    redis: Redis,
    user_id: uuid.UUID,
    field: str,
    limit: int,
) -> int:
    """
    Atomically check the daily limit and increment if under.

    Returns the new count, or -1 if the limit has been reached.
    Uses a Lua script to prevent race conditions between check and increment.
    """
    key = _redis_limit_key(user_id)
    ttl = _seconds_until_midnight_utc()
    result = await redis.eval(
        _CHECK_AND_INCREMENT_LUA, 1, key, field, str(limit), str(ttl),
    )
    return int(result)


async def _increment_usage(
    redis: Redis,
    user_id: uuid.UUID,
    field: str,
) -> int:
    """Atomically increment a usage counter and set expiry to midnight UTC."""
    key = _redis_limit_key(user_id)
    new_val = await redis.hincrby(key, field, 1)
    ttl = await redis.ttl(key)
    if ttl == -1:
        await redis.expire(key, _seconds_until_midnight_utc())
    return new_val


async def _decrement_usage(
    redis: Redis,
    user_id: uuid.UUID,
    field: str,
) -> None:
    """Decrement a usage counter (for undo)."""
    key = _redis_limit_key(user_id)
    await redis.hincrby(key, field, -1)


async def like_user(
    db: AsyncSession,
    redis: Redis,
    from_user: User,
    to_user_id: uuid.UUID,
    like_type: LikeType,
) -> LikeResult:
    """
    Process a like or super-like from one user to another.

    Validates the target, checks daily limits, creates the Like record,
    detects mutual matches, and returns the result with remaining limits.

    Raises ValueError with a descriptive message on validation failure.
    """
    # ---- 1. Validate target user ----
    result = await db.execute(
        select(User)
        .options(selectinload(User.stats))
        .where(User.id == to_user_id),
    )
    to_user = result.scalar_one_or_none()

    if to_user is None:
        raise ValueError("Пользователь не найден")

    if to_user.is_banned:
        raise ValueError("Пользователь заблокирован")

    if to_user.id == from_user.id:
        raise ValueError("Нельзя лайкнуть самого себя")

    # ---- 2. Check for existing like ----
    existing_like = await db.execute(
        select(Like).where(
            Like.from_user_id == from_user.id,
            Like.to_user_id == to_user_id,
        ),
    )
    if existing_like.scalar_one_or_none() is not None:
        raise ValueError("Вы уже оценили этого пользователя")

    # ---- 3. Check for blocks ----
    block_result = await db.execute(
        select(Block.id).where(
            or_(
                and_(Block.blocker_id == from_user.id, Block.blocked_id == to_user_id),
                and_(Block.blocker_id == to_user_id, Block.blocked_id == from_user.id),
            ),
        ),
    )
    if block_result.scalar_one_or_none() is not None:
        raise ValueError("Действие невозможно")

    # ---- 4. Determine league relation ----
    from_league = from_user.stats.league if from_user.stats else None
    to_league = to_user.stats.league if to_user.stats else None
    league_relation = _determine_league_relation(from_league, to_league)
    is_cross_league_up = league_relation == "up"

    # ---- 5+6. Atomic check-and-increment daily limits ----
    limits = _get_limits(from_user.is_premium)

    if like_type == LikeType.super_like:
        result_val = await _check_and_increment(
            redis, from_user.id, "super_like", limits["super_like"],
        )
        if result_val == -1:
            raise ValueError(
                f"Лимит супер-лайков исчерпан ({limits['super_like']}/день)"
            )
    elif is_cross_league_up:
        result_val = await _check_and_increment(
            redis, from_user.id, "cross_up", limits["cross_up"],
        )
        if result_val == -1:
            raise ValueError(
                f"Лимит лайков на высшую лигу исчерпан ({limits['cross_up']}/день)"
            )
    elif league_relation == "same":
        result_val = await _check_and_increment(
            redis, from_user.id, "same_league", limits["same_league"],
        )
        if result_val == -1:
            raise ValueError(
                f"Лимит лайков исчерпан ({limits['same_league']}/день)"
            )
    # "down" = unlimited, no check needed

    # ---- 7. Create Like record ----
    like = Like(
        from_user_id=from_user.id,
        to_user_id=to_user_id,
        type=like_type,
        is_cross_league_up=is_cross_league_up,
    )
    db.add(like)
    await db.flush()

    # ---- 8. Check for mutual match ----
    reciprocal = await db.execute(
        select(Like).where(
            Like.from_user_id == to_user_id,
            Like.to_user_id == from_user.id,
            Like.type.in_([LikeType.like, LikeType.super_like]),
        ),
    )
    is_match = reciprocal.scalar_one_or_none() is not None
    match_id: uuid.UUID | None = None

    if is_match:
        # Order user IDs consistently for the unique constraint
        uid1, uid2 = sorted([from_user.id, to_user_id])
        match = Match(user1_id=uid1, user2_id=uid2)
        db.add(match)
        await db.flush()
        match_id = match.id
        logger.info("Match created: %s <-> %s (match_id=%s)", from_user.id, to_user_id, match_id)

    # ---- 9. Compute remaining limits ----
    updated_usage = await _get_usage(redis, from_user.id)
    remaining = {
        "same_league": max(0, limits["same_league"] - updated_usage["same_league"]),
        "cross_up": max(0, limits["cross_up"] - updated_usage["cross_up"]),
        "super_like": max(0, limits["super_like"] - updated_usage["super_like"]),
    }

    return LikeResult(
        like=like,
        is_match=is_match,
        match_id=match_id,
        remaining=remaining,
    )


async def dislike_user(
    db: AsyncSession,
    from_user: User,
    to_user_id: uuid.UUID,
) -> None:
    """
    Record a dislike (skip) to prevent this user from appearing in the feed again.

    Creates a Like record with type=like and a special marker. Since the DB has
    a unique constraint on (from_user_id, to_user_id), we reuse the Like model
    to track all interactions. Dislikes don't count toward daily limits.

    We store dislikes as regular likes to leverage the existing exclusion logic
    in the feed service (which excludes all users in the likes table).
    """
    # Check if already interacted
    existing = await db.execute(
        select(Like).where(
            Like.from_user_id == from_user.id,
            Like.to_user_id == to_user_id,
        ),
    )
    if existing.scalar_one_or_none() is not None:
        return  # Already interacted, silently ignore

    like = Like(
        from_user_id=from_user.id,
        to_user_id=to_user_id,
        type=LikeType.dislike,
        is_cross_league_up=False,
    )
    db.add(like)
    await db.flush()


async def get_daily_limits(
    redis: Redis,
    user: User,
) -> DailyLimits:
    """Return the current daily usage and maximums for the user."""
    limits = _get_limits(user.is_premium)
    usage = await _get_usage(redis, user.id)

    return DailyLimits(
        same_league_used=usage["same_league"],
        same_league_max=limits["same_league"],
        cross_up_used=usage["cross_up"],
        cross_up_max=limits["cross_up"],
        super_like_used=usage["super_like"],
        super_like_max=limits["super_like"],
    )


async def undo_last_like(
    db: AsyncSession,
    redis: Redis,
    user: User,
) -> bool:
    """
    Undo the user's most recent like (premium only).

    Only works if the like was within the last 5 minutes and no match
    was created from it. Restores the daily limit counter.
    Returns True if undo succeeded, False otherwise.
    """
    if not user.is_premium:
        raise ValueError("Функция отмены доступна только для Premium")

    # Find the most recent like by this user
    result = await db.execute(
        select(Like)
        .where(Like.from_user_id == user.id)
        .order_by(Like.created_at.desc())
        .limit(1),
    )
    last_like = result.scalar_one_or_none()

    if last_like is None:
        raise ValueError("Нет лайков для отмены")

    # Check if within 5-minute window
    now = datetime.now(timezone.utc)
    age = (now - last_like.created_at.replace(tzinfo=timezone.utc)).total_seconds()
    if age > 300:
        raise ValueError("Отмена возможна только в течение 5 минут")

    # Check if a match was created (cannot undo if matched)
    uid1, uid2 = sorted([user.id, last_like.to_user_id])
    match_result = await db.execute(
        select(Match).where(
            Match.user1_id == uid1,
            Match.user2_id == uid2,
        ),
    )
    if match_result.scalar_one_or_none() is not None:
        raise ValueError("Невозможно отменить — уже есть мэтч")

    # Restore Redis counter
    if last_like.type == LikeType.super_like:
        await _decrement_usage(redis, user.id, "super_like")
    elif last_like.is_cross_league_up:
        await _decrement_usage(redis, user.id, "cross_up")
    else:
        # Determine if it was same-league (not cross-league-down)
        from_league = user.stats.league if user.stats else None
        to_stats = await db.execute(
            select(UserStats).where(UserStats.user_id == last_like.to_user_id),
        )
        to_stat = to_stats.scalar_one_or_none()
        to_league = to_stat.league if to_stat else None
        relation = _determine_league_relation(from_league, to_league)
        if relation == "same":
            await _decrement_usage(redis, user.id, "same_league")

    # Delete the like
    await db.delete(last_like)
    await db.flush()

    logger.info("User %s undid like to %s", user.id, last_like.to_user_id)
    return True


async def get_user_matches(
    db: AsyncSession,
    user_id: uuid.UUID,
    offset: int = 0,
    limit: int = 50,
) -> tuple[list[dict], int]:
    """
    Fetch all active matches for a user with partner profile info.

    Returns a list of dicts with match data and the partner's User object,
    plus the total count.
    """
    # Count total active matches
    count_result = await db.execute(
        select(func.count()).select_from(Match).where(
            or_(Match.user1_id == user_id, Match.user2_id == user_id),
            Match.is_active.is_(True),
        ),
    )
    total = count_result.scalar() or 0

    # Fetch matches with relationships
    result = await db.execute(
        select(Match)
        .options(
            selectinload(Match.user1).selectinload(User.stats),
            selectinload(Match.user1).selectinload(User.categories),
            selectinload(Match.user2).selectinload(User.stats),
            selectinload(Match.user2).selectinload(User.categories),
        )
        .where(
            or_(Match.user1_id == user_id, Match.user2_id == user_id),
            Match.is_active.is_(True),
        )
        .order_by(Match.created_at.desc())
        .offset(offset)
        .limit(limit),
    )
    matches = result.scalars().all()

    match_list = []
    for match in matches:
        # Determine which user is the partner
        partner = match.user2 if match.user1_id == user_id else match.user1
        match_list.append({
            "id": match.id,
            "partner": partner,
            "created_at": match.created_at,
            "is_active": match.is_active,
        })

    return match_list, total
