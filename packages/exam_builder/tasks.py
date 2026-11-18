from __future__ import annotations

import uuid

from celery import Task
from sqlalchemy import select

from .celery_app import celery_app
from .database import SessionLocal
from .enums import JobStatus
from .exporters import load_export_records, render_export
from .models import ExportJob, MediaAsset
from .pipeline import process_document
from .storage import ObjectStorage


@celery_app.task(
    bind=True,
    base=Task,
    name="documents.process",
    autoretry_for=(OSError, ConnectionError),
    retry_backoff=True,
    retry_jitter=True,
    max_retries=3,
)
def process_document_task(self: Task, document_id: str) -> dict[str, int | str]:
    with SessionLocal() as session:
        return process_document(session, uuid.UUID(document_id))


@celery_app.task(
    bind=True,
    base=Task,
    name="exports.create",
    autoretry_for=(OSError, ConnectionError),
    retry_backoff=True,
    max_retries=3,
)
def create_export_task(self: Task, export_id: str) -> dict[str, int | str]:
    with SessionLocal() as session:
        export = session.get(ExportJob, uuid.UUID(export_id))
        if export is None:
            raise ValueError(f"Export {export_id} was not found")
        export.status = JobStatus.PROCESSING
        session.commit()
        try:
            records = load_export_records(session, export.filters)
            media_files: list[tuple[str, bytes]] = []
            if export.format.value == "zip":
                media_query = select(MediaAsset)
                if document_id := export.filters.get("document_id"):
                    media_query = media_query.where(MediaAsset.document_id == uuid.UUID(str(document_id)))
                storage = ObjectStorage()
                for asset in session.scalars(media_query):
                    media_files.append(
                        (asset.storage_key.rsplit("/", 1)[-1], storage.get_bytes(asset.storage_key))
                    )
            payload, content_type = render_export(records, export.format, media_files)
            extension = export.format.value
            key = f"exports/{export.id}/questions.{extension}"
            ObjectStorage().put_bytes(key, payload, content_type)
            export.storage_key = key
            export.record_count = len(records)
            export.status = JobStatus.COMPLETED
            session.commit()
            return {"export_id": str(export.id), "records": len(records)}
        except Exception as error:
            session.rollback()
            export = session.get(ExportJob, uuid.UUID(export_id))
            if export:
                export.status = JobStatus.FAILED
                export.error_message = str(error)[:4000]
                session.commit()
            raise