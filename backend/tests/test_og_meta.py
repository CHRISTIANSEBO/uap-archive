"""Unit tests for the Open Graph meta injection helper used to give shared
/case/:id links a rich preview. Pure string ops, no DB."""
from __future__ import annotations

from backend.app.main import _esc, _set_meta

HEAD = (
    "<!doctype html><html><head>"
    '<meta property="og:title" content="Default Title" />'
    '<meta name="twitter:card" content="summary" />'
    "</head><body></body></html>"
)


def test_replaces_existing_meta_value():
    out = _set_meta(HEAD, "property", "og:title", "New Case Title")
    assert '<meta property="og:title" content="New Case Title" />' in out
    assert "Default Title" not in out
    # Only the targeted tag changes.
    assert '<meta name="twitter:card" content="summary" />' in out


def test_appends_missing_meta_before_head_close():
    out = _set_meta(HEAD, "property", "og:image", "https://ex/img.jpg")
    assert '<meta property="og:image" content="https://ex/img.jpg" />' in out
    assert out.count("</head>") == 1
    # Appended tag sits inside the head, before the closing tag.
    assert out.index("og:image") < out.index("</head>")


def test_upgrades_twitter_card_to_large_image():
    out = _set_meta(HEAD, "name", "twitter:card", "summary_large_image")
    assert '<meta name="twitter:card" content="summary_large_image" />' in out


def test_escapes_html_special_chars():
    assert _esc('a "b" <c> & d') == "a &quot;b&quot; &lt;c&gt; &amp; d"


def test_injected_value_is_escaped():
    out = _set_meta(HEAD, "property", "og:title", 'Quote " and <tag>')
    assert "&quot;" in out and "&lt;tag&gt;" in out
    # No raw unescaped injected quote breaks the attribute.
    assert 'content="Quote " and' not in out
