# OCR، Layout و محدودیت‌ها

## پیاده‌سازی محلی

image Python شامل Tesseract و language packهای `fas` و `eng` است. preprocessing به‌ترتیب resize تا حداقل عرض 1800، denoise، histogram equalization، adaptive threshold و deskew محدود به 12 درجه را انجام می‌دهد. confidence واژه‌های Tesseract به صفحه و سپس سؤال منتقل می‌شود.

PDFهای متنی از `page.get_text("blocks")` و مختصات واقعی استفاده می‌کنند. PDFهای mixed صفحه‌به‌صفحه تصمیم‌گیری می‌شوند. تشخیص دو ستون براساس توزیع بلوک‌های چپ/راست است و در صفحات RTL ستون راست زودتر خوانده می‌شود. header/footer فقط وقتی حذف می‌شود که متن یکسان در حداقل نیمی از سه صفحه یا بیشتر تکرار شود.

## افزودن OCR adapter

1. کلاسی بسازید که متد `recognize(image: PIL.Image, languages: str) -> OCRResult` را پیاده کند.
2. خروجی هر واژه باید متن، confidence بین صفر و یک و box `(x, y, width, height)` داشته باشد.
3. adapter را در `get_ocr_adapter` ثبت کنید یا از adapter آماده `HTTPOCRAdapter` استفاده کنید.
4. `OCR_PROVIDER` و متغیرهای endpoint را تنظیم و تست contract را اجرا کنید.

پروتکل HTTP موجود فایل PNG multipart و فیلد `languages` می‌فرستد و JSON زیر را انتظار دارد:

```json
{"text":"...","confidence":0.91,"words":[{"text":"...","confidence":0.9,"box":[10,20,40,15]}]}
```

## محدودیت‌های دقیق

- Tesseract برای متن چاپی واضح فارسی مناسب است، اما دست‌خط، فونت تزئینی، scan زیر حدود 150 DPI و پس‌زمینه خاکستری می‌تواند confidence را شدیداً کاهش دهد.
- OCR محلی فرمول ریاضی را به LaTeX تبدیل نمی‌کند. فرمول raster به‌عنوان media با bounding box حفظ و سؤال به review انسانی فرستاده می‌شود؛ متن ساده اطراف فرمول OCR می‌شود.
- فرمول‌های native PDF ممکن است به glyphهای جدا یا متن ناقص تبدیل شوند. raw block و preview برای اصلاح انسانی نگه داشته می‌شود.
- table extraction مدل شبکه/سلول کامل ندارد. ترتیب بلوک‌ها حفظ می‌شود، اما جدول پیچیده یا merged-cell باید در UI بازبینی شود.
- تصویرهای embedded PDF استخراج و با نزدیک‌ترین سؤال پیشین همان صفحه associate می‌شوند. تصویرهای vector drawing و برخی نمودارهای ساخته‌شده از path، بخشی از preview صفحه می‌مانند و asset مستقل نیستند.
- DOCX فعلاً متن paragraph را با ترتیب سند استخراج می‌کند؛ drawing، equation OMML و جدول پیچیده در preview مستقل نمایش داده نمی‌شوند. برای این موارد تبدیل DOCX به PDF قبل از upload دقت layout بهتری دارد.
- regex الگوهای رایج را پوشش می‌دهد، اما شماره‌گذاری بسیار سفارشی یا پاسخ‌نامه بدون marker ممکن است نیازمند اصلاح reviewer باشد.

هر سؤال با confidence کمتر یا ساختار ناقص با `needs_review` ذخیره می‌شود. سیستم هیچ پاسخ کم‌اطمینانی را خودکار approve نمی‌کند.
