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
    # Ensure the pgvector extension exists, THEN register the vector type.
    # Without this, a fresh database (no extension yet) makes register_vector
    # raise 'vector type not found', which would break every pooled connection.
    try:
        conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
        register_vector(conn)
    except Exception:  # noqa: BLE001
        # DB reachable but extension not installable yet — don't kill the pool.
        # Vector ops will work once /api/init-db (or the pipeline) runs schema.sql.
        pass


def get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        settings = get_settings()
        # Fast connect timeout so a missing/wrong DATABASE_URL fails loudly
        # instead of hanging requests forever.
        _pool = ConnectionPool(
            settings.database_url,
            min_size=0,          # don't open a connection until first use
            max_size=10,
            timeout=10,
            open=False,          # do NOT connect at construction time
            configure=_configure,
            kwargs={"autocommit": True, "connect_timeout": 5},
        )
        _pool.open()
    return _pool


def ping() -> bool:
    """Quick DB liveness check for /api/healthz. Never raises."""
    try:
        with get_conn() as conn:
            conn.execute("SELECT 1")
        return True
    except Exception:  # noqa: BLE001
        return False


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
