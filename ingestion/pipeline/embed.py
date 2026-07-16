"""Stage 4 — CHUNK + EMBED.

Chunk each case's OCR text (~500 tokens, 50 overlap), embed locally (bge-small, 384-dim),
store in pgvector with case_id + page_number so search can cite an exact page.
Idempotent: clears+rewrites chunks for a case only when (re)run for that case.
"""
from __future__ import annotations

from backend.app.config import get_settings
from backend.app.db import get_conn
from backend.app.embeddings import embed_documents
from .state import mark, is_done

settings = get_settings()

# ~4 chars/token heuristic -> char windows for chunking without a tokenizer dependency.
_CHARS_PER_TOK = 4
_WINDOW = settings.chunk_tokens * _CHARS_PER_TOK
_OVERLAP = settings.chunk_overlap * _CHARS_PER_TOK


def _chunk(text: str) -> list[str]:
    text = " ".join(text.split())
    if not text:
        return []
    chunks, start = [], 0
    while start < len(text):
        end = min(start + _WINDOW, len(text))
        chunks.append(text[start:end])
        if end == len(text):
            break
        start = end - _OVERLAP
    return chunks


def embed_case(case_id: str) -> bool:
    if is_done(case_id, "embed"):
        return True
    try:
        with get_conn() as conn:
            pages = conn.execute(
                "SELECT page_number, ocr_text FROM pages WHERE case_id=%s ORDER BY page_number",
                (case_id,),
            ).fetchall()

        payload: list[tuple[int, int, str]] = []  # (page, chunk_idx, content)
        for page_number, ocr_text in pages:
            for ci, content in enumerate(_chunk(ocr_text or "")):
                payload.append((page_number, ci, content))

        if not payload:
            mark(case_id, "embed", "skipped", "no chunkable text")
            return True

        vectors = embed_documents([c for _, _, c in payload])

        with get_conn() as conn:
            conn.execute("DELETE FROM chunks WHERE case_id=%s", (case_id,))
            with conn.cursor() as cur:
                cur.executemany(
                    """
                    INSERT INTO chunks (case_id, page_number, chunk_index, content, embedding)
                    VALUES (%s,%s,%s,%s,%s)
                    ON CONFLICT (case_id, page_number, chunk_index) DO NOTHING
                    """,
                    [
                        (case_id, p, ci, content, vec)
                        for (p, ci, content), vec in zip(payload, vectors)
                    ],
                )
        mark(case_id, "embed", "done", f"{len(payload)} chunks")
        return True
    except Exception as exc:  # noqa: BLE001
        mark(case_id, "embed", "failed", str(exc)[:400])
        return False
