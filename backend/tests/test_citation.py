"""Test the citation string helper. Importing the app module must not touch the DB
(the connection pool is lazy), so this stays a pure unit test."""
from __future__ import annotations

from backend.app.main import _citation, ARCHIVE_ITEM


def test_citation_format():
    cid = "1952-07-19-WASHINGTON"
    out = _citation(cid)
    assert out == f"Case {cid} — {ARCHIVE_ITEM.format(cid=cid)}"
    assert out.startswith(f"Case {cid} — ")
    assert "archive.org/details/" in out


def test_citation_embeds_exact_case_id():
    cid = "abc123"
    assert cid in _citation(cid)
    assert _citation(cid).endswith(f"archive.org/details/{cid}")
