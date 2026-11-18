from __future__ import annotations

import uuid
from typing import Any

import structlog
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .enums import JobStatus, ReviewStatus
from .extraction import extract_document
from .models import AnswerKey, Document, MediaAsset, Option, Page, ProcessingLog, Question, UploadJob
from .ocr import get_ocr_adapter
from .settings import get_settings
from .storage import ObjectStorage

logger = structlog.get_logger(__name__)


def _log_stage(
    session: Session,
    document_id: uuid.UUID,
    stage: str,
    message: str,
    level: str = "info",
    payload: dict[str, Any] | None = None,
) -> None:
    session.add(
        ProcessingLog(
            document_id=document_id,
            stage=stage,
            level=level,
            message=message,
            payload=payload or {},
        )
    )
    session.flush()
    getattr(logger, level)(message, document_id=str(document_id), stage=stage, **(payload or {}))


def process_document(session: Session, document_id: uuid.UUID) -> dict[str, int | str]:
    document = session.scalar(
        select(Document).where(Document.id == document_id).with_for_update()
    )
    if document is None:
        raise ValueError(f"Document {document_id} was not found")
    upload = document.upload_job
    document.status = JobStatus.PROCESSING
    upload.status = JobStatus.PROCESSING
    session.commit()
    try:
        _log_stage(session, document.id, "download", "Downloading source document")
        storage = ObjectStorage()
        source = storage.get_bytes(upload.storage_key)
        _log_stage(session, document.id, "extract", "Extracting document layout and text")
        settings = get_settings()
        kind, extracted_pages, parsed_questions, answers = extract_document(
            upload.original_filename,
            source,
            get_ocr_adapter(settings),
            settings.ocr_languages,
        )
        session.execute(delete(Question).where(Question.document_id == document.id))
        session.execute(delete(AnswerKey).where(AnswerKey.document_id == document.id))
        session.execute(delete(MediaAsset).where(MediaAsset.document_id == document.id))
        session.execute(delete(Page).where(Page.document_id == document.id))
        session.flush()
        page_by_number: dict[int, Page] = {}
        for extracted_page in extracted_pages:
            preview_key = None
            if extracted_page.preview_png:
                preview_key = f"previews/{document.id}/page-{extracted_page.number}.png"
                storage.put_bytes(preview_key, extracted_page.preview_png, "image/png")
            page = Page(
                document_id=document.id,
                page_number=extracted_page.number,
                width=extracted_page.width,
                height=extracted_page.height,
                raw_text=extracted_page.raw_text,
                normalized_text="\n".join(block.text for block in extracted_page.blocks),
                layout_json={
                    "blocks": [
                        {"text": block.text, "box": block.box, "confidence": block.confidence}
                        for block in extracted_page.blocks
                    ]
                },
                image_storage_key=preview_key,
                is_scanned=extracted_page.is_scanned,
                is_low_quality=extracted_page.confidence < 0.55,
                column_count=extracted_page.column_count,
                confidence=extracted_page.confidence,
            )
            session.add(page)
            session.flush()
            page_by_number[extracted_page.number] = page
        for parsed in parsed_questions:
            question = Question(
                document_id=document.id,
                page_id=page_by_number.get(parsed.page_number).id if page_by_number.get(parsed.page_number) else None,
                question_number=parsed.number,
                question_type=parsed.question_type,
                raw_text=parsed.raw_text,
                normalized_text=parsed.normalized_text,
                correct_option=parsed.correct_option,
                confidence=parsed.confidence,
                bounding_box={"x0": parsed.box[0], "y0": parsed.box[1], "x1": parsed.box[2], "y1": parsed.box[3]} if parsed.box else None,
                review_status=ReviewStatus.NEEDS_REVIEW,
            )
            session.add(question)
            session.flush()
            session.add_all(
                Option(
                    question_id=question.id,
                    label=option.label,
                    position=index,
                    raw_text=option.raw_text,
                    normalized_text=option.normalized_text,
                    confidence=option.confidence,
                )
                for index, option in enumerate(parsed.options, start=1)
            )
        session.flush()
        persisted_questions = list(
            session.scalars(
                select(Question).where(Question.document_id == document.id).order_by(Question.question_number)
            )
        )
        for extracted_page in extracted_pages:
            page_questions = [
                question for question in persisted_questions if question.page_id == page_by_number[extracted_page.number].id
            ]
            for media_index, media in enumerate(extracted_page.media, start=1):
                media_y = media.box[1] if media.box else 0.0
                preceding = [
                    question
                    for question in page_questions
                    if question.bounding_box and question.bounding_box.get("y0", 0) <= media_y
                ]
                owner = preceding[-1] if preceding else (page_questions[0] if page_questions else None)
                key = f"media/{document.id}/page-{extracted_page.number}-{media_index}.{media.extension}"
                storage.put_bytes(key, media.data, media.mime_type)
                session.add(
                    MediaAsset(
                        document_id=document.id,
                        question_id=owner.id if owner else None,
                        page_number=extracted_page.number,
                        asset_type="image",
                        storage_key=key,
                        mime_type=media.mime_type,
                        bounding_box={"x0": media.box[0], "y0": media.box[1], "x1": media.box[2], "y1": media.box[3]} if media.box else None,
                        metadata_json={"association": "nearest_preceding_question" if owner else "unassigned"},
                    )
                )
        session.add_all(
            AnswerKey(
                document_id=document.id,
                question_number=number,
                answer=answer,
                confidence=0.85,
                raw_payload={"source": "document_parser"},
            )
            for number, answer in answers.items()
        )
        document.kind = kind
        document.page_count = len(extracted_pages)
        document.confidence = (
            sum(question.confidence for question in parsed_questions) / len(parsed_questions)
            if parsed_questions
            else 0.0
        )
        document.raw_payload = {"filename": upload.original_filename, "size_bytes": upload.size_bytes}
        document.normalized_payload = {
            "question_count": len(parsed_questions),
            "answer_count": len(answers),
        }
        document.dominant_language = "fa" if any("\u0600" <= char <= "\u06ff" for char in "".join(page.raw_text for page in extracted_pages)) else "en"
        document.status = JobStatus.COMPLETED
        upload.status = JobStatus.COMPLETED
        _log_stage(
            session,
            document.id,
            "complete",
            "Document processing completed",
            payload={"pages": len(extracted_pages), "questions": len(parsed_questions)},
        )
        session.commit()
        return {"document_id": str(document.id), "pages": len(extracted_pages), "questions": len(parsed_questions)}
    except Exception as error:
        session.rollback()
        document = session.get(Document, document_id)
        if document:
            document.status = JobStatus.FAILED
            document.upload_job.status = JobStatus.FAILED
            document.upload_job.error_code = type(error).__name__
            document.upload_job.error_message = str(error)[:4000]
            _log_stage(session, document.id, "failed", "Document processing failed", "error", {"error": str(error)})
            session.commit()
        raise
