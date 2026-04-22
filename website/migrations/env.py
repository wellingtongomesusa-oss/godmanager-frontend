"""Alembic env.py para o schema multi-tenant em website/db.

Filtra include_object para incluir apenas tabelas declaradas em
Base.metadata (ignora as tabelas legadas gm_* do Flask-SQLAlchemy
em website/models.py).
"""
from __future__ import annotations

import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from website.db.base import Base
from website.db import models  # noqa: F401  (registra todos os models em Base.metadata)

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

KNOWN_TABLES = set(target_metadata.tables.keys())


def _resolve_url() -> str:
    url = os.environ.get("DATABASE_URL_LOCAL") or os.environ.get("DATABASE_URL", "")
    if url.startswith("postgres://"):
        url = "postgresql+psycopg2://" + url[len("postgres://"):]
    return url


def include_object(obj, name, type_, reflected, compare_to):
    if type_ == "table":
        return name in KNOWN_TABLES
    if type_ == "index":
        tbl = getattr(obj, "table", None)
        return bool(tbl and tbl.name in KNOWN_TABLES)
    return True


def run_migrations_offline() -> None:
    context.configure(
        url=_resolve_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        include_object=include_object,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    cfg = config.get_section(config.config_ini_section, {})
    cfg["sqlalchemy.url"] = _resolve_url()
    connectable = engine_from_config(cfg, prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
