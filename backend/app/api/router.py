"""
StreamMatch — Main API Router Aggregator.

Collects all sub-routers and mounts them under the application.
Import this module in main.py to register all API routes.
"""

from fastapi import APIRouter

from app.api.admin import router as admin_router
from app.api.auth import router as auth_router
from app.api.chat import router as chat_router
from app.api.feed import router as feed_router
from app.api.matches import router as matches_router
from app.api.notifications import router as notifications_router
from app.api.premium import router as premium_router
from app.api.reports import router as reports_router
from app.api.users import router as users_router

# Main router that aggregates all sub-routers
api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(feed_router)
api_router.include_router(matches_router)
api_router.include_router(chat_router)
api_router.include_router(notifications_router)
api_router.include_router(reports_router)
api_router.include_router(premium_router)
api_router.include_router(admin_router)
