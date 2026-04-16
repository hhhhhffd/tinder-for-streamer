"""
StreamMatch — Push Notification Service.

Sends browser push notifications via the Web Push protocol (VAPID).
Manages push subscriptions in the database and handles delivery
to all registered devices for a given user.

Notification triggers:
- New match: "У вас новый мэтч с {display_name}!"
- Super-like received: "{display_name} поставил вам супер-лайк!"
- Cross-league-up like: "{display_name} из {league} лайкнул вас!"
- New message (if not in chat): "Новое сообщение от {display_name}"
"""

import asyncio
import json
import logging
import uuid
from functools import partial

from pywebpush import WebPushException, webpush
from sqlalchemy import and_, delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.notification import PushSubscription

logger = logging.getLogger(__name__)
settings = get_settings()

# League display names for notification text
LEAGUE_DISPLAY = {
    "bronze": "Бронзы",
    "silver": "Серебра",
    "gold": "Золота",
    "platinum": "Платины",
}


async def subscribe(
    db: AsyncSession,
    user_id: uuid.UUID,
    endpoint: str,
    p256dh: str,
    auth: str,
) -> PushSubscription:
    """
    Save or update a Web Push subscription for a user.

    If a subscription with the same endpoint already exists for this user,
    it updates the keys. Otherwise creates a new subscription.
    """
    # Check for existing subscription with this endpoint
    result = await db.execute(
        select(PushSubscription).where(
            and_(
                PushSubscription.user_id == user_id,
                PushSubscription.endpoint == endpoint,
            )
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.p256dh = p256dh
        existing.auth = auth
        await db.flush()
        return existing

    sub = PushSubscription(
        user_id=user_id,
        endpoint=endpoint,
        p256dh=p256dh,
        auth=auth,
    )
    db.add(sub)
    await db.flush()
    return sub


async def unsubscribe(
    db: AsyncSession,
    user_id: uuid.UUID,
    endpoint: str,
) -> bool:
    """
    Remove a push subscription for a user by endpoint.

    Returns True if a subscription was deleted, False if not found.
    """
    result = await db.execute(
        delete(PushSubscription).where(
            and_(
                PushSubscription.user_id == user_id,
                PushSubscription.endpoint == endpoint,
            )
        )
    )
    return result.rowcount > 0


async def unsubscribe_all(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> int:
    """Remove all push subscriptions for a user. Returns count deleted."""
    result = await db.execute(
        delete(PushSubscription).where(PushSubscription.user_id == user_id)
    )
    return result.rowcount


async def send_push(
    db: AsyncSession,
    user_id: uuid.UUID,
    title: str,
    body: str,
    url: str = "/",
) -> int:
    """
    Send a push notification to all of a user's registered devices.

    Constructs a Web Push payload with title, body, and click URL,
    then delivers it to each registered subscription endpoint.
    Automatically removes expired/invalid subscriptions.

    Returns the number of successfully delivered notifications.
    """
    if not settings.vapid_private_key:
        logger.warning("VAPID keys not configured, skipping push notification")
        return 0

    # Fetch all subscriptions for this user
    result = await db.execute(
        select(PushSubscription).where(PushSubscription.user_id == user_id)
    )
    subscriptions = list(result.scalars().all())

    if not subscriptions:
        return 0

    payload = json.dumps({
        "title": title,
        "body": body,
        "url": url,
        "icon": "/icons/icon-192.png",
        "badge": "/icons/badge-72.png",
    }, ensure_ascii=False)

    delivered = 0
    expired_ids: list[uuid.UUID] = []

    for sub in subscriptions:
        subscription_info = {
            "endpoint": sub.endpoint,
            "keys": {
                "p256dh": sub.p256dh,
                "auth": sub.auth,
            },
        }

        try:
            await asyncio.to_thread(
                partial(
                    webpush,
                    subscription_info=subscription_info,
                    data=payload,
                    vapid_private_key=settings.vapid_private_key,
                    vapid_claims={
                        "sub": settings.vapid_contact_email,
                    },
                )
            )
            delivered += 1
        except WebPushException as exc:
            # 410 Gone or 404 means subscription expired
            if hasattr(exc, "response") and exc.response is not None:
                status_code = exc.response.status_code
                if status_code in (404, 410):
                    expired_ids.append(sub.id)
                    logger.info("Push subscription expired, removing: %s", sub.endpoint[:50])
                else:
                    logger.warning("Push failed (status %s): %s", status_code, str(exc)[:100])
            else:
                logger.warning("Push failed: %s", str(exc)[:100])
        except Exception as exc:
            logger.exception("Unexpected push error: %s", exc)

    # Clean up expired subscriptions
    if expired_ids:
        await db.execute(
            delete(PushSubscription).where(PushSubscription.id.in_(expired_ids))
        )

    return delivered


async def notify_new_match(
    db: AsyncSession,
    user_id: uuid.UUID,
    partner_display_name: str,
) -> int:
    """Send a push notification about a new mutual match."""
    return await send_push(
        db=db,
        user_id=user_id,
        title="Новый мэтч! 🎉",
        body=f"У вас новый мэтч с {partner_display_name}!",
        url="/chat",
    )


async def notify_super_like(
    db: AsyncSession,
    user_id: uuid.UUID,
    liker_display_name: str,
) -> int:
    """Send a push notification about a received super-like."""
    return await send_push(
        db=db,
        user_id=user_id,
        title="Супер-лайк! ⭐",
        body=f"{liker_display_name} поставил вам супер-лайк!",
        url="/feed",
    )


async def notify_cross_league_like(
    db: AsyncSession,
    user_id: uuid.UUID,
    liker_display_name: str,
    liker_league: str,
) -> int:
    """Send a push notification about a cross-league-up like."""
    league_name = LEAGUE_DISPLAY.get(liker_league, liker_league)
    return await send_push(
        db=db,
        user_id=user_id,
        title="Лайк из другой лиги! 🏆",
        body=f"{liker_display_name} из {league_name} лайкнул вас!",
        url="/feed",
    )


async def notify_new_message(
    db: AsyncSession,
    user_id: uuid.UUID,
    sender_display_name: str,
    match_id: uuid.UUID,
) -> int:
    """Send a push notification about a new chat message."""
    return await send_push(
        db=db,
        user_id=user_id,
        title="Новое сообщение 💬",
        body=f"Новое сообщение от {sender_display_name}",
        url="/chat",
    )
