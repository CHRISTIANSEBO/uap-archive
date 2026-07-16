#!/usr/bin/env python3
"""Seed the case list to ingest — the curated 'unidentified' set.

Strategy (documented in README):
  archive.org's 'project-blue-book' collection is the digitized NARA T1206 microfilm.
  It is NOT pre-filtered to the ~701 official "unidentified" cases. We curate a set by:
    (a) a hand-checked seed list of well-known genuinely-unidentified cases, and
    (b) optional expansion by querying the collection.

For the portfolio MVP we curate a focused, visually-rich set (default ~50). Scale up by
raising --limit. This script only registers case_ids + creates pipeline_status rows; it
does not download anything (that's the fetch stage).

Usage:
  python -m ingestion.seed_cases --from-file ingestion/data_sources/unidentified_seed.txt
  python -m ingestion.seed_cases --query "unidentified" --limit 50
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import requests

from backend.app.config import get_settings
from backend.app.db import get_conn, init_schema

settings = get_settings()
SEARCH = "https://archive.org/advancedsearch.php"
SESSION = requests.Session()
SESSION.headers["User-Agent"] = "uap-archive/1.0 (portfolio project)"


def _register(case_ids: list[str]) -> int:
    n = 0
    with get_conn() as conn:
        for cid in case_ids:
            conn.execute(
                """INSERT INTO cases (case_id, source_url)
                   VALUES (%s, %s) ON CONFLICT (case_id) DO NOTHING""",
                (cid, f"https://archive.org/details/{cid}"),
            )
            for stage in ("fetch", "ocr", "extract", "embed"):
                conn.execute(
                    """INSERT INTO pipeline_status (case_id, stage, status)
                       VALUES (%s,%s,'pending')
                       ON CONFLICT (case_id, stage) DO NOTHING""",
                    (cid, stage),
                )
            n += 1
    return n


def _query_collection(query: str, limit: int) -> list[str]:
    params = {
        "q": f"collection:{settings.source_collection} AND ({query})",
        "fl[]": "identifier",
        "rows": str(limit),
        "output": "json",
        "sort[]": "downloads desc",  # prefer well-viewed items = better scans
    }
    for attempt in range(4):
        r = SESSION.get(SEARCH, params=params, timeout=60)
        if r.status_code == 429:
            time.sleep(2 ** attempt)
            continue
        r.raise_for_status()
        docs = r.json()["response"]["docs"]
        return [d["identifier"] for d in docs if d.get("identifier")]
    return []


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--from-file", type=Path, help="newline-delimited archive.org identifiers")
    ap.add_argument("--query", default="unidentified")
    ap.add_argument("--limit", type=int, default=50)
    ap.add_argument("--schema", default="db/schema.sql")
    args = ap.parse_args()

    init_schema(args.schema)

    ids: list[str] = []
    if args.from_file and args.from_file.exists():
        ids = [
            line.strip()
            for line in args.from_file.read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.startswith("#")
        ]
        print(f"Loaded {len(ids)} case ids from {args.from_file}")
    else:
        ids = _query_collection(args.query, args.limit)
        print(f"Queried collection -> {len(ids)} case ids")

    if not ids:
        print("No case ids to seed.", file=sys.stderr)
        return 1

    n = _register(ids)
    print(f"Registered {n} cases (idempotent). Next: python -m ingestion.run --stage all")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
