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


def _clean_documents(case_id: str) -> list[tuple[int, int, str]]:
    """Build clean, search-friendly documents for a case.

    Primary signal = LLM-generated summaries + structured fields (robust to bad OCR).
    Secondary signal = the best OCR page chunks (only reasonably-confident pages),
    so exact phrases in decent scans are still findable.
    Returns list of (page_number, chunk_index, content); page 0 = case-level doc.
    """
    with get_conn() as conn:
        row = conn.execute(
            """SELECT summary_one_line, summary_paragraph, city, state, shape,
                      witness_type, official_conclusion, event_date, title_raw
               FROM cases WHERE case_id=%s""",
            (case_id,),
        ).fetchone()
        pages = conn.execute(
            """SELECT page_number, ocr_text, ocr_confidence FROM pages
               WHERE case_id=%s ORDER BY page_number""",
            (case_id,),
        ).fetchall()

    docs: list[tuple[int, int, str]] = []

    if row:
        one, para, city, state, shape, witness, concl, ev, title = row
        loc = ", ".join([p for p in (city, state) if p])
        year = ev.year if ev else None
        decade = f"{(year // 10) * 10}s" if year else None
        parts = [
            one, para,
            f"Location: {loc}" if loc else None,
            f"Date: {ev.isoformat()}" if ev else None,
            f"Decade: {decade}" if decade else None,
            f"Object shape: {shape}" if shape and shape != "unknown" else None,
            f"Witnesses: {witness}" if witness and witness != "unknown" else None,
            f"Official conclusion: {concl}" if concl else None,
            title,
        ]
        clean = ". ".join(p for p in parts if p)
        if clean.strip():
            docs.append((0, 0, clean))  # page 0 = clean case-level document

    # Secondary: only chunk pages with usable OCR confidence.
    for page_number, ocr_text, conf in pages:
        if (conf or 0) < settings.ocr_confidence_threshold:
            continue
        for ci, content in enumerate(_chunk(ocr_text or "")):
            docs.append((page_number, ci + 1, content))
    return docs


def embed_case(case_id: str) -> bool:
    if is_done(case_id, "embed"):
        return True
    try:
        payload = _clean_documents(case_id)
        if not payload:
            mark(case_id, "embed", "skipped", "no clean/confident text to embed")
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
        mark(case_id, "embed", "done", f"{len(payload)} docs (clean+ocr)")
        return True
    except Exception as exc:  # noqa: BLE001
        mark(case_id, "embed", "failed", str(exc)[:400])
        return False
