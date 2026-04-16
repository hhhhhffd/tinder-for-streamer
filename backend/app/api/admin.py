"""
StreamMatch — Admin Panel API Router.

All endpoints require admin privileges via the require_admin dependency.
Provides CRUD for users, reports management, stats dashboard, and matches.
"""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_db, require_admin
from app.models.chat import Message
from app.models.match import Like, Match
from app.models.report import Report, ReportStatus
from app.models.user import League, User, UserStats
from app.schemas.report import ReportRead, ReportUpdate
from app.schemas.user import UserAdminRead, UserProfile

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ---- Schemas ----

class AdminStatsResponse(BaseModel):
    """Dashboard statistics for the admin panel."""

    total_users: int
    active_today: int
    matches_today: int
    messages_today: int
    reports_pending: int
    premium_count: int
    users_per_league: dict[str, int]


class UserAdminUpdate(BaseModel):
    """Fields an admin can modify on a user account."""

    is_premium: bool | None = None
    is_banned: bool | None = None
    is_admin: bool | None = None


class UserAdminListResponse(BaseModel):
    """Paginated list of users for admin panel."""

    users: list[UserAdminRead]
    total: int


class AdminReportRead(BaseModel):
    """Extended report view with reporter and reported user profiles."""

    model_config = {"from_attributes": True}

    id: uuid.UUID
    reporter: UserProfile
    reported: UserProfile
    reason: str
    status: str
    admin_notes: str | None = None
    created_at: datetime
    resolved_at: datetime | None = None


class AdminReportListResponse(BaseModel):
    """Paginated list of reports for admin panel."""

    reports: list[AdminReportRead]
    total: int


class MatchAdminRead(BaseModel):
    """Match view for admin panel with both user profiles."""

    id: uuid.UUID
    user1: UserProfile
    user2: UserProfile
    created_at: datetime
    is_active: bool


class MatchAdminListResponse(BaseModel):
    """Paginated list of matches for admin panel."""

    matches: list[MatchAdminRead]
    total: int


# ---- Stats Dashboard ----

@router.get(
    "/stats",
    response_model=AdminStatsResponse,
    summary="Статистика для админ-панели",
)
async def admin_stats(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminStatsResponse:
    """
    Aggregate statistics for the admin dashboard.

    Returns total users, active today, matches/messages created today,
    pending reports count, premium count, and users per league.
    """
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Total users (non-banned)
    total_users_result = await db.execute(
        select(func.count()).select_from(User).where(User.is_banned.is_(False))
    )
    total_users = total_users_result.scalar() or 0

    # Active today — unique users who created a like or sent a message today
    liker_ids = select(Like.from_user_id).where(Like.created_at >= today_start)
    messager_ids = select(Message.sender_id).where(Message.created_at >= today_start)
    union_subq = liker_ids.union(messager_ids).subquery()
    active_today_result = await db.execute(
        select(func.count()).select_from(union_subq)
    )
    active_today = active_today_result.scalar() or 0

    # Matches today
    matches_today_result = await db.execute(
        select(func.count()).select_from(Match).where(Match.created_at >= today_start)
    )
    matches_today = matches_today_result.scalar() or 0

    # Messages today
    messages_today_result = await db.execute(
        select(func.count()).select_from(Message).where(Message.created_at >= today_start)
    )
    messages_today = messages_today_result.scalar() or 0

    # Pending reports
    reports_pending_result = await db.execute(
        select(func.count()).select_from(Report).where(
            Report.status == ReportStatus.pending
        )
    )
    reports_pending = reports_pending_result.scalar() or 0

    # Premium count
    premium_result = await db.execute(
        select(func.count()).select_from(User).where(
            User.is_premium.is_(True),
            User.is_banned.is_(False),
        )
    )
    premium_count = premium_result.scalar() or 0

    # Users per league
    league_result = await db.execute(
        select(UserStats.league, func.count())
        .join(User, User.id == UserStats.user_id)
        .where(User.is_banned.is_(False))
        .group_by(UserStats.league)
    )
    users_per_league = {row[0].value: row[1] for row in league_result.all()}
    # Ensure all leagues are present
    for league in League:
        if league.value not in users_per_league:
            users_per_league[league.value] = 0

    return AdminStatsResponse(
        total_users=total_users,
        active_today=active_today,
        matches_today=matches_today,
        messages_today=messages_today,
        reports_pending=reports_pending,
        premium_count=premium_count,
        users_per_league=users_per_league,
    )


# ---- Users CRUD ----

@router.get(
    "/users",
    response_model=UserAdminListResponse,
    summary="Список пользователей (admin)",
)
async def list_users(
    search: str | None = Query(default=None, description="Поиск по имени или логину"),
    league: str | None = Query(default=None, description="Фильтр по лиге"),
    is_premium: bool | None = Query(default=None, description="Фильтр по Premium"),
    is_banned: bool | None = Query(default=None, description="Фильтр по бану"),
    page: int = Query(default=1, ge=1, description="Номер страницы"),
    limit: int = Query(default=20, ge=1, le=100, description="Записей на странице"),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UserAdminListResponse:
    """
    Paginated user list with search and filters for the admin panel.

    Supports search by display_name or login, filter by league, premium status, and ban status.
    """
    query = (
        select(User)
        .outerjoin(UserStats, UserStats.user_id == User.id)
        .options(selectinload(User.stats), selectinload(User.categories))
    )

    # Search filter
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            or_(
                User.display_name.ilike(search_pattern),
                User.login.ilike(search_pattern),
            )
        )

    # League filter
    if league:
        query = query.where(UserStats.league == league)

    # Premium filter
    if is_premium is not None:
        query = query.where(User.is_premium == is_premium)

    # Banned filter
    if is_banned is not None:
        query = query.where(User.is_banned == is_banned)

    # Count total
    count_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = count_result.scalar() or 0

    # Paginate
    offset = (page - 1) * limit
    query = query.order_by(User.created_at.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    users = list(result.scalars().unique().all())

    return UserAdminListResponse(
        users=[UserAdminRead.model_validate(u) for u in users],
        total=total,
    )


@router.get(
    "/users/{user_id}",
    response_model=UserAdminRead,
    summary="Детали пользователя (admin)",
)
async def get_user(
    user_id: uuid.UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UserAdminRead:
    """Fetch full details for a single user including stats and categories."""
    result = await db.execute(
        select(User)
        .options(selectinload(User.stats), selectinload(User.categories))
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден",
        )

    return UserAdminRead.model_validate(user)


@router.patch(
    "/users/{user_id}",
    response_model=UserAdminRead,
    summary="Обновить пользователя (admin)",
)
async def update_user(
    user_id: uuid.UUID,
    body: UserAdminUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UserAdminRead:
    """
    Update moderation flags on a user account.

    Supports toggling is_premium, is_banned, and is_admin.
    Admins cannot modify their own admin status.
    """
    result = await db.execute(
        select(User)
        .options(selectinload(User.stats), selectinload(User.categories))
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден",
        )

    # Prevent admin from removing their own admin status
    if body.is_admin is not None and user.id == admin.id and not body.is_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя снять с себя права администратора",
        )

    if body.is_premium is not None:
        user.is_premium = body.is_premium
    if body.is_banned is not None:
        user.is_banned = body.is_banned
    if body.is_admin is not None:
        user.is_admin = body.is_admin

    await db.flush()
    return UserAdminRead.model_validate(user)


@router.delete(
    "/users/{user_id}",
    summary="Заблокировать пользователя (admin)",
)
async def delete_user(
    user_id: uuid.UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """
    Soft-delete a user by setting is_banned=True.

    Does not physically delete the record — preserves data for audit.
    """
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя заблокировать самого себя",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден",
        )

    user.is_banned = True
    await db.flush()

    return {"detail": f"Пользователь {user.display_name} заблокирован"}


# ---- Reports Management ----

@router.get(
    "/reports",
    response_model=AdminReportListResponse,
    summary="Список жалоб (admin)",
)
async def list_reports(
    report_status: str | None = Query(
        default="pending",
        alias="status",
        description="Фильтр по статусу: pending, reviewed, resolved",
    ),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminReportListResponse:
    """
    Paginated list of reports with full reporter and reported user profiles.

    Default filter is 'pending' to show reports that need attention.
    """
    query = (
        select(Report)
        .options(
            selectinload(Report.reporter).selectinload(User.stats),
            selectinload(Report.reporter).selectinload(User.categories),
            selectinload(Report.reported).selectinload(User.stats),
            selectinload(Report.reported).selectinload(User.categories),
        )
    )

    if report_status:
        query = query.where(Report.status == report_status)

    # Count total
    count_query = select(func.count()).select_from(Report)
    if report_status:
        count_query = count_query.where(Report.status == report_status)
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # Paginate
    offset = (page - 1) * limit
    query = query.order_by(Report.created_at.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    reports = list(result.scalars().unique().all())

    items = [
        AdminReportRead(
            id=r.id,
            reporter=UserProfile.model_validate(r.reporter),
            reported=UserProfile.model_validate(r.reported),
            reason=r.reason,
            status=r.status.value if hasattr(r.status, "value") else r.status,
            admin_notes=r.admin_notes,
            created_at=r.created_at,
            resolved_at=r.resolved_at,
        )
        for r in reports
    ]

    return AdminReportListResponse(reports=items, total=total)


@router.get(
    "/reports/{report_id}",
    response_model=AdminReportRead,
    summary="Детали жалобы (admin)",
)
async def get_report(
    report_id: uuid.UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminReportRead:
    """Fetch full details for a single report including both user profiles."""
    result = await db.execute(
        select(Report)
        .options(
            selectinload(Report.reporter).selectinload(User.stats),
            selectinload(Report.reporter).selectinload(User.categories),
            selectinload(Report.reported).selectinload(User.stats),
            selectinload(Report.reported).selectinload(User.categories),
        )
        .where(Report.id == report_id)
    )
    report = result.scalar_one_or_none()

    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Жалоба не найдена",
        )

    return AdminReportRead(
        id=report.id,
        reporter=UserProfile.model_validate(report.reporter),
        reported=UserProfile.model_validate(report.reported),
        reason=report.reason,
        status=report.status.value if hasattr(report.status, "value") else report.status,
        admin_notes=report.admin_notes,
        created_at=report.created_at,
        resolved_at=report.resolved_at,
    )


@router.patch(
    "/reports/{report_id}",
    response_model=AdminReportRead,
    summary="Обновить жалобу (admin)",
)
async def update_report(
    report_id: uuid.UUID,
    body: ReportUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminReportRead:
    """
    Update a report's status and admin notes.

    Valid status transitions: pending → reviewed → resolved.
    Setting status to 'resolved' auto-fills resolved_at timestamp.
    """
    result = await db.execute(
        select(Report)
        .options(
            selectinload(Report.reporter).selectinload(User.stats),
            selectinload(Report.reporter).selectinload(User.categories),
            selectinload(Report.reported).selectinload(User.stats),
            selectinload(Report.reported).selectinload(User.categories),
        )
        .where(Report.id == report_id)
    )
    report = result.scalar_one_or_none()

    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Жалоба не найдена",
        )

    report.status = ReportStatus(body.status)
    if body.admin_notes is not None:
        report.admin_notes = body.admin_notes

    if body.status == "resolved":
        report.resolved_at = datetime.now(timezone.utc)

    await db.flush()

    return AdminReportRead(
        id=report.id,
        reporter=UserProfile.model_validate(report.reporter),
        reported=UserProfile.model_validate(report.reported),
        reason=report.reason,
        status=report.status.value if hasattr(report.status, "value") else report.status,
        admin_notes=report.admin_notes,
        created_at=report.created_at,
        resolved_at=report.resolved_at,
    )


# ---- Matches Management ----

@router.get(
    "/matches",
    response_model=MatchAdminListResponse,
    summary="Список мэтчей (admin)",
)
async def list_matches(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> MatchAdminListResponse:
    """Paginated list of all matches with both user profiles."""
    # Count total
    count_result = await db.execute(select(func.count()).select_from(Match))
    total = count_result.scalar() or 0

    # Fetch matches
    offset = (page - 1) * limit
    result = await db.execute(
        select(Match)
        .options(
            selectinload(Match.user1).selectinload(User.stats),
            selectinload(Match.user1).selectinload(User.categories),
            selectinload(Match.user2).selectinload(User.stats),
            selectinload(Match.user2).selectinload(User.categories),
        )
        .order_by(Match.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    matches = list(result.scalars().unique().all())

    items = [
        MatchAdminRead(
            id=m.id,
            user1=UserProfile.model_validate(m.user1),
            user2=UserProfile.model_validate(m.user2),
            created_at=m.created_at,
            is_active=m.is_active,
        )
        for m in matches
    ]

    return MatchAdminListResponse(matches=items, total=total)


@router.delete(
    "/matches/{match_id}",
    summary="Деактивировать мэтч (admin)",
)
async def deactivate_match(
    match_id: uuid.UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Deactivate a match — prevents further messaging."""
    result = await db.execute(select(Match).where(Match.id == match_id))
    match = result.scalar_one_or_none()

    if match is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Мэтч не найден",
        )

    match.is_active = False
    await db.flush()

    return {"detail": "Мэтч деактивирован"}
