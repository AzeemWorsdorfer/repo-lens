"""Route table for the web layer."""
ROUTES = ("/", "/health")


def routes() -> list[str]:
    """Returns the registered routes."""
    return list(ROUTES)
