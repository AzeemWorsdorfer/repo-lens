"""Core analysis logic for the sample package."""
import os

import src.utils
from .config import DEFAULT_PREFIX
from .models import Record


def analyze(record: Record) -> str:
    """Returns a decorated label for a record name."""
    prefix = os.getenv("PREFIX") or DEFAULT_PREFIX
    if prefix:
        return f"{prefix}:{src.utils.slugify(record.name)}"
    return record.name
