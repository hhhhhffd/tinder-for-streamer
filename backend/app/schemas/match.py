"""
StreamMatch — Like & Match Pydantic Schemas.

Request/response models for the swipe and match endpoints.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import UserProfile


class LikeCreate(BaseModel):
    """Request body for liking or super-liking another user."""

    to_user_id: uuid.UUID
    type: str = Field(
        default="like",
        pattern="^(like|super_like)$",
        description="Either 'like' or 'super_like'",
    )


class DislikeCreate(BaseModel):
    """Request body for disliking (skipping) another user."""

    to_user_id: uuid.UUID


class LikeResponse(BaseModel):
    """Response after submitting a like — indicates whether a match was created."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    from_user_id: uuid.UUID
    to_user_id: uuid.UUID
    type: str
    is_cross_league_up: bool
    created_at: datetime
    is_match: bool = Field(
        default=False,
        description="True if this like created a mutual match",
    )
    match_id: uuid.UUID | None = Field(
        default=None,
        description="Match ID if a mutual match was created",
    )
    remaining: dict[str, int] = Field(
        default_factory=dict,
        description="Remaining daily limits after this action",
    )


class MatchRead(BaseModel):
    """A mutual match with the partner's full profile."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    partner: UserProfile
    created_at: datetime
    is_active: bool


class MatchListResponse(BaseModel):
    """Paginated list of matches for the current user."""

    matches: list[MatchRead]
    total: int


class DailyLimitsResponse(BaseModel):
    """Current daily usage and maximums for each limit type."""

    same_league_used: int
    same_league_max: int
    cross_up_used: int
    cross_up_max: int
    super_like_used: int
    super_like_max: int


class UndoResponse(BaseModel):
    """Result of the undo-last-like action."""

    success: bool
