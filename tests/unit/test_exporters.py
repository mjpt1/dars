import csv
import io
import json
import zipfile

from packages.exam_builder.enums import ExportFormat
from packages.exam_builder.exporters import render_export


RECORDS = [{
    "id": "1", "document_id": "2", "question_number": 1, "type": "multiple_choice",
    "raw_text": "سؤال", "normalized_text": "سوال", "options": [{"label": "الف", "normalized_text": "پاسخ"}], "media": [],
    "correct_option": "الف", "explanation": None, "tags": ["ریاضی"], "confidence": 0.9, "review_status": "approved",
}]


def test_json_export_preserves_persian() -> None:
    payload, media_type = render_export(RECORDS, ExportFormat.JSON)
    assert media_type == "application/json"
    assert json.loads(payload)[0]["raw_text"] == "سؤال"


def test_csv_export_has_bom_and_options_json() -> None:
    payload, _ = render_export(RECORDS, ExportFormat.CSV)
    rows = list(csv.DictReader(io.StringIO(payload.decode("utf-8-sig"))))
    assert rows[0]["tags"] == "ریاضی"
    assert "پاسخ" in rows[0]["options_json"]


def test_zip_export_contains_training_artifacts() -> None:
    payload, media_type = render_export(RECORDS, ExportFormat.ZIP)
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        assert set(archive.namelist()) == {"questions.json", "questions.csv", "manifest.json"}
    assert media_type == "application/zip"
