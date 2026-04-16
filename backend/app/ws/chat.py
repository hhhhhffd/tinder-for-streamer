"""
StreamMatch — WebSocket Chat Handler.

Real-time chat via WebSocket with Redis pub/sub for horizontal scaling.
Each match conversation gets a Redis channel "chat:{match_id}".
On connect, the user is authenticated via JWT cookie, verified as a match
participant, and subscribed to the Redis channel. Messages are broadcast
to all connected clients for that match via Redis pub/sub.
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from jose import JWTError, jwt
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import async_session_factory
from app.models.match import Match
from app.models.report import Block
from app.models.user import User
from app.redis import get_redis_client
from app.services.auth import AUTH_COOKIE_NAME
from app.services.chat import save_message
from app.services.notifications import notify_new_message

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter()

# In-memory registry of active WebSocket connections per match.
# Key: match_id (str) -> set of WebSocket connections.
# This is per-process; Redis pub/sub handles cross-process delivery.
_active_connections: dict[str, set[WebSocket]] = {}

# Active Redis subscriber tasks per match (one per match per process).
_subscriber_tasks: dict[str, asyncio.Task[None]] = {}


def _get_channel_name(match_id: str) -> str:
    """Build the Redis pub/sub channel name for a match conversation."""
    return f"chat:{match_id}"


async def _authenticate_websocket(websocket: WebSocket) -> str | None:
    """
    Extract and validate the JWT from the WebSocket connection.

    WebSocket connections cannot use standard cookie headers the same way
    as HTTP. We try two approaches:
    1. Parse the Cookie header from the WebSocket handshake
    2. Accept a 'token' query parameter as fallback

    Returns the user_id string if valid, None otherwise.
    """
    token: str | None = None

    # Try cookie header first
    cookies = websocket.cookies
    if AUTH_COOKIE_NAME in cookies:
        token = cookies[AUTH_COOKIE_NAME]

    # Fallback: query parameter
    if token is None:
        token = websocket.query_params.get("token")

    if token is None:
        return None

    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        user_id: str | None = payload.get("sub")
        return user_id
    except JWTError:
        return None


async def _validate_match_participant(
    db: AsyncSession,
    match_id: str,
    user_id: str,
) -> bool:
    """
    Verify the match exists, is active, the user is a participant,
    and neither user has blocked the other.

    Returns True if valid, False otherwise.
    """
    result = await db.execute(
        select(Match).where(Match.id == match_id)
    )
    match = result.scalar_one_or_none()

    if match is None or not match.is_active:
        return False

    is_participant = str(match.user1_id) == user_id or str(match.user2_id) == user_id
    if not is_participant:
        return False

    # Determine the partner's ID
    partner_id = str(match.user2_id) if str(match.user1_id) == user_id else str(match.user1_id)

    # Check for blocks in either direction
    block_result = await db.execute(
        select(Block.id).where(
            ((Block.blocker_id == user_id) & (Block.blocked_id == partner_id))
            | ((Block.blocker_id == partner_id) & (Block.blocked_id == user_id))
        )
    )
    if block_result.scalar_one_or_none() is not None:
        return False

    return True


def _add_connection(match_id: str, websocket: WebSocket) -> None:
    """Register a WebSocket connection for a match."""
    if match_id not in _active_connections:
        _active_connections[match_id] = set()
    _active_connections[match_id].add(websocket)


def _remove_connection(match_id: str, websocket: WebSocket) -> None:
    """Unregister a WebSocket connection for a match."""
    if match_id in _active_connections:
        _active_connections[match_id].discard(websocket)
        if not _active_connections[match_id]:
            del _active_connections[match_id]


async def _broadcast_to_local(match_id: str, message: dict[str, Any], exclude: WebSocket | None = None) -> None:
    """
    Send a message to all locally connected WebSocket clients for a match.

    Optionally excludes one connection (e.g. the sender, to avoid echo
    when the message was already published via Redis to other processes).
    """
    connections = _active_connections.get(match_id, set()).copy()
    payload = json.dumps(message, default=str, ensure_ascii=False)

    dead_connections: list[WebSocket] = []
    for ws in connections:
        if ws is exclude:
            continue
        try:
            await ws.send_text(payload)
        except Exception:
            dead_connections.append(ws)

    # Clean up dead connections
    for ws in dead_connections:
        _remove_connection(match_id, ws)


async def _redis_subscriber(match_id: str, redis: Redis) -> None:
    """
    Subscribe to the Redis pub/sub channel for a match and forward
    incoming messages to all local WebSocket connections.

    Runs as a background task for the duration of the WebSocket connection.
    When no more local connections exist for this match, the subscription
    is cancelled automatically.
    """
    channel_name = _get_channel_name(match_id)
    pubsub = redis.pubsub()
    await pubsub.subscribe(channel_name)

    try:
        async for raw_message in pubsub.listen():
            if raw_message["type"] != "message":
                continue

            # Check if there are still local connections
            if match_id not in _active_connections or not _active_connections[match_id]:
                break

            try:
                data = json.loads(raw_message["data"])
            except (json.JSONDecodeError, TypeError):
                continue

            await _broadcast_to_local(match_id, data)
    finally:
        await pubsub.unsubscribe(channel_name)
        await pubsub.aclose()


@router.websocket("/ws/chat/{match_id}")
async def websocket_chat(websocket: WebSocket, match_id: str) -> None:
    """
    WebSocket endpoint for real-time chat within a match.

    Flow:
    1. Authenticate the user via JWT cookie or query param
    2. Verify the user is part of the match
    3. Accept the connection
    4. Subscribe to Redis pub/sub channel for this match
    5. Listen for incoming messages, save to DB, publish to Redis
    6. On disconnect, clean up connection and subscription
    """
    # Step 1: Authenticate
    user_id = await _authenticate_websocket(websocket)
    if user_id is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Требуется авторизация")
        return

    # Step 2: Validate match membership
    async with async_session_factory() as db:
        is_valid = await _validate_match_participant(db, match_id, user_id)

    if not is_valid:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Нет доступа к этому чату")
        return

    # Step 3: Accept connection
    await websocket.accept()

    # Step 4: Register connection and start Redis subscriber
    websocket._streammatch_user_id = user_id  # type: ignore[attr-defined]
    _add_connection(match_id, websocket)
    redis = get_redis_client()

    # Start Redis subscriber as background task (if not already running for this match)
    if match_id not in _subscriber_tasks or _subscriber_tasks[match_id].done():
        sub_redis = get_redis_client()
        task = asyncio.create_task(_redis_subscriber(match_id, sub_redis))
        _subscriber_tasks[match_id] = task

    try:
        # Step 5: Message loop
        while True:
            raw = await websocket.receive_text()

            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "content": "Некорректный формат сообщения",
                }))
                continue

            msg_type = data.get("type", "message")

            # Handle typing indicator — broadcast without saving
            if msg_type == "typing":
                typing_event = {
                    "type": "typing",
                    "sender_id": user_id,
                    "match_id": match_id,
                }
                await redis.publish(
                    _get_channel_name(match_id),
                    json.dumps(typing_event, ensure_ascii=False),
                )
                continue

            # Handle read receipt — mark messages as read and notify
            if msg_type == "read_receipt":
                async with async_session_factory() as db:
                    from app.services.chat import mark_as_read
                    await mark_as_read(db, uuid.UUID(match_id), uuid.UUID(user_id))
                    await db.commit()

                read_event = {
                    "type": "read_receipt",
                    "sender_id": user_id,
                    "match_id": match_id,
                }
                await redis.publish(
                    _get_channel_name(match_id),
                    json.dumps(read_event, ensure_ascii=False),
                )
                continue

            # Handle chat message
            content = data.get("content", "").strip()
            if not content:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "content": "Сообщение не может быть пустым",
                }))
                continue

            if len(content) > 2000:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "content": "Сообщение слишком длинное (макс. 2000 символов)",
                }))
                continue

            # Save message to database
            async with async_session_factory() as db:
                message = await save_message(
                    db=db,
                    match_id=uuid.UUID(match_id),
                    sender_id=uuid.UUID(user_id),
                    content=content,
                )
                await db.commit()
                await db.refresh(message)

                msg_payload = {
                    "type": "message",
                    "id": str(message.id),
                    "match_id": str(message.match_id),
                    "sender_id": str(message.sender_id),
                    "content": message.content,
                    "created_at": message.created_at.isoformat(),
                    "is_read": message.is_read,
                }

            # Publish to Redis — all subscribers (including this process) will receive it
            await redis.publish(
                _get_channel_name(match_id),
                json.dumps(msg_payload, default=str, ensure_ascii=False),
            )

            # Send push notification to the partner (if they're not connected)
            try:
                async with async_session_factory() as notify_db:
                    # Fetch match to find partner and sender display name
                    match_result = await notify_db.execute(
                        select(Match).where(Match.id == match_id)
                    )
                    match_obj = match_result.scalar_one_or_none()
                    if match_obj:
                        partner_uid = (
                            match_obj.user2_id
                            if str(match_obj.user1_id) == user_id
                            else match_obj.user1_id
                        )
                        partner_mid = str(partner_uid)
                        # Only notify if partner has no active WS connection for this match
                        partner_connected = any(
                            True for ws_conn in _active_connections.get(match_id, set())
                            if getattr(ws_conn, "_streammatch_user_id", None) == partner_mid
                        )
                        if not partner_connected:
                            sender_result = await notify_db.execute(
                                select(User.display_name).where(User.id == user_id)
                            )
                            sender_name = sender_result.scalar_one_or_none() or "Пользователь"
                            await notify_new_message(
                                notify_db, partner_uid, sender_name, uuid.UUID(match_id),
                            )
                            await notify_db.commit()
            except Exception:
                logger.warning("Failed to send message push notification", exc_info=True)

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected: user=%s match=%s", user_id, match_id)
    except Exception as exc:
        logger.exception("WebSocket error: user=%s match=%s error=%s", user_id, match_id, exc)
    finally:
        # Step 6: Cleanup
        _remove_connection(match_id, websocket)

        # Cancel subscriber if no more local connections for this match
        if match_id not in _active_connections and match_id in _subscriber_tasks:
            _subscriber_tasks[match_id].cancel()
            try:
                await _subscriber_tasks[match_id]
            except asyncio.CancelledError:
                pass
            del _subscriber_tasks[match_id]

        await redis.aclose()
