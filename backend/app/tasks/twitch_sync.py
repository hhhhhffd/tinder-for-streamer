"""
StreamMatch — Twitch Data Sync Celery Tasks.

Periodic and on-demand tasks for synchronizing user data from the Twitch API.
Uses asyncio.run() to bridge async service code into Celery's sync workers.

Rate limiting: Twitch allows 800 requests per minute per Client ID.
Each user sync makes ~4 API calls, so we process at most 200 users/min
with a small delay between batches to stay safely under the limit.
"""

import asyncio
import logging
import time

from app.tasks import celery_app

logger = logging.getLogger(__name__)

# Rate limiting constants
REQUESTS_PER_USER = 4          # get_user, get_followers, get_streams, get_channel_info
TWITCH_RATE_LIMIT = 800        # requests per minute
SAFE_RATE_LIMIT = 600          # leave headroom for other operations
BATCH_SIZE = 50                # users per batch
BATCH_DELAY_SECONDS = (BATCH_SIZE * REQUESTS_PER_USER / SAFE_RATE_LIMIT) * 60


@celery_app.task(
    name="app.tasks.twitch_sync.sync_all_users_task",
    bind=True,
    max_retries=2,
    default_retry_delay=300,
)
def sync_all_users_task(self) -> dict:
    """
    Periodic task: sync Twitch data for all active users.

    Iterates through all non-banned users in batches, calling
    sync_user_data for each. Respects Twitch API rate limits
    by inserting delays between batches.

    Returns a summary with counts of synced/failed/skipped users.
    """
    return asyncio.run(_sync_all_users_async(self))


async def _sync_all_users_async(task) -> dict:
    """
    Async implementation of the bulk sync.

    Fetches all active user IDs, processes them in rate-limited
    batches, and returns a summary dict.
    """
    from app.services.twitch_sync import get_all_active_user_ids, sync_user_data

    user_ids = await get_all_active_user_ids()
    total = len(user_ids)
    synced = 0
    failed = 0

    logger.info("Starting Twitch sync for %d users", total)

    for batch_start in range(0, total, BATCH_SIZE):
        batch = user_ids[batch_start:batch_start + BATCH_SIZE]
        batch_num = batch_start // BATCH_SIZE + 1
        total_batches = (total + BATCH_SIZE - 1) // BATCH_SIZE

        logger.info(
            "Processing batch %d/%d (%d users)",
            batch_num, total_batches, len(batch),
        )

        for user_id in batch:
            try:
                success = await sync_user_data(user_id)
                if success:
                    synced += 1
                else:
                    failed += 1
            except Exception:
                logger.exception("Unexpected error syncing user %s", user_id)
                failed += 1

        # Rate limit: pause between batches to stay under 800 req/min
        if batch_start + BATCH_SIZE < total:
            logger.debug(
                "Rate limiting: sleeping %.1fs between batches",
                BATCH_DELAY_SECONDS,
            )
            time.sleep(BATCH_DELAY_SECONDS)

        # Update task state for monitoring
        task.update_state(
            state="PROGRESS",
            meta={
                "synced": synced,
                "failed": failed,
                "total": total,
                "current_batch": batch_num,
            },
        )

    summary = {
        "synced": synced,
        "failed": failed,
        "total": total,
        "skipped": total - synced - failed,
    }
    logger.info("Twitch sync complete: %s", summary)
    return summary


@celery_app.task(
    name="app.tasks.twitch_sync.sync_single_user_task",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def sync_single_user_task(self, user_id: str) -> dict:
    """
    On-demand task: sync Twitch data for a single user.

    Called after OAuth login or when a user manually requests a refresh.
    The user_id is passed as a string (UUID) since Celery serializes to JSON.
    """
    import uuid
    return asyncio.run(_sync_single_user_async(self, uuid.UUID(user_id)))


async def _sync_single_user_async(task, user_id) -> dict:
    """Async implementation of single-user sync."""
    from app.services.twitch_sync import sync_user_data

    try:
        success = await sync_user_data(user_id)
        return {
            "user_id": str(user_id),
            "success": success,
        }
    except Exception as exc:
        logger.exception("Failed to sync user %s", user_id)
        raise task.retry(exc=exc)
