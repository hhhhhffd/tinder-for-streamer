"""
StreamMatch — Report & Block Pydantic Schemas.

Request/response models for reporting and blocking users.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ReportCreate(BaseModel):
    """Request body for reporting a user."""

    reported_id: uuid.UUID
    reason: str = Field(..., min_length=10, max_length=1000)


class ReportRead(BaseModel):
    """Report details — visible to admins and the reporter."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    reporter_id: uuid.UUID
    reported_id: uuid.UUID
    reason: str
    status: str
    admin_notes: str | None = None
    created_at: datetime
    resolved_at: datetime | None = None


class ReportUpdate(BaseModel):
    """Admin-only schema for updating a report's status and notes."""

    status: str = Field(
        ...,
        pattern="^(pending|reviewed|resolved)$",
        description="New status for the report",
    )
    admin_notes: str | None = Field(default=None, max_length=2000)


class ReportListResponse(BaseModel):
    """Paginated list of reports for the admin panel."""

    reports: list[ReportRead]
    total: int


class BlockCreate(BaseModel):
    """Request body for blocking a user."""

    blocked_id: uuid.UUID


class BlockRead(BaseModel):
    """Block record — confirms the block was created."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    blocker_id: uuid.UUID
    blocked_id: uuid.UUID
    created_at: datetime
