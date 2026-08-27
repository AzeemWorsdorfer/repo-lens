"""HTTP server assembly for the sample package."""
from ..core import analyze
from . import routing


def create_server() -> dict:
    """Returns a minimal server configuration."""
    return {"handler": analyze, "routes": routing.routes()}
