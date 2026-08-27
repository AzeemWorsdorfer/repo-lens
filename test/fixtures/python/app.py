"""Entry script run directly with `python app.py`."""
from src.core import analyze
from src.web.server import create_server


def run() -> None:
    """Starts the sample application and prints one analysis line."""
    server = create_server()
    print(analyze(server))


if __name__ == "__main__":
    run()
