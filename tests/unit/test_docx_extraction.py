import io

from docx import Document

from packages.exam_builder.enums import DocumentKind
from packages.exam_builder.extraction import extract_docx, parse_questions


def test_extracts_real_docx_paragraphs() -> None:
    source = Document()
    source.add_paragraph("۱- پایتخت ایران کدام است؟")
    source.add_paragraph("الف) تهران")
    source.add_paragraph("ب) شیراز")
    buffer = io.BytesIO()
    source.save(buffer)
    kind, pages = extract_docx(buffer.getvalue())
    questions, _ = parse_questions(pages)
    assert kind == DocumentKind.DOCX
    assert questions[0].number == 1
    assert len(questions[0].options) == 2
