"""Stage 3 — STRUCTURE (LLM extraction + summaries).

For each case, feed condensed OCR text to Claude (cheap model) and get validated JSON:
{date, location, shape, duration, witness_type, official_conclusion,
 summary_one_line, summary_paragraph}.

Guardrails:
  * Pydantic validation. On failure: retry ONCE with the error message, then mark
    the case extraction_failed and move on.
  * Cache: skip re-summarizing a case whose OCR text hash is unchanged (never pay twice).
  * Poor/no OCR: skip the LLM entirely, mark summary_available=FALSE so the UI shows
    "Original document available — text extraction incomplete" instead of a fake summary.
  * Cost guard: every call is metered; the runner aborts if projected spend > budget.
  * Every summary is grounded in document text; the API appends the source citation.
"""
from __future__ import annotations

import hashlib
import json

from pydantic import ValidationError

from backend.app.config import get_settings
from backend.app.db import get_conn
from backend.app.models import CaseExtraction
from .geocode import geocode
from .state import mark, is_done, CostGuard

settings = get_settings()

# Condense OCR text to control token spend (summarize from a condensed representation,
# not raw full-case OCR). Keep it generous enough to be faithful.
MAX_CHARS = 12000

SYSTEM = (
    "You are a careful archivist summarizing a declassified US Air Force Project Blue "
    "Book UFO case file. Use ONLY facts present in the provided OCR text. Never invent "
    "details, dates, or conclusions. If a field is not stated, use null (or 'unknown' "
    "for shape/witness_type). Tone: intriguing but strictly factual; present what the "
    "document says without asserting extraordinary claims. Return ONLY valid JSON."
)

SCHEMA_HINT = """Return JSON with exactly these keys:
{
  "date": "YYYY-MM-DD or null",
  "location": {"city": "string or null", "state": "2-letter US state or null"},
  "shape": "one of: disc, light, sphere, cigar, triangle, oval, fireball, cylinder, formation, other, unknown",
  "duration": "string or null",
  "witness_type": "one of: civilian, military, pilot, multiple, unknown",
  "official_conclusion": "string or null",
  "summary_one_line": "<=160 chars, a single evocative-but-factual sentence",
  "summary_paragraph": "3-5 sentences: what happened, who reported it, the official conclusion"
}"""


def _ocr_for_case(case_id: str) -> tuple[str, str]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT ocr_text FROM pages WHERE case_id=%s ORDER BY page_number",
            (case_id,),
        ).fetchall()
    text = "\n".join((r[0] or "") for r in rows).strip()
    sha = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return text[:MAX_CHARS], sha


def _case_quality(case_id: str) -> tuple[str, str | None]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT ocr_quality, ocr_text_sha FROM cases WHERE case_id=%s", (case_id,)
        ).fetchone()
    return (row[0] if row else "none"), (row[1] if row else None)


def _call_claude(client, user_prompt: str, guard: CostGuard) -> str:
    resp = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=900,
        system=SYSTEM,
        messages=[{"role": "user", "content": user_prompt}],
    )
    usage = resp.usage
    guard.record("extract", settings.anthropic_model,
                 usage.input_tokens, usage.output_tokens)
    return "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")


def _parse(raw: str, case_id: str) -> CaseExtraction:
    start, end = raw.find("{"), raw.rfind("}")
    if start == -1 or end == -1:
        raise ValidationError.from_exception_data("CaseExtraction", [])
    data = json.loads(raw[start : end + 1])
    data["case_id"] = case_id
    return CaseExtraction(**data)


def extract_case(case_id: str, client, guard: CostGuard) -> bool:
    if is_done(case_id, "extract"):
        return True

    quality, prev_sha = _case_quality(case_id)
    text, sha = _ocr_for_case(case_id)

    # Poor / no OCR -> no fabricated summary. UI shows the incomplete-text state.
    if quality in ("poor", "none") or len(text) < 120:
        with get_conn() as conn:
            conn.execute(
                """UPDATE cases SET summary_available=FALSE, ocr_text_sha=%s,
                   is_unidentified=TRUE, updated_at=now() WHERE case_id=%s""",
                (sha, case_id),
            )
        mark(case_id, "extract", "skipped", "poor/insufficient OCR -> no summary")
        return True

    # Cache: unchanged OCR text and we already have a summary -> never re-pay.
    if prev_sha == sha:
        with get_conn() as conn:
            has = conn.execute(
                "SELECT summary_available FROM cases WHERE case_id=%s", (case_id,)
            ).fetchone()
        if has and has[0]:
            mark(case_id, "extract", "done", "cache hit (ocr unchanged)")
            return True

    prompt = f"{SCHEMA_HINT}\n\nOCR TEXT OF CASE {case_id}:\n\"\"\"\n{text}\n\"\"\""

    extraction: CaseExtraction | None = None
    last_err = ""
    for attempt in range(2):  # initial + one retry
        try:
            raw = _call_claude(
                client,
                prompt if attempt == 0
                else f"{prompt}\n\nYour previous reply failed validation: {last_err}. "
                     f"Return ONLY valid JSON matching the schema exactly.",
                guard,
            )
            extraction = _parse(raw, case_id)
            break
        except (ValidationError, json.JSONDecodeError, ValueError) as exc:
            last_err = str(exc)[:300]

    if extraction is None:
        with get_conn() as conn:
            conn.execute(
                "UPDATE cases SET extraction_error=%s, updated_at=now() WHERE case_id=%s",
                (last_err, case_id),
            )
        mark(case_id, "extract", "failed", f"validation failed twice: {last_err}")
        return False

    lat, lon = geocode(extraction.location.city, extraction.location.state)
    with get_conn() as conn:
        conn.execute(
            """
            UPDATE cases SET
                event_date = %s, date_text = %s, city = %s, state = %s,
                latitude = %s, longitude = %s, shape = %s, duration = %s,
                witness_type = %s, official_conclusion = %s,
                summary_one_line = %s, summary_paragraph = %s,
                summary_available = TRUE, ocr_text_sha = %s,
                extraction_error = NULL, updated_at = now()
            WHERE case_id = %s
            """,
            (
                extraction.date, extraction.date, extraction.location.city,
                extraction.location.state, lat, lon, extraction.shape,
                extraction.duration, extraction.witness_type,
                extraction.official_conclusion, extraction.summary_one_line,
                extraction.summary_paragraph, sha, case_id,
            ),
        )
    mark(case_id, "extract", "done", "extracted + summarized")
    return True
