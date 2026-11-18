from __future__ import annotations

import io
import os

import pytest
from docx import Document as DocxDocument
from fastapi.testclient import TestClient
from sqlalchemy import delete

from apps.api.main import app
from packages.exam_builder.database import SessionLocal
from packages.exam_builder.models import UploadJob

pytestmark = pytest.mark.integration


class MemoryStorage:
    objects: dict[str, bytes] = {}

    def put_bytes(self, key: str, data: bytes, content_type: str) -> None:
        self.objects[key] = data

    def presigned_url(self, key: str, expires_seconds: int = 3600) -> str:
        return f"http://storage.test/{key}"


@pytest.fixture(autouse=True)
def require_integration() -> None:
    if os.getenv("RUN_INTEGRATION") != "1":
        pytest.skip("Set RUN_INTEGRATION=1 and provide PostgreSQL to run integration tests")


def test_upload_get_and_queue_document(monkeypatch: pytest.MonkeyPatch) -> None:
    source = DocxDocument()
    source.add_paragraph("1- API integration question")
    payload = io.BytesIO()
    source.save(payload)
    dispatched: list[str] = []
    monkeypatch.setattr("apps.api.main.ObjectStorage", MemoryStorage)
    monkeypatch.setattr("apps.api.main.process_document_task.delay", dispatched.append)
    with TestClient(app) as client:
        response = client.post(
            "/uploads",
            files={"files": ("exam.docx", payload.getvalue(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        )
        assert response.status_code == 202
        created = response.json()[0]
        upload_id = created["id"]
        document_id = created["document_id"]
        assert client.get(f"/uploads/{upload_id}").json()["checksum_sha256"]
        queued = client.post(f"/documents/{document_id}/process")
        assert queued.status_code == 202
        assert dispatched == [document_id]
    with SessionLocal() as session:
        session.execute(delete(UploadJob).where(UploadJob.id == upload_id))
        session.commit()