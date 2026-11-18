# عملیات و رفع خطا

## مشاهده وضعیت

```powershell
docker compose ps
docker compose logs --tail=200 api worker migrate
docker compose exec postgres psql -U exam -d exam_builder -c "select status,count(*) from documents group by status;"
docker compose exec redis redis-cli llen documents
```

## failure modes

| نشانه | علت محتمل | اقدام |
|---|---|---|
| `database_unavailable` | PostgreSQL unhealthy یا credential نادرست | healthcheck و `DATABASE_URL` را بررسی کنید |
| document در `queued` می‌ماند | worker یا Redis قطع است | log worker و queueهای `documents,exports` را ببینید |
| `TesseractNotFoundError` | اجرای خارج Docker بدون Tesseract | Tesseract و language pack فارسی را نصب کنید |
| OCR فارسی خالی است | pack `fas` نصب نیست | `tesseract --list-langs` باید `fas` را نشان دهد |
| upload کد 400 می‌دهد | magic bytes یا archive خراب | فایل را با PDF/DOCX reader باز و دوباره export کنید |
| MinIO `AccessDenied` | access/secret ناهماهنگ | متغیرهای S3 و MinIO root را یکسان کنید |
| frontend API error | `NEXT_PUBLIC_API_URL` اشتباه | URL قابل دسترس از مرورگر را هنگام build تنظیم کنید |
| edit کد 409 می‌دهد | reviewer دیگری نسخه را تغییر داده | سؤال را reload و تغییر را روی نسخه جدید اعمال کنید |

## backup و restore

PostgreSQL و MinIO باید با هم backup شوند تا metadata و objectها سازگار بمانند.

```powershell
docker compose exec -T postgres pg_dump -U exam -Fc exam_builder > exam-builder.dump
docker run --rm -v exam-dataset-builder_minio-data:/data -v ${PWD}:/backup alpine tar czf /backup/minio-data.tgz /data
```

## scaling

API stateless است و می‌تواند replica داشته باشد. worker را با `docker compose up --scale worker=4` افزایش دهید. برای بار بالا queueهای documents و exports را به workerهای جدا route کنید. Redis production باید persistence/monitoring و PostgreSQL باید backup، connection limits و alert داشته باشد.

## retention

soft delete فیلد document/question را برای حذف منطقی فراهم می‌کند. حذف فیزیکی objectهای MinIO باید با policy سازمان و job دوره‌ای هماهنگ شود؛ حذف مستقیم bucket بدون حذف metadata مجاز نیست.