"""
StreamMatch — Reports & Blocks API Router.

Endpoints for reporting inappropriate users and managing blocks.
When a user blocks another:
- The blocked user disappears from feed (already in feed service)
- Any active match between them is deactivated
- Chat messaging is prevented
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user, get_db
from app.models.match import Match
from app.models.report import Block, Report, ReportStatus
from app.models.user import User
from app.schemas.report import BlockRead, ReportCreate, ReportRead

router = APIRouter(prefix="/api", tags=["reports"])


# ---- Reports ----


@router.post(
    "/reports",
    response_model=ReportRead,
    status_code=status.HTTP_201_CREATED,
    summary="Пожаловаться на пользователя",
)
async def create_report(
    payload: ReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReportRead:
    """
    Submit a report about another user.

    Each user can have at most 3 active (pending) reports at a time
    to prevent spam. Cannot report yourself.
    """
    if payload.reported_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя пожаловаться на самого себя",
        )

    # Verify reported user exists
    result = await db.execute(
        select(User.id).where(User.id == payload.reported_id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден",
        )

    # Check active report limit (max 3 pending per reporter)
    count_result = await db.execute(
        select(func.count(Report.id)).where(
            and_(
                Report.reporter_id == current_user.id,
                Report.status == ReportStatus.pending,
            )
        )
    )
    active_count = count_result.scalar() or 0

    if active_count >= 3:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Максимум 3 активных жалобы. Дождитесь рассмотрения предыдущих.",
        )

    report = Report(
        reporter_id=current_user.id,
        reported_id=payload.reported_id,
        reason=payload.reason,
    )
    db.add(report)
    await db.flush()
    await db.refresh(report)

    return ReportRead.model_validate(report)


# ---- Blocks ----


@router.post(
    "/blocks/{user_id}",
    response_model=BlockRead,
    status_code=status.HTTP_201_CREATED,
    summary="Заблокировать пользователя",
)
async def block_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BlockRead:
    """
    Block a user.

    Effects:
    - Blocked user disappears from your feed (handled by feed service)
    - Any active match between you is deactivated
    - Blocked user cannot send you messages or likes
    """
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя заблокировать самого себя",
        )

    # Verify target user exists
    result = await db.execute(
        select(User.id).where(User.id == user_id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден",
        )

    # Check if already blocked
    existing = await db.execute(
        select(Block.id).where(
            and_(
                Block.blocker_id == current_user.id,
                Block.blocked_id == user_id,
            )
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пользователь уже заблокирован",
        )

    # Create block
    block = Block(
        blocker_id=current_user.id,
        blocked_id=user_id,
    )
    db.add(block)

    # Deactivate any active match between the two users
    uid1, uid2 = sorted([current_user.id, user_id])
    await db.execute(
        update(Match)
        .where(
            and_(
                Match.user1_id == uid1,
                Match.user2_id == uid2,
                Match.is_active.is_(True),
            )
        )
        .values(is_active=False)
    )

    await db.flush()
    await db.refresh(block)

    return BlockRead.model_validate(block)


@router.delete(
    "/blocks/{user_id}",
    summary="Разблокировать пользователя",
)
async def unblock_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Unblock a previously blocked user.

    Note: this does not restore any deactivated matches.
    The users would need to re-match through the feed.
    """
    result = await db.execute(
        select(Block).where(
            and_(
                Block.blocker_id == current_user.id,
                Block.blocked_id == user_id,
            )
        )
    )
    block = result.scalar_one_or_none()

    if block is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Блокировка не найдена",
        )

    await db.delete(block)
    await db.flush()

    return {"detail": "Пользователь разблокирован"}


@router.get(
    "/blocks",
    summary="Список заблокированных пользователей",
)
async def list_blocks(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Get a list of users blocked by the current user.

    Returns blocked user profiles with basic info.
    """
    # Count total
    count_result = await db.execute(
        select(func.count(Block.id)).where(Block.blocker_id == current_user.id)
    )
    total = count_result.scalar() or 0

    # Fetch blocks with blocked user info
    result = await db.execute(
        select(Block)
        .options(
            selectinload(Block.blocked).selectinload(User.stats),
        )
        .where(Block.blocker_id == current_user.id)
        .order_by(Block.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    blocks = list(result.scalars().all())

    return {
        "blocks": [
            {
                "id": str(b.id),
                "user_id": str(b.blocked_id),
                "display_name": b.blocked.display_name if b.blocked else "Удалён",
                "profile_image_url": b.blocked.profile_image_url if b.blocked else "",
                "login": b.blocked.login if b.blocked else "",
                "created_at": b.created_at.isoformat(),
            }
            for b in blocks
        ],
        "total": total,
    }
