from packages.exam_builder.normalization import normalize_digits, normalize_text, normalized_search_text


def test_normalizes_mixed_persian_arabic_text() -> None:
    source = "\u200fسؤال ۱۲، كدام گزينه ٣ درست است؟  می\u200c رود"
    assert normalize_text(source) == "سوال 12، کدام گزینه 3 درست است؟ می\u200cرود"


def test_normalizes_all_digit_sets() -> None:
    assert normalize_digits("۱۲۳-٤٥٦-789") == "123-456-789"


def test_search_text_is_single_line_and_casefolded() -> None:
    assert normalized_search_text("  TEST\nگزينه  ") == "test گزینه"
