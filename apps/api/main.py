from __future__ import annotations

import hashlib
import io
import jwt
import uuid
import zipfile
from datetime import UTC, datetime, timedelta
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, Any

from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, UploadFile, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from sqlalchemy import asc, desc, func, or_, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload
from structlog import get_logger
from passlib.context import CryptContext

from packages.exam_builder.database import engine, get_db
from packages.exam_builder.enums import JobStatus, ReviewStatus
from packages.exam_builder.logging_config import configure_logging
from packages.exam_builder.models import (
    Document,
    ExportJob,
    Option,
    Page,
    ProcessingLog,
    Question,
    ReviewAction,
    UploadJob,
    User,
)
from packages.exam_builder.normalization import normalize_text
from packages.exam_builder.schemas import (
    DocumentRead,
    ExportCreate,
    ExportRead,
    LoginRequest,
    LoginResponse,
    PageRead,
    PaginatedResponse,
    ProcessingLogRead,
    QuestionRead,
    QuestionUpdate,
    ReviewRequest,
    UploadRead,
)
from packages.exam_builder.settings import get_settings

configure_logging()
logger = get_logger(__name__)
settings = get_settings()
REQUEST_COUNT = Counter("exam_builder_http_requests_total", "HTTP request count", ["method", "path", "status"])
REQUEST_DURATION = Histogram("exam_builder_http_request_seconds", "HTTP request duration", ["method", "path"])
PWD_CONTEXT = CryptContext(schemes=["bcrypt"], deprecated="auto")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("api_started", environment=settings.environment)
    yield
    engine.dispose()


app = FastAPI(
    title="Exam Dataset Builder API",
    version="0.1.0",
    description="Extract, review, and export structured exam questions from PDF and DOCX files.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    path = request.url.path
    with REQUEST_DURATION.labels(request.method, path).time():
        response = await call_next(request)
    REQUEST_COUNT.labels(request.method, path, response.status_code).inc()
    response.headers["X-Request-ID"] = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    return response


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, error: RequestValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"error": "validation_error", "details": error.errors()})


@app.exception_handler(SQLAlchemyError)
async def database_handler(request: Request, error: SQLAlchemyError) -> JSONResponse:
    logger.exception("database_error", path=request.url.path)
    return JSONResponse(status_code=503, content={"error": "database_unavailable", "message": "Database operation failed"})


def _validate_document(filename: str, content_type: str, data: bytes) -> str:
    suffix = Path(filename).suffix.lower()
    allowed = {".pdf": "application/pdf", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
    if suffix not in allowed:
        raise HTTPException(415, "Only PDF and DOCX files are supported")
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"File exceeds {settings.max_upload_mb} MB")
    if suffix == ".pdf" and not data.startswith(b"%PDF-"):
        raise HTTPException(400, "The uploaded PDF signature is invalid")
    if suffix == ".docx":
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                if "word/document.xml" not in archive.namelist():
                    raise HTTPException(400, "The uploaded DOCX structure is invalid")
        except zipfile.BadZipFile as error:
            raise HTTPException(400, "The uploaded DOCX archive is corrupt") from error
    return allowed[suffix]


def _question_snapshot(question: Question) -> dict[str, Any]:
    return {
        "text": question.normalized_text,
        "type": question.question_type.value,
        "correct_option": question.correct_option,
        "explanation": question.explanation,
        "tags": question.tags,
        "status": question.review_status.value,
        "version": question.version,
        "options": [{"label": item.label, "text": item.normalized_text} for item in question.options],
    }


def _sign_token(user: User) -> LoginResponse:
    ttl = settings.auth_token_ttl_minutes * 60
    now = datetime.now(UTC)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "name": user.display_name,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=ttl)).timestamp()),
    }
    token = jwt.encode(payload, settings.auth_secret_key, algorithm=settings.auth_algorithm)
    return LoginResponse(
        access_token=token,
        expires_in=ttl,
        user_id=user.id,
        display_name=user.display_name,
    )


@app.post("/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, session: Annotated[Session, Depends(get_db)]) -> LoginResponse:
    user = session.scalar(select(User).where(User.email == payload.email, User.is_active.is_(True)))
    if not user or not user.password_hash or not PWD_CONTEXT.verify(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    return _sign_token(user)


@app.get("/health")
def health(session: Annotated[Session, Depends(get_db)]) -> dict[str, str]:
    session.execute(text("SELECT 1"))
    return {"status": "healthy", "database": "connected"}


@app.get("/metrics", include_in_schema=False)
def metrics() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.post("/uploads", response_model=list[UploadRead], status_code=status.HTTP_202_ACCEPTED)
async def create_uploads(
    files: Annotated[list[UploadFile], File(description="One or more PDF or DOCX files")],
    session: Annotated[Session, Depends(get_db)],
) -> list[UploadRead]:
    from packages.exam_builder.storage import ObjectStorage

    if not files:
        raise HTTPException(400, "At least one file is required")
    storage = ObjectStorage()
    created: list[UploadRead] = []
    try:
        for upload_file in files:
            data = await upload_file.read(settings.max_upload_mb * 1024 * 1024 + 1)
            filename = Path(upload_file.filename or "document").name
            canonical_type = _validate_document(filename, upload_file.content_type or "", data)
            checksum = hashlib.sha256(data).hexdigest()
            job_id = uuid.uuid4()
            storage_key = f"uploads/{job_id}/{filename}"
            storage.put_bytes(storage_key, data, canonical_type)
            job = UploadJob(
                id=job_id,
                status=JobStatus.PENDING,
                original_filename=filename,
                content_type=canonical_type,
                size_bytes=len(data),
                storage_key=storage_key,
                checksum_sha256=checksum,
                metadata_json={"client_content_type": upload_file.content_type},
            )
            document = Document(upload_job=job, title=Path(filename).stem, status=JobStatus.PENDING)
            session.add(document)
            session.flush()
            result = UploadRead.model_validate(job)
            result.document_id = document.id
            created.append(result)
        session.commit()
        return created
    except Exception:
        session.rollback()
        raise


@app.get("/uploads/{upload_id}", response_model=UploadRead)
def get_upload(upload_id: uuid.UUID, session: Annotated[Session, Depends(get_db)]) -> UploadRead:
    job = session.scalar(select(UploadJob).options(selectinload(UploadJob.document)).where(UploadJob.id == upload_id))
    if not job:
        raise HTTPException(404, "Upload was not found")
    result = UploadRead.model_validate(job)
    result.document_id = job.document.id if job.document else None
    return result


@app.get("/documents", response_model=PaginatedResponse)
def list_documents(
    session: Annotated[Session, Depends(get_db)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
    query: str | None = None,
    job_status: JobStatus | None = None,
    sort: str = "created_at",
    direction: str = "desc",
) -> PaginatedResponse:
    statement = select(Document).where(Document.deleted_at.is_(None))
    count_statement = select(func.count()).select_from(Document).where(Document.deleted_at.is_(None))
    if query:
        condition = Document.title.ilike(f"%{query}%")
        statement, count_statement = statement.where(condition), count_statement.where(condition)
    if job_status:
        statement, count_statement = statement.where(Document.status == job_status), count_statement.where(Document.status == job_status)
    sort_column = {"title": Document.title, "confidence": Document.confidence, "created_at": Document.created_at}.get(sort, Document.created_at)
    order = asc(sort_column) if direction == "asc" else desc(sort_column)
    items = session.scalars(statement.order_by(order).offset((page - 1) * page_size).limit(page_size)).all()
    return PaginatedResponse(items=[DocumentRead.model_validate(item) for item in items], total=session.scalar(count_statement) or 0, page=page, page_size=page_size)


@app.get("/documents/{document_id}", response_model=DocumentRead)
def get_document(document_id: uuid.UUID, session: Annotated[Session, Depends(get_db)]) -> Document:
    document = session.get(Document, document_id)
    if not document or document.deleted_at:
        raise HTTPException(404, "Document was not found")
    return document


@app.post("/documents/{document_id}/process", response_model=DocumentRead, status_code=202)
def queue_document(document_id: uuid.UUID, session: Annotated[Session, Depends(get_db)]) -> Document:
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(404, "Document was not found")
    if document.status == JobStatus.PROCESSING:
        raise HTTPException(409, "Document is already processing")
    document.status = JobStatus.QUEUED
    document.upload_job.status = JobStatus.QUEUED
    session.commit()
    from packages.exam_builder.tasks import process_document_task

    process_document_task.delay(str(document.id))
    return document


@app.get("/documents/{document_id}/pages", response_model=list[PageRead])
def document_pages(document_id: uuid.UUID, session: Annotated[Session, Depends(get_db)]) -> list[PageRead]:
    from packages.exam_builder.storage import ObjectStorage

    pages = session.scalars(select(Page).where(Page.document_id == document_id).order_by(Page.page_number)).all()
    storage = ObjectStorage()
    result: list[PageRead] = []
    for page in pages:
        item = PageRead.model_validate(page)
        item.preview_url = storage.presigned_url(page.image_storage_key) if page.image_storage_key else None
        result.append(item)
    return result


@app.get("/documents/{document_id}/logs", response_model=list[ProcessingLogRead])
def document_logs(document_id: uuid.UUID, session: Annotated[Session, Depends(get_db)]) -> list[ProcessingLog]:
    return list(session.scalars(select(ProcessingLog).where(ProcessingLog.document_id == document_id).order_by(ProcessingLog.created_at)))


@app.get("/questions", response_model=PaginatedResponse)
def list_questions(
    session: Annotated[Session, Depends(get_db)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
    document_id: uuid.UUID | None = None,
    review_status: ReviewStatus | None = None,
    min_confidence: Annotated[float | None, Query(ge=0, le=1)] = None,
    query: str | None = None,
    sort: str = "question_number",
    direction: str = "asc",
) -> PaginatedResponse:
    conditions = [Question.deleted_at.is_(None)]
    if document_id:
        conditions.append(Question.document_id == document_id)
    if review_status:
        conditions.append(Question.review_status == review_status)
    if min_confidence is not None:
        conditions.append(Question.confidence >= min_confidence)
    if query:
        conditions.append(or_(Question.normalized_text.ilike(f"%{query}%"), Question.raw_text.ilike(f"%{query}%")))
    statement = select(Question).options(selectinload(Question.options)).where(*conditions)
    count_statement = select(func.count()).select_from(Question).where(*conditions)
    sort_column = {"confidence": Question.confidence, "updated_at": Question.updated_at, "question_number": Question.question_number}.get(sort, Question.question_number)
    order = desc(sort_column) if direction == "desc" else asc(sort_column)
    questions = session.scalars(statement.order_by(order).offset((page - 1) * page_size).limit(page_size)).unique().all()
    return PaginatedResponse(items=[QuestionRead.model_validate(item) for item in questions], total=session.scalar(count_statement) or 0, page=page, page_size=page_size)


@app.get("/questions/{question_id}", response_model=QuestionRead)
def get_question(question_id: uuid.UUID, session: Annotated[Session, Depends(get_db)]) -> Question:
    question = session.scalar(select(Question).options(selectinload(Question.options)).where(Question.id == question_id))
    if not question or question.deleted_at:
        raise HTTPException(404, "Question was not found")
    return question


@app.patch("/questions/{question_id}", response_model=QuestionRead)
def update_question(question_id: uuid.UUID, payload: QuestionUpdate, session: Annotated[Session, Depends(get_db)]) -> Question:
    question = session.scalar(select(Question).options(selectinload(Question.options)).where(Question.id == question_id).with_for_update())
    if not question:
        raise HTTPException(404, "Question was not found")
    if question.version != payload.expected_version:
        raise HTTPException(409, {"message": "Question was changed by another reviewer", "current_version": question.version})
    before = _question_snapshot(question)
    updates = payload.model_dump(exclude_unset=True, exclude={"options", "expected_version"})
    for key, value in updates.items():
        setattr(question, key, value)
    if payload.normalized_text is not None:
        question.normalized_text = normalize_text(payload.normalized_text)
    if payload.options is not None:
        question.options.clear()
        session.flush()
        question.options.extend(
            Option(label=item.label, position=index, raw_text=item.text, normalized_text=normalize_text(item.text), confidence=1.0)
            for index, item in enumerate(payload.options, start=1)
        )
    question.version += 1
    question.review_status = ReviewStatus.NEEDS_REVIEW
    session.flush()
    session.add(ReviewAction(question_id=question.id, action="edit", before_payload=before, after_payload=_question_snapshot(question)))
    session.commit()
    return get_question(question.id, session)


def _set_review_status(question_id: uuid.UUID, target: ReviewStatus, payload: ReviewRequest, session: Session) -> Question:
    question = session.scalar(select(Question).options(selectinload(Question.options)).where(Question.id == question_id).with_for_update())
    if not question:
        raise HTTPException(404, "Question was not found")
    before = _question_snapshot(question)
    question.review_status = target
    question.version += 1
    session.flush()
    session.add(ReviewAction(question_id=question.id, action=target.value, before_payload=before, after_payload=_question_snapshot(question), comment=payload.comment))
    session.commit()
    return question


@app.post("/questions/{question_id}/approve", response_model=QuestionRead)
def approve_question(question_id: uuid.UUID, payload: ReviewRequest, session: Annotated[Session, Depends(get_db)]) -> Question:
    return _set_review_status(question_id, ReviewStatus.APPROVED, payload, session)


@app.post("/questions/{question_id}/reject", response_model=QuestionRead)
def reject_question(question_id: uuid.UUID, payload: ReviewRequest, session: Annotated[Session, Depends(get_db)]) -> Question:
    return _set_review_status(question_id, ReviewStatus.REJECTED, payload, session)


@app.post("/exports", response_model=ExportRead, status_code=202)
def create_export(payload: ExportCreate, session: Annotated[Session, Depends(get_db)]) -> ExportJob:
    filters = payload.model_dump(exclude_none=True, exclude={"format"}, mode="json")
    export = ExportJob(format=payload.format, filters=filters, status=JobStatus.QUEUED)
    session.add(export)
    session.commit()
    from packages.exam_builder.tasks import create_export_task

    create_export_task.delay(str(export.id))
    return export


@app.get("/exports/{export_id}", response_model=ExportRead)
def get_export(export_id: uuid.UUID, session: Annotated[Session, Depends(get_db)]) -> ExportRead:
    from packages.exam_builder.storage import ObjectStorage

    export = session.get(ExportJob, export_id)
    if not export:
        raise HTTPException(404, "Export was not found")
    result = ExportRead.model_validate(export)
    result.download_url = ObjectStorage().presigned_url(export.storage_key) if export.storage_key else None
    return result