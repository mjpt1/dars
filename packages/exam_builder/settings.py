from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"
    log_level: str = "INFO"
    database_url: str = "postgresql+psycopg://exam:exam@postgres:5432/exam_builder"
    redis_url: str = "redis://redis:6379/0"
    celery_broker_url: str = "redis://redis:6379/0"
    celery_result_backend: str = "redis://redis:6379/1"
    s3_endpoint_url: str = "http://minio:9000"
    s3_access_key: str = "exam-builder"
    s3_secret_key: str = "change-this-secret"
    s3_bucket: str = "exam-files"
    s3_region: str = "us-east-1"
    max_upload_mb: int = Field(default=100, ge=1, le=1000)
    auth_secret_key: str = "change-this-auth-secret"
    auth_algorithm: str = "HS256"
    auth_token_ttl_minutes: int = 60 * 8
    cors_origins: str = "http://localhost:3000"
    ocr_provider: str = "tesseract"
    ocr_languages: str = "fas+eng"
    ocr_external_url: str | None = None
    ocr_external_token: str | None = None

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
