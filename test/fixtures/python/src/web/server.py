"""HTTP server assembly for the sample package."""
from ..core import analyze
from . import routing
from src import config


def create_server() -> dict:
    """Returns a minimal server configuration."""
    return {
        "handler": analyze,
        "routes": routing.routes(),
        "label": config.DEFAULT_PREFIX,
    }
