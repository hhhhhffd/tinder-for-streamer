"""
StreamMatch — Feed Pydantic Schemas.

Request/response models for the swipe feed endpoints.
"""

from pydantic import BaseModel, Field

from app.schemas.user import UserProfile


class FeedFilters(BaseModel):
    """
    Optional filters applied to the swipe feed.

    All fields are optional — omitting a filter means no constraint.
    """

    categories: list[str] | None = Field(
        default=None,
        description="Category IDs to filter by (match any)",
    )
    min_viewers: int | None = Field(
        default=None,
        ge=0,
        description="Minimum average viewers",
    )
    max_viewers: int | None = Field(
        default=None,
        ge=0,
        description="Maximum average viewers",
    )
    min_followers: int | None = Field(
        default=None,
        ge=0,
        description="Minimum follower count",
    )
    max_followers: int | None = Field(
        default=None,
        ge=0,
        description="Maximum follower count",
    )
    language: str | None = Field(
        default=None,
        description="Stream language code (e.g. 'ru', 'en')",
    )


class FeedResponse(BaseModel):
    """Paginated feed of user profiles to swipe on."""

    profiles: list[UserProfile]
    total: int
    has_more: bool


class CategoryItem(BaseModel):
    """A unique category available in the system for filter dropdowns."""

    category_id: str
    category_name: str


class CategoriesResponse(BaseModel):
    """List of all unique categories for the filter panel."""

    categories: list[CategoryItem]
