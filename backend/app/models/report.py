"""
StreamMatch — Report & Block Models.

Report allows users to flag inappropriate behavior for admin review.
Block allows users to hide another user from their feed permanently.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ReportStatus(str, enum.Enum):
    """Lifecycle states for a user report."""

    pending = "pending"
    reviewed = "reviewed"
    resolved = "resolved"


class Report(Base):
    """
    A user-submitted report about another user.

    Admins review pending reports via the admin panel, add notes,
    and transition the status through reviewed → resolved.
    """

    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    reporter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reported_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[ReportStatus] = mapped_column(
        Enum(ReportStatus, name="report_status_enum", create_constraint=True),
        nullable=False,
        server_default=ReportStatus.pending.value,
    )
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    # Relationships
    reporter = relationship("User", foreign_keys=[reporter_id], lazy="selectin")
    reported = relationship("User", foreign_keys=[reported_id], lazy="selectin")

    __table_args__ = (
        Index("ix_reports_status", "status"),
    )

    def __repr__(self) -> str:
        return f"<Report {self.reporter_id} -> {self.reported_id} ({self.status})>"


class Block(Base):
    """
    A user-initiated block.

    Blocked users are excluded from the blocker's feed and cannot
    send likes or messages to the blocker. Unique constraint prevents
    duplicate blocks.
    """

    __tablename__ = "blocks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    blocker_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    blocked_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )

    # Relationships
    blocker = relationship("User", foreign_keys=[blocker_id], lazy="selectin")
    blocked = relationship("User", foreign_keys=[blocked_id], lazy="selectin")

    __table_args__ = (
        UniqueConstraint("blocker_id", "blocked_id", name="uq_block_pair"),
    )

    def __repr__(self) -> str:
        return f"<Block {self.blocker_id} blocks {self.blocked_id}>"
