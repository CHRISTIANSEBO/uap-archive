"""Stage 2 — OCR.

Render each PDF page to an image (pdftoppm), OCR with Tesseract, store per-page text +
mean word confidence. Pages below the confidence threshold (default 60%) are flagged
needs_review rather than silently ingested as garbage.

Idempotent: skips cases already OCR'd. Sets case.ocr_quality (good/poor/none).
"""
from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

import pytesseract
from PIL import Image

from backend.app.config import get_settings
from backend.app.db import get_conn
from .state import mark, is_done

settings = get_settings()
DL = "https://archive.org/download/{cid}/{name}"


def _pdf_to_images(pdf_path: Path, out_dir: Path) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    prefix = out_dir / "page"
    subprocess.run(
        ["pdftoppm", "-png", "-r", str(settings.ocr_dpi), str(pdf_path), str(prefix)],
        check=True,
        capture_output=True,
    )
    return sorted(out_dir.glob("page*.png"))


def _ocr_image(img_path: Path) -> tuple[str, float]:
    data = pytesseract.image_to_data(
        Image.open(img_path), output_type=pytesseract.Output.DICT
    )
    words, confs = [], []
    for text, conf in zip(data["text"], data["conf"]):
        try:
            c = float(conf)
        except (TypeError, ValueError):
            continue
        if text.strip() and c >= 0:
            words.append(text)
            confs.append(c)
    mean_conf = sum(confs) / len(confs) if confs else 0.0
    return " ".join(words), round(mean_conf, 2)


def ocr_case(case_id: str) -> bool:
    if is_done(case_id, "ocr"):
        return True
    pdf_path = settings.raw_dir / case_id / "document.pdf"
    if not pdf_path.exists():
        mark(case_id, "ocr", "failed", "missing document.pdf")
        return False
    try:
        img_dir = settings.raw_dir / case_id / "pages"
        images = _pdf_to_images(pdf_path, img_dir)
        if not images:
            mark(case_id, "ocr", "failed", "pdftoppm produced no pages")
            _set_quality(case_id, "none")
            return False

        page_confs: list[float] = []
        with get_conn() as conn:
            for i, img in enumerate(images, start=1):
                text, conf = _ocr_image(img)
                needs_review = conf < settings.ocr_confidence_threshold
                page_confs.append(conf)
                rel_img = str(img.relative_to(settings.data_dir))
                conn.execute(
                    """
                    INSERT INTO pages (case_id, page_number, ocr_text, ocr_confidence,
                                       needs_review, image_path, source_url)
                    VALUES (%s,%s,%s,%s,%s,%s,%s)
                    ON CONFLICT (case_id, page_number) DO UPDATE
                    SET ocr_text=EXCLUDED.ocr_text,
                        ocr_confidence=EXCLUDED.ocr_confidence,
                        needs_review=EXCLUDED.needs_review,
                        image_path=EXCLUDED.image_path
                    """,
                    (case_id, i, text, conf, needs_review, rel_img,
                     f"https://archive.org/details/{case_id}"),
                )

        # Case-level OCR quality: 'good' if a usable fraction of pages passed.
        good_pages = [c for c in page_confs if c >= settings.ocr_confidence_threshold]
        if not page_confs:
            quality = "none"
        elif len(good_pages) >= max(1, len(page_confs) // 2):
            quality = "good"
        else:
            quality = "poor"
        _set_quality(case_id, quality)

        mark(case_id, "ocr", "done",
             f"{len(images)} pages, {len(good_pages)} above threshold")
        return True
    except Exception as exc:  # noqa: BLE001
        mark(case_id, "ocr", "failed", str(exc)[:400])
        return False


def _set_quality(case_id: str, quality: str) -> None:
    with get_conn() as conn:
        conn.execute(
            "UPDATE cases SET ocr_quality=%s, updated_at=now() WHERE case_id=%s",
            (quality, case_id),
        )
