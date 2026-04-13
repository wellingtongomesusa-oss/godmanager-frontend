"""Servidor local: SQLite + porta 5001 (evita conflito com AirPlay na 5000)."""
import os

os.environ.setdefault("DATABASE_URL", f"sqlite:///{os.path.abspath('local_dev.db')}")
os.environ.setdefault("SECRET_KEY", "dev-secret-key-change-me")

from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=True, use_reloader=False)
