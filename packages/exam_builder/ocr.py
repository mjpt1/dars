from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

import cv2
import httpx
import numpy as np
import pytesseract
from PIL import Image
from pytesseract import Output

from .settings import Settings, get_settings


@dataclass(frozen=True, slots=True)
class OCRWord:
    text: str
    confidence: float
    box: tuple[int, int, int, int]


@dataclass(frozen=True, slots=True)
class OCRResult:
    text: str
    confidence: float
    words: list[OCRWord]


class OCRAdapter(Protocol):
    def recognize(self, image: Image.Image, languages: str) -> OCRResult: ...


def preprocess_image(image: Image.Image) -> Image.Image:
    source = cv2.cvtColor(np.array(image.convert("RGB")), cv2.COLOR_RGB2GRAY)
    height, width = source.shape
    if width < 1800:
        scale = 1800 / width
        source = cv2.resize(source, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    source = cv2.fastNlMeansDenoising(source, None, 12, 7, 21)
    source = cv2.equalizeHist(source)
    binary = cv2.adaptiveThreshold(
        source, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 41, 15
    )
    points = np.column_stack(np.where(binary < 255))
    if len(points) > max(100, int(height * width * 0.0001)):
        angle = cv2.minAreaRect(points)[-1]
        angle = -(90 + angle) if angle < -45 else -angle
        if 0.2 < abs(angle) < 12:
            center = (binary.shape[1] // 2, binary.shape[0] // 2)
            matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
            binary = cv2.warpAffine(
                binary, matrix, (binary.shape[1], binary.shape[0]), borderValue=255
            )
    return Image.fromarray(binary)


class TesseractOCRAdapter:
    def recognize(self, image: Image.Image, languages: str) -> OCRResult:
        processed = preprocess_image(image)
        data = pytesseract.image_to_data(
            processed, lang=languages, config="--oem 1 --psm 6", output_type=Output.DICT
        )
        words: list[OCRWord] = []
        for index, raw_text in enumerate(data["text"]):
            text = raw_text.strip()
            confidence = float(data["conf"][index])
            if text and confidence >= 0:
                words.append(
                    OCRWord(
                        text=text,
                        confidence=confidence / 100,
                        box=(
                            int(data["left"][index]),
                            int(data["top"][index]),
                            int(data["width"][index]),
                            int(data["height"][index]),
                        ),
                    )
                )
        mean = sum(word.confidence for word in words) / len(words) if words else 0.0
        return OCRResult(" ".join(word.text for word in words), mean, words)


class HTTPOCRAdapter:
    def __init__(self, endpoint: str, token: str | None = None) -> None:
        self.endpoint = endpoint
        self.token = token

    def recognize(self, image: Image.Image, languages: str) -> OCRResult:
        import io

        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}
        response = httpx.post(
            self.endpoint,
            files={"file": ("page.png", buffer.getvalue(), "image/png")},
            data={"languages": languages},
            headers=headers,
            timeout=120,
        )
        response.raise_for_status()
        payload = response.json()
        words = [
            OCRWord(item["text"], float(item["confidence"]), tuple(item["box"]))
            for item in payload.get("words", [])
        ]
        return OCRResult(payload["text"], float(payload.get("confidence", 0)), words)


def get_ocr_adapter(settings: Settings | None = None) -> OCRAdapter:
    current = settings or get_settings()
    if current.ocr_provider == "http":
        if not current.ocr_external_url:
            raise ValueError("OCR_EXTERNAL_URL is required when OCR_PROVIDER=http")
        return HTTPOCRAdapter(current.ocr_external_url, current.ocr_external_token)
    if current.ocr_provider != "tesseract":
        raise ValueError(f"Unsupported OCR provider: {current.ocr_provider}")
    return TesseractOCRAdapter()
