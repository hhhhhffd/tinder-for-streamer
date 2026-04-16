"""
StreamMatch — Push Notification Endpoints.

Manages Web Push subscriptions: subscribe to receive push notifications,
unsubscribe to stop receiving them. Also provides the VAPID public key
so the frontend can register with the browser Push API.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.services.notifications import subscribe, unsubscribe

settings = get_settings()
router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class PushSubscribeRequest(BaseModel):
    """Request body for subscribing to push notifications."""

    endpoint: str = Field(..., min_length=1, max_length=2048)
    p256dh: str = Field(..., min_length=1, max_length=256)
    auth: str = Field(..., min_length=1, max_length=256)


class PushUnsubscribeRequest(BaseModel):
    """Request body for unsubscribing from push notifications."""

    endpoint: str = Field(..., min_length=1, max_length=2048)


@router.get(
    "/vapid-key",
    summary="Получить VAPID публичный ключ",
)
async def get_vapid_key() -> dict:
    """
    Return the VAPID public key for the frontend to use
    when subscribing to push notifications via the Push API.
    """
    return {"vapid_public_key": settings.vapid_public_key}


@router.post(
    "/subscribe",
    summary="Подписаться на push-уведомления",
)
async def push_subscribe(
    payload: PushSubscribeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Save a Web Push subscription for the current user.

    The frontend should call this after successfully registering
    a service worker and obtaining a PushSubscription object.
    """
    sub = await subscribe(
        db=db,
        user_id=current_user.id,
        endpoint=payload.endpoint,
        p256dh=payload.p256dh,
        auth=payload.auth,
    )
    return {"detail": "Подписка сохранена", "id": str(sub.id)}


@router.delete(
    "/unsubscribe",
    summary="Отписаться от push-уведомлений",
)
async def push_unsubscribe(
    payload: PushUnsubscribeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Remove a push subscription for the current user.

    Called when the user disables notifications or unregisters the service worker.
    """
    removed = await unsubscribe(
        db=db,
        user_id=current_user.id,
        endpoint=payload.endpoint,
    )
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Подписка не найдена",
        )
    return {"detail": "Подписка удалена"}
