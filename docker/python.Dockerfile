FROM public.ecr.aws/docker/library/python:3.12-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr tesseract-ocr-fas tesseract-ocr-eng libgl1 libglib2.0-0 curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY pyproject.toml ./
COPY packages ./packages
COPY apps ./apps
COPY migrations ./migrations
COPY alembic.ini ./
RUN pip install --upgrade pip && pip install "."
RUN useradd --create-home --uid 10001 appuser && chown -R appuser:appuser /app
USER appuser

FROM runtime AS test-runner
USER root
RUN pip install ".[dev]"
USER appuser
