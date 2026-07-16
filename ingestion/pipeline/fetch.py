"""Stage 1 — FETCH.

Download the case PDF + metadata from archive.org into /data/raw/{case_id}/.
Records the source URL for every file. Idempotent: skips cases already fetched.

Source: archive.org 'project-blue-book' collection (digitized NARA T1206 microfilm).
Every displayed document links back to its archive.org item (official mirror of NARA).
"""
from __future__ import annotations

import json
import time
from pathlib import Path

import requests

from backend.app.config import get_settings
from backend.app.db import get_conn
from .state import mark, is_done

settings = get_settings()
META = "https://archive.org/metadata/{cid}"
DL = "https://archive.org/download/{cid}/{name}"
ITEM = "https://archive.org/details/{cid}"
SESSION = requests.Session()
SESSION.headers["User-Agent"] = "uap-archive/1.0 (portfolio project; respectful crawler)"


def _get(url: str, **kw) -> requests.Response:
    for attempt in range(4):
        r = SESSION.get(url, timeout=60, allow_redirects=True, **kw)
        if r.status_code == 429:
            time.sleep(2 ** attempt)
            continue
        r.raise_for_status()
        return r
    r.raise_for_status()
    return r


def fetch_case(case_id: str) -> bool:
    if is_done(case_id, "fetch"):
        return True
    try:
        meta = _get(META.format(cid=case_id)).json()
        md = meta.get("metadata", {})
        files = meta.get("files", [])

        pdfs = [f for f in files if f.get("format") == "Text PDF"]
        if not pdfs:
            pdfs = [f for f in files if f.get("name", "").lower().endswith(".pdf")]
        if not pdfs:
            mark(case_id, "fetch", "failed", "no PDF file in item")
            return False

        pdf_name = pdfs[0]["name"]
        case_dir = settings.raw_dir / case_id
        case_dir.mkdir(parents=True, exist_ok=True)

        pdf_url = DL.format(cid=case_id, name=pdf_name)
        pdf_path = case_dir / "document.pdf"
        if not pdf_path.exists() or pdf_path.stat().st_size == 0:
            r = _get(pdf_url)
            pdf_path.write_bytes(r.content)

        # Persist provenance for every stored file.
        (case_dir / "source.json").write_text(
            json.dumps(
                {
                    "case_id": case_id,
                    "item_url": ITEM.format(cid=case_id),
                    "pdf_url": pdf_url,
                    "nara_origin": "NARA T1206 (Project Blue Book microfilm)",
                    "collection": md.get("collection"),
                },
                indent=2,
            ),
            encoding="utf-8",
        )

        # Upsert the case row with raw metadata + attribution.
        title = md.get("title") or case_id
        with get_conn() as conn:
            conn.execute(
                """
                INSERT INTO cases (case_id, source_url, nara_origin, title_raw)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (case_id) DO UPDATE
                SET source_url = EXCLUDED.source_url,
                    nara_origin = EXCLUDED.nara_origin,
                    title_raw = EXCLUDED.title_raw,
                    updated_at = now()
                """,
                (case_id, ITEM.format(cid=case_id),
                 "NARA T1206 (Project Blue Book microfilm)", title),
            )

        mark(case_id, "fetch", "done", str(pdf_path))
        return True
    except Exception as exc:  # noqa: BLE001 - record and move on
        mark(case_id, "fetch", "failed", str(exc)[:400])
        return False
