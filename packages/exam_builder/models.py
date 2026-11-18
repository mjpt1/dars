from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base
from .enums import DocumentKind, ExportFormat, JobStatus, QuestionType, ReviewStatus


def utcnow() -> datetime:
    return datetime.now(UTC)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class UUIDMixin:
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


class User(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "users"
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(200))
    password_hash: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    upload_jobs: Mapped[list[UploadJob]] = relationship(back_populates="user")


class UploadJob(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "upload_jobs"
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.PENDING, index=True)
    original_filename: Mapped[str] = mapped_column(String(500))
    content_type: Mapped[str] = mapped_column(String(120))
    size_bytes: Mapped[int] = mapped_column(Integer)
    storage_key: Mapped[str] = mapped_column(String(800), unique=True)
    checksum_sha256: Mapped[str] = mapped_column(String(64), index=True)
    error_code: Mapped[str | None] = mapped_column(String(100))
    error_message: Mapped[str | None] = mapped_column(Text)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    user: Mapped[User | None] = relationship(back_populates="upload_jobs")
    document: Mapped[Document | None] = relationship(back_populates="upload_job", uselist=False)


class Document(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "documents"
    upload_job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("upload_jobs.id", ondelete="CASCADE"), unique=True)
    title: Mapped[str] = mapped_column(String(500), index=True)
    kind: Mapped[DocumentKind] = mapped_column(Enum(DocumentKind), default=DocumentKind.UNKNOWN, index=True)
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.PENDING, index=True)
    page_count: Mapped[int] = mapped_column(Integer, default=0)
    dominant_language: Mapped[str | None] = mapped_column(String(20))
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    raw_payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    normalized_payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    upload_job: Mapped[UploadJob] = relationship(back_populates="document")
    pages: Mapped[list[Page]] = relationship(back_populates="document", cascade="all, delete-orphan")
    questions: Mapped[list[Question]] = relationship(back_populates="document", cascade="all, delete-orphan")
    answer_keys: Mapped[list[AnswerKey]] = relationship(back_populates="document", cascade="all, delete-orphan")


class Page(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "pages"
    __table_args__ = (Index("ix_pages_document_number", "document_id", "page_number", unique=True),)
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"))
    page_number: Mapped[int] = mapped_column(Integer)
    width: Mapped[float] = mapped_column(Float)
    height: Mapped[float] = mapped_column(Float)
    raw_text: Mapped[str] = mapped_column(Text, default="")
    normalized_text: Mapped[str] = mapped_column(Text, default="")
    layout_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    image_storage_key: Mapped[str | None] = mapped_column(String(800))
    is_scanned: Mapped[bool] = mapped_column(Boolean, default=False)
    is_low_quality: Mapped[bool] = mapped_column(Boolean, default=False)
    column_count: Mapped[int] = mapped_column(Integer, default=1)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    document: Mapped[Document] = relationship(back_populates="pages")


class Question(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "questions"
    __table_args__ = (
        Index("ix_questions_document_number", "document_id", "question_number"),
        Index("ix_questions_review_confidence", "review_status", "confidence"),
    )
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"))
    page_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("pages.id", ondelete="SET NULL"), index=True)
    question_number: Mapped[int] = mapped_column(Integer)
    question_type: Mapped[QuestionType] = mapped_column(Enum(QuestionType))
    raw_text: Mapped[str] = mapped_column(Text)
    normalized_text: Mapped[str] = mapped_column(Text)
    correct_option: Mapped[str | None] = mapped_column(String(20))
    explanation: Mapped[str | None] = mapped_column(Text)
    tags: Mapped[list[str]] = mapped_column(JSONB, default=list)
    bounding_box: Mapped[dict[str, float] | None] = mapped_column(JSONB)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    review_status: Mapped[ReviewStatus] = mapped_column(Enum(ReviewStatus), default=ReviewStatus.NEEDS_REVIEW, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    document: Mapped[Document] = relationship(back_populates="questions")
    options: Mapped[list[Option]] = relationship(back_populates="question", cascade="all, delete-orphan", order_by="Option.position")
    media_assets: Mapped[list[MediaAsset]] = relationship(back_populates="question")
    review_actions: Mapped[list[ReviewAction]] = relationship(back_populates="question", cascade="all, delete-orphan")


class Option(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "options"
    __table_args__ = (Index("ix_options_question_label", "question_id", "label", unique=True),)
    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"))
    label: Mapped[str] = mapped_column(String(20))
    position: Mapped[int] = mapped_column(Integer)
    raw_text: Mapped[str] = mapped_column(Text)
    normalized_text: Mapped[str] = mapped_column(Text)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    question: Mapped[Question] = relationship(back_populates="options")


class AnswerKey(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "answer_keys"
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    question_number: Mapped[int] = mapped_column(Integer)
    answer: Mapped[str] = mapped_column(String(50))
    source_page: Mapped[int | None] = mapped_column(Integer)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    raw_payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    document: Mapped[Document] = relationship(back_populates="answer_keys")


class MediaAsset(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "media_assets"
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    question_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("questions.id", ondelete="SET NULL"), index=True)
    page_number: Mapped[int] = mapped_column(Integer)
    asset_type: Mapped[str] = mapped_column(String(30))
    storage_key: Mapped[str] = mapped_column(String(800), unique=True)
    mime_type: Mapped[str] = mapped_column(String(120))
    bounding_box: Mapped[dict[str, float] | None] = mapped_column(JSONB)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    question: Mapped[Question | None] = relationship(back_populates="media_assets")


class ReviewAction(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "review_actions"
    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    action: Mapped[str] = mapped_column(String(40), index=True)
    before_payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    after_payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    comment: Mapped[str | None] = mapped_column(Text)
    question: Mapped[Question] = relationship(back_populates="review_actions")


class ExportJob(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "export_jobs"
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.PENDING, index=True)
    format: Mapped[ExportFormat] = mapped_column(Enum(ExportFormat))
    filters: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    storage_key: Mapped[str | None] = mapped_column(String(800))
    record_count: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text)


class ProcessingLog(UUIDMixin, Base):
    __tablename__ = "processing_logs"
    document_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    stage: Mapped[str] = mapped_column(String(80), index=True)
    level: Mapped[str] = mapped_column(String(20), index=True)
    message: Mapped[str] = mapped_column(Text)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)