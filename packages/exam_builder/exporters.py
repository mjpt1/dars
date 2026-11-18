from __future__ import annotations

import io
import json
import uuid
import zipfile
from typing import Any

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .enums import ExportFormat, ReviewStatus
from .models import Document, Question


def question_to_record(question: Question) -> dict[str, Any]:
    return {
        "id": str(question.id),
        "document_id": str(question.document_id),
        "question_number": question.question_number,
        "type": question.question_type.value,
        "raw_text": question.raw_text,
        "normalized_text": question.normalized_text,
        "options": [
            {
                "label": option.label,
                "raw_text": option.raw_text,
                "normalized_text": option.normalized_text,
                "confidence": option.confidence,
            }
            for option in question.options
        ],
        "media": [
            {
                "id": str(asset.id),
                "type": asset.asset_type,
                "mime_type": asset.mime_type,
                "storage_key": asset.storage_key,
                "bounding_box": asset.bounding_box,
            }
            for asset in question.media_assets
        ],
        "correct_option": question.correct_option,
        "explanation": question.explanation,
        "tags": question.tags,
        "confidence": question.confidence,
        "review_status": question.review_status.value,
    }


def load_export_records(session: Session, filters: dict[str, Any]) -> list[dict[str, Any]]:
    query = select(Question).options(selectinload(Question.options), selectinload(Question.media_assets)).where(Question.deleted_at.is_(None))
    if document_id := filters.get("document_id"):
        query = query.where(Question.document_id == uuid.UUID(str(document_id)))
    if status := filters.get("review_status"):
        query = query.where(Question.review_status == ReviewStatus(status))
    if minimum := filters.get("min_confidence"):
        query = query.where(Question.confidence >= float(minimum))
    return [question_to_record(question) for question in session.scalars(query).unique().all()]


def render_export(
    records: list[dict[str, Any]],
    export_format: ExportFormat,
    media_files: list[tuple[str, bytes]] | None = None,
) -> tuple[bytes, str]:
    if export_format == ExportFormat.JSON:
        return json.dumps(records, ensure_ascii=False, indent=2).encode("utf-8"), "application/json"
    flattened = [
        {
            **{key: value for key, value in record.items() if key not in {"options", "tags", "media"}},
            "tags": "|".join(record["tags"]),
            "options_json": json.dumps(record["options"], ensure_ascii=False),
            "media_json": json.dumps(record.get("media", []), ensure_ascii=False),
        }
        for record in records
    ]
    csv_bytes = pd.DataFrame(flattened).to_csv(index=False).encode("utf-8-sig")
    if export_format == ExportFormat.CSV:
        return csv_bytes, "text/csv; charset=utf-8"
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("questions.json", json.dumps(records, ensure_ascii=False, indent=2))
        archive.writestr("questions.csv", csv_bytes)
        for name, data in media_files or []:
            archive.writestr(f"media/{name}", data)
        archive.writestr(
            "manifest.json",
            json.dumps({"version": 1, "records": len(records), "media_files": len(media_files or [])}),
        )
    return output.getvalue(), "application/zip"
