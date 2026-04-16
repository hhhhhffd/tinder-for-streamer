"""
StreamMatch — Schema Registry.

Re-exports all Pydantic schemas for convenient imports.
"""

from app.schemas.user import (  # noqa: F401
    UserCreate,
    UserRead,
    UserProfile,
    UserUpdate,
    UserAdminRead,
    UserStatsRead,
    UserCategoryRead,
)
from app.schemas.match import (  # noqa: F401
    LikeCreate,
    DislikeCreate,
    LikeResponse,
    MatchRead,
    MatchListResponse,
    DailyLimitsResponse,
    UndoResponse,
)
from app.schemas.chat import (  # noqa: F401
    MessageCreate,
    MessageRead,
    ChatHistory,
    WebSocketMessage,
)
from app.schemas.feed import (  # noqa: F401
    FeedFilters,
    FeedResponse,
    CategoryItem,
    CategoriesResponse,
)
from app.schemas.report import (  # noqa: F401
    ReportCreate,
    ReportRead,
    ReportUpdate,
    ReportListResponse,
    BlockCreate,
    BlockRead,
)
