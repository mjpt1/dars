# API و مدل داده

OpenAPI زنده در `/docs` و schema خام در `/openapi.json` ارائه می‌شود.

## Endpointها

| Method | Path | کاربرد |
|---|---|---|
| POST | `/uploads` | multipart چندفایلی PDF/DOCX |
| GET | `/uploads/{id}` | metadata و وضعیت upload |
| GET | `/documents` | pagination، search، status، sort |
| GET | `/documents/{id}` | جزئیات document |
| POST | `/documents/{id}/process` | dispatch یا reprocess |
| GET | `/documents/{id}/pages` | layout، confidence و preview URL |
| GET | `/documents/{id}/logs` | log مراحل pipeline |
| GET | `/questions` | pagination و فیلتر document/status/confidence/search |
| GET | `/questions/{id}` | سؤال و گزینه‌ها |
| PATCH | `/questions/{id}` | اصلاح همراه `expected_version` |
| POST | `/questions/{id}/approve` | تأیید و audit history |
| POST | `/questions/{id}/reject` | رد و audit history |
| POST | `/exports` | ساخت JSON، CSV یا ZIP |
| GET | `/exports/{id}` | وضعیت و presigned download URL |
| GET | `/health` | اتصال DB |
| GET | `/metrics` | Prometheus exposition |

## مدل‌ها

- `User`: هویت reviewer قابل اتصال به OIDC
- `UploadJob`: فایل خام، checksum، خطا و وضعیت
- `Document`: نوع، زبان، confidence و payloadها
- `Page`: متن، layout blockها، preview، ستون و کیفیت
- `Question`, `Option`: متن raw/normalized، confidence و review status
- `AnswerKey`: پاسخ استخراج‌شده و source confidence
- `MediaAsset`: binary key، MIME، bounding box و association
- `ReviewAction`: before/after snapshot و comment
- `ExportJob`: filter، format، record count و download key
- `ProcessingLog`: stage، level، payload و timestamp

## خطاها

- `400`: فایل خراب، DOCX نامعتبر یا درخواست ناسازگار
- `409`: پردازش هم‌زمان یا version conflict بازبینی
- `413`: عبور از سقف حجم
- `415`: فرمت پشتیبانی‌نشده
- `422`: validation استاندارد Pydantic
- `503`: failure دیتابیس
