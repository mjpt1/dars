from __future__ import annotations

import io
import re
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

import fitz
from docx import Document as DocxDocument
from PIL import Image

from .enums import DocumentKind, QuestionType
from .normalization import normalize_text
from .ocr import OCRAdapter


@dataclass(slots=True)
class TextBlock:
    text: str
    box: tuple[float, float, float, float]
    confidence: float = 1.0


@dataclass(slots=True)
class ExtractedMedia:
    data: bytes
    extension: str
    mime_type: str
    box: tuple[float, float, float, float] | None


@dataclass(slots=True)
class ExtractedPage:
    number: int
    width: float
    height: float
    raw_text: str
    blocks: list[TextBlock]
    is_scanned: bool
    confidence: float
    column_count: int = 1
    preview_png: bytes | None = None
    media: list[ExtractedMedia] = field(default_factory=list)


@dataclass(slots=True)
class ParsedOption:
    label: str
    raw_text: str
    normalized_text: str
    confidence: float


@dataclass(slots=True)
class ParsedQuestion:
    number: int
    page_number: int
    raw_text: str
    normalized_text: str
    question_type: QuestionType
    options: list[ParsedOption] = field(default_factory=list)
    correct_option: str | None = None
    confidence: float = 0.0
    box: tuple[float, float, float, float] | None = None


QUESTION_PATTERN = re.compile(
    r"^\s*(?:س[ؤو]ال\s*)?(?P<number>[0-9۰-۹٠-٩]{1,4})\s*[.)\-–—:：]\s*(?P<body>.+)$"
)
OPTION_PATTERN = re.compile(
    r"^\s*(?:گزینه\s*)?(?P<label>[1-9۱-۹١-٩]|[الفبجدهـو]|[A-Fa-f])\s*[.)\-–—:]\s*(?P<body>.+)$"
)
ANSWER_PAIR_PATTERN = re.compile(
    r"(?P<number>[0-9۰-۹٠-٩]{1,4})\s*[-:.)]\s*(?P<answer>[1-6۱-۶١-٦A-Fa-fالفبجدهـو])"
)


def _detect_columns(blocks: list[TextBlock], width: float) -> int:
    meaningful = [block for block in blocks if len(block.text.strip()) > 2]
    left = sum(block.box[0] < width * 0.42 for block in meaningful)
    right = sum(block.box[0] > width * 0.52 for block in meaningful)
    centered = sum(block.box[0] <= width * 0.52 and block.box[2] >= width * 0.48 for block in meaningful)
    return 2 if left >= 3 and right >= 3 and centered < len(meaningful) * 0.45 else 1


def _render_page(page: fitz.Page, dpi: int = 180) -> bytes:
    pixmap = page.get_pixmap(matrix=fitz.Matrix(dpi / 72, dpi / 72), alpha=False)
    return pixmap.tobytes("png")


def extract_pdf(data: bytes, ocr: OCRAdapter, languages: str) -> tuple[DocumentKind, list[ExtractedPage]]:
    pdf = fitz.open(stream=data, filetype="pdf")
    pages: list[ExtractedPage] = []
    scanned_count = 0
    for page_index, page in enumerate(pdf):
        blocks = [
            TextBlock(str(item[4]).strip(), tuple(float(value) for value in item[:4]))
            for item in page.get_text("blocks")
            if str(item[4]).strip()
        ]
        raw_text = "\n".join(block.text for block in blocks)
        is_scanned = len(normalize_text(raw_text, preserve_lines=False)) < 30
        preview = _render_page(page)
        media: list[ExtractedMedia] = []
        for image_info in page.get_image_info(xrefs=True):
            xref = int(image_info.get("xref", 0))
            if xref <= 0:
                continue
            extracted = pdf.extract_image(xref)
            box_value = image_info.get("bbox")
            box = tuple(float(value) for value in box_value) if box_value else None
            extension = str(extracted.get("ext", "png"))
            media.append(
                ExtractedMedia(
                    data=extracted["image"],
                    extension=extension,
                    mime_type=f"image/{'jpeg' if extension in {'jpg', 'jpeg'} else extension}",
                    box=box,
                )
            )
        confidence = 1.0
        if is_scanned:
            scanned_count += 1
            result = ocr.recognize(Image.open(io.BytesIO(preview)), languages)
            raw_text = result.text
            confidence = result.confidence
            scale_x = page.rect.width / max(1, Image.open(io.BytesIO(preview)).width)
            scale_y = page.rect.height / max(1, Image.open(io.BytesIO(preview)).height)
            blocks = [
                TextBlock(
                    word.text,
                    (
                        word.box[0] * scale_x,
                        word.box[1] * scale_y,
                        (word.box[0] + word.box[2]) * scale_x,
                        (word.box[1] + word.box[3]) * scale_y,
                    ),
                    word.confidence,
                )
                for word in result.words
            ]
        pages.append(
            ExtractedPage(
                number=page_index + 1,
                width=page.rect.width,
                height=page.rect.height,
                raw_text=raw_text,
                blocks=blocks,
                is_scanned=is_scanned,
                confidence=confidence,
                column_count=_detect_columns(blocks, page.rect.width),
                preview_png=preview,
                media=media,
            )
        )
    kind = DocumentKind.PDF_SCANNED if scanned_count == len(pages) else DocumentKind.PDF_TEXT
    if 0 < scanned_count < len(pages):
        kind = DocumentKind.PDF_MIXED
    return kind, pages


def extract_docx(data: bytes) -> tuple[DocumentKind, list[ExtractedPage]]:
    document = DocxDocument(io.BytesIO(data))
    paragraphs = [paragraph.text.strip() for paragraph in document.paragraphs if paragraph.text.strip()]
    raw_text = "\n".join(paragraphs)
    blocks = [TextBlock(text, (0.0, float(index * 20), 600.0, float(index * 20 + 18))) for index, text in enumerate(paragraphs)]
    return DocumentKind.DOCX, [ExtractedPage(1, 600, max(800, len(paragraphs) * 20), raw_text, blocks, False, 1.0)]


def remove_repeated_margins(pages: list[ExtractedPage]) -> None:
    if len(pages) < 3:
        return
    candidates: Counter[str] = Counter()
    for page in pages:
        for block in page.blocks:
            if block.box[1] < page.height * 0.1 or block.box[3] > page.height * 0.9:
                value = normalize_text(block.text, preserve_lines=False)
                if value:
                    candidates[value] += 1
    repeated = {text for text, count in candidates.items() if count >= max(2, len(pages) // 2)}
    for page in pages:
        page.blocks = [
            block
            for block in page.blocks
            if normalize_text(block.text, preserve_lines=False) not in repeated
        ]
        page.raw_text = "\n".join(block.text for block in page.blocks)


def _reading_order(page: ExtractedPage) -> list[TextBlock]:
    if page.column_count == 1:
        return sorted(page.blocks, key=lambda block: (round(block.box[1] / 4), block.box[0]))
    midpoint = page.width / 2
    right = sorted((block for block in page.blocks if block.box[0] >= midpoint), key=lambda block: block.box[1])
    left = sorted((block for block in page.blocks if block.box[0] < midpoint), key=lambda block: block.box[1])
    return right + left


def parse_questions(pages: list[ExtractedPage]) -> tuple[list[ParsedQuestion], dict[int, str]]:
    questions: list[ParsedQuestion] = []
    answers: dict[int, str] = {}
    current: ParsedQuestion | None = None
    answer_mode = False
    for page in pages:
        for block in _reading_order(page):
            for raw_line in block.text.splitlines():
                line = normalize_text(raw_line, preserve_lines=False)
                if not line:
                    continue
                if re.search(r"پاسخ\s*نامه|کلید\s*(?:سوال|آزمون)|answer\s*key", line, re.IGNORECASE):
                    if current:
                        questions.append(current)
                        current = None
                    answer_mode = True
                    continue
                if answer_mode:
                    for answer_match in ANSWER_PAIR_PATTERN.finditer(line):
                        number = int(normalize_text(answer_match.group("number"), preserve_lines=False))
                        answers[number] = normalize_text(answer_match.group("answer"), preserve_lines=False)
                    continue
                question_match = QUESTION_PATTERN.match(line)
                option_match = OPTION_PATTERN.match(line)
                if question_match:
                    if current:
                        questions.append(current)
                    number = int(normalize_text(question_match.group("number"), preserve_lines=False))
                    body = question_match.group("body")
                    current = ParsedQuestion(
                        number=number,
                        page_number=page.number,
                        raw_text=raw_line,
                        normalized_text=body,
                        question_type=QuestionType.DESCRIPTIVE,
                        confidence=max(0.45, page.confidence * block.confidence * 0.9),
                        box=block.box,
                    )
                elif option_match and current:
                    label = normalize_text(option_match.group("label"), preserve_lines=False)
                    body = option_match.group("body")
                    current.options.append(ParsedOption(label, raw_line, body, block.confidence))
                    current.question_type = QuestionType.MULTIPLE_CHOICE
                elif current:
                    current.raw_text += "\n" + raw_line
                    current.normalized_text += " " + line
                else:
                    for answer_match in ANSWER_PAIR_PATTERN.finditer(line):
                        number = int(normalize_text(answer_match.group("number"), preserve_lines=False))
                        answers[number] = normalize_text(answer_match.group("answer"), preserve_lines=False)
    if current:
        questions.append(current)
    for question in questions:
        question.correct_option = answers.get(question.number)
        structure_score = 1.0 if question.question_type == QuestionType.DESCRIPTIVE else min(1.0, len(question.options) / 4)
        question.confidence = round(min(question.confidence, 0.65 + structure_score * 0.35), 4)
    return questions, answers


def extract_document(filename: str, data: bytes, ocr: OCRAdapter, languages: str) -> tuple[DocumentKind, list[ExtractedPage], list[ParsedQuestion], dict[int, str]]:
    suffix = Path(filename).suffix.lower()
    if suffix == ".pdf":
        kind, pages = extract_pdf(data, ocr, languages)
    elif suffix == ".docx":
        kind, pages = extract_docx(data)
    else:
        raise ValueError(f"Unsupported document type: {suffix}")
    remove_repeated_margins(pages)
    questions, answers = parse_questions(pages)
    return kind, pages, questions, answers