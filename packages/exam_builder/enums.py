from __future__ import annotations

from enum import StrEnum


class JobStatus(StrEnum):
    PENDING = "pending"
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class DocumentKind(StrEnum):
    PDF_TEXT = "pdf_text"
    PDF_SCANNED = "pdf_scanned"
    PDF_MIXED = "pdf_mixed"
    DOCX = "docx"
    UNKNOWN = "unknown"


class ReviewStatus(StrEnum):
    NEEDS_REVIEW = "needs_review"
    APPROVED = "approved"
    REJECTED = "rejected"


class QuestionType(StrEnum):
    MULTIPLE_CHOICE = "multiple_choice"
    DESCRIPTIVE = "descriptive"


class ExportFormat(StrEnum):
    JSON = "json"
    CSV = "csv"
    ZIP = "zip"
