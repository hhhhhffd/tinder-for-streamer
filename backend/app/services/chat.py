"""
StreamMatch — Chat Service.

Business logic for chat messages within matched conversations.
Handles saving messages, loading paginated history, marking as read,
and counting unread messages per match.
"""

import uuid
from datetime import datetime

from sqlalchemy import and_, case, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.chat import Message
from app.models.match import Match


async def save_message(
    db: AsyncSession,
    match_id: uuid.UUID,
    sender_id: uuid.UUID,
    content: str,
) -> Message:
    """
    Persist a new chat message in the database.

    Creates a Message row linked to the match and sender.
    Returns the saved message with its generated ID and timestamp.
    """
    message = Message(
        match_id=match_id,
        sender_id=sender_id,
        content=content,
    )
    db.add(message)
    await db.flush()
    await db.refresh(message)
    return message


async def get_chat_history(
    db: AsyncSession,
    match_id: uuid.UUID,
    before: datetime | None = None,
    limit: int = 50,
) -> tuple[list[Message], bool]:
    """
    Fetch paginated chat history for a match conversation.

    Uses cursor-based pagination via the 'before' timestamp.
    Returns messages in reverse chronological order (newest first)
    and a boolean indicating whether more messages exist.

    Args:
        db: Async database session.
        match_id: The match conversation to load.
        before: Cursor — only messages created before this timestamp.
        limit: Maximum number of messages to return (default 50).

    Returns:
        Tuple of (messages list, has_more boolean).
    """
    query = (
        select(Message)
        .where(Message.match_id == match_id)
        .order_by(Message.created_at.desc())
        .limit(limit + 1)  # Fetch one extra to check if more exist
    )

    if before is not None:
        query = query.where(Message.created_at < before)

    result = await db.execute(query)
    messages = list(result.scalars().all())

    # Determine if more messages exist beyond this page
    has_more = len(messages) > limit
    if has_more:
        messages = messages[:limit]

    return messages, has_more


async def mark_as_read(
    db: AsyncSession,
    match_id: uuid.UUID,
    user_id: uuid.UUID,
) -> int:
    """
    Mark all unread messages in a match as read for a given user.

    Only marks messages sent by the OTHER user (not the reader's own messages).
    Returns the number of messages marked as read.
    """
    result = await db.execute(
        update(Message)
        .where(
            and_(
                Message.match_id == match_id,
                Message.sender_id != user_id,
                Message.is_read == False,  # noqa: E712 — SQLAlchemy requires == for filter
            )
        )
        .values(is_read=True)
    )
    return result.rowcount


async def get_unread_counts(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> dict[uuid.UUID, int]:
    """
    Count unread messages per match for a user.

    Only counts messages sent by the other user (not the user's own messages).
    Returns a dict mapping match_id -> unread count, only for matches
    with at least one unread message.
    """
    # First get all active match IDs involving this user
    match_subq = (
        select(Match.id)
        .where(
            and_(
                Match.is_active == True,  # noqa: E712
                (Match.user1_id == user_id) | (Match.user2_id == user_id),
            )
        )
    ).subquery()

    # Count unread messages per match (exclude user's own messages)
    result = await db.execute(
        select(
            Message.match_id,
            func.count(Message.id).label("unread"),
        )
        .where(
            and_(
                Message.match_id.in_(select(match_subq.c.id)),
                Message.sender_id != user_id,
                Message.is_read == False,  # noqa: E712
            )
        )
        .group_by(Message.match_id)
    )

    return {row.match_id: row.unread for row in result.all()}


async def get_match_with_validation(
    db: AsyncSession,
    match_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Match:
    """
    Load a match and verify the user is a participant.

    Raises ValueError if the match doesn't exist, is inactive,
    or the user is not part of it.
    """
    result = await db.execute(
        select(Match).where(Match.id == match_id)
    )
    match = result.scalar_one_or_none()

    if match is None:
        raise ValueError("Чат не найден")

    if not match.is_active:
        raise ValueError("Мэтч больше не активен")

    if match.user1_id != user_id and match.user2_id != user_id:
        raise ValueError("У вас нет доступа к этому чату")

    return match
