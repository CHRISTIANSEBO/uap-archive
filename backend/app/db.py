"""Postgres connection pool + pgvector registration. Shared by API and pipeline."""
from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

import psycopg
from psycopg_pool import ConnectionPool
from pgvector.psycopg import register_vector

from .config import get_settings

_pool: ConnectionPool | None = None


def _configure(conn: psycopg.Connection) -> None:
    register_vector(conn)


def get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        settings = get_settings()
        _pool = ConnectionPool(
            settings.database_url,
            min_size=1,
            max_size=10,
            configure=_configure,
            kwargs={"autocommit": True},
        )
    return _pool


@contextmanager
def get_conn() -> Iterator[psycopg.Connection]:
    with get_pool().connection() as conn:
        yield conn


def init_schema(schema_path: str) -> None:
    """Apply schema.sql (idempotent — all CREATE ... IF NOT EXISTS)."""
    with open(schema_path, "r", encoding="utf-8") as fh:
        sql = fh.read()
    with get_conn() as conn:
        conn.execute(sql)
