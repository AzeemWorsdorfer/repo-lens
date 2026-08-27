"""Data records used across the package."""
from . import config


class Record:
    """A simple name/value record with a stable prefix."""

    def __init__(self, name: str, value: int) -> None:
        self.name = name
        self.value = value
        self.prefix = config.DEFAULT_PREFIX

    def classify(self) -> str:
        """Classifies the record value into a label."""
        if self.value > 0:
            return "positive"
        return "negative" if self.value < 0 else "zero"
