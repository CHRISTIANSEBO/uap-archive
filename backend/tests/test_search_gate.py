"""The semantic-search gate: queries shorter than MIN_QUERY_LEN are not treated
as semantic (they skip the embedding call). Pure-logic test, no DB."""
from __future__ import annotations

from backend.app.main import MIN_QUERY_LEN


def _is_semantic(q: str) -> bool:
    # Mirrors the gate used in main.search(): trimmed length >= MIN_QUERY_LEN.
    return len(q.strip()) >= MIN_QUERY_LEN


def test_default_threshold_is_two():
    assert MIN_QUERY_LEN == 2


def test_short_and_whitespace_queries_are_not_semantic():
    assert _is_semantic("") is False
    assert _is_semantic("   ") is False
    assert _is_semantic("a") is False
    assert _is_semantic("  x  ") is False


def test_two_char_query_is_semantic():
    assert _is_semantic("ok") is True
    assert _is_semantic(" disc ") is True
