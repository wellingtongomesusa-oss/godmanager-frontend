"""Servidor CRM (GAAP + 1099): usa app_master_finance — porta 5001."""
import os

os.environ.setdefault("DATABASE_URL", f"sqlite:///{os.path.abspath('local_dev.db')}")
os.environ.setdefault("SECRET_KEY", "dev-secret-key-change-me")

# Garantir imports `website.*`: pasta pai no path
import sys

_root = os.path.dirname(os.path.abspath(__file__))
_parent = os.path.dirname(_root)
if _parent not in sys.path:
    sys.path.insert(0, _parent)

from app_master_finance import app

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=True, use_reloader=False)
