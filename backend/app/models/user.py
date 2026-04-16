"""
StreamMatch — User Models.

Defines the User, UserStats, and UserCategory tables.
User is the central entity — authenticated via Twitch OAuth.
UserStats holds synced Twitch metrics and the auto-assigned league.
UserCategory stores the streamer's recent game/category tags.
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
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class League(str, enum.Enum):
    """League tiers based on average concurrent viewers."""

    bronze = "bronze"
    silver = "silver"
    gold = "gold"
    platinum = "platinum"


class User(Base):
    """
    Core user entity.

    Created on first Twitch OAuth login. Profile data is synced from the
    Twitch Helix API on auth and every 24 hours via Celery beat.
    """

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    twitch_id: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True,
    )
    login: Mapped[str] = mapped_column(String(128), nullable=False)
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    email: Mapped[str | None] = mapped_column(String(256), nullable=True)
    profile_image_url: Mapped[str] = mapped_column(String(512), nullable=False, server_default="")
    broadcaster_type: Mapped[str] = mapped_column(
        String(32), nullable=False, server_default="",
    )
    bio: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    is_premium: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    is_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    is_banned: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now(),
    )

    # Relationships
    stats: Mapped["UserStats"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan", lazy="selectin",
    )
    categories: Mapped[list["UserCategory"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<User {self.login} ({self.twitch_id})>"


class UserStats(Base):
    """
    Twitch statistics for a user.

    Synced from the Twitch Helix API. The league field is auto-calculated
    based on avg_viewers and cannot be manually overridden.
    """

    __tablename__ = "user_stats"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    follower_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    avg_viewers: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    league: Mapped[League] = mapped_column(
        Enum(League, name="league_enum", create_constraint=True),
        nullable=False,
        server_default=League.bronze.value,
    )
    stream_language: Mapped[str] = mapped_column(String(16), nullable=False, server_default="ru")
    last_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now(),
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="stats")

    def __repr__(self) -> str:
        return f"<UserStats user_id={self.user_id} league={self.league}>"


class UserCategory(Base):
    """
    A Twitch game/category that the streamer recently played.

    Pulled from the Twitch API during sync. Displayed on the profile card
    so potential collaborators can see shared interests.
    """

    __tablename__ = "user_categories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category_id: Mapped[str] = mapped_column(String(64), nullable=False)
    category_name: Mapped[str] = mapped_column(String(256), nullable=False)
    box_art_url: Mapped[str] = mapped_column(String(512), nullable=False, server_default="")

    # Relationships
    user: Mapped["User"] = relationship(back_populates="categories")

    # Prevent duplicate categories per user
    __table_args__ = (
        Index("ix_user_categories_user_category", "user_id", "category_id", unique=True),
    )

    def __repr__(self) -> str:
        return f"<UserCategory {self.category_name} for user_id={self.user_id}>"
