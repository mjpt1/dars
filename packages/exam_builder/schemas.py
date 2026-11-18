from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from .enums import DocumentKind, ExportFormat, JobStatus, QuestionType, ReviewStatus


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UploadRead(ORMModel):
    id: uuid.UUID
    status: JobStatus
    original_filename: str
    content_type: str
    size_bytes: int
    checksum_sha256: str
    error_code: str | None
    error_message: str | None
    created_at: datetime
    document_id: uuid.UUID | None = None


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=200)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user_id: uuid.UUID
    display_name: str


class DocumentRead(ORMModel):
    id: uuid.UUID
    title: str
    kind: DocumentKind
    status: JobStatus
    page_count: int
    dominant_language: str | None
    confidence: float
    normalized_payload: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class PageRead(ORMModel):
    id: uuid.UUID
    page_number: int
    width: float
    height: float
    normalized_text: str
    layout_json: dict[str, Any]
    is_scanned: bool
    is_low_quality: bool
    column_count: int
    confidence: float
    preview_url: str | None = None


class OptionRead(ORMModel):
    id: uuid.UUID
    label: str
    position: int
    raw_text: str
    normalized_text: str
    confidence: float


class OptionUpdate(BaseModel):
    id: uuid.UUID | None = None
    label: str = Field(min_length=1, max_length=20)
    text: str = Field(min_length=1)


class QuestionRead(ORMModel):
    id: uuid.UUID
    document_id: uuid.UUID
    page_id: uuid.UUID | None
    question_number: int
    question_type: QuestionType
    raw_text: str
    normalized_text: str
    correct_option: str | None
    explanation: str | None
    tags: list[str]
    bounding_box: dict[str, float] | None
    confidence: float
    review_status: ReviewStatus
    version: int
    options: list[OptionRead]
    created_at: datetime
    updated_at: datetime


class QuestionUpdate(BaseModel):
    normalized_text: str | None = Field(default=None, min_length=1)
    question_type: QuestionType | None = None
    correct_option: str | None = Field(default=None, max_length=20)
    explanation: str | None = None
    tags: list[str] | None = None
    options: list[OptionUpdate] | None = None
    expected_version: int = Field(ge=1)


class ReviewRequest(BaseModel):
    comment: str | None = Field(default=None, max_length=2000)


class ExportCreate(BaseModel):
    format: ExportFormat
    document_id: uuid.UUID | None = None
    review_status: ReviewStatus | None = None
    min_confidence: float | None = Field(default=None, ge=0, le=1)


class ExportRead(ORMModel):
    id: uuid.UUID
    status: JobStatus
    format: ExportFormat
    filters: dict[str, Any]
    record_count: int
    error_message: str | None
    download_url: str | None = None
    created_at: datetime


class ProcessingLogRead(ORMModel):
    id: uuid.UUID
    stage: str
    level: str
    message: str
    payload: dict[str, Any]
    created_at: datetime


class PaginatedResponse(BaseModel):
    items: list[Any]
    total: int
    page: int
    page_size: int
