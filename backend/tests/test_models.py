"""Unit tests for the validated data contract (no DB, no network)."""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from backend.app.models import CaseExtraction, Location


def _base(**overrides):
    data = {
        "case_id": "1949-05-6311606-ROANOKE-",
        "summary_one_line": "Two pilots reported a fast disc over Roanoke.",
        "summary_paragraph": (
            "On a clear evening two Air Force pilots observed a bright disc-shaped "
            "object that paced their aircraft before accelerating out of sight."
        ),
    }
    data.update(overrides)
    return data


def test_minimal_valid_extraction():
    c = CaseExtraction(**_base())
    assert c.case_id.startswith("1949")
    # Defaults fall back to safe, known values.
    assert c.shape == "unknown"
    assert c.witness_type == "unknown"
    assert c.date is None
    assert isinstance(c.location, Location)


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("1952-07-19", "1952-07-19"),
        ("", None),
        ("null", None),
        ("unknown", None),
        (None, None),
        ("not-a-date", None),   # fuzzy/garbage date -> None, not a hard failure
        ("1952-13-40", None),   # out-of-range -> None
    ],
)
def test_date_validator_normalizes(raw, expected):
    c = CaseExtraction(**_base(date=raw))
    assert c.date == expected


def test_summary_one_line_length_capped():
    with pytest.raises(ValidationError):
        CaseExtraction(**_base(summary_one_line="x" * 161))


def test_summary_paragraph_min_length_enforced():
    with pytest.raises(ValidationError):
        CaseExtraction(**_base(summary_paragraph="too short"))


def test_invalid_shape_rejected():
    with pytest.raises(ValidationError):
        CaseExtraction(**_base(shape="banana"))


def test_invalid_witness_type_rejected():
    with pytest.raises(ValidationError):
        CaseExtraction(**_base(witness_type="alien"))


def test_location_accepts_partial():
    loc = Location(state="NM")
    assert loc.state == "NM"
    assert loc.city is None
