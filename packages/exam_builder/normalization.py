"""Persian and English exam-text normalization utilities."""

from __future__ import annotations

import re
import unicodedata

_DIGIT_TRANSLATION = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
_LETTER_TRANSLATION = str.maketrans(
    {
        "ي": "ی",
        "ى": "ی",
        "ك": "ک",
        "ة": "ه",
        "ۀ": "هٔ",
        "ؤ": "و",
        "إ": "ا",
        "أ": "ا",
    }
)
_CONTROL_CHARS = re.compile(r"[\u200e\u200f\u202a-\u202e\u2066-\u2069]")
_WHITESPACE = re.compile(r"[^\S\n]+")
_EXCESS_LINES = re.compile(r"\n{3,}")


def normalize_digits(value: str) -> str:
    """Convert Persian and Arabic-Indic digits to ASCII digits."""
    return value.translate(_DIGIT_TRANSLATION)


def normalize_text(value: str, *, preserve_lines: bool = True) -> str:
    """Normalize Unicode, Persian letters, digits, spacing, and punctuation."""
    text = unicodedata.normalize("NFKC", value)
    text = _CONTROL_CHARS.sub("", text)
    text = text.translate(_LETTER_TRANSLATION)
    text = normalize_digits(text)
    text = text.replace("\u00a0", " ").replace("\u200c ", "\u200c").replace(" \u200c", "\u200c")
    text = text.replace(",", "،").replace("?", "؟")
    text = _WHITESPACE.sub(" ", text)
    if preserve_lines:
        lines = [line.strip() for line in text.splitlines()]
        return _EXCESS_LINES.sub("\n\n", "\n".join(lines)).strip()
    return " ".join(text.split()).strip()


def normalized_search_text(value: str) -> str:
    """Produce a case-insensitive single-line representation for searching."""
    return normalize_text(value, preserve_lines=False).casefold()