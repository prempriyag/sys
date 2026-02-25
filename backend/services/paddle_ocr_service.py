"""
PaddleOCR service for high-accuracy extraction from scanned electoral roll PDFs.
Targets 90%+ accuracy on scanned documents.
"""
import io
import os
import re
import logging

# Skip model host connectivity check on startup (speeds up init)
os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

# Optional PaddleOCR - gracefully degrade if not installed
_PADDLE_AVAILABLE = False
_paddle_ocr = None

try:
    import numpy as np
    from paddleocr import PaddleOCR

    # PaddleOCR 3.x uses model-based API; lang="en" for English
    _paddle_ocr = PaddleOCR(lang="en")
    _PADDLE_AVAILABLE = True
    logger.info("PaddleOCR initialized successfully for scanned PDF extraction")
except ImportError as e:
    logger.warning(
        "PaddleOCR not installed. Install with: pip install paddlepaddle paddleocr"
    )
except Exception as e:
    logger.warning("PaddleOCR initialization failed: %s", e)


def is_available() -> bool:
    """Return True if PaddleOCR is available."""
    return _PADDLE_AVAILABLE and _paddle_ocr is not None


def _sort_ocr_results(result) -> List[tuple]:
    """Sort OCR results by reading order. Handles PaddleOCR 2.x/3.x result formats."""
    if not result:
        return []
    # PaddleOCR 2.x: result is list of pages, result[0] = list of [box, (text, conf)]
    # PaddleOCR 3.x: result may be dict or list; normalize to list of lines
    lines_raw = None
    if isinstance(result, list) and result:
        first = result[0]
        if isinstance(first, list):
            lines_raw = first
        elif isinstance(first, dict) and "rec_texts" in first:
            # 3.x pipeline format
            dt_boxes = first.get("dt_polys", first.get("dt_boxes", []))
            rec_texts = first.get("rec_texts", [])
            rec_scores = first.get("rec_scores", [1.0] * len(rec_texts))
            items = []
            for i, txt in enumerate(rec_texts):
                box = dt_boxes[i] if i < len(dt_boxes) else [[0, 0], [100, 0], [100, 20], [0, 20]]
                conf = rec_scores[i] if i < len(rec_scores) else 1.0
                if txt and str(txt).strip():
                    y_c = sum(p[1] for p in box) / 4 if len(box) >= 4 else 0
                    x_c = sum(p[0] for p in box) / 4 if len(box) >= 4 else 0
                    items.append((y_c, x_c, str(txt).strip(), float(conf)))
            items.sort(key=lambda x: (round(x[0] / 20) * 20, x[1]))
            return items
    if lines_raw is None:
        lines_raw = result[0] if isinstance(result, list) and result else []
    items = []
    for line in (lines_raw or []):
        if not line or len(line) < 2:
            continue
        try:
            box, text_conf = line[0], line[1]
            text = text_conf[0] if isinstance(text_conf, (list, tuple)) else text_conf
            conf = text_conf[1] if isinstance(text_conf, (list, tuple)) and len(text_conf) > 1 else 1.0
        except (IndexError, TypeError):
            continue
        if not text or not str(text).strip():
            continue
        y_center = sum(p[1] for p in box) / 4 if box else 0
        x_center = sum(p[0] for p in box) / 4 if box else 0
        items.append((y_center, x_center, str(text).strip(), float(conf)))
    items.sort(key=lambda x: (round(x[0] / 20) * 20, x[1]))
    return items


def _items_to_blocks(items: List[tuple], line_gap_threshold: float = 15.0) -> str:
    """Convert sorted OCR items to text. Uses smaller gap for grid layout."""
    if not items:
        return ""
    lines = []
    current_block = []
    prev_y = None

    for y, x, text, conf in items:
        if prev_y is not None and (y - prev_y) > line_gap_threshold:
            if current_block:
                lines.append(" ".join(current_block))
                current_block = []
        current_block.append(text)
        prev_y = y

    if current_block:
        lines.append(" ".join(current_block))
    text = "\n\n".join(lines)
    epic_count = len(re.findall(r"\b[A-Za-z]{2,6}[0-9OoIl]{5,12}\b", text))
    if epic_count >= 2 and text.count("\n\n") < 2:
        return text.replace("\n\n", " ")
    return text


def _parse_ocr_text_to_records(text: str) -> List[Dict[str, Any]]:
    """
    Parse OCR text into voter records for grid-format electoral roll cards.
    Extracts: card_no, epic_number, name, relation_type, relative_name, age, gender, house_no.
    Supports both paragraph-style blocks and grid layout (splits by EPIC when multiple per block).
    """
    records = []
    epic_re = re.compile(r"\b([A-Za-z]{2,6}[0-9OoIl]{5,12})\b", re.I)
    # First split by double newlines (paragraph-style)
    raw_blocks = re.split(r"\n\s*\n", text)
    blocks = []
    for raw in raw_blocks:
        raw = raw.strip()
        if not raw:
            continue
        # Grid layout: one block may contain multiple cards (multiple EPICs). Split by EPIC.
        epic_matches = list(epic_re.finditer(raw))
        if len(epic_matches) <= 1:
            blocks.append(raw)
            continue
        for i, match in enumerate(epic_matches):
            start = match.start()
            end = epic_matches[i + 1].start() if i + 1 < len(epic_matches) else len(raw)
            blocks.append(raw[start:end].strip())
    for block in blocks:
        block = block.strip()
        if not block:
            continue
        m = epic_re.search(block)
        if not m:
            continue
        raw = m.group(1).upper().replace("/", "").replace("O", "0").replace("I", "1").replace("L", "1")
        epic = re.sub(r"[^A-Z0-9]", "", raw)
        if len(epic) < 7:
            continue
        name = ""
        name_m = re.search(
            r"(?<!\bFather\s)(?<!\bMother\s)(?<!\bHusband\s)(?<!\bFather's\s)(?<!\bMother's\s)(?<!\bHusband's\s)Name\s*[:\-]?\s*(.+?)(?=\s*(?:Father|Mother|Husband)(?:'s)?\s*Name|House\s*(?:No\.?|Number)|Age\s*[:\-]?|\bMale\b|\bFemale\b|Photo|$)",
            block, re.I | re.DOTALL
        )
        if name_m:
            name = name_m.group(1).strip().split("\n")[0].strip()
        if not name:
            name_m2 = re.search(r"^Name\s*[:\-]?\s*(.+?)$", block, re.I | re.MULTILINE)
            if name_m2:
                name = name_m2.group(1).strip().split("\n")[0].strip()
        relation_type = ""
        relative_name = ""
        rel_m = re.search(
            r"(Father|Mother|Husband)(?:'s)?\s*Name\s*[:\-]?\s*(.+)", block, re.I
        )
        if rel_m:
            relation_type = rel_m.group(1).strip()
            raw = rel_m.group(2).strip()
            relative_name = _take_until_label(raw, r"\s*House\s*(?:No\.?|Number)|Age|\bMale\b|\bFemale\b|Photo")
        if not relative_name and rel_m:
            relative_name = rel_m.group(2).strip().split("\n")[0].strip()
        house_m = re.search(
            r"House\s*(?:No\.?|Number)?\s*[:\-]?\s*([^\n]+)", block, re.I
        )
        house_no = house_m.group(1).strip().split("\n")[0].strip() if house_m else ""
        age = None
        age_m = re.search(r"Age\s*[:\-]?\s*(\d+)", block, re.I)
        if age_m:
            try:
                age = int(age_m.group(1))
            except (ValueError, TypeError):
                pass
        gender = ""
        if re.search(r"\bMale\b", block, re.I):
            gender = "Male"
        elif re.search(r"\bFemale\b", block, re.I):
            gender = "Female"
        card_no = None
        serial_m = re.search(r"^\s*(\d{2,5})\b", block) or re.search(r"\b(\d{2,5})\s*(?=[A-Z]{2,5}\d{5,10}\b)", block)
        if serial_m:
            try:
                card_no = int(serial_m.group(1))
                if card_no < 1 or card_no > 99999:
                    card_no = None
            except (ValueError, TypeError):
                pass
        # Keep record if we have at least EPIC (output partial data rather than empty CSV)
        records.append(
            {
                "card_no": card_no,
                "epic_number": epic,
                "name": _preserve_name(name),
                "relation_type": relation_type,
                "relative_name": _preserve_name(relative_name),
                "age": age,
                "gender": gender,
                "house_no": _clean_house(house_no),
                "address": "",
            }
        )
    return records


def _take_until_label(text: str, stop_pattern: str) -> str:
    """Extract text until a label pattern (Father/Mother/Husband Name, House No, etc.)."""
    if not text:
        return ""
    m = re.search(stop_pattern, text, re.I)
    return text[: m.start()].strip() if m else text.strip()


def _preserve_name(value: str) -> str:
    """Preserve original casing; normalize whitespace only (for 100% accurate extraction)."""
    if not value or not isinstance(value, str):
        return ""
    return " ".join(value.split())


def _clean_field(value: str) -> str:
    if not value or not isinstance(value, str):
        return ""
    value = value.strip().upper()
    value = re.sub(r"[^\w\s\-]", "", value, flags=re.IGNORECASE)
    return " ".join(value.split())


def _clean_house(value: str) -> str:
    if not value or not isinstance(value, str):
        return ""
    value = value.strip()
    value = re.sub(
        r"\s*Photo\s*(?:Available|Not|Submitted)?\s*$", "", value, flags=re.IGNORECASE
    )
    value = re.sub(
        r"^\s*Photo\s*(?:Available|Not|Submitted)?\s*", "", value, flags=re.IGNORECASE
    )
    return value.strip()


def ocr_image_to_records(
    image,
) -> List[Dict[str, Any]]:
    """
    Run PaddleOCR on a single PIL Image and return list of voter record dicts.
    image: PIL.Image
    """
    if not _PADDLE_AVAILABLE or _paddle_ocr is None:
        return []
    try:
        if hasattr(image, "mode") and image.mode != "RGB":
            image = image.convert("RGB")
        img_array = np.array(image)
        result = _paddle_ocr.ocr(img_array, cls=True)
        items = _sort_ocr_results(result)
        text = _items_to_blocks(items)
        return _parse_ocr_text_to_records(text)
    except Exception as e:
        logger.exception("PaddleOCR image extraction failed: %s", e)
        return []


def ocr_pdf_bytes_to_records(
    content: bytes,
    convert_from_bytes=None,
    dpi: int = 200,
    crop_top: float = 0.06,
    crop_bottom: float = 0.04,
    max_pages: int = 0,
) -> List[Dict[str, Any]]:
    """
    Convert scanned PDF bytes to voter records using PaddleOCR.
    Processes a single page only (first content page) by default.

    Args:
        content: Raw PDF bytes
        convert_from_bytes: pdf2image.convert_from_bytes function (caller provides to avoid import in this module)
        dpi: DPI for PDF-to-image conversion (higher = better quality, slower)
        crop_top: Fraction of page height to crop from top (header)
        crop_bottom: Fraction of page height to crop from bottom (footer)
        max_pages: Max pages to process (1 = first content page only, 0 = all pages)

    Returns:
        List of voter record dicts with keys: epic_number, name, relative_name, age, gender, house_no, address
    """
    if not _PADDLE_AVAILABLE or _paddle_ocr is None or not convert_from_bytes:
        return []
    if not content:
        return []
    try:
        images = convert_from_bytes(content, dpi=dpi)
        all_records = []
        seen_epics = set()
        pages_processed = 0
        # For single-page PDF, process page 0. For multi-page, skip cover (page 0).
        skip_first = len(images) > 1
        for page_idx, page in enumerate(images):
            if skip_first and page_idx < 1:
                continue
            if max_pages > 0 and pages_processed >= max_pages:
                break
            w, h = page.size
            top = int(h * crop_top)
            bottom = int(h * crop_bottom)
            cropped = page.crop((0, top, w, h - bottom))
            page_records = ocr_image_to_records(cropped)
            for r in page_records:
                epic = r.get("epic_number", "")
                if epic and epic not in seen_epics:
                    seen_epics.add(epic)
                    all_records.append(r)
            pages_processed += 1
        return all_records
    except Exception as e:
        logger.exception("PaddleOCR PDF extraction failed: %s", e)
        return []
