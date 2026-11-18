from __future__ import annotations

from celery import Celery

from .settings import get_settings

settings = get_settings()
celery_app = Celery(
    "exam_builder",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["packages.exam_builder.tasks"],
)
celery_app.conf.update(
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    task_track_started=True,
    task_time_limit=1800,
    task_soft_time_limit=1740,
    task_routes={"documents.process": {"queue": "documents"}, "exports.create": {"queue": "exports"}},
    broker_transport_options={"visibility_timeout": 3600},
)
