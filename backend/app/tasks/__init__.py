"""
StreamMatch — Celery Application.

Configures the Celery app with Redis broker for background task processing.
Defines beat schedule for periodic tasks and concurrency settings.
"""

from celery import Celery

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "streammatch",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    # Serialization
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",

    # Timezone
    timezone="UTC",
    enable_utc=True,

    # Concurrency — limit to avoid overwhelming Twitch API
    worker_concurrency=4,
    worker_prefetch_multiplier=1,

    # Task expiry — don't execute stale tasks
    task_soft_time_limit=300,   # 5 min soft limit
    task_time_limit=600,        # 10 min hard limit

    # Task routing
    task_routes={
        "app.tasks.twitch_sync.sync_all_users_task": {"queue": "sync"},
        "app.tasks.twitch_sync.sync_single_user_task": {"queue": "sync"},
    },

    # Beat schedule — periodic tasks
    beat_schedule={
        "sync-twitch-data-every-24h": {
            "task": "app.tasks.twitch_sync.sync_all_users_task",
            "schedule": 86400.0,  # 24 hours in seconds
        },
    },
)

# Auto-discover tasks in the tasks module
celery_app.autodiscover_tasks(["app.tasks"])
