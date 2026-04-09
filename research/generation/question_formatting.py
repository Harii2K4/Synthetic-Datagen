import re

_HEADER_PATTERN = re.compile(
    r"^(?:\*\*|__)?\s*(?:math\s*problem|problem|question)\s*:\s*(?:\*\*|__)?\s*",
    re.IGNORECASE,
)
_TRAILING_SECTION_PATTERN = re.compile(
    r"\n\s*(?:solution|answer|explanation|hint|approach|steps?|analysis)\s*:\s*",
    re.IGNORECASE,
)
_CODE_FENCE_PATTERN = re.compile(r"^```[\w-]*\s*|\s*```$", re.MULTILINE)


def normalize_math_problem_text(raw_text: str) -> str:
    text = str(raw_text or "").replace("\r\n", "\n").strip()
    text = _CODE_FENCE_PATTERN.sub("", text).strip()
    trailing_section = _TRAILING_SECTION_PATTERN.search(text)
    if trailing_section:
        text = text[: trailing_section.start()].rstrip()
    text = text.replace("**Math problem:**", "Math problem:")
    text = text.replace("**Math Problem:**", "Math problem:")
    text = text.replace("__Math problem:__", "Math problem:")
    text = _HEADER_PATTERN.sub("", text, count=1).strip()
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    if not text:
        return "Math problem:"
    return f"Math problem:\n{text}"


def normalize_math_problem_batch(raw_texts: list[str]) -> list[str]:
    return [normalize_math_problem_text(text) for text in raw_texts]
