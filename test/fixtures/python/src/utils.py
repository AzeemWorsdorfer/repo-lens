"""String helpers shared across the package."""
import re


def slugify(text: str) -> str:
    """Returns a lowercase, hyphenated label for a text."""
    words = re.split(r"\W+", text)
    return "-".join(word for word in words if word)
