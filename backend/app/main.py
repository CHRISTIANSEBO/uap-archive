"""FastAPI app — the friendly read layer over the ingested corpus.

Endpoints:
  GET /search?q=   — semantic search, grouped by case, ranked
  GET /case/{id}   — full structured data + page text + source links
  GET /random      — one random case (Case of the Day)
  GET /stats       — counts by decade / state / shape
  GET /healthz     — liveness

No Anthropic calls happen here. All summaries are precomputed during ingestion and
served from Postgres, so live traffic costs $0 in API spend.
"""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .config import get_settings
from .db import get_conn, ping, init_schema
from .embeddings import embed_query
from .models import (
    CaseDetail,
    MatchedCase,
    PageOut,
    SearchResponse,
    StatsResponse,
)

settings = get_settings()

# The API is mounted under /api so a single container can also serve the SPA + scans.
app = FastAPI(title="UAP Archive API", version="1.0.0")
api = FastAPI(title="UAP Archive API", version="1.0.0")

_origins = os.getenv("CORS_ORIGINS", "*").split(",")
api.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_methods=["GET"],
    allow_headers=["*"],
)

ARCHIVE_ITEM = "https://archive.org/details/{cid}"
ARCHIVE_THUMB = "https://archive.org/services/img/{cid}"


def _citation(case_id: str) -> str:
    return f"Case {case_id} — {ARCHIVE_ITEM.format(cid=case_id)}"


@api.get("/healthz")
def healthz() -> dict:
    # Reports DB reachability so a missing DATABASE_URL is obvious at a glance.
    return {"ok": True, "db": ping()}


@api.get("/init-db")
def init_db() -> dict:
    # Idempotent, on-demand schema creation (tables + pgvector extension).
    # Called once after the DB is linked, instead of blocking app startup.
    try:
        init_schema(os.getenv("SCHEMA_PATH", "db/schema.sql"))
        return {"ok": True, "schema": "initialized"}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=503, detail=f"db not ready: {exc}")


@api.get("/filters")
def filters() -> dict:
    """Distinct decade/state/shape values for the search filter UI."""
    with get_conn() as conn:
        decades = conn.execute(
            """SELECT DISTINCT (EXTRACT(YEAR FROM event_date)::int/10*10) d
               FROM cases WHERE event_date IS NOT NULL ORDER BY d"""
        ).fetchall()
        states = conn.execute(
            "SELECT DISTINCT state FROM cases WHERE state IS NOT NULL ORDER BY state"
        ).fetchall()
        shapes = conn.execute(
            """SELECT DISTINCT shape FROM cases
               WHERE shape IS NOT NULL AND shape <> 'unknown' ORDER BY shape"""
        ).fetchall()
    return {
        "decades": [f"{int(d[0])}s" for d in decades],
        "states": [s[0] for s in states],
        "shapes": [s[0] for s in shapes],
    }


@api.get("/search", response_model=SearchResponse)
def search(
    q: str = Query("", max_length=300),
    decade: str | None = Query(None),
    state: str | None = Query(None),
    shape: str | None = Query(None),
) -> SearchResponse:
    """Semantic search over clean summaries + structured fields, with optional
    structured filters (decade / state / shape). Filters work even with an empty
    query, so the map + cards can be browsed by facet."""
    # Build filter clause shared by both paths.
    clauses, params = [], []
    if decade and decade[:-1].isdigit():
        dy = int(decade[:-1])
        clauses.append("EXTRACT(YEAR FROM c.event_date) BETWEEN %s AND %s")
        params += [dy, dy + 9]
    if state:
        clauses.append("c.state = %s")
        params.append(state)
    if shape:
        clauses.append("c.shape = %s")
        params.append(shape)
    where = (" AND " + " AND ".join(clauses)) if clauses else ""

    with get_conn() as conn:
        if q.strip():
            qvec = embed_query(q)
            rows = conn.execute(
                f"""
                WITH ranked AS (
                    SELECT ch.case_id, ch.page_number, ch.content,
                           1 - (ch.embedding <=> %s::vector) AS score,
                           ROW_NUMBER() OVER (
                               PARTITION BY ch.case_id
                               ORDER BY ch.embedding <=> %s::vector
                           ) AS rn
                    FROM chunks ch
                    ORDER BY ch.embedding <=> %s::vector
                    LIMIT 80
                )
                SELECT r.case_id, r.page_number, r.content, r.score,
                       c.summary_one_line, c.event_date, c.city, c.state, c.shape,
                       c.latitude, c.longitude, c.summary_available
                FROM ranked r
                JOIN cases c ON c.case_id = r.case_id
                WHERE r.rn = 1 {where}
                ORDER BY r.score DESC
                LIMIT 30
                """,
                (qvec, qvec, qvec, *params),
            ).fetchall()
        else:
            # No query: browse by filters (or everything), newest-dated first.
            rows = conn.execute(
                f"""
                SELECT c.case_id, 0 AS page_number, c.summary_paragraph AS content,
                       1.0 AS score, c.summary_one_line, c.event_date, c.city,
                       c.state, c.shape, c.latitude, c.longitude, c.summary_available
                FROM cases c
                WHERE c.summary_available = TRUE {where}
                ORDER BY c.event_date DESC NULLS LAST
                LIMIT 60
                """,
                tuple(params),
            ).fetchall()

    results: list[MatchedCase] = []
    for (
        cid, page, content, score, one_line, ev_date, city, state, shape,
        lat, lon, sum_avail,
    ) in rows:
        # page 0 = clean case-level doc (the summary); don't surface it as an
        # OCR "excerpt" or as a page citation.
        is_case_doc = page == 0
        excerpt = (content or "").strip().replace("\n", " ")
        if len(excerpt) > 240:
            excerpt = excerpt[:240].rsplit(" ", 1)[0] + "…"
        results.append(
            MatchedCase(
                case_id=cid,
                score=round(float(score), 4),
                summary_one_line=one_line,
                date=ev_date.isoformat() if ev_date else None,
                city=city,
                state=state,
                shape=shape,
                latitude=lat,
                longitude=lon,
                thumbnail_url=ARCHIVE_THUMB.format(cid=cid),
                matched_excerpt=None if is_case_doc else (excerpt or None),
                matched_page=None if is_case_doc else page,
                summary_available=bool(sum_avail),
                source_url=ARCHIVE_ITEM.format(cid=cid),
            )
        )
    return SearchResponse(query=q, count=len(results), results=results)


def _load_case(case_id: str) -> CaseDetail:
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT case_id, title_raw, event_date, date_text, city, state, country,
                   latitude, longitude, shape, duration, witness_type,
                   official_conclusion, summary_one_line, summary_paragraph,
                   summary_available, ocr_quality, source_url, nara_origin
            FROM cases WHERE case_id = %s
            """,
            (case_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="case not found")

        pages_rows = conn.execute(
            """
            SELECT page_number, ocr_text, ocr_confidence, needs_review,
                   image_path, source_url
            FROM pages WHERE case_id = %s ORDER BY page_number
            """,
            (case_id,),
        ).fetchall()

    (
        cid, title, ev_date, date_text, city, state, country, lat, lon, shape,
        duration, witness, conclusion, one_line, para, sum_avail, ocr_q,
        source_url, nara,
    ) = row

    pages = [
        PageOut(
            page_number=p[0],
            ocr_text=p[1],
            ocr_confidence=p[2],
            needs_review=bool(p[3]),
            image_url=(f"/media/{p[4]}" if p[4] else None),
            source_url=p[5],
        )
        for p in pages_rows
    ]

    return CaseDetail(
        case_id=cid,
        title_raw=title,
        date=ev_date.isoformat() if ev_date else None,
        date_text=date_text,
        city=city,
        state=state,
        country=country,
        latitude=lat,
        longitude=lon,
        shape=shape,
        duration=duration,
        witness_type=witness,
        official_conclusion=conclusion,
        summary_one_line=one_line,
        summary_paragraph=para,
        summary_available=bool(sum_avail),
        ocr_quality=ocr_q,
        source_url=source_url,
        nara_origin=nara,
        pages=pages,
        citation=_citation(cid),
    )


@api.get("/case/{case_id}", response_model=CaseDetail)
def get_case(case_id: str) -> CaseDetail:
    return _load_case(case_id)


@api.get("/random", response_model=CaseDetail)
def random_case() -> CaseDetail:
    """One random case with a usable summary (Case of the Day)."""
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT case_id FROM cases
            WHERE summary_available = TRUE
            ORDER BY random() LIMIT 1
            """
        ).fetchone()
        if not row:
            # Fall back to any case at all so the homepage never shows empty.
            row = conn.execute(
                "SELECT case_id FROM cases ORDER BY random() LIMIT 1"
            ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="no cases ingested yet")
    return _load_case(row[0])


@api.get("/stats", response_model=StatsResponse)
def stats() -> StatsResponse:
    with get_conn() as conn:
        total = conn.execute("SELECT count(*) FROM cases").fetchone()[0]

        by_decade_rows = conn.execute(
            """
            SELECT (EXTRACT(YEAR FROM event_date)::int / 10 * 10) AS decade, count(*)
            FROM cases WHERE event_date IS NOT NULL
            GROUP BY decade ORDER BY decade
            """
        ).fetchall()
        by_state_rows = conn.execute(
            """
            SELECT COALESCE(state, 'unknown'), count(*)
            FROM cases GROUP BY state ORDER BY count(*) DESC
            """
        ).fetchall()
        by_shape_rows = conn.execute(
            """
            SELECT COALESCE(shape, 'unknown'), count(*)
            FROM cases GROUP BY shape ORDER BY count(*) DESC
            """
        ).fetchall()
        review = conn.execute(
            "SELECT count(*) FROM pages WHERE needs_review"
        ).fetchone()[0]

    return StatsResponse(
        total_cases=total,
        by_decade={f"{int(d)}s": n for d, n in by_decade_rows},
        by_state={str(s): n for s, n in by_state_rows},
        by_shape={str(s): n for s, n in by_shape_rows},
        needs_review_pages=review,
    )


# --------------------------------------------------------------------------
# Compose one app: /api/* (JSON), /media/* (page scans), and the built SPA.
# In dev you typically run the API alone (uvicorn) + Vite; in the Docker
# image the frontend is built into ./frontend/dist and served here.
# --------------------------------------------------------------------------
app.mount("/api", api)

_media_root = Path(os.getenv("DATA_DIR", "./data"))
if _media_root.exists():
    app.mount("/media", StaticFiles(directory=str(_media_root)), name="media")

_frontend_dist = Path(os.getenv("FRONTEND_DIST", "./frontend/dist"))
if _frontend_dist.exists():
    app.mount(
        "/assets",
        StaticFiles(directory=str(_frontend_dist / "assets")),
        name="assets",
    )

    @app.get("/{full_path:path}")
    def spa(full_path: str):  # noqa: ANN201
        # Serve real files if present, else index.html for client-side routing.
        candidate = _frontend_dist / full_path
        if full_path and candidate.is_file():
            return FileResponse(str(candidate))
        return FileResponse(str(_frontend_dist / "index.html"))
else:
    @app.get("/")
    def root():  # noqa: ANN201
        return {"service": "uap-archive", "docs": "/api/docs", "frontend": "not built"}
