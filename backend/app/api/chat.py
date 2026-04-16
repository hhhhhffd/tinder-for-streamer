"""
StreamMatch — Chat REST API Router.

REST endpoints for chat history, read receipts, and unread counts.
Real-time messaging happens via WebSocket (ws/chat.py); these endpoints
provide supporting functionality for loading history and managing state.
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, get_redis
from app.models.user import User
from app.schemas.chat import ChatHistory, MessageRead
from app.services.chat import (
    get_chat_history,
    get_match_with_validation,
    get_unread_counts,
    mark_as_read,
)

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.get(
    "/{match_id}/messages",
    response_model=ChatHistory,
    summary="Получить историю чата",
)
async def get_messages(
    match_id: uuid.UUID,
    before: datetime | None = Query(
        default=None,
        description="Cursor: load messages created before this timestamp (ISO 8601)",
    ),
    limit: int = Query(default=50, ge=1, le=100, description="Number of messages to load"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatHistory:
    """
    Load paginated chat history for a match conversation.

    Messages are returned in reverse chronological order (newest first).
    Use the 'before' cursor with the oldest message's created_at timestamp
    to load the next page. The 'has_more' field indicates if more messages exist.
    """
    # Verify user has access to this match
    try:
        await get_match_with_validation(db, match_id, current_user.id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        )

    messages, has_more = await get_chat_history(db, match_id, before=before, limit=limit)

    return ChatHistory(
        messages=[MessageRead.model_validate(m) for m in messages],
        total=len(messages),
        has_more=has_more,
    )


@router.post(
    "/{match_id}/read",
    summary="Отметить сообщения как прочитанные",
)
async def mark_messages_read(
    match_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Mark all unread messages from the partner as read.

    Only marks messages sent by the other user (not the current user's
    own messages). Returns the count of messages marked as read.
    """
    try:
        await get_match_with_validation(db, match_id, current_user.id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        )

    count = await mark_as_read(db, match_id, current_user.id)
    return {"marked_read": count}


@router.get(
    "/unread",
    summary="Получить количество непрочитанных сообщений",
)
async def get_unread(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Get unread message counts for all active matches.

    Returns a mapping of match_id -> unread count, only for matches
    that have at least one unread message.
    """
    counts = await get_unread_counts(db, current_user.id)
    # Convert UUID keys to strings for JSON serialization
    return {
        "unread": {str(match_id): count for match_id, count in counts.items()},
        "total_unread": sum(counts.values()),
    }
