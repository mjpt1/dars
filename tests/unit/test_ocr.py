from PIL import Image

from packages.exam_builder.ocr import OCRAdapter, OCRResult, OCRWord


class FakeOCR:
    def recognize(self, image: Image.Image, languages: str) -> OCRResult:
        return OCRResult("سوال", 0.9, [OCRWord("سوال", 0.9, (1, 2, 30, 10))])


def run_adapter(adapter: OCRAdapter) -> OCRResult:
    return adapter.recognize(Image.new("RGB", (100, 50), "white"), "fas+eng")


def test_ocr_adapter_contract_is_replaceable() -> None:
    result = run_adapter(FakeOCR())
    assert result.confidence == 0.9
    assert result.words[0].box == (1, 2, 30, 10)
