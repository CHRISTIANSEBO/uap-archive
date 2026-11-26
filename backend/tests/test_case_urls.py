"""Regression tests for safe case URLs and social metadata rendering."""

from urllib.parse import quote

from backend.app.main import _citation, _iiif_page_url, _set_meta, _esc


def test_case_citation_encodes_reserved_characters():
    case_id = "case A/#1"
    assert _citation(case_id).endswith(
        "https://archive.org/details/" + quote(case_id, safe="")
    )


def test_iiif_url_encodes_case_id_but_keeps_page_selector():
    url = _iiif_page_url("case A/#1", page_number=3)
    assert "case%20A%2F%231$2/full/1000," in url


def test_social_meta_escapes_markup_and_preserves_backslashes():
    html = '<head><meta property="og:title" content="old" /></head>'
    updated = _set_meta(html, "property", "og:title", 'A\\B & "quoted" <title>')
    assert 'content="A\\B &amp; &quot;quoted&quot; &lt;title&gt;"' in updated


def test_html_escape_handles_attribute_delimiters():
    assert _esc('A & "B" <C>') == 'A &amp; &quot;B&quot; &lt;C&gt;'
