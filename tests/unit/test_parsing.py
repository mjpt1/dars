from packages.exam_builder.enums import QuestionType
from packages.exam_builder.extraction import ExtractedPage, TextBlock, parse_questions


def page_with(text: str) -> ExtractedPage:
    return ExtractedPage(1, 600, 800, text, [TextBlock(text, (20, 20, 580, 700))], False, 1.0)


def test_parses_persian_questions_options_and_trailing_answer_key() -> None:
    page = page_with(
        "۱- حاصل دو به علاوه دو چیست؟\n"
        "الف) سه\nب) چهار\nج) پنج\nد) شش\n"
        "2. Explain gravity.\n"
        "پاسخ نامه\n1- ب  2- A"
    )
    questions, answers = parse_questions([page])
    assert [question.number for question in questions] == [1, 2]
    assert questions[0].question_type == QuestionType.MULTIPLE_CHOICE
    assert len(questions[0].options) == 4
    assert questions[0].correct_option == "ب"
    assert answers == {1: "ب", 2: "A"}


def test_does_not_merge_consecutive_questions() -> None:
    questions, _ = parse_questions([page_with("1- First question\ncontinued line\n2) Second question")])
    assert len(questions) == 2
    assert questions[0].normalized_text == "First question continued line"
