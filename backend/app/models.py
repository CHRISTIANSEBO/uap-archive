"""Pydantic models — the validated data contract for LLM extraction and the API."""
from __future__ import annotations

from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

WitnessType = Literal["civilian", "military", "pilot", "multiple", "unknown"]
Shape = Literal[
    "disc", "light", "sphere", "cigar", "triangle", "oval", "fireball",
    "cylinder", "formation", "other", "unknown",
]


class Location(BaseModel):
    city: Optional[str] = None
    state: Optional[str] = None  # 2-letter US state where applicable


class CaseExtraction(BaseModel):
    """Strict schema the LLM must produce. Validation failure -> retry once -> mark failed."""

    case_id: str
    date: Optional[str] = Field(
        None, description="ISO date YYYY-MM-DD if known, else null"
    )
    location: Location = Location()
    shape: Shape = "unknown"
    duration: Optional[str] = None
    witness_type: WitnessType = "unknown"
    official_conclusion: Optional[str] = None
    summary_one_line: str = Field(..., max_length=160)
    summary_paragraph: str = Field(..., min_length=20, max_length=1200)

    @field_validator("date")
    @classmethod
    def _valid_date(cls, v: Optional[str]) -> Optional[str]:
        if v in (None, "", "null", "unknown"):
            return None
        try:
            date.fromisoformat(v)
        except ValueError:
            # Keep as raw text upstream; don't hard-fail extraction on a fuzzy date.
            return None
        return v


# ---------------- API response models ----------------

class MatchedCase(BaseModel):
    case_id: str
    score: float
    summary_one_line: Optional[str]
    date: Optional[str]
    city: Optional[str]
    state: Optional[str]
    shape: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    thumbnail_url: Optional[str]
    matched_excerpt: Optional[str]
    matched_page: Optional[int]
    summary_available: bool
    source_url: str


class SearchResponse(BaseModel):
    query: str
    count: int
    results: list[MatchedCase]


class PageOut(BaseModel):
    page_number: int
    ocr_text: Optional[str]
    ocr_confidence: Optional[float]
    needs_review: bool
    image_url: Optional[str]
    source_url: str


class CaseDetail(BaseModel):
    case_id: str
    title_raw: Optional[str]
    date: Optional[str]
    date_text: Optional[str]
    city: Optional[str]
    state: Optional[str]
    country: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    shape: Optional[str]
    duration: Optional[str]
    witness_type: Optional[str]
    official_conclusion: Optional[str]
    summary_one_line: Optional[str]
    summary_paragraph: Optional[str]
    summary_available: bool
    ocr_quality: Optional[str]
    source_url: str
    nara_origin: Optional[str]
    pages: list[PageOut]
    citation: str  # "Case {id} — {archive link}"


class StatsResponse(BaseModel):
    total_cases: int
    by_decade: dict[str, int]
    by_state: dict[str, int]
    by_shape: dict[str, int]
    needs_review_pages: int
