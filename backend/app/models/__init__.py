"""
StreamMatch — Model Registry.

Imports all SQLAlchemy models so that Alembic auto-generation
can detect them via Base.metadata.
"""

from app.models.user import User, UserStats, UserCategory, League  # noqa: F401
from app.models.match import Like, Match, LikeType  # noqa: F401
from app.models.chat import Message  # noqa: F401
from app.models.report import Report, Block, ReportStatus  # noqa: F401
from app.models.notification import PushSubscription  # noqa: F401
