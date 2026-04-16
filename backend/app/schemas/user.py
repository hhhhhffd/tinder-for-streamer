"""
StreamMatch — User Pydantic Schemas.

Request/response models for user-related endpoints.
All API boundaries use these schemas — never return raw dicts.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UserCategoryRead(BaseModel):
    """A single Twitch category displayed on a user's profile card."""

    model_config = ConfigDict(from_attributes=True)

    category_id: str
    category_name: str
    box_art_url: str


class UserStatsRead(BaseModel):
    """Twitch statistics and league info for a user."""

    model_config = ConfigDict(from_attributes=True)

    follower_count: int
    avg_viewers: int
    league: str
    stream_language: str
    last_synced_at: datetime | None = None


class UserCreate(BaseModel):
    """
    Internal schema for creating a user from Twitch OAuth data.

    Not exposed as an API endpoint — used by the auth service.
    """

    twitch_id: str
    login: str
    display_name: str
    email: str | None = None
    profile_image_url: str = ""
    broadcaster_type: str = ""


class UserRead(BaseModel):
    """Public user profile returned in API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    twitch_id: str
    login: str
    display_name: str
    profile_image_url: str
    broadcaster_type: str
    bio: str
    is_premium: bool
    created_at: datetime


class UserProfile(BaseModel):
    """
    Full user profile with stats and categories.

    Used on the profile page and in the swipe card feed.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    twitch_id: str
    login: str
    display_name: str
    profile_image_url: str
    broadcaster_type: str
    bio: str
    is_premium: bool
    is_admin: bool = False
    created_at: datetime
    stats: UserStatsRead | None = None
    categories: list[UserCategoryRead] = Field(default_factory=list)


class UserUpdate(BaseModel):
    """
    Fields the user can edit on their own profile.

    Currently only bio is editable — all other data comes from Twitch.
    """

    bio: str = Field(..., min_length=0, max_length=500)


class UserAdminRead(BaseModel):
    """Extended user view for admin panel — includes moderation flags."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    twitch_id: str
    login: str
    display_name: str
    email: str | None
    profile_image_url: str
    broadcaster_type: str
    bio: str
    is_premium: bool
    is_admin: bool
    is_banned: bool
    created_at: datetime
    updated_at: datetime
    stats: UserStatsRead | None = None
    categories: list[UserCategoryRead] = Field(default_factory=list)
