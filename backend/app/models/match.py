"""
StreamMatch — Like & Match Models.

Like represents a directional swipe (like or super-like) from one user to another.
Match is created when two users have mutually liked each other, unlocking chat.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class LikeType(str, enum.Enum):
    """Type of like action a user can perform."""

    like = "like"
    super_like = "super_like"
    dislike = "dislike"


class Like(Base):
    """
    A directional like from one user to another.

    Tracks whether the like crosses league boundaries upward (which has
    special behavior: notifications + priority in the recipient's feed).
    A unique constraint prevents duplicate likes between the same pair.
    """

    __tablename__ = "likes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    from_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    to_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type: Mapped[LikeType] = mapped_column(
        Enum(LikeType, name="like_type_enum", create_constraint=True),
        nullable=False,
        server_default=LikeType.like.value,
    )
    is_cross_league_up: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )

    # Relationships
    from_user = relationship("User", foreign_keys=[from_user_id], lazy="selectin")
    to_user = relationship("User", foreign_keys=[to_user_id], lazy="selectin")

    __table_args__ = (
        UniqueConstraint("from_user_id", "to_user_id", name="uq_like_from_to"),
        Index("ix_likes_to_user_created", "to_user_id", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<Like {self.from_user_id} -> {self.to_user_id} ({self.type})>"


class Match(Base):
    """
    A mutual match between two users.

    Created automatically when user A likes user B and user B has already
    liked user A. Once matched, both users can chat via WebSocket.
    is_active can be set to False if either user unmatches.
    """

    __tablename__ = "matches"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    user1_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user2_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true",
    )

    # Relationships
    user1 = relationship("User", foreign_keys=[user1_id], lazy="selectin")
    user2 = relationship("User", foreign_keys=[user2_id], lazy="selectin")
    messages: Mapped[list["Message"]] = relationship(
        "Message", back_populates="match", cascade="all, delete-orphan", lazy="select",
    )

    __table_args__ = (
        Index("ix_matches_users", "user1_id", "user2_id", unique=True),
    )

    def __repr__(self) -> str:
        return f"<Match {self.user1_id} <-> {self.user2_id}>"
