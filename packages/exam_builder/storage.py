from __future__ import annotations

import io
from pathlib import Path

import boto3
from botocore.client import BaseClient
from botocore.exceptions import ClientError

from .settings import Settings, get_settings


class ObjectStorage:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.client: BaseClient = boto3.client(
            "s3",
            endpoint_url=self.settings.s3_endpoint_url,
            aws_access_key_id=self.settings.s3_access_key,
            aws_secret_access_key=self.settings.s3_secret_key,
            region_name=self.settings.s3_region,
        )

    def ensure_bucket(self) -> None:
        try:
            self.client.head_bucket(Bucket=self.settings.s3_bucket)
        except ClientError:
            self.client.create_bucket(Bucket=self.settings.s3_bucket)

    def put_bytes(self, key: str, data: bytes, content_type: str) -> None:
        self.ensure_bucket()
        self.client.upload_fileobj(
            io.BytesIO(data), self.settings.s3_bucket, key, ExtraArgs={"ContentType": content_type}
        )

    def get_bytes(self, key: str) -> bytes:
        response = self.client.get_object(Bucket=self.settings.s3_bucket, Key=key)
        return response["Body"].read()

    def download_to(self, key: str, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self.client.download_file(self.settings.s3_bucket, key, str(path))

    def presigned_url(self, key: str, expires_seconds: int = 3600) -> str:
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.settings.s3_bucket, "Key": key},
            ExpiresIn=expires_seconds,
        )
