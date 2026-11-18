from __future__ import annotations

import io
import os
import uuid

import pytest
from docx import Document as DocxDocument
from sqlalchemy import delete, select

from packages.exam_builder.database import SessionLocal
from packages.exam_builder.enums import ExportFormat, JobStatus
from packages.exam_builder.exporters import load_export_records, render_export
from packages.exam_builder.models import Document, Option, Question, UploadJob
from packages.exam_builder.pipeline import process_document

pytestmark = pytest.mark.integration


class MemoryStorage:
    objects: dict[str, bytes] = {}

    def get_bytes(self, key: str) -> bytes:
        return self.objects[key]

    def put_bytes(self, key: str, data: bytes, content_type: str) -> None:
        self.objects[key] = data


@pytest.fixture(autouse=True)
def require_integration() -> None:
    if os.getenv("RUN_INTEGRATION") != "1":
        pytest.skip("Set RUN_INTEGRATION=1 and provide PostgreSQL to run integration tests")


def test_upload_process_export_persists_real_questions(monkeypatch: pytest.MonkeyPatch) -> None:
    source = DocxDocument()
    source.add_paragraph("1- دو به علاوه دو چند است؟")
    source.add_paragraph("الف) سه")
    source.add_paragraph("ب) چهار")
    source.add_paragraph("ج) پنج")
    source.add_paragraph("د) شش")
    source.add_paragraph("پاسخ نامه")
    source.add_paragraph("1- ب")
    payload = io.BytesIO()
    source.save(payload)
    key = f"tests/{uuid.uuid4()}/exam.docx"
    MemoryStorage.objects[key] = payload.getvalue()
    monkeypatch.setattr("packages.exam_builder.pipeline.ObjectStorage", MemoryStorage)
    with SessionLocal() as session:
        upload = UploadJob(status=JobStatus.PENDING, original_filename="exam.docx", content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document", size_bytes=len(payload.getvalue()), storage_key=key, checksum_sha256="0" * 64)
        document = Document(upload_job=upload, title="integration exam")
        session.add(document)
        session.commit()
        document_id = document.id
        result = process_document(session, document_id)
        assert result["questions"] == 1
        persisted = session.scalar(select(Question).where(Question.document_id == document_id))
        assert persisted is not None
        assert persisted.correct_option == "ب"
        assert len(session.scalars(select(Option).where(Option.question_id == persisted.id)).all()) == 4
        records = load_export_records(session, {"document_id": str(document_id)})
        zipped, media_type = render_export(records, ExportFormat.ZIP)
        assert len(zipped) > 100
        assert media_type == "application/zip"
        session.execute(delete(Document).where(Document.id == document_id))
        session.commit()