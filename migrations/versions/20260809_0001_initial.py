"""Initial production schema.

Revision ID: 20260809_0001
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260809_0001"
down_revision = None
branch_labels = None
depends_on = None

job_status = postgresql.ENUM("PENDING", "QUEUED", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED", name="jobstatus", create_type=False)
document_kind = postgresql.ENUM("PDF_TEXT", "PDF_SCANNED", "PDF_MIXED", "DOCX", "UNKNOWN", name="documentkind", create_type=False)
review_status = postgresql.ENUM("NEEDS_REVIEW", "APPROVED", "REJECTED", name="reviewstatus", create_type=False)
question_type = postgresql.ENUM("MULTIPLE_CHOICE", "DESCRIPTIVE", name="questiontype", create_type=False)
export_format = postgresql.ENUM("JSON", "CSV", "ZIP", name="exportformat", create_type=False)


def timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    ]


def upgrade() -> None:
    bind = op.get_bind()
    for enum in (job_status, document_kind, review_status, question_type, export_format):
        enum.create(bind, checkfirst=True)
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("display_name", sa.String(200), nullable=False),
        sa.Column("password_hash", sa.String(255)),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        *timestamps(),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_table(
        "upload_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("status", job_status, nullable=False),
        sa.Column("original_filename", sa.String(500), nullable=False),
        sa.Column("content_type", sa.String(120), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("storage_key", sa.String(800), nullable=False, unique=True),
        sa.Column("checksum_sha256", sa.String(64), nullable=False),
        sa.Column("error_code", sa.String(100)),
        sa.Column("error_message", sa.Text()),
        sa.Column("metadata_json", postgresql.JSONB(), nullable=False),
        *timestamps(),
    )
    op.create_index("ix_upload_jobs_status", "upload_jobs", ["status"])
    op.create_index("ix_upload_jobs_checksum_sha256", "upload_jobs", ["checksum_sha256"])
    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("upload_job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("upload_jobs.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("kind", document_kind, nullable=False),
        sa.Column("status", job_status, nullable=False),
        sa.Column("page_count", sa.Integer(), nullable=False),
        sa.Column("dominant_language", sa.String(20)),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("raw_payload", postgresql.JSONB(), nullable=False),
        sa.Column("normalized_payload", postgresql.JSONB(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        *timestamps(),
    )
    op.create_index("ix_documents_title", "documents", ["title"])
    op.create_index("ix_documents_status", "documents", ["status"])
    op.create_index("ix_documents_kind", "documents", ["kind"])
    op.create_table(
        "pages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=False),
        sa.Column("width", sa.Float(), nullable=False),
        sa.Column("height", sa.Float(), nullable=False),
        sa.Column("raw_text", sa.Text(), nullable=False),
        sa.Column("normalized_text", sa.Text(), nullable=False),
        sa.Column("layout_json", postgresql.JSONB(), nullable=False),
        sa.Column("image_storage_key", sa.String(800)),
        sa.Column("is_scanned", sa.Boolean(), nullable=False),
        sa.Column("is_low_quality", sa.Boolean(), nullable=False),
        sa.Column("column_count", sa.Integer(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        *timestamps(),
    )
    op.create_index("ix_pages_document_number", "pages", ["document_id", "page_number"], unique=True)
    op.create_table(
        "questions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("page_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("pages.id", ondelete="SET NULL")),
        sa.Column("question_number", sa.Integer(), nullable=False),
        sa.Column("question_type", question_type, nullable=False),
        sa.Column("raw_text", sa.Text(), nullable=False),
        sa.Column("normalized_text", sa.Text(), nullable=False),
        sa.Column("correct_option", sa.String(20)),
        sa.Column("explanation", sa.Text()),
        sa.Column("tags", postgresql.JSONB(), nullable=False),
        sa.Column("bounding_box", postgresql.JSONB()),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("review_status", review_status, nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        *timestamps(),
    )
    op.create_index("ix_questions_document_number", "questions", ["document_id", "question_number"])
    op.create_index("ix_questions_review_confidence", "questions", ["review_status", "confidence"])
    op.create_table(
        "options",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("question_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("questions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("label", sa.String(20), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("raw_text", sa.Text(), nullable=False),
        sa.Column("normalized_text", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        *timestamps(),
    )
    op.create_index("ix_options_question_label", "options", ["question_id", "label"], unique=True)
    op.create_table(
        "answer_keys",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_number", sa.Integer(), nullable=False),
        sa.Column("answer", sa.String(50), nullable=False),
        sa.Column("source_page", sa.Integer()),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("raw_payload", postgresql.JSONB(), nullable=False),
        *timestamps(),
    )
    op.create_index("ix_answer_keys_document_id", "answer_keys", ["document_id"])
    op.create_table(
        "media_assets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("questions.id", ondelete="SET NULL")),
        sa.Column("page_number", sa.Integer(), nullable=False),
        sa.Column("asset_type", sa.String(30), nullable=False),
        sa.Column("storage_key", sa.String(800), nullable=False, unique=True),
        sa.Column("mime_type", sa.String(120), nullable=False),
        sa.Column("bounding_box", postgresql.JSONB()),
        sa.Column("metadata_json", postgresql.JSONB(), nullable=False),
        *timestamps(),
    )
    op.create_table(
        "review_actions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("question_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("questions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("action", sa.String(40), nullable=False),
        sa.Column("before_payload", postgresql.JSONB(), nullable=False),
        sa.Column("after_payload", postgresql.JSONB(), nullable=False),
        sa.Column("comment", sa.Text()),
        *timestamps(),
    )
    op.create_table(
        "export_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("status", job_status, nullable=False),
        sa.Column("format", export_format, nullable=False),
        sa.Column("filters", postgresql.JSONB(), nullable=False),
        sa.Column("storage_key", sa.String(800)),
        sa.Column("record_count", sa.Integer(), nullable=False),
        sa.Column("error_message", sa.Text()),
        *timestamps(),
    )
    op.create_index("ix_export_jobs_status", "export_jobs", ["status"])
    op.create_table(
        "processing_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE")),
        sa.Column("stage", sa.String(80), nullable=False),
        sa.Column("level", sa.String(20), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_processing_logs_document_id", "processing_logs", ["document_id"])
    op.create_index("ix_processing_logs_created_at", "processing_logs", ["created_at"])


def downgrade() -> None:
    for table in ("processing_logs", "export_jobs", "review_actions", "media_assets", "answer_keys", "options", "questions", "pages", "documents", "upload_jobs", "users"):
        op.drop_table(table)
    bind = op.get_bind()
    for enum in (export_format, question_type, review_status, document_kind, job_status):
        enum.drop(bind, checkfirst=True)