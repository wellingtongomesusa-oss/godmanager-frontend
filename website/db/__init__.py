"""SQLAlchemy 2.0 engine + Session factory para o schema multi-tenant.

Vive em paralelo ao Flask-SQLAlchemy legado de website/models.py. Nao
substitui nada existente.
"""
from __future__ import annotations

import os
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from .base import Base


def _resolve_database_url() -> str:
    url = os.environ.get("DATABASE_URL_LOCAL") or os.environ.get("DATABASE_URL", "")
    if url.startswith("postgres://"):
        url = "postgresql+psycopg2://" + url[len("postgres://"):]
    return url


DATABASE_URL = _resolve_database_url()

engine = create_engine(DATABASE_URL, future=True, pool_pre_ping=True) if DATABASE_URL else None
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True) if engine else None


def get_session() -> Iterator[Session]:
    if SessionLocal is None:
        raise RuntimeError("DATABASE_URL nao configurado")
    sess = SessionLocal()
    try:
        yield sess
    finally:
        sess.close()


__all__ = ["Base", "engine", "SessionLocal", "get_session", "DATABASE_URL"]
