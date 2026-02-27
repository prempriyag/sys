"""
Electoral Roll PDF Extractor - SIR Data Acquisition Module
Per SOP Section 3: Data Acquisition & Standardization.
Parses ECI-style electoral roll PDFs (e.g. SIR Draft Roll) and returns
standardized rows for database ingestion.

If the PDF has no text layer (scanned/image PDF), use --ocr when running
the CLI script (requires: pip install pdf2image pytesseract, and Tesseract installed).

--------------------------------------------------------------------------------
TN ECI ELECTORAL ROLL - FIELD REFERENCE (from sample PDF)
--------------------------------------------------------------------------------
FIRST PAGE (Cover):
  - Document title: ELECTORAL ROLL 2026 S22 Tamil Nadu
  - Assembly Constituency No and Name: 11- DR.RADHAKRISHNAN NAGAR (GEN)
  - Part No.: 20
  - Parliamentary Constituency: 2- CHENNAI NORTH (GEN)
  - 1. Details of Revision:
      Year of Revision, Qualifying Date, Type of revision, Date of Publication
      Roll Identification: Basic Roll SSR, 2026
  - 2. Details of part and polling area:
      No. and name of sections in the part (list 1-6)
      Main Town or Village, Ward no., Post Office, Police Station, Block,
      Subdivision, District, Pin code
  - 3. Polling station details:
      No. and Name of Polling Station, Address of Polling Station,
      Type of Polling Station (Male/Female/General),
      Number of Auxiliary Polling Stations in this part
  - 4. NUMBER OF ELECTORS:
      Starting Serial No., Ending Serial No.
      Net Electors: Male, Female, Third Gender, Total
  - Footer: Signature, Total Pages N - Page M

DATA PAGES (Voter cards per section):
  - Header: Assembly Constituency No and Name, Section No and Name, Part No.
  - Per voter: Serial, EPIC, Name, Father/Husband/Mother Name,
    House Number, Age, Gender, Photo Available

SUMMARY PAGE (last):
  - SUMMARY OF ELECTORS, Roll Type, Roll Identification, NUMBER OF ELECTORS table
--------------------------------------------------------------------------------
"""
import re
import json
import logging
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)


def _get_debug_config() -> Optional[Dict[str, Any]]:
    """
    Optional diagnostic logging for one page and one card.
    Set EXTRACT_DEBUG=1, EXTRACT_DEBUG_PAGE=3, EXTRACT_DEBUG_CARD=0 (defaults).
    Outputs: debug/full_page_ocr_*.json, epic_detection_*.json, card_01.png, card_01_ocr.txt,
             parsed_record.json, expected_record.json (template).
    """
    if os.getenv("EXTRACT_DEBUG", "").strip().lower() not in ("1", "true", "yes"):
        return None
    try:
        page = int(os.getenv("EXTRACT_DEBUG_PAGE", "3"))
        card = int(os.getenv("EXTRACT_DEBUG_CARD", "0"))
    except ValueError:
        return None
    debug_dir = Path(os.getenv("EXTRACT_DEBUG_DIR", "debug"))
    return {"debug_page": page, "debug_card_index": card, "debug_dir": debug_dir}


_TESSERACT_HELP = (
    "Tesseract OCR is not installed or not in PATH. "
    "Install Tesseract and either add it to PATH, or set TESSERACT_CMD to the full path "
    r"(example: C:\Program Files\Tesseract-OCR\tesseract.exe)."
)

# Common Windows install paths (used when TESSERACT_CMD is not set).
_TESSERACT_WINDOWS_PATHS = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
)


def _configure_tesseract_cmd() -> None:
    """Configure pytesseract command from env var or common Windows paths."""
    try:
        import pytesseract
    except Exception:
        return
    cmd = (os.getenv("TESSERACT_CMD") or "").strip()
    if cmd and os.path.isfile(cmd):
        pytesseract.pytesseract.tesseract_cmd = cmd
        return
    if sys.platform == "win32":
        for p in _TESSERACT_WINDOWS_PATHS:
            if os.path.isfile(p):
                pytesseract.pytesseract.tesseract_cmd = p
                return


def _require_tesseract() -> None:
    """Fail fast if Tesseract is not available (avoid slow EasyOCR/torch fallbacks)."""
    _configure_tesseract_cmd()
    try:
        import pytesseract
        # This triggers the underlying tesseract binary call.
        pytesseract.get_tesseract_version()
    except Exception as e:
        raise RuntimeError(_TESSERACT_HELP) from e


def _preprocess_image_for_ocr(img) -> "Any":
    """Apply OpenCV preprocessing for better OCR (grayscale, blur, Otsu threshold)."""
    try:
        import cv2
        import numpy as np
        from PIL import Image
    except ImportError:
        return img
    if hasattr(img, "size"):
        arr = np.array(img)
        gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY) if len(arr.shape) == 3 else arr
    else:
        gray = cv2.imread(str(img), cv2.IMREAD_GRAYSCALE)
        if gray is None:
            return img
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    _, thresh = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return Image.fromarray(thresh)


def _enhance_image_for_ocr(img) -> "Any":
    """
    Advanced preprocessing for hybrid pipeline (95%+ target): CLAHE + noise removal + sharpen.
    Use when extraction_config has use_enhance=True. Improves OCR 3-5% on low-contrast scans.
    """
    try:
        import cv2
        import numpy as np
        from PIL import Image
    except ImportError:
        return img
    if hasattr(img, "size"):
        arr = np.array(img)
        gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY) if len(arr.shape) == 3 else arr
    else:
        gray = cv2.imread(str(img), cv2.IMREAD_GRAYSCALE)
        if gray is None:
            return img
    # CLAHE
    try:
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        cl = clahe.apply(gray)
    except Exception:
        cl = gray
    blur = cv2.GaussianBlur(cl, (3, 3), 0)
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]], dtype=np.float32)
    sharp = cv2.filter2D(blur, -1, kernel)
    return Image.fromarray(np.clip(sharp, 0, 255).astype(np.uint8))


def _multi_ocr_vote(img: "Any", configs: Optional[List[str]] = None) -> str:
    """
    Multi-pass OCR voting: run Tesseract with several PSM/OEM configs and return the longest
    cleaned result (reduces single-pass randomness). For hybrid pipeline use_multi_ocr.
    """
    if configs is None:
        configs = ["--oem 3 --psm 6", "--oem 3 --psm 4", "--oem 1 --psm 6"]
    try:
        import pytesseract
    except ImportError:
        return ""
    pil = _img_to_pil(img)
    results = []
    for c in configs:
        try:
            text = pytesseract.image_to_string(pil, config=c)
            results.append(re.sub(r"\s+", " ", (text or "").strip()))
        except Exception:
            results.append("")
    if not results:
        return ""
    return max(results, key=len)


def _img_to_pil(img) -> "Any":
    """Ensure img is a PIL Image (convert from path or numpy if needed)."""
    if hasattr(img, "size"):
        return img
    from PIL import Image
    if isinstance(img, str):
        return Image.open(img)
    import numpy as np
    if isinstance(img, np.ndarray):
        return Image.fromarray(img)
    return img


def _preprocess_card_for_ocr(img) -> "Any":
    """
    Lightweight per-card preprocessing before OCR.
    Keeps details while improving text contrast for small card crops.
    """
    try:
        from PIL import ImageEnhance
    except ImportError:
        return img
    pil = _img_to_pil(img)
    try:
        pil = pil.convert("L")
        pil = ImageEnhance.Contrast(pil).enhance(1.5)
    except Exception:
        return _img_to_pil(img)
    return pil


def _extract_epic_token(text: str) -> Optional[str]:
    """
    Extract a single EPIC-like token from any OCR line (e.g. "667 IVZ2392736").
    """
    if not text:
        return None
    raw = text.strip().upper()
    for tok in re.findall(r"[A-Z0-9/]{5,16}", raw):
        if _looks_like_epic(tok):
            return tok
    m = RE_EPIC_ANYWHERE.search(raw)
    if m:
        return m.group(0).upper().replace(" ", "")
    return None


def _sanitize_block_to_single_voter(block: List[str], max_lines: int = 12) -> List[str]:
    """
    Keep one voter per block by trimming everything after the next EPIC anchor.
    This prevents cross-card field mixing when OCR crop includes neighboring text.
    """
    lines = [ln.strip() for ln in block if ln and ln.strip()]
    if not lines:
        return []
    epic_idx = [i for i, ln in enumerate(lines) if _extract_epic_token(ln)]
    if not epic_idx:
        return lines[:max_lines]
    start = epic_idx[0]
    end = epic_idx[1] if len(epic_idx) > 1 else len(lines)
    return lines[start:end][:max_lines]


def _ocr_page_by_detected_boxes(
    img,
    min_boxes: int = 18,
    max_boxes: int = 80,
) -> List[List[str]]:
    """
    Contour-based per-box OCR.
    Reads one detected card box at a time and returns blocks in row-major order.
    """
    try:
        import pytesseract
    except ImportError:
        return []

    pil_img = _img_to_pil(img)
    w_page, h_page = pil_img.size
    boxes = _detect_voter_boxes_adaptive(pil_img)
    if not boxes or len(boxes) < min_boxes or len(boxes) > max_boxes:
        return []

    # Group boxes into visual rows (then left->right inside row).
    median_h = sorted(b[3] for b in boxes)[len(boxes) // 2] if boxes else 20
    y_threshold = max(10, int(median_h * 0.6))
    rows: List[List[Tuple[int, int, int, int]]] = []
    for bx in sorted(boxes, key=lambda b: (b[1], b[0])):
        if not rows:
            rows.append([bx])
            continue
        prev_row_y = min(r[1] for r in rows[-1])
        if abs(bx[1] - prev_row_y) <= y_threshold:
            rows[-1].append(bx)
        else:
            rows.append([bx])
    ordered_boxes: List[Tuple[int, int, int, int]] = []
    for row in rows:
        ordered_boxes.extend(sorted(row, key=lambda b: b[0]))

    blocks: List[List[str]] = []
    for x, y, w, h in ordered_boxes:
        pad_x = max(2, int(w * 0.02))
        pad_y = max(2, int(h * 0.03))
        x0 = max(0, x - pad_x)
        y0 = max(0, y - pad_y)
        x1 = min(w_page, x + w + pad_x)
        y1 = min(h_page, y + h + pad_y)
        crop = pil_img.crop((x0, y0, x1, y1))
        crop = _preprocess_card_for_ocr(crop)
        text = pytesseract.image_to_string(crop, config=TESSERACT_CARD_CONFIG)
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        lines = _sanitize_block_to_single_voter(lines)
        if lines:
            blocks.append(lines)
    return blocks


def _cluster_x_into_columns(words: List[dict], num_cols: int) -> List[List[dict]]:
    """
    Assign words to columns using dynamic gap-based X clustering.

    Instead of equal-width zones (fragile with skewed scans), we:
    1. Sort all word X-centres.
    2. Find the (num_cols - 1) largest gaps between consecutive centres.
    3. Use those gaps as column boundaries.

    This handles slight card misalignment and scan skew robustly.
    """
    if not words or num_cols <= 1:
        return [words] if words else [[] for _ in range(num_cols)]

    centers = sorted(set(w["x"] + w["w"] // 2 for w in words))
    if len(centers) < num_cols:
        # Fallback: equal split by page width
        if not words:
            return [[] for _ in range(num_cols)]
        max_x = max(w["x"] + w["w"] for w in words)
        col_width = max(1, max_x // num_cols)
        cols: List[List[dict]] = [[] for _ in range(num_cols)]
        for w in words:
            cx = w["x"] + w["w"] // 2
            cols[min(cx // col_width, num_cols - 1)].append(w)
        return cols

    # Find largest gaps between consecutive X-centres
    gaps = [(centers[i + 1] - centers[i], centers[i], centers[i + 1])
            for i in range(len(centers) - 1)]
    gaps.sort(key=lambda g: -g[0])
    # Take the (num_cols - 1) largest gaps as split boundaries
    boundaries = sorted([(lo + hi) // 2 for _, lo, hi in gaps[: num_cols - 1]])

    cols = [[] for _ in range(num_cols)]
    for w in words:
        cx = w["x"] + w["w"] // 2
        col_idx = sum(1 for b in boundaries if cx >= b)
        cols[min(col_idx, num_cols - 1)].append(w)
    return cols


def _cluster_words_into_lines_scipy(col_words: List[dict], y_threshold: float = 8.0) -> List[List[dict]]:
    """
    Group words into text lines using scipy hierarchical clustering on Y position.
    Used by OCR PDF Detector when scipy is available; same idea as Docling line grouping.
    """
    try:
        import numpy as np
        from scipy.cluster.hierarchy import fclusterdata  # type: ignore
    except ImportError:
        return []

    if not col_words:
        return []

    # Use word top-Y (or centre-Y) for clustering
    ys = np.array([w["y"] + w["h"] // 2 for w in col_words], dtype=float).reshape(-1, 1)
    labels = fclusterdata(ys, t=float(y_threshold), criterion="distance", metric="euclidean")
    by_label: Dict[int, List[dict]] = {}
    for w, lab in zip(col_words, labels):
        by_label.setdefault(int(lab), []).append(w)
    # Order lines by min Y, then sort words left-to-right within each line
    ordered = sorted(by_label.values(), key=lambda group: min(w["y"] for w in group))
    for group in ordered:
        group.sort(key=lambda w: w["x"])
    return ordered


def _cluster_words_into_lines(col_words: List[dict]) -> List[List[dict]]:
    """
    Group words into text lines using vertical overlap (not absolute Y gap).
    Uses scipy when available (OCR PDF Detector flow); otherwise overlap-based fallback.

    Two words belong to the same line if their vertical extents overlap:
        overlap = min(y1+h1, y2+h2) - max(y1, y2) > 0

    This handles tall characters (e.g. "Father Name:") that shift the top-Y
    slightly, which would break a fixed y_gap threshold.
    Falls back to a generous y_gap (half the median word height) when overlap
    is zero but words are very close.
    """
    if not col_words:
        return []

    # Prefer scipy-based line clustering when available (same idea as Docling)
    heights = [w["h"] for w in col_words if w["h"] > 0]
    median_h = sorted(heights)[len(heights) // 2] if heights else 20
    y_threshold = max(6.0, median_h * 0.4)
    scipy_lines = _cluster_words_into_lines_scipy(col_words, y_threshold=y_threshold)
    if scipy_lines:
        return scipy_lines

    col_words = sorted(col_words, key=lambda w: (w["y"], w["x"]))
    fallback_gap = max(4, median_h // 2)

    lines: List[List[dict]] = []
    current: List[dict] = [col_words[0]]

    for w in col_words[1:]:
        prev = current[-1]
        overlap = min(prev["y"] + prev["h"], w["y"] + w["h"]) - max(prev["y"], w["y"])
        gap = w["y"] - (prev["y"] + prev["h"])
        if overlap > 0 or gap <= fallback_gap:
            current.append(w)
        else:
            lines.append(current)
            current = [w]
    lines.append(current)
    return lines


# ----- EPIC: two-level handling -----
# 1) ANCHOR (segmentation): very tolerant — do NOT use strict validation for segmentation.
#    Match EPIC-like tokens (alphanumeric + slash); filter by ≥5 digits + ≥2 letters.
_RE_EPIC_ANCHOR_LOOSE = re.compile(r"^[A-Za-z0-9/]{5,14}$", re.IGNORECASE)
# 2) VALIDATION (final data only): strict, after normalisation.
_RE_EPIC_STRICT = re.compile(r"^[A-Z]{3}[0-9]{6,7}(/[0-9]+)?$", re.IGNORECASE)
# Minimum EPICs on a data page to accept segmentation; below this we log failure and do not fallback.
EPIC_MIN_FOR_DATA_PAGE = 25


def _looks_like_epic(text: str) -> bool:
    """
    EPIC anchor for segmentation only. Tolerant of OCR noise (WQd, WOD, WQp2/24243, WQD259783Q).
    Must contain ≥5 digits and ≥2 letters; no strict format. Strict validation is applied later.
    """
    t = text.strip()
    if not t or len(t) < 5 or len(t) > 14:
        return False
    if not _RE_EPIC_ANCHOR_LOOSE.match(t):
        return False
    digit_count = sum(1 for c in t if c.isdigit())
    letter_count = sum(1 for c in t if c.isalpha())
    return digit_count >= 5 and letter_count >= 2


# PSM 6 = uniform block of text (best for small card crops). OEM 3 = default LSTM.
TESSERACT_CARD_CONFIG = "--psm 6 --oem 3 -l eng"
# EPIC-first segmentation constants (TN ECI S22 format: 10 rows × 3 columns = 30 cards)
EPICS_PER_PAGE_EXPECTED = 30
ROWS_PER_PAGE = 10


def _ocr_page_epic_first(
    img,
    num_cols: int = 3,
    conf_threshold: int = 30,
    expected_epics: int = EPICS_PER_PAGE_EXPECTED,
    page_number: Optional[int] = None,
    debug_config: Optional[Dict[str, Any]] = None,
) -> Tuple[List[List[str]], Optional[str], Optional[Dict[str, Any]]]:
    """
    EPIC-first deterministic segmentation for TN ECI electoral rolls.

    Pipeline:
      1. image_to_data on full page → per-word bounding boxes
      2. Find all words matching EPIC anchor (tolerant) → EPIC positions
      3. Sort EPICs by Y, cluster into rows
      4. If EPIC count < EPIC_MIN_FOR_DATA_PAGE → return failure (no fallback)
      5. Compute card bounding boxes, crop each card
      6. Preprocess crop, OCR per card with --psm 6 --oem 3 -l eng
      7. Return card blocks + segmentation metrics

    Returns: (card_blocks, segmentation_error or None, metrics or None)
    """
    try:
        import pytesseract
        from pytesseract import Output
        from PIL import Image
    except ImportError:
        return [], "pytesseract or PIL not available", None

    pil_img = _img_to_pil(img)
    w_page, h_page = pil_img.size

    try:
        data = pytesseract.image_to_data(pil_img, output_type=Output.DICT)
    except Exception as e:
        logger.warning("image_to_data failed in EPIC-first: %s", e)
        return [], str(e), None

    # ----- DEBUG: 1) Raw full-page OCR output (word, x, y, width, height, confidence) -----
    if debug_config and page_number == debug_config.get("debug_page"):
        debug_dir = debug_config["debug_dir"]
        debug_dir.mkdir(parents=True, exist_ok=True)
        raw_words = []
        for i in range(len(data["text"])):
            try:
                conf = int(data["conf"][i])
            except (ValueError, TypeError):
                conf = -1
            raw_words.append({
                "word": str(data["text"][i]),
                "x": int(data["left"][i]),
                "y": int(data["top"][i]),
                "width": int(data["width"][i]),
                "height": int(data["height"][i]),
                "confidence": conf,
            })
        out_path = debug_dir / ("full_page_ocr_%d.json" % page_number)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(raw_words, f, indent=2, ensure_ascii=False)
        logger.info("DEBUG: wrote %s", out_path)

    # Step 1: collect all words with bboxes (low conf to catch EPICs)
    words: List[dict] = []
    for i in range(len(data["text"])):
        try:
            conf = int(data["conf"][i])
        except (ValueError, TypeError):
            conf = -1
        text = str(data["text"][i]).strip()
        if conf >= conf_threshold and text:
            words.append({
                "text": text,
                "x": int(data["left"][i]),
                "y": int(data["top"][i]),
                "w": int(data["width"][i]),
                "h": int(data["height"][i]),
            })

    # Step 2: find EPIC positions
    epics: List[dict] = []
    for w in words:
        if _looks_like_epic(w["text"]):
            epics.append({
                "text": w["text"],
                "x": w["x"],
                "y": w["y"],
                "w": w["w"],
                "h": w["h"],
            })

    if not epics:
        return [], "no EPICs detected", None

    # Step 3: sort by Y, cluster into rows
    epics_sorted = sorted(epics, key=lambda e: (e["y"], e["x"]))
    rows: List[List[dict]] = []
    current_row: List[dict] = [epics_sorted[0]]
    median_h = sorted(e["h"] for e in epics)[len(epics) // 2] if epics else 20
    y_threshold = max(15, median_h * 1.5)

    for e in epics_sorted[1:]:
        prev_y = current_row[-1]["y"]
        if e["y"] - prev_y <= y_threshold:
            current_row.append(e)
        else:
            rows.append(current_row)
            current_row = [e]
    if current_row:
        rows.append(current_row)

    # ----- DEBUG: 2) EPIC detection result (candidates, X/Y, per-row count, total) -----
    if debug_config and page_number == debug_config.get("debug_page"):
        debug_dir = debug_config["debug_dir"]
        debug_dir.mkdir(parents=True, exist_ok=True)
        epic_payload = {
            "epic_candidates": [{"text": e["text"], "x": e["x"], "y": e["y"]} for e in epics_sorted],
            "epics_per_row": [len(r) for r in rows],
            "total_epic_count": sum(len(r) for r in rows),
        }
        out_path = debug_dir / ("epic_detection_%d.json" % page_number)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(epic_payload, f, indent=2, ensure_ascii=False)
        logger.info("DEBUG: wrote %s", out_path)

    # Step 4: integrity check — each row should have num_cols EPICs
    bad_rows = [i for i, r in enumerate(rows) if len(r) != num_cols]
    if bad_rows:
        logger.warning(
            "EPIC-first segmentation: rows %s have != %d EPICs (got %s); page may have layout anomalies",
            bad_rows[:5], num_cols, [len(r) for r in rows],
        )
    total_epics = sum(len(r) for r in rows)
    if total_epics != expected_epics:
        logger.warning(
            "EPIC-first segmentation failure: expected %d EPICs per page, got %d",
            expected_epics, total_epics,
        )
    # Do not return blocks if EPIC count too low — force caller to treat as segmentation failure (no fallback).
    if total_epics < EPIC_MIN_FOR_DATA_PAGE:
        metrics = {
            "epic_count": total_epics,
            "rows_detected": len(rows),
            "cards_extracted": 0,
            "segmentation_failure": True,
        }
        return [], "segmentation_failure: EPIC count %d < %d" % (total_epics, EPIC_MIN_FOR_DATA_PAGE), metrics

    # Step 5: compute card bounding boxes from EPIC positions (resilient to column drift)
    margin_left = 15
    margin_right = 15
    top_margin = 35  # space above EPIC for serial
    bottom_margin = 20
    card_blocks: List[List[str]] = []

    for row_idx, row_epics in enumerate(rows):
        row_epics_sorted_x = sorted(row_epics, key=lambda e: e["x"])
        row_y_min = min(e["y"] for e in row_epics) - top_margin
        row_y_max = max(e["y"] + e["h"] for e in row_epics)
        row_height = row_y_max - row_y_min
        card_height = int(row_height + bottom_margin)
        if row_idx + 1 < len(rows):
            next_row_y = min(e["y"] for e in rows[row_idx + 1])
            card_height = min(card_height, next_row_y - row_y_min - 5)

        # Column boundaries from EPIC positions (midpoints between adjacent EPICs)
        col_bounds: List[Tuple[int, int]] = []
        for col_idx, epic_info in enumerate(row_epics_sorted_x):
            ex, ew = epic_info["x"], epic_info["w"]
            prev_right = (row_epics_sorted_x[col_idx - 1]["x"] + row_epics_sorted_x[col_idx - 1]["w"]) if col_idx > 0 else 0
            next_left = row_epics_sorted_x[col_idx + 1]["x"] if col_idx + 1 < len(row_epics_sorted_x) else w_page
            x_min = margin_left if col_idx == 0 else (prev_right + ex) // 2
            x_max = (ex + ew + next_left) // 2 if col_idx < len(row_epics_sorted_x) - 1 else w_page - margin_right
            col_bounds.append((max(0, x_min), min(w_page, x_max)))

        for col_idx, epic_info in enumerate(row_epics_sorted_x):
            x_min, x_max = col_bounds[col_idx] if col_idx < len(col_bounds) else (
                max(0, col_idx * (w_page // num_cols)), min(w_page, (col_idx + 1) * (w_page // num_cols))
            )
            y_min = max(0, row_y_min)
            y_max = min(h_page, row_y_min + card_height)

            try:
                crop = pil_img.crop((x_min, y_min, x_max, y_max))
                crop = _preprocess_card_for_ocr(crop)
                crop_text = pytesseract.image_to_string(crop, config=TESSERACT_CARD_CONFIG)
                lines = [ln.strip() for ln in crop_text.splitlines() if ln.strip()]
                # ----- DEBUG: 3) Cropped card image; 4) Raw OCR text from that crop -----
                card_linear_index = row_idx * num_cols + col_idx
                if debug_config and page_number == debug_config.get("debug_page") and card_linear_index == debug_config.get("debug_card_index", 0):
                    debug_dir = debug_config["debug_dir"]
                    debug_dir.mkdir(parents=True, exist_ok=True)
                    crop.save(debug_dir / "card_01.png")
                    ocr_path = debug_dir / "card_01_ocr.txt"
                    with open(ocr_path, "w", encoding="utf-8") as f:
                        f.write(crop_text)
                    logger.info("DEBUG: wrote %s and %s", debug_dir / "card_01.png", ocr_path)
                if lines:
                    card_blocks.append(lines)
                else:
                    card_blocks.append([epic_info["text"]])  # fallback: EPIC only
            except Exception as e:
                logger.debug("Crop OCR failed for card (%d,%d): %s", row_idx, col_idx, e)
                card_blocks.append([epic_info["text"]])

    metrics = {
        "epic_count": total_epics,
        "rows_detected": len(rows),
        "cards_extracted": len(card_blocks),
        "segmentation_failure": False,
    }
    return card_blocks, None, metrics


def _ocr_page_spatial(img, num_cols: int = 3, conf_threshold: int = 40) -> List[List[str]]:
    """
    Production-grade spatial OCR for 3-column electoral roll pages.

    Pipeline:
      1. image_to_data  → per-word bounding boxes + confidence
      2. Dynamic X clustering (gap-based, not equal-width) → columns
      3. Vertical-overlap line clustering within each column
      4. Tolerant EPIC anchor detection → split into per-card blocks

    Fixes:
      - Fixed equal-width zones → dynamic gap clustering (handles skew/misalignment)
      - Absolute y_gap threshold → vertical overlap (handles tall text lines)
      - Strict EPIC regex → tolerant anchor (catches WOD/WQd/slash variants)
    """
    try:
        import pytesseract
        from pytesseract import Output
    except ImportError:
        return []

    pil_img = _img_to_pil(img)

    try:
        _require_tesseract()
        data = pytesseract.image_to_data(pil_img, output_type=Output.DICT)
    except Exception as e:
        msg = str(e).lower()
        if "tesseract" in msg and ("path" in msg or "not installed" in msg):
            # Fail fast with a clear instruction instead of silently returning empty OCR.
            raise RuntimeError(_TESSERACT_HELP) from e
        logger.warning("image_to_data failed: %s", e)
        return []

    # Step 1: collect valid words with bounding boxes
    words: List[dict] = []
    for i in range(len(data["text"])):
        try:
            conf = int(data["conf"][i])
        except (ValueError, TypeError):
            conf = -1
        text = str(data["text"][i]).strip()
        if conf >= conf_threshold and text:
            words.append({
                "text": text,
                "x": int(data["left"][i]),
                "y": int(data["top"][i]),
                "w": int(data["width"][i]),
                "h": int(data["height"][i]),
            })

    if not words:
        return []

    # Step 2: dynamic X clustering → columns (left to right order)
    raw_cols = _cluster_x_into_columns(words, num_cols)
    # Sort columns left-to-right by their median X centre
    def _col_median_x(col: List[dict]) -> float:
        if not col:
            return 0.0
        xs = sorted(w["x"] + w["w"] // 2 for w in col)
        return xs[len(xs) // 2]
    columns = sorted(raw_cols, key=_col_median_x)

    # Step 3 + 4: per column → lines → card blocks
    all_blocks: List[List[str]] = []
    for col_words in columns:
        if not col_words:
            continue

        # Cluster into text lines using vertical overlap
        line_groups = _cluster_words_into_lines(col_words)

        # Build text lines (words sorted left→right within each line)
        text_lines: List[str] = []
        for line_words in line_groups:
            line_words.sort(key=lambda w: w["x"])
            text_lines.append(" ".join(w["text"] for w in line_words))

        # Split into card blocks at EPIC anchors
        card_blocks: List[List[str]] = []
        current_block: List[str] = []
        for line in text_lines:
            stripped = line.strip()
            if _looks_like_epic(stripped):
                if current_block:
                    card_blocks.append(current_block)
                current_block = [stripped]
            elif current_block:
                if stripped:
                    current_block.append(stripped)
            # Lines before first EPIC (page header, etc.) are discarded
        if current_block:
            card_blocks.append(current_block)

        all_blocks.extend(card_blocks)

    logger.debug("_ocr_page_spatial: %d columns → %d card blocks", num_cols, len(all_blocks))
    return all_blocks


def _render_pdf_images(
    pdf_path: Path,
    max_pages: int = 1000,
    dpi: int = 300,
) -> List["Any"]:
    """
    Render PDF pages to PIL Images.
    Tries pdf2image (needs poppler) first; falls back to PyMuPDF.
    """
    images = []
    try:
        from pdf2image import convert_from_path
        images = convert_from_path(str(pdf_path), first_page=1, last_page=max_pages, dpi=dpi)
        return images
    except Exception as e:
        err = str(e).lower()
        if "poppler" not in err and "page count" not in err and "unable" not in err:
            logger.warning("pdf2image failed: %s", e)
            return []

    # Fallback: PyMuPDF
    try:
        import fitz
        import io
        from PIL import Image
        doc = fitz.open(str(pdf_path))
        scale = dpi / 72.0
        mat = fitz.Matrix(scale, scale)
        for i in range(min(len(doc), max_pages)):
            pix = doc[i].get_pixmap(matrix=mat, alpha=False)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            images.append(img)
        doc.close()
        return images
    except ImportError:
        logger.warning("OCR failed: poppler not in PATH and PyMuPDF not installed (pip install pymupdf).")
        return []
    except Exception as e2:
        logger.warning("OCR via PyMuPDF failed: %s", e2)
        return []


def _extract_text_via_ocr(
    pdf_path: Path,
    max_pages: Optional[int] = 1000,
    dpi: int = 300,
    preprocess: bool = False,
    num_cols: int = 3,
) -> List[str]:
    """
    Extract text from each PDF page using spatial OCR.

    Primary path (Tesseract available):
      - Renders each page to an image.
      - Uses image_to_data() to get per-word bounding boxes.
      - Splits words into X-axis column zones (num_cols wide).
      - Within each zone, clusters words by Y proximity into lines.
      - Within each column, splits lines into card blocks by EPIC anchor.
      - Returns one "virtual page text" per PDF page where each card block
        is separated by a blank line, columns are concatenated left→right.

    Fallback (Tesseract not available):
      - EasyOCR with spatial ordering (sorted by bounding-box Y then X).

    This fixes the "only every 3rd card" bug: image_to_string() reads the
    page top-to-bottom, mixing all 3 columns into one stream.  Spatial OCR
    keeps each column separate so every card is correctly segmented.
    """
    images = _render_pdf_images(pdf_path, max_pages=max_pages or 1000, dpi=dpi)
    if not images:
        return []

    # Fail fast by default (avoid importing EasyOCR/torch which can take minutes).
    allow_easyocr = os.getenv("ALLOW_EASYOCR_FALLBACK", "").strip().lower() in ("1", "true", "yes")
    if not allow_easyocr:
        _require_tesseract()

    if preprocess:
        images = [_preprocess_image_for_ocr(img) for img in images]

    def _img_to_numpy(img):
        import numpy as np
        if hasattr(img, "size"):
            return np.array(img)
        from PIL import Image
        return np.array(Image.open(img) if isinstance(img, str) else img)

    # Try Tesseract spatial path
    try:
        import pytesseract
        from pytesseract import Output  # noqa: F401 - verify import works

        def _spatial_one(img) -> str:
            blocks = _ocr_page_spatial(img, num_cols=num_cols)
            if not blocks:
                # Fallback: plain image_to_string for this page
                return pytesseract.image_to_string(img)
            # Join card blocks with blank-line separator so downstream
            # segment_page_text / _parse_voter_cards_from_text can handle them,
            # but since blocks are already per-card we mark them with a sentinel.
            return "\n\n".join("\n".join(b) for b in blocks)

        max_workers = min(4, len(images))
        if max_workers <= 1:
            return [_spatial_one(img) for img in images]
        with ThreadPoolExecutor(max_workers=max_workers) as ex:
            return list(ex.map(_spatial_one, images))

    except Exception as e:
        err_msg = str(e).lower()
        if "tesseract" not in err_msg and "path" not in err_msg:
            logger.warning("Tesseract OCR failed: %s", e)
            return []
        if not allow_easyocr:
            raise RuntimeError(_TESSERACT_HELP) from e

        # Optional fallback: EasyOCR with spatial sort
        try:
            import easyocr
            reader = easyocr.Reader(["en"], gpu=False, verbose=False)
            result = []
            for img in images:
                arr = _img_to_numpy(img)
                detections = reader.readtext(arr)
                # detections: [(bbox, text, conf), ...]
                # Sort by top-left Y then X for natural reading order
                detections.sort(key=lambda d: (d[0][0][1], d[0][0][0]))
                page_text = "\n".join(t[1] for t in detections)
                result.append(page_text)
            logger.info("OCR completed using EasyOCR (Tesseract not in PATH).")
            return result
        except ImportError:
            logger.warning(
                "Tesseract is not installed or not in PATH. "
                "Install Tesseract or EasyOCR: pip install easyocr"
            )
            return []
        except Exception as e2:
            logger.warning("EasyOCR failed: %s", e2)
            return []


def _extract_blocks_via_ocr(
    pdf_path: Path,
    max_pages: int = 1000,
    dpi: int = 300,
    preprocess: bool = False,
    num_cols: int = 3,
    extraction_config: Optional[Dict[str, Any]] = None,
) -> List[List[List[str]]]:
    """
    Spatial OCR: returns per-page list of card blocks.
    Each page → list of card blocks → each block = list of text lines.

    Uses _ocr_page_spatial() (image_to_data bounding boxes) when Tesseract is
    available.  Falls back to _extract_text_via_ocr() (flat text) otherwise,
    returning each page as a single "block" for downstream text parsing.

    Returns: [ page0_blocks, page1_blocks, ... ]
      where page_blocks = [ [line, line, ...], [line, line, ...], ... ]
    """
    images = _render_pdf_images(pdf_path, max_pages=max_pages, dpi=dpi)
    if not images:
        return []

    cfg = extraction_config or {}
    if preprocess:
        if cfg.get("use_enhance"):
            images = [_enhance_image_for_ocr(img) for img in images]
        else:
            images = [_preprocess_image_for_ocr(img) for img in images]

    debug_dir = cfg.get("debug_dir")
    if debug_dir:
        for page_idx, img in enumerate(images):
            boxes = _detect_voter_boxes_adaptive(img)
            path = os.path.join(debug_dir, f"page_{page_idx + 1}_debug.jpg")
            _save_debug_page_with_boxes(img, boxes, path)

    debug_config = _get_debug_config()

    # Try Tesseract spatial path
    try:
        import pytesseract
        from pytesseract import Output  # noqa: F401

        def _spatial_page(img, page_idx: int = 0) -> List[List[str]]:
            # Data pages (page 2+): always use EPIC-first; never fallback to full-page split.
            if page_idx >= 2:
                # Prefer true per-box OCR when contour detection is reliable.
                box_blocks = _ocr_page_by_detected_boxes(
                    img,
                    min_boxes=int(cfg.get("min_detected_boxes", 18)),
                    max_boxes=int(cfg.get("max_detected_boxes", 80)),
                )
                if box_blocks:
                    return box_blocks
                blocks, seg_err, seg_metrics = _ocr_page_epic_first(
                    img, num_cols=num_cols,
                    page_number=page_idx + 1, debug_config=debug_config,
                )
                if blocks:
                    return blocks
                logger.warning(
                    "Data page %d: EPIC-first segmentation failed (%s). Not falling back to full-page OCR.",
                    page_idx + 1, seg_err or "unknown",
                )
                if seg_metrics:
                    logger.info(
                        "Segmentation metrics: epic_count=%s rows_detected=%s cards_extracted=%s",
                        seg_metrics.get("epic_count"), seg_metrics.get("rows_detected"),
                        seg_metrics.get("cards_extracted"),
                    )
                return []
            # Cover/summary pages (0, 1): use spatial or full-page as before
            blocks, seg_err, _ = _ocr_page_epic_first(
                img, num_cols=num_cols,
                page_number=page_idx + 1, debug_config=debug_config,
            )
            if blocks:
                return blocks
            blocks = _ocr_page_spatial(img, num_cols=num_cols)
            if blocks:
                return blocks
            text = pytesseract.image_to_string(img)
            lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
            return [lines] if lines else []

        max_workers = min(4, len(images))
        if max_workers <= 1:
            result = [_spatial_page(img, i) for i, img in enumerate(images)]
        else:
            with ThreadPoolExecutor(max_workers=max_workers) as ex:
                result = list(ex.map(lambda args: _spatial_page(args[1], args[0]), enumerate(images)))
        logger.info(
            "Spatial OCR: %d pages, total %d card blocks",
            len(result),
            sum(len(p) for p in result),
        )
        return result

    except Exception as e:
        err_msg = str(e).lower()
        if "tesseract" not in err_msg and "path" not in err_msg:
            logger.warning("Tesseract OCR failed: %s", e)
            return []

        # EasyOCR fallback: spatial sort, return as flat page blocks
        try:
            import easyocr
            import numpy as np
            reader = easyocr.Reader(["en"], gpu=False, verbose=False)
            result = []
            for img in images:
                arr = np.array(img) if hasattr(img, "size") else np.array(__import__("PIL").Image.open(img))
                detections = reader.readtext(arr)
                detections.sort(key=lambda d: (d[0][0][1], d[0][0][0]))
                lines = [t[1].strip() for t in detections if t[1].strip()]
                result.append([lines] if lines else [])
            logger.info("Spatial OCR (EasyOCR fallback): %d pages", len(result))
            return result
        except ImportError:
            logger.warning("Tesseract not in PATH and EasyOCR not installed (pip install easyocr).")
            return []
        except Exception as e2:
            logger.warning("EasyOCR failed: %s", e2)
            return []


# Column name variants seen in ECI/state electoral roll PDFs (case-insensitive)
# Tamil Nadu / ECI format often uses: S.No, EPIC No, Name, Father's/Husband's Name, Age, Sex, House No, Address
COLUMN_ALIASES = {
    "epic_number": ["epic no", "epic no.", "epic number", "epic", "voter id", "elector id", "epic number"],
    "name": ["name", "elector name", "voter name", "name of elector", "elector's name", "name of the elector"],
    "relative_name": ["father's name", "father name", "husband's name", "husband name", "relative name", "relative's name", "mother's name", "mother name", "father/husband", "father/husband's name", "f/h name", "relation"],
    "age": ["age"],
    "gender": ["sex", "gender", "m/f", "m or f"],
    "house_no": ["house no", "house no.", "house number", "door no", "door no.", "house number"],
    "address": ["address", "address of elector", "residence", "house address"],
    "serial": ["s.no", "sl no", "serial no", "serial number", "no.", "no ", "s.no.", "sl.no"],
}

# Header patterns to extract constituency and part/booth from first page
# Tamil Nadu ECI format: "Assembly Constituency: 11- DR.RADHAKRISHNAN NAGAR (GEN) Part No.: 20" (can be same line)
HEADER_PATTERNS = {
    "constituency": re.compile(
        r"(?:assembly\s+constituency|ac\s+name|constituency)(?:\(ies\))?[^\n]*[\n:]?\s*(\d+\s*-\s*[^\n]+?)(?:\s*\(GEN\)|\s*\(SC\)|\s*\(ST\))?(?:\s|$)",
        re.IGNORECASE
    ),
    "constituency_same_line": re.compile(
        r"(\d+\s*-\s*[A-Z][A-Z\.\s]*(?:NAGAR|NORTH|SOUTH|CENTRAL|WEST|EAST)[^\n]*?)(?:\s*\(GEN\)|\s*\(SC\)|\s*\(ST\)|\s+Part\s+No\.|$)",
        re.IGNORECASE
    ),
    "constituency_alt": re.compile(
        r"(\d+\s*-\s*[A-Z\.\s]+(?:NAGAR|NORTH|SOUTH|CENTRAL|WEST|EAST)[^\n]*)",
        re.IGNORECASE
    ),
    "part_no": re.compile(
        r"part\s*(?:no\.?|number)?\s*[:\-]?\s*(\d+)",
        re.IGNORECASE
    ),
    "part_name": re.compile(
        r"part\s*name\s*[:\-]\s*([^\n]+)",
        re.IGNORECASE
    ),
    "parliamentary": re.compile(
        r"parliamentary\s+constituency[^\n]*[\n:]?\s*(\d+\s*-\s*[^\n]+)",
        re.IGNORECASE
    ),
}
# Extended first-page metadata (TN ECI cover page)
# Sample uses "Year of Revision 2026" (space) or "Year of Revision: 2026" (colon)
REVISION_PATTERNS = {
    "revision_year": re.compile(r"year\s+of\s+revision\s*[:\-]?\s*(\d{4})", re.IGNORECASE),
    "qualifying_date": re.compile(r"qualifying\s+date\s*[:\-]?\s*([\d\-]+)", re.IGNORECASE),
    "type_of_revision": re.compile(r"type\s+of\s+revision\s*[:\-]?\s*([^\n]+?)(?=\s*Date\s+of\s+Publication|\s*$)", re.IGNORECASE | re.DOTALL),
    "date_of_publication": re.compile(r"date\s+of\s+publication\s*[:\-]?\s*([^\n]+)", re.IGNORECASE),
    "polling_station": re.compile(
        r"(?:no\.?\s+and\s+name\s+of\s+)?polling\s+station\s*[:\-]?\s*([^\n]+?)(?=\s*Address\s+of\s+Polling|\s*$)",
        re.IGNORECASE | re.DOTALL
    ),
    "address_of_polling_station": re.compile(
        r"address\s+of\s+polling\s+station\s*[:\-]?\s*([^\n]+?)(?=\s*Type\s+of\s+Polling|\s*$)",
        re.IGNORECASE | re.DOTALL
    ),
    "type_of_polling_station": re.compile(
        r"type\s+of\s+polling\s+station[^\n]*[:\-]?\s*(Male|Female|General)",
        re.IGNORECASE
    ),
    "roll_identification": re.compile(r"roll\s+identification\s*[:\-]?\s*([^\n]+)", re.IGNORECASE),
    "parliamentary_constituency": re.compile(
        r"parliamentary\s+constituency[^\n]*[\n:]?\s*(\d+\s*-\s*[^\n]+)",
        re.IGNORECASE
    ),
    "main_town_or_village": re.compile(r"main\s+town\s+or\s+village\s*[:\-]?\s*([^\n]+)", re.IGNORECASE),
    "ward_no": re.compile(r"ward\s+no\.?\s*[:\-]?\s*([^\n]+)", re.IGNORECASE),
    "district": re.compile(r"district\s*[:\-]?\s*([^\n]+)", re.IGNORECASE),
    "starting_serial_no": re.compile(r"starting\s*serial\s*no\.?\s*[:\-]?\s*(\d+)", re.IGNORECASE),
    "ending_serial_no": re.compile(r"ending\s*serial\s*no\.?\s*[:\-]?\s*(\d+)", re.IGNORECASE),
    "net_electors_male": re.compile(r"net\s+electors?[\s\S]{0,200}?male\s*[:\-]?\s*(\d+)", re.IGNORECASE),
    "net_electors_female": re.compile(r"net\s+electors?[\s\S]{0,300}?female\s*[:\-]?\s*(\d+)", re.IGNORECASE),
    "net_electors_third_gender": re.compile(r"third\s+gender\s*[:\-]?\s*(\d+)", re.IGNORECASE),
    "net_electors_total": re.compile(r"(?:net\s+electors?[\s\S]{0,400}?)?total\s*[:\-]?\s*(\d+)", re.IGNORECASE),
}
# Sections in the part: lines like "1-Tondiarpet Ward No 38 Sanjay Gandhi Nagar 4th Street"
RE_SECTION_LINE = re.compile(r"^(\d+)\s*-\s*(.+)$", re.MULTILINE)


def _normalize_column_header(cell: str) -> str:
    """Map PDF table header to our schema key."""
    if not cell:
        return ""
    cell = str(cell).strip().lower().replace("\n", " ")
    for schema_key, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            if alias in cell or cell in alias:
                return schema_key
    if cell in ("s.no", "sl no", "serial no", "no.", "no"):
        return "serial"
    return ""


def _map_row_to_record(headers: List[str], row: List[Any], default_booth: str, default_constituency: str) -> Optional[Dict[str, Any]]:
    """Map a table row to a single voter record (schema-ready)."""
    record = {}
    for i, val in enumerate(row):
        if i >= len(headers):
            break
        key = headers[i]
        if not key:
            continue
        raw = str(val).strip() if val is not None else ""
        if key == "serial":
            continue  # we don't store serial
        if key == "age":
            try:
                record["age"] = int(re.sub(r"\D", "", raw)) if raw else None
            except ValueError:
                record["age"] = None
        elif key == "gender":
            g = raw.upper()[:1] if raw else ""
            record["gender"] = "M" if g == "M" else "F" if g == "F" else (raw or None)
        else:
            record[key] = raw or None

    # Required for our schema
    if not record.get("name") and not record.get("epic_number"):
        return None
    record.setdefault("epic_number", record.get("epic_number"))
    record.setdefault("relative_name", record.get("relative_name") or "")
    record.setdefault("house_no", record.get("house_no") or "")
    record.setdefault("address", record.get("address") or "")
    record["booth_number"] = default_booth
    record["constituency_name"] = default_constituency
    return record


# EPIC number pattern: 2-5 letter prefix + digits (with optional embedded slashes from OCR)
# Handles: WQD2616720, WQD2/24243, WOD22/2193, FBT2224673
RE_EPIC = re.compile(r"^[A-Za-z][A-Za-z0-9]{1,4}[0-9][0-9/]{2,}[0-9]$", re.IGNORECASE)
# EPIC anywhere in string (for finding in mixed lines)
RE_EPIC_ANYWHERE = re.compile(r"[A-Za-z][A-Za-z0-9]{1,4}[0-9][0-9/]{2,}[0-9]")
# Start of voter card: optional serial number then EPIC on same line or next
RE_RECORD_START = re.compile(r"^\s*(\d+)\s+([A-Za-z]{2,4}[0-9]{5,})\s*$")
RE_RECORD_START_SERIAL_ONLY = re.compile(r"^\s*(\d+)\s*$")
# Relation line: "Father Name: xxx", "Husband Name: xxx", "Mother Name: xxx"
RE_FATHER = re.compile(r"father\s*name\s*[:\-]\s*(.+)", re.IGNORECASE)
RE_HUSBAND = re.compile(r"husband\s*name\s*[:\-]\s*(.+)", re.IGNORECASE)
RE_MOTHER = re.compile(r"mother\s*name\s*[:\-]\s*(.+)", re.IGNORECASE)
# "Name: xxx" or "Nama: xxx" (elector name with prefix)
RE_NAME_PREFIX = re.compile(r"^(?:name|nama|namo|namc|namne|narne)\s*[:\-]\s*(.+)", re.IGNORECASE)
# "House Number: xxx" or "House No: xxx"
RE_HOUSE_NUMBER_PREFIX = re.compile(r"house\s*(?:number|no\.?)\s*[:\-]\s*(.+)", re.IGNORECASE)
# "Age: 32 Gender: Male Photo" on same line
RE_AGE_GENDER_LINE = re.compile(r"age\s*[:\-]\s*(\d{1,3})(?:\s*.*?gender\s*[:\-]\s*(Male|Female|M|F))?", re.IGNORECASE)
# House number (standalone): digits, slashes, hyphens (8/100, 36-1, 40A)
RE_HOUSE_NO = re.compile(r"^[\d\s/\-\.A-Za-z,]+$")
# Age: 1-3 digits, 18-120
RE_AGE = re.compile(r"^\d{1,3}$")
RE_GENDER = re.compile(r"^(Male|Female|M|F)$", re.IGNORECASE)

# ----- OCR-tolerant patterns (scanned TN ECI cards) -----
# Name: "Name" / "Nama" / "Namo" / "Namc" / "Namne" / "Narne" (OCR typos)
RE_NAME_FUZZY = re.compile(r"^(?:name|nama|namo|namc|namne|narne)\s*[:\-]?\s*(.*)$", re.IGNORECASE)
# Father/Husband/Mother: Fatnar Namo, Fether Name, Falher Narne, Fatner Narie
RE_FATHER_FUZZY = re.compile(
    r"(?:falhe?r?|father|falner|falhar|fatnar|fether|fatner)\s*(?:naine?|name|namie|nama|namo|narne|narie)?\s*[:\-\"]?\s*(.*)$",
    re.IGNORECASE
)
RE_HUSBAND_FUZZY = re.compile(r"(?:husband|husoand)\s*(?:name|nama)?\s*[:\-]?\s*(.*)$", re.IGNORECASE)
RE_MOTHER_FUZZY = re.compile(r"mother\s*(?:name|nama|namo)?\s*[:\-]?\s*(.*)$", re.IGNORECASE)
# House Number: Fouse, Houso Numbar, Hou8e, Houga, Houea, Housa, House Numoor, Numper, Husoand
RE_HOUSE_NUMBER_FUZZY = re.compile(
    r"(?:house?|fouse?|houso|hou8e?|houga|houea|housa)\s*(?:num(?:ber|bet|bor|bar|bep|oor|per)?|numbet|numbar|numbor|numoor|numper)?\s*[:\-]?\s*(.*)$",
    re.IGNORECASE
)
# Age + Gender label typos: Gerer, Gondar, Gerder, Genocr, Gendcr, Cendor
RE_AGE_FUZZY = re.compile(
    r"(?:age|ago|aga)\s*[:\-]?\s*(\d{1,3})\s*(?:genocr|gendcr|cendor|cender|gender|gerer|gondar|gerder)?",
    re.IGNORECASE
)
RE_AGE_LEADING = re.compile(
    r"^(\d{1,3})\s+(?:genocr|gendcr|cendor|cender|gender|gerer|gondar|gerder)",
    re.IGNORECASE
)
RE_AGE_GENDER_LINE_FUZZY = re.compile(
    r"(?:age|ago|aga)\s*[:\-]?\s*(\d{1,3})\s*(?:genocr|gendcr|cendor|cender|gender|gerer|gondar|gerder|gonder|gendar|gander)\s*[:\-]?\s*(Male|Female|M|F|Mala|Ferala|Femalo|Famale|Ma e|Fema e|Farna|MA 4)?",
    re.IGNORECASE
)
# Gender value with OCR: Mole, Mala, Ma e, MA 4 (Male), Ferala, Fema e, Femalo, Famale (Female)
RE_GENDER_FUZZY = re.compile(r"^(?:ma\s*e|ma\s*4|ma?\s*0?|male|mole|mala|m)\s*$", re.IGNORECASE)
RE_GENDER_FEMALE_FUZZY = re.compile(r"^(?:farna\s*8?|fema\s*e|foma?\s*0?|female|ferala|femalo|famale|f)\s*$", re.IGNORECASE)
# Reject dates as house_no: 09-May, Oct-99, 12-Jan
RE_DATE_LIKE = re.compile(r"^(?:\d{1,2}[-/](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-/]\d{2,4})\s*$", re.IGNORECASE)

# ----- OCR normalization: fix common label typos before keyword-based parsing -----
# TN rolls: Cender/Gendar/Gerder → Gender; Housa/Houae → House; Falher → Father
OCR_NORMALIZATION_MAP = [
    (r"\bCender\b", "Gender"),
    (r"\bGendar\b", "Gender"),
    (r"\bGerder\b", "Gender"),
    (r"\bGonder\b", "Gender"),
    (r"\bGenocr\b", "Gender"),
    (r"\bGendcr\b", "Gender"),
    (r"\bCendor\b", "Gender"),
    (r"\bHousa\b", "House"),
    (r"\bHouae\b", "House"),
    (r"\bHcu3e\b", "House"),
    (r"\bFouse\b", "House"),
    (r"\bHouso\b", "House"),
    (r"\bHou8e\b", "House"),
    (r"\bHouga\b", "House"),
    (r"\bNumbar\b", "Number"),
    (r"\bNumoor\b", "Number"),
    (r"\bNumper\b", "Number"),
    (r"\bFalher\b", "Father"),
    (r"\bFalner\b", "Father"),
    (r"\bFatnar\b", "Father"),
    (r"\bFether\b", "Father"),
    (r"\bFatner\b", "Father"),
    (r"\bFalhar\b", "Father"),
    (r"\bNaine\b", "Name"),
    (r"\bNamie\b", "Name"),
    (r"\bNamo\b", "Name"),
    (r"\bNamc\b", "Name"),
    (r"\bNarne\b", "Name"),
    (r"\bNarie\b", "Name"),
    (r"\bHusoand\b", "Husband"),
]
# Compile for speed
_OCR_NORM_REGEXES = [(re.compile(p, re.IGNORECASE), r) for p, r in OCR_NORMALIZATION_MAP]


def _normalize_ocr_card_lines(lines: List[str]) -> List[str]:
    """
    Apply OCR typo normalization to each line so keyword anchors (Gender, House, Father Name)
    match despite OCR noise. Returns new list of lines; does not mutate input.
    """
    out: List[str] = []
    for ln in lines:
        s = ln.strip()
        if not s:
            continue
        for pat, repl in _OCR_NORM_REGEXES:
            s = pat.sub(repl, s)
        # Collapse multiple spaces
        s = re.sub(r"\s+", " ", s).strip()
        out.append(s)
    return out


# Footer lines that must not be included in card content (e.g. last card on page)
CARD_FOOTER_KEYWORDS = (
    "age as on",
    "date of publication",
    "total pages",
    "page ",
    "signature of",
    "summary of electors",
)


def _strip_footer_from_card_block(lines: List[str]) -> List[str]:
    """Remove lines that are clearly page footer, not card content."""
    return [
        ln for ln in lines
        if ln.strip() and not any(k in ln.lower() for k in CARD_FOOTER_KEYWORDS)
    ]


# Keyword-anchor regexes (TN rolls: order varies; use anchors, not line index)
RE_EPIC_ANYWHERE_STRICT = re.compile(r"\b[A-Z]{3}[0-9]{6,7}\b", re.IGNORECASE)
RE_AGE_ANCHOR = re.compile(r"Age\s*[:;]?\s*(\d{1,3})", re.IGNORECASE)
RE_AGE_FALLBACK_GENDER = re.compile(r"\b(\d{2})\s*(Male|Female)\b", re.IGNORECASE)
RE_RELATIVE_ANCHOR = re.compile(r"(Father|Husband|Mother)\s*Name\s*[:;]?\s*(.*)", re.IGNORECASE)
RE_HOUSE_ANCHOR = re.compile(r"House\s*Number\s*[:;]?\s*([0-9A-Za-z\/\-]+)", re.IGNORECASE)
RE_HOUSE_FALLBACK = re.compile(r"\b([0-9]+[A-Za-z]*[/\-][0-9A-Za-z\/\-]+)\b")
# Name with prefix on same line (after normalization)
RE_NAME_ANCHOR = re.compile(r"^Name\s*[:;]?\s*(.+)$", re.IGNORECASE)


def _parse_card_keyword_anchored(block: List[str], rec: Dict[str, Any]) -> None:
    """
    Extract fields using keyword anchors and patterns only. No line-position assumptions.
    Use after OCR normalization and footer stripping. Fills only missing fields.
    """
    if not block:
        return
    full_text = " ".join(block)
    lines = [ln.strip() for ln in block if ln.strip()]

    # 1) EPIC: find anywhere in block (do not assume first line)
    if not rec.get("epic_number"):
        for ln in lines:
            m = RE_RECORD_START.match(ln)
            if m:
                if rec.get("serial_number") is None:
                    rec["serial_number"] = m.group(1)
                if _looks_like_epic(m.group(2)):
                    rec["epic_number"] = m.group(2)
                    break
            if _looks_like_epic(ln):
                rec["epic_number"] = ln
                break
        if not rec.get("epic_number"):
            m = RE_EPIC_ANYWHERE_STRICT.search(full_text)
            if m:
                rec["epic_number"] = m.group(0)

    # 2) Relative: (Father|Husband|Mother) Name : value
    if not rec.get("relative_name"):
        for ln in lines:
            m = RE_RELATIVE_ANCHOR.search(ln)
            if m:
                val = (m.group(2) or "").strip().rstrip("-").rstrip('"').strip()
                if val and len(val) >= 2 and val.lower() not in ("name", "nama", "narie", "nartie"):
                    rec["relative_name"] = val
                    break

    # 3) House Number: "House Number : 9/5" or first numeric/slash pattern
    if not rec.get("house_no"):
        for ln in lines:
            m = RE_HOUSE_ANCHOR.search(ln)
            if m:
                val = (m.group(1) or "").strip()
                if val and not _is_date_like(val) and not RE_EPIC.match(val):
                    rec["house_no"] = _normalize_house_no(val)
                    break
        if not rec.get("house_no"):
            for ln in lines:
                m = RE_HOUSE_FALLBACK.search(ln)
                if m:
                    val = m.group(1).strip()
                    if not _is_date_like(val) and not RE_EPIC.match(val) and len(val) <= 20:
                        rec["house_no"] = _normalize_house_no(val)
                        break

    # 4) Age: "Age : 24" or "24 Male" / "24 Female"
    if rec.get("age") is None:
        for ln in lines:
            m = RE_AGE_ANCHOR.search(ln)
            if m:
                try:
                    a = int(m.group(1))
                    if 18 <= a <= 120:
                        rec["age"] = a
                        break
                except ValueError:
                    pass
        if rec.get("age") is None:
            m = RE_AGE_FALLBACK_GENDER.search(full_text)
            if m:
                try:
                    a = int(m.group(1))
                    if 18 <= a <= 120:
                        rec["age"] = a
                except ValueError:
                    pass

    # 5) Gender: search for Male/Female on any line (independent of Age)
    # Do not assign "O" during parsing — only M/F; leave unknown for validation/default.
    if not rec.get("gender"):
        for ln in lines:
            g = _normalize_gender(ln)
            if g and g in ("M", "F"):
                rec["gender"] = g
                break

    # 6) Name: "Name : value" on same line, or first non-keyword line after EPIC
    if rec.get("name") is None:
        for ln in lines:
            m = RE_NAME_ANCHOR.match(ln)
            if m:
                val = (m.group(1) or "").strip().rstrip("-").strip()
                if val and val.lower() not in ("name", "nama", "narie"):
                    rec["name"] = val
                    break
        if rec.get("name") is None:
            skip_starts = ("father", "husband", "mother", "house", "age", "gender", "photo", "available", "name:")
            for ln in lines:
                if RE_EPIC.match(ln) or _looks_like_epic(ln):
                    continue
                low = ln.lower().strip()
                if any(low.startswith(s) for s in skip_starts) or low in ("male", "female"):
                    continue
                if ln.isdigit() or _is_date_like(ln) or RE_HOUSE_FALLBACK.match(ln):
                    continue
                if len(ln) > 1 and ":" not in ln.split()[0] if ln.split() else True:
                    rec["name"] = ln.rstrip("-").strip()
                    break


def _normalize_house_no(s: str) -> str:
    """Fix common OCR errors in house numbers: &→8, Q→0, O→0, C→0, I→1 (e.g. 8/100, &/10Q→8/100)."""
    if not s or len(s) > 80:
        return s
    s = s.strip()
    # Only in digit/slash context: replace common OCR misreads.
    out = []
    for i, c in enumerate(s):
        prev_numeric = (out and out[-1] in "0123456789/") or (i > 0 and s[i - 1] in "0123456789/")
        next_numeric = i + 1 < len(s) and s[i + 1] in "0123456789/"
        in_numeric_zone = prev_numeric or next_numeric
        if in_numeric_zone:
            if c == "&":
                out.append("8")
            elif c.upper() == "Q":
                out.append("0")
            elif c.upper() in ("C", "O"):
                out.append("0")
            elif c.upper() == "I" and (prev_numeric or next_numeric):
                out.append("1")
            else:
                out.append(c)
        else:
            out.append(c)
    return "".join(out)


def _is_date_like(s: str) -> bool:
    """Reject values that look like dates (e.g. 09-May, Oct-99) for house_no."""
    if not s or len(s) > 20:
        return False
    t = s.strip()
    if RE_DATE_LIKE.match(t):
        return True
    if re.match(r"^\d{1,2}[-/][A-Za-z]{3,}[-/]?\d{0,4}$", t):
        return True
    if re.match(r"^[A-Za-z]{3,}[-/]\d{2,4}$", t):
        return True
    return False


# ----- Position-aware extraction -----
# Layout: 3 cards per row × 10 rows = 30 voters per page (configurable)
# Extraction config: cards_per_row, rows_per_page, row_gap, header_top, data_bottom
# Default EPIC corrections: (from_prefix, to_prefix) applied to first 3 chars
EPIC_CORRECTIONS_DEFAULT = [
    ("WOD", "WQD"),   # O confused with Q
    ("WQ0", "WQD"),   # 0 confused with D
    ("WQd", "WQD"),   # lowercase d
]
# Digit part substitutions (0↔6 common OCR): applied to chars after position 3
EPIC_DIGIT_CORRECTIONS_DEFAULT = [
    ("0", "6"),   # OCR often reads 6 as 0
]

EXTRACTION_CONFIG_DEFAULTS = {
    "cards_per_row": 3,       # 3 cards per row (10 rows × 3 = 30 per page)
    "rows_per_page": 10,
    "row_gap": 25,            # Vertical gap (px) between cards; if word top - prev_top > row_gap → new card
    "header_top": 120,        # Skip content above this y (page header)
    "data_bottom": 750,       # Skip content below this y (footer, page numbers)
    "margin_left": 20,
    "margin_right": 20,
    "epic_corrections": None,       # Optional list of (from, to) for EPIC prefix; None = use default
    "epic_digit_corrections": None, # Optional list of (from, to) for digit part; None = use default (0→6)
    "epic_fix_digit_0_as_6": True,  # When True, replace 0→6 in EPIC digit part (common OCR error)
}


# EPIC valid pattern: 3 letters + 6-7 digits (TN format)
RE_EPIC_VALID = re.compile(r"^[A-Za-z]{3}[0-9]{6,7}(/[0-9]+)?$", re.IGNORECASE)

# Known ECI EPIC prefixes (TN and common states) for confidence scoring
ALLOWED_EPIC_PREFIXES = frozenset(("WQD", "WOD", "FBT", "ABC", "XYZ", "TMB", "TN", "AP", "KL", "KA", "DL", "MH", "WB", "UP", "RJ", "PB", "HR", "GJ"))


def _epic_confidence(epic: Optional[str]) -> float:
    """
    EPIC structural confidence 0-1 for hybrid pipeline.
    Format 3 letters + 7 digits = 0.6, allowed prefix = 0.3, length 10 = 0.1.
    """
    if not epic or not isinstance(epic, str):
        return 0.0
    epic = epic.strip().upper().replace(" ", "")
    score = 0.0
    if RE_EPIC_VALID.match(epic):
        score += 0.6
    if epic[:3] in ALLOWED_EPIC_PREFIXES:
        score += 0.3
    if len(epic) == 10:
        score += 0.1
    return round(min(1.0, score), 2)


def _normalize_epic(epic: str, config: Optional[Dict[str, Any]] = None) -> Tuple[str, bool]:
    """
    Apply EPIC corrections safely. Returns (normalized_epic, prefix_was_corrected).

    Steps:
    1. Strip spaces, uppercase.
    2. Remove spurious slash in numeric part (WQD2/24243 → WQD2724243).
    3. Prefix corrections: WOD→WQD, WQ0→WQD, WQd→WQD (always apply).
    4. Digit 0→6 in numeric part: ONLY when epic fails validation AND correction yields valid.
       (Safe guard: never corrupt a structurally valid EPIC by blind digit replacement.)
    """
    if not epic or len(epic) < 4:
        return epic, False
    epic = epic.strip().upper().replace(" ", "")
    cfg = config or {}

    # Remove spurious slash inside the numeric part (OCR reads "2/2" instead of "22")
    prefix_raw = epic[:3]
    rest_raw = epic[3:]
    rest_raw = re.sub(r"(\d)/(\d)", r"\1\2", rest_raw)

    # Prefix corrections (safe, always apply)
    prefix = prefix_raw.upper()
    prefix_corrected = False
    corrections = cfg.get("epic_corrections") or EPIC_CORRECTIONS_DEFAULT
    for from_p, to_p in corrections or []:
        if isinstance(from_p, str) and isinstance(to_p, str) and prefix == from_p.upper():
            prefix = to_p.upper()
            prefix_corrected = True
            break
    result = prefix + rest_raw

    # Digit corrections: ONLY if the result fails strict validation
    # (never replace digits in an already-valid EPIC — too risky without ground truth)
    if not RE_EPIC_VALID.match(result) and cfg.get("epic_fix_digit_0_as_6", True):
        digit_corr = cfg.get("epic_digit_corrections") or EPIC_DIGIT_CORRECTIONS_DEFAULT
        for from_d, to_d in digit_corr or []:
            if isinstance(from_d, str) and isinstance(to_d, str) and from_d in rest_raw:
                candidate = prefix + rest_raw.replace(from_d, to_d)
                if RE_EPIC_VALID.match(candidate):
                    return candidate, prefix_corrected
    return result, prefix_corrected


def _normalize_gender(text: str) -> Optional[str]:
    """
    Normalize OCR-noisy gender values to 'M', 'F', or 'O' (Third gender).
    Handles: Male/Female/Third, Ma e/Fema e, Mala/Ferala, Famale/Femalo, etc.
    Returns 'M', 'F', 'O', or None if unrecognisable.
    """
    if not text:
        return None
    t = text.strip().lower().replace(" ", "").replace(".", "")
    # Third gender first (ECI TN format)
    third_tokens = ("third", "thirdgender", "other", "o", "transgender", "tg")
    for tok in third_tokens:
        if t == tok or t.startswith(tok) or tok in t:
            return "O"
    # Female (longer match, avoids "fema" matching "ma")
    female_tokens = ("female", "fema", "femalo", "famale", "ferala", "farnale",
                     "fema0", "fema8", "fema@", "femal")
    male_tokens = ("male", "mala", "ma0", "ma8", "ma4", "mae", "mal")
    for tok in female_tokens:
        if t.startswith(tok) or tok in t:
            return "F"
    for tok in male_tokens:
        if t.startswith(tok) or tok in t:
            return "M"
    # Single letter
    if t in ("f",):
        return "F"
    if t in ("m",):
        return "M"
    return None


def _validate_and_score_records(records: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Structural intelligence layer:
    - Logical validation (age 18-120, gender valid, house_no length, EPIC format)
    - Per-record confidence scoring (EPIC 40%, Name 20%, Age 15%, Gender 15%, House 10%)
    - Duplicate detection
    - low_confidence flag when score < 70%
    """
    AGE_MIN, AGE_MAX = 18, 120
    HOUSE_NO_MAX_LEN = 15
    VALID_GENDERS = {"M", "F", "O", "MALE", "FEMALE", "OTHER"}
    CONFIDENCE_WEIGHTS = {"epic": 0.40, "name": 0.20, "age": 0.15, "gender": 0.15, "house_no": 0.10}
    LOW_CONFIDENCE_THRESHOLD = 0.70

    seen_epics: set = set()
    stats = {
        "epic_valid_count": 0,
        "age_valid_count": 0,
        "gender_valid_count": 0,
        "duplicate_epic_count": 0,
        "low_confidence_count": 0,
        "multi_epic_warnings": 0,
        "possible_cross_card_merge_count": 0,
    }

    for r in records:
        r.setdefault("source_block", "")
        warnings = list(r.get("_warnings", []))
        epic = (r.get("epic_number") or "").strip()
        epic_valid = bool(RE_EPIC_VALID.match(epic)) if epic else False
        if epic_valid:
            stats["epic_valid_count"] += 1
        if epic in seen_epics and epic:
            warnings.append("duplicate_epic")
            r["is_duplicate"] = True
            stats["duplicate_epic_count"] += 1
        else:
            r["is_duplicate"] = False
            if epic:
                seen_epics.add(epic)

        age = r.get("age")
        age_valid = age is not None and AGE_MIN <= age <= AGE_MAX
        if age_valid:
            stats["age_valid_count"] += 1
        elif age is None or age == "":
            warnings.append("age_missing")
        elif age < AGE_MIN or age > AGE_MAX:
            warnings.append("age_out_of_range")

        gender = (r.get("gender") or "").strip().upper()
        gender_valid = gender in VALID_GENDERS or gender in ("M", "F", "O")
        if gender_valid and gender:
            stats["gender_valid_count"] += 1
        if gender and gender not in VALID_GENDERS and gender not in ("M", "F", "O"):
            warnings.append("gender_invalid")

        house_no = (r.get("house_no") or "").strip()
        if house_no and len(house_no) > HOUSE_NO_MAX_LEN:
            warnings.append("house_no_too_long")
            r["house_no"] = house_no[:HOUSE_NO_MAX_LEN]

        # Validation status: Valid | Missing Age | EPIC Invalid | Gender Invalid | Needs Review
        if epic_valid and age_valid and gender_valid:
            r["validation_status"] = "Valid"
        elif not epic_valid and epic:
            r["validation_status"] = "EPIC Invalid"
        elif not age_valid and (age is None or age == ""):
            r["validation_status"] = "Missing Age"
        elif not gender_valid and gender:
            r["validation_status"] = "Gender Invalid"
        elif not epic_valid or not age_valid or not gender_valid:
            r["validation_status"] = "Needs Review"
        else:
            r["validation_status"] = "Valid"

        if "multiple_epics_in_card" in warnings:
            stats["multi_epic_warnings"] += 1
        if "possible_cross_card_merge" in warnings:
            stats["possible_cross_card_merge_count"] += 1

        # Confidence score
        score = 0.0
        if epic_valid:
            score += CONFIDENCE_WEIGHTS["epic"]
        elif epic:
            score += CONFIDENCE_WEIGHTS["epic"] * 0.5
        if (r.get("name") or "").strip():
            score += CONFIDENCE_WEIGHTS["name"]
        if age_valid:
            score += CONFIDENCE_WEIGHTS["age"]
        if gender_valid and gender:
            score += CONFIDENCE_WEIGHTS["gender"]
        if house_no and len(house_no) <= HOUSE_NO_MAX_LEN:
            score += CONFIDENCE_WEIGHTS["house_no"]

        epic_conf = _epic_confidence(epic)
        r["epic_confidence"] = epic_conf
        r["confidence_score"] = round(score, 2)
        r["low_confidence"] = score < LOW_CONFIDENCE_THRESHOLD
        r["quality_flag"] = "ok" if score >= 0.85 else "review"
        if r["low_confidence"]:
            stats["low_confidence_count"] += 1
        r["_warnings"] = warnings

    n = len(records)
    stats["epic_valid_pct"] = round(100 * stats["epic_valid_count"] / n, 1) if n else 0
    stats["age_valid_pct"] = round(100 * stats["age_valid_count"] / n, 1) if n else 0
    stats["gender_valid_pct"] = round(100 * stats["gender_valid_count"] / n, 1) if n else 0
    return records, stats


def _merge_ocr_config(extraction_config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Merge extraction_config with env-based config for OCR (dpi, max_pages, preprocess)."""
    try:
        from config.extraction_config import get_extraction_config
        ecfg = get_extraction_config()
        base = {
            "ocr_dpi": ecfg.ocr_dpi,
            "ocr_max_pages": ecfg.ocr_max_pages,
            "ocr_preprocess": ecfg.ocr_preprocess,
        }
    except Exception:
        base = {"ocr_dpi": 300, "ocr_max_pages": 1000, "ocr_preprocess": False}
    return {**base, **(extraction_config or {})}


def _extract_cards_by_position(
    page,
    page_number: int,
    default_booth: str,
    default_constituency: str,
    config: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Extract voter cards using word positions. Divides page into columns by x0,
    groups words per card. Layout: cards_per_row columns × rows_per_page rows.
    """
    cfg = {**EXTRACTION_CONFIG_DEFAULTS, **(config or {})}
    cards_per_row = int(cfg.get("cards_per_row", 3))
    header_top = float(cfg.get("header_top", 120))
    data_bottom = float(cfg.get("data_bottom", 750))
    margin_left = float(cfg.get("margin_left", 20))
    margin_right = float(cfg.get("margin_right", 20))
    # row_gap: vertical gap (px) above which we start a new card
    rows_per_page = int(cfg.get("rows_per_page", 10))
    row_gap = float(cfg.get("row_gap", 0)) or (
        (data_bottom - header_top) / max(1, rows_per_page) * 0.4
    )

    words = page.extract_words(x_tolerance=3, y_tolerance=3) or []
    page_width = float(getattr(page, "width", 612))
    page_height = float(getattr(page, "height", 792))

    # Column boundaries: divide usable width into cards_per_row columns
    usable_left = margin_left
    usable_right = page_width - margin_right
    col_width = (usable_right - usable_left) / cards_per_row
    col_bounds = [
        (usable_left + j * col_width, usable_left + (j + 1) * col_width)
        for j in range(cards_per_row)
    ]

    # Filter words to data region, assign to column by x0
    data_words: List[Tuple[int, float, str]] = []  # (col_idx, top, text)
    for w in words:
        top = w.get("top", 0)
        if top < header_top or top > data_bottom:
            continue
        x0 = w.get("x0", 0)
        text = (w.get("text") or "").strip()
        if not text:
            continue
        for col_idx, (left, right) in enumerate(col_bounds):
            if left <= x0 < right:
                data_words.append((col_idx, top, text))
                break

    if not data_words:
        return []

    # Group by column, then cluster vertically into cards (gap > row_gap = new card)
    by_col: Dict[int, List[Tuple[float, str]]] = {}
    for col_idx, top, text in data_words:
        by_col.setdefault(col_idx, []).append((top, text))
    for col_idx in by_col:
        by_col[col_idx].sort(key=lambda x: x[0])

    all_cards: List[Tuple[int, List[str]]] = []  # (col_idx, lines)
    for col_idx in range(cards_per_row):
        col_words = by_col.get(col_idx, [])
        if not col_words:
            continue
        cards_in_col: List[List[str]] = []
        current: List[Tuple[float, str]] = [col_words[0]]
        for i in range(1, len(col_words)):
            top, text = col_words[i]
            prev_top = current[-1][0]
            if top - prev_top > row_gap and current:
                cards_in_col.append([t for _, t in current])
                current = []
            current.append((top, text))
        if current:
            cards_in_col.append([t for _, t in current])
        for lines in cards_in_col:
            all_cards.append((col_idx, lines))

    records: List[Dict[str, Any]] = []
    for _col_idx, lines in all_cards:
        if not lines:
            continue
        epics_in_col = [ln for ln in lines if RE_EPIC.match(ln)]
        epic = epics_in_col[0] if epics_in_col else None
        if not epic:
            continue
        rec: Dict[str, Any] = {
            "epic_number": epic,
            "name": None,
            "relative_name": "",
            "age": None,
            "gender": None,
            "house_no": "",
            "address": "",
            "booth_number": default_booth,
            "constituency_name": default_constituency,
            "page_number": page_number,
        }
        _parse_one_card_block(lines, rec)
        if len(epics_in_col) > 1:
            rec["_warnings"] = rec.get("_warnings", []) + ["multiple_epics_in_card"]
        if rec.get("name") or rec.get("epic_number"):
            records.append(rec)
    return records


def _apply_positional_card_parsing(block: List[str], rec: Dict[str, Any]) -> None:
    """
    Positional extraction: Line 0 = EPIC/serial, 1 = Name, 2 = Father, 3 = House, 4+ = Age/Gender.
    Only sets fields when the line content matches expected type; does not overwrite with garbage.
    """
    if not block:
        return
    lines = [ln.strip() for ln in block if ln.strip()]
    # Line 0: EPIC or "serial EPIC"
    if lines:
        m = RE_RECORD_START.match(lines[0])
        if m:
            rec["serial_number"] = rec.get("serial_number") or m.group(1)
            if _looks_like_epic(m.group(2)):
                rec["epic_number"] = rec.get("epic_number") or m.group(2)
        elif _looks_like_epic(lines[0]):
            rec["epic_number"] = rec.get("epic_number") or lines[0]
    # Line 1: Name (if not a label line)
    if len(lines) > 1 and not re.match(r"^(?:name|nama|father|house|age|sex|gender)", lines[1], re.I):
        if not RE_EPIC.match(lines[1]) and len(lines[1]) > 1 and not lines[1].isdigit():
            rec["name"] = rec.get("name") or lines[1].rstrip("-").strip()
    # Line 2: Father/relative (if not a label)
    if len(lines) > 2 and not re.match(r"^(?:father|husband|mother|house|age)", lines[2], re.I):
        if not RE_EPIC.match(lines[2]) and len(lines[2]) > 1:
            rec["relative_name"] = rec.get("relative_name") or lines[2].rstrip("-").strip() or ""
    # Line 3: House (digits/slash) or next line that looks like house
    for idx in (3, 4):
        if len(lines) > idx and re.search(r"[\d/]", lines[idx]) and not _is_date_like(lines[idx]):
            if not RE_EPIC.match(lines[idx]) and len(lines[idx]) <= 20:
                rec["house_no"] = rec.get("house_no") or _normalize_house_no(lines[idx]) or ""
                break
    # Age/Gender: look for "digits" and "Male/Female" in remaining lines
    for idx in range(min(4, len(lines)), len(lines)):
        ln = lines[idx]
        m_age = RE_AGE_GENDER_LINE_FUZZY.search(ln) or RE_AGE_FUZZY.search(ln)
        if m_age:
            try:
                a = int(m_age.group(1))
                if 18 <= a <= 120:
                    rec["age"] = rec.get("age") or a
            except (ValueError, TypeError):
                pass
            if m_age.lastindex and m_age.lastindex >= 2 and m_age.group(2):
                g = _normalize_gender(m_age.group(2))
                if g:
                    rec["gender"] = rec.get("gender") or g
        if RE_AGE.match(ln.split()[-1] if ln.split() else ""):
            try:
                a = int(re.sub(r"\D", "", ln))
                if 18 <= a <= 120:
                    rec["age"] = rec.get("age") or a
            except ValueError:
                pass
        g = _normalize_gender(ln)
        if g:
            rec["gender"] = rec.get("gender") or g


def _parse_one_card_block(
    block: List[str],
    rec: Dict[str, Any],
) -> None:
    """
    Fill one voter record from a list of lines (one card).
    Uses keyword-anchor extraction only (no line-position assumptions).
    Optional label-based loop fills remaining gaps.
    """
    # Normalize OCR typos (Cender→Gender, Falher→Father, etc.) and strip footer
    normalized = _normalize_ocr_card_lines(block)
    lines = _strip_footer_from_card_block(normalized)
    lines = _sanitize_block_to_single_voter(lines)
    if not lines:
        return

    # Keyword-anchor extraction first (no positional assumptions)
    _parse_card_keyword_anchored(lines, rec)

    if os.getenv("EXTRACT_DEBUG", "").strip().lower() in ("1", "true", "yes"):
        logger.debug(
            "Parsed card (before gap-fill): epic=%s name=%s relative=%s age=%s gender=%s house_no=%s",
            rec.get("epic_number"), rec.get("name"), rec.get("relative_name"),
            rec.get("age"), rec.get("gender"), rec.get("house_no"),
        )

    # Serial number from first line if "serial EPIC" or standalone digit
    i = 0
    if lines:
        m = RE_RECORD_START.match(lines[0])
        if m:
            rec["serial_number"] = rec.get("serial_number") or m.group(1)
            i = 1
        elif re.match(r"^\d{1,4}$", lines[0]) and len(lines) > 1:
            rec["serial_number"] = rec.get("serial_number") or lines[0]
            i = 1
    # Label-based gap-fill (next-line values, fuzzy labels)
    while i < len(lines):
        bl = lines[i].strip()
        if not bl or bl.lower() in ("photo", "available", "pnoio", "ptoto", "pnoto", "avallable", "availabl", "availablc", "avallablo"):
            i += 1
            continue
        # Name: "Name : value" or "Name" then next line is value
        m_name = RE_NAME_PREFIX.match(bl) or RE_NAME_FUZZY.match(bl)
        if m_name:
            val = (m_name.group(1) or "").strip().rstrip("-")
            if val and val.lower() not in ("name", "naine", "namie", "nama", "namo", "namc"):
                rec["name"] = val
            elif i + 1 < len(lines):
                next_val = lines[i + 1].strip()
                if next_val and not RE_EPIC.match(next_val) and next_val.lower() not in ("name", "father", "house", "age", "gender", "photo", "available"):
                    rec["name"] = next_val.rstrip("-").strip()
                    i += 1
            i += 1
            continue
        # Father/Husband/Mother
        m_f = RE_FATHER.search(bl) or RE_FATHER_FUZZY.match(bl)
        m_h = RE_HUSBAND.search(bl) or RE_HUSBAND_FUZZY.match(bl)
        m_m = RE_MOTHER.search(bl) or RE_MOTHER_FUZZY.match(bl)
        if m_f:
            val = (m_f.group(1) or "").strip().rstrip("-").rstrip('"').strip()
            label_like = re.sub(r"[\s\"]+", "", val).lower() in ("name", "naine", "namie", "nama", "namo", "namc", "narne", "narie") or len(val) < 3
            if val and not label_like:
                rec["relative_name"] = val
            elif i + 1 < len(lines):
                rec["relative_name"] = lines[i + 1].strip().rstrip("-").rstrip('"').strip()
                i += 1
            i += 1
            continue
        if m_h:
            val = (m_h.group(1) or "").strip().rstrip("-")
            if val:
                rec["relative_name"] = val
            elif i + 1 < len(lines):
                rec["relative_name"] = lines[i + 1].strip().rstrip("-").strip()
                i += 1
            i += 1
            continue
        if m_m:
            val = (m_m.group(1) or "").strip().rstrip("-")
            if val:
                rec["relative_name"] = val
            elif i + 1 < len(lines):
                rec["relative_name"] = lines[i + 1].strip().rstrip("-").strip()
                i += 1
            i += 1
            continue
        # House Number (fuzzy)
        m_house = RE_HOUSE_NUMBER_PREFIX.search(bl) or RE_HOUSE_NUMBER_FUZZY.match(bl)
        if m_house:
            val = (m_house.group(1) or "").strip()
            # Only use captured value if it looks like a real house no (has digit/slash or sufficient length)
            sensible = val and not _is_date_like(val) and (re.search(r"[\d/]", val) or len(val) > 3)
            if sensible and not RE_EPIC.match(val):
                rec["house_no"] = _normalize_house_no(val)
            elif i + 1 < len(lines):
                val2 = lines[i + 1].strip()
                if val2 and not _is_date_like(val2) and not RE_EPIC.match(val2):
                    rec["house_no"] = _normalize_house_no(val2)
                    i += 1
            i += 1
            continue
        # Standalone age label "Ago"/"Aga"/"Age" with value on next line (e.g. "32 Genocr", then "Mole")
        if bl.lower() in ("ago", "aga", "age") and i + 1 < len(lines):
            next_ln = lines[i + 1].strip()
            m_next = RE_AGE_LEADING.match(next_ln) or RE_AGE_FUZZY.search(next_ln) or (RE_AGE.match(next_ln) and next_ln)
            if m_next:
                try:
                    a = int(m_next.group(1) if hasattr(m_next, "group") else m_next)
                    if 1 <= a <= 120:
                        rec["age"] = a
                except (ValueError, AttributeError, TypeError):
                    pass
                if i + 2 < len(lines):
                    g_line = lines[i + 2].strip()
                    g_norm = _normalize_gender(g_line)
                    if g_norm and g_norm in ("M", "F"):
                        rec["gender"] = g_norm
                        i += 1
                i += 1
            i += 1
            continue
        # Age + optional Gender on same line: "32 Genocr", "Age 24 Gerer Female", "Aga 24 Gondar Ferala"
        m_age_line = (
            RE_AGE_GENDER_LINE.search(bl)
            or RE_AGE_GENDER_LINE_FUZZY.search(bl)
            or RE_AGE_FUZZY.search(bl)
            or RE_AGE_LEADING.match(bl)
        )
        if m_age_line:
            try:
                a = int(m_age_line.group(1))
                if 1 <= a <= 120:
                    rec["age"] = a
            except ValueError:
                pass
            # Gender may be in group(2) (same line) or next line
            g_val = m_age_line.group(2) if m_age_line.lastindex and m_age_line.lastindex >= 2 else None
            if g_val:
                g_norm = _normalize_gender(g_val)
                if g_norm and g_norm in ("M", "F"):
                    rec["gender"] = g_norm
            elif i + 1 < len(lines):
                g_line = lines[i + 1].strip()
                g_norm = _normalize_gender(g_line)
                if g_norm and g_norm in ("M", "F"):
                    rec["gender"] = g_norm
                    i += 1
            i += 1
            continue
        # Standalone age number
        if RE_AGE.match(bl):
            try:
                a = int(bl)
                if 1 <= a <= 120:
                    rec["age"] = a
            except ValueError:
                pass
            i += 1
            continue
        # Standalone gender line — use _normalize_gender for all OCR variants
        # Only set M/F during parsing; never assign O (validation/default only).
        g_norm = _normalize_gender(bl)
        if g_norm and g_norm in ("M", "F") and not rec.get("gender"):
            rec["gender"] = g_norm
            i += 1
            continue
        # Standalone house number (not EPIC, not date, not a label line)
        bl_lower = bl.lower()
        is_house_label = "hous" in bl_lower and ("num" in bl_lower or "no" in bl_lower)
        if not rec.get("house_no") and RE_HOUSE_NO.match(bl) and len(bl) <= 80 and not is_house_label:
            if not RE_EPIC.match(bl) and not RE_EPIC_ANYWHERE.search(bl) and not _is_date_like(bl):
                rec["house_no"] = _normalize_house_no(bl)
            i += 1
            continue
        # Name fallback: first non-label line that looks like a name
        if rec.get("name") is None and not RE_EPIC.match(bl):
            bl_lower = bl.lower()
            if bl_lower not in ("male", "female", "photo", "available", "name") and not bl.strip().isdigit():
                if "name" not in bl_lower or ":" in bl:
                    rec["name"] = bl.rstrip("-").strip()
        i += 1


def _try_parse_column_layout(
    lines: List[str],
    default_booth: str,
    default_constituency: str,
    page_number: int,
) -> Optional[List[Dict[str, Any]]]:
    """
    When page is a grid of N cards (N columns), text may be: EPIC1, EPIC2, ..., EPICN, then
    row-major cells (Name, name_val, Name, name_val, ...). Detect consecutive EPIC-only lines
    at start, then chunk rest into rows of N and assign each column to a card.
    """
    if len(lines) < 4:
        return None
    # Count consecutive EPIC-only lines at start, or first line with multiple EPICs
    num_cards = 0
    epics: List[str] = []
    i = 0
    first_line = lines[0].strip()
    tokens_first = first_line.split()
    if len(tokens_first) >= 2 and all(RE_EPIC.match(t) for t in tokens_first):
        epics = tokens_first
        num_cards = len(epics)
        i = 1
    else:
        while i < len(lines):
            line = lines[i].strip()
            m = RE_RECORD_START.match(line)
            if m:
                epics.append(m.group(2))
                num_cards += 1
                i += 1
                continue
            if RE_EPIC.match(line):
                epics.append(line)
                num_cards += 1
                i += 1
                continue
            break
    if num_cards < 2:
        return None
    rest = lines[i:]
    if not rest:
        return None
    # Two layouts: (1) Column-major = rest[0:n], rest[n:2n], ... (n = len//num_cards); (2) Row-major = column j = rest[j], rest[j+num_cards], rest[j+2*num_cards], ...
    n = len(rest) // num_cards
    if n < 2:
        return None

    def build_column_major() -> List[List[str]]:
        cols: List[List[str]] = []
        for j in range(num_cards):
            start, end = j * n, (j + 1) * n
            cols.append([ln.strip() for ln in rest[start:end] if ln.strip()])
        return cols

    def build_row_major() -> List[List[str]]:
        cols: List[List[str]] = [[] for _ in range(num_cards)]
        for row_start in range(0, len(rest), num_cards):
            row = rest[row_start : row_start + num_cards]
            for j, cell in enumerate(row):
                if j < num_cards and cell.strip():
                    cols[j].append(cell.strip())
        return cols

    columns = build_column_major()
    # If second line of first column is an EPIC, data is row-major (EPICs ended up in column 0).
    if len(columns[0]) > 1 and RE_EPIC.match(columns[0][1].strip()):
        columns = build_row_major()
    records: List[Dict[str, Any]] = []
    for j in range(num_cards):
        rec: Dict[str, Any] = {
            "epic_number": epics[j] if j < len(epics) else "",
            "serial_number": str(j + 1) if num_cards <= 10 else None,  # best-effort for grid
            "name": None,
            "relative_name": "",
            "age": None,
            "gender": None,
            "house_no": "",
            "address": "",
            "booth_number": default_booth,
            "constituency_name": default_constituency,
            "page_number": page_number,
        }
        _parse_one_card_block(columns[j], rec)
        if rec.get("name") or rec.get("epic_number"):
            records.append(rec)
    return records if records else None


def _parse_voter_cards_from_blocks(
    blocks: List[List[str]],
    default_booth: str,
    default_constituency: str,
    page_number: int = 1,
) -> List[Dict[str, Any]]:
    """
    Parse voter records from pre-segmented card blocks (e.g. from spatial OCR).
    Each block is a list of text lines for one voter card.
    Bypasses segment_page_text — blocks are already correctly separated.
    """
    try:
        from .record_segmentation import count_structural_anomalies
    except ImportError:
        count_structural_anomalies = lambda b: []  # noqa: E731

    # ----- DEBUG: Log raw card blocks BEFORE parsing (segmentation verification) -----
    if os.getenv("EXTRACT_DEBUG", "").strip().lower() in ("1", "true", "yes"):
        debug_page = None
        try:
            debug_page = int(os.getenv("EXTRACT_DEBUG_PAGE", "0"))
        except ValueError:
            pass
        if debug_page == 0 or page_number == debug_page:
            logger.info(
                "Page %d: total card blocks = %d (expected 30 for TN 3×10 grid)",
                page_number, len(blocks),
            )
            for block_idx, block in enumerate(blocks):
                epics_in_block = [ln for ln in block if _looks_like_epic((ln or "").strip())]
                logger.info(
                    "---- CARD BLOCK START (page=%d block=%d/%d, EPICs in block=%d) ----",
                    page_number, block_idx + 1, len(blocks), len(epics_in_block),
                )
                for line in block:
                    logger.info("%s", line)
                logger.info("---- CARD BLOCK END ----")

    records: List[Dict[str, Any]] = []
    for card_index, block in enumerate(blocks):
        if not block:
            continue
        block = _sanitize_block_to_single_voter(block)
        # Use tolerant anchor for blocks from EPIC-first (OCR-noisy EPICs like WQd2597805, WOD2614642)
        epic = None
        for ln in block:
            epic = _extract_epic_token(ln)
            if epic:
                break
        if not epic:
            continue
        rec: Dict[str, Any] = {
            "epic_number": epic,
            "serial_number": None,
            "name": None,
            "relative_name": "",
            "age": None,
            "gender": None,
            "house_no": "",
            "address": "",
            "booth_number": default_booth,
            "constituency_name": default_constituency,
            "page_number": page_number,
            "card_index": card_index,
        }
        _parse_one_card_block(block, rec)
        rec["source_block"] = "\n".join(block)
        anomalies = count_structural_anomalies(block)
        if anomalies:
            rec["_warnings"] = rec.get("_warnings", []) + ["possible_cross_card_merge"] + anomalies
        if rec.get("name") or rec.get("epic_number"):
            records.append(rec)
    return records


def _parse_voter_cards_from_text(
    text: str,
    default_booth: str,
    default_constituency: str,
    page_number: int = 1,
    extraction_config: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Parse voter entries from card-style layout (TN ECI format).
    Flow: (1) Record segmentation (EPIC-split or grid reorder), (2) Column layout, (3) Sequential.
    """
    cfg = extraction_config or {}
    cards_per_row = int(cfg.get("cards_per_row", 3))
    rows_per_page = int(cfg.get("rows_per_page", 10))
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]

    # 1) Record segmentation layer: ensures one-block-per-card before parsing
    try:
        from .record_segmentation import segment_page_text, count_structural_anomalies
        blocks = segment_page_text(text, cards_per_row=cards_per_row, rows_per_page=rows_per_page)
        if blocks:
            records = []
            for block in blocks:
                if not block:
                    continue
                block = _sanitize_block_to_single_voter(block)
                epic = None
                for ln in block:
                    epic = _extract_epic_token(ln)
                    if epic:
                        break
                if not epic:
                    continue
                rec: Dict[str, Any] = {
                    "epic_number": epic,
                    "serial_number": None,
                    "name": None,
                    "relative_name": "",
                    "age": None,
                    "gender": None,
                    "house_no": "",
                    "address": "",
                    "booth_number": default_booth,
                    "constituency_name": default_constituency,
                    "page_number": page_number,
                }
                _parse_one_card_block(block, rec)
                anomalies = count_structural_anomalies(block)
                if anomalies:
                    rec["_warnings"] = rec.get("_warnings", []) + ["possible_cross_card_merge"] + anomalies
                if rec.get("name") or rec.get("epic_number"):
                    records.append(rec)
            if records:
                return records
    except ImportError:
        pass

    # 2) Column grid layout (legacy)
    col_result = _try_parse_column_layout(lines, default_booth, default_constituency, page_number)
    if col_result:
        return col_result

    records: List[Dict[str, Any]] = []
    skip_keywords = ("photo", "available", "electoral roll", "assembly constituency", "part no", "section no", "age as on", "date of publication", "total pages", "page ")
    i = 0
    while i < len(lines):
        line = lines[i]
        line_lower = line.lower()
        if any(s in line_lower for s in skip_keywords):
            i += 1
            continue
        # Check for record start: "serial EPIC" (e.g. "1 WQD2616720") or EPIC alone (e.g. "WQD2616720")
        m = RE_RECORD_START.match(line)
        if m:
            serial_str, epic = m.group(1), m.group(2)
        elif RE_EPIC.match(line):
            epic = line.strip()
            serial_str = None
        else:
            i += 1
            continue
        rec: Dict[str, Any] = {
            "epic_number": epic,
            "serial_number": serial_str,
            "name": None,
            "relative_name": "",
            "age": None,
            "gender": None,
            "house_no": "",
            "address": "",
            "booth_number": default_booth,
            "constituency_name": default_constituency,
            "page_number": page_number,
        }
        # Next lines belong to this card (until next "serial EPIC" or end)
        block: List[str] = []
        i += 1
        while i < len(lines):
            next_line = lines[i]
            if RE_RECORD_START.match(next_line):
                break
            if RE_EPIC.match(next_line):
                # Lone EPIC = start of next card; don't consume so next iteration picks it up
                break
            if RE_RECORD_START_SERIAL_ONLY.match(next_line) and i + 1 < len(lines) and RE_EPIC.match(lines[i + 1].strip()):
                break
            block.append(next_line)
            i += 1
        # Parse block with OCR-tolerant rules (fuzzy labels, next-line values, reject dates as house_no)
        _parse_one_card_block(block, rec)
        if rec.get("name") or rec.get("epic_number"):
            records.append(rec)
    return records


def _parse_voter_cards_fallback(
    text: str,
    default_booth: str,
    default_constituency: str,
    page_number: int = 1,
) -> List[Dict[str, Any]]:
    """
    Fallback: find every line that is exactly an EPIC; treat next 2-10 lines as that card's block.
    Use when main card parser returns 0 (e.g. text order or skip_keywords hid record starts).
    """
    records: List[Dict[str, Any]] = []
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    skip_keywords = ("electoral roll", "assembly constituency", "part no", "section no", "age as on", "date of publication", "total pages", "page ", "summary of electors", "signature of")
    epic_indices = [i for i, line in enumerate(lines) if RE_EPIC.match(line) and not any(s in line.lower() for s in skip_keywords)]
    for idx in epic_indices:
        epic = lines[idx].strip()
        # Serial may be on previous line (standalone digit)
        serial_num = None
        if idx > 0 and re.match(r"^\d{1,4}$", lines[idx - 1]):
            serial_num = lines[idx - 1]
        block = lines[idx + 1 : min(idx + 10, len(lines))]
        # Stop at next EPIC
        stop = next((j for j, ln in enumerate(block) if RE_EPIC.match(ln)), len(block))
        block = block[:stop]
        rec: Dict[str, Any] = {
            "epic_number": epic,
            "serial_number": serial_num,
            "name": None,
            "relative_name": "",
            "age": None,
            "gender": None,
            "house_no": "",
            "address": "",
            "booth_number": default_booth,
            "constituency_name": default_constituency,
            "page_number": page_number,
        }
        _parse_one_card_block(block, rec)
        if rec.get("name") or rec.get("epic_number"):
            records.append(rec)
    return records


def _extract_extended_metadata(first_page_text: str) -> Dict[str, Any]:
    """Extract revision details and polling station from first page (TN ECI cover)."""
    def clean(v: str) -> str:
        return " ".join(v.split()).strip() if v else ""

    out: Dict[str, Any] = {}
    for key, pattern in REVISION_PATTERNS.items():
        m = pattern.search(first_page_text)
        if m:
            out[key] = clean(m.group(1))

    # Sections in the part: "1-Tondiarpet Ward No 38 ..." until "Main Town" or similar
    sections_match = re.search(
        r"No\.\s+and\s+name\s+of\s+sections\s+in\s+the\s+part\s*(.+?)(?=Main\s+Town|Location|Ward\s+no\.|$)",
        first_page_text,
        re.IGNORECASE | re.DOTALL
    )
    if sections_match:
        block = sections_match.group(1)
        sections = []
        for m in RE_SECTION_LINE.finditer(block):
            sections.append(f"{m.group(1)}-{m.group(2).strip()}")
        if sections:
            out["sections_in_part"] = sections

    # Fallback: type of revision often on next line (e.g. "Special Intensive Revision 2026")
    if not out.get("type_of_revision") and re.search(r"Special\s+Intensive\s+Revision", first_page_text, re.IGNORECASE):
        m = re.search(r"(Special\s+Intensive\s+Revision\s*\d{4})", first_page_text, re.IGNORECASE)
        if m:
            out["type_of_revision"] = clean(m.group(1))
    # Fallback: date of publication often on next line (e.g. 19-12-2025)
    if not out.get("date_of_publication"):
        m = re.search(r"date\s+of\s+publication\s*[:\-]?\s*(\d{2}-\d{2}-\d{4})", first_page_text, re.IGNORECASE)
        if not m:
            m = re.search(r"date\s+of\s+publication[^\d]*(?:[\s\n]+[^\n]*)?(\d{2}-\d{2}-\d{4})", first_page_text, re.IGNORECASE)
        if m:
            out["date_of_publication"] = m.group(1)
    return out


def _extract_metadata_from_text(first_page_text: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """Extract constituency_name, part_no (booth), part_name from first page text (TN ECI format)."""
    constituency_name = None
    part_no = None
    part_name = None
    for pattern_name, pattern in HEADER_PATTERNS.items():
        if pattern_name == "constituency_alt":
            if not constituency_name:
                m = pattern.search(first_page_text)
                if m:
                    constituency_name = m.group(1).strip()
            continue
        if pattern_name == "constituency_same_line":
            if not constituency_name:
                m = pattern.search(first_page_text)
                if m:
                    constituency_name = m.group(1).strip()
            continue
        if pattern_name == "parliamentary":
            continue
        m = pattern.search(first_page_text)
        if m:
            val = m.group(1).strip()
            if pattern_name == "constituency":
                constituency_name = val
            elif pattern_name == "part_no":
                part_no = val
            elif pattern_name == "part_name":
                part_name = val
    return constituency_name, part_no, part_name


def _get_page_text(page) -> str:
    """
    Get full text from a pdfplumber page. Tries extract_text(layout=True), then
    extract_text(), then builds text from page.chars when extract returns empty.
    """
    text = page.extract_text(layout=True) or page.extract_text() or ""
    if text and text.strip():
        return text
    # Fallback: build from raw chars (handles PDFs where extract_text returns empty)
    chars = getattr(page, "chars", None) or []
    if not chars:
        return ""
    # Group chars by line (same top within tolerance), then sort by x within line
    line_tolerance = 3
    lines_dict: Dict[float, List[Any]] = {}
    for c in chars:
        top = round(c.get("top", 0) / line_tolerance) * line_tolerance
        if top not in lines_dict:
            lines_dict[top] = []
        lines_dict[top].append(c)
    lines = []
    for top in sorted(lines_dict.keys()):
        line_chars = sorted(lines_dict[top], key=lambda x: x.get("x0", 0))
        line_text = "".join(str(ch.get("text", "")) for ch in line_chars)
        if line_text.strip():
            lines.append(line_text)
    return "\n".join(lines)


def get_pdf_page_texts(pdf_path: str | Path, max_pages: int = 20) -> List[Dict[str, Any]]:
    """Return full extracted text for each page (using _get_page_text). For frontend to show entire data."""
    try:
        import pdfplumber
    except ImportError:
        return []
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        return []
    result = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages[:max_pages]):
            text = _get_page_text(page)
            result.append({"page": i + 1, "length": len(text), "text": text})
    return result


def debug_pdf(pdf_path: str | Path) -> Dict[str, Any]:
    """
    Inspect PDF structure: first page text, table count, and first table preview.
    Use this when extract_from_pdf returns 0 records to see the actual format.
    """
    try:
        import pdfplumber
    except ImportError:
        raise ImportError("pdfplumber is required. Install with: pip install pdfplumber")
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")
    out: Dict[str, Any] = {"first_page_text": "", "first_page_text_length": 0, "table_count": 0, "table_preview": [], "table_count_text_strategy": 0}
    with pdfplumber.open(pdf_path) as pdf:
        if not pdf.pages:
            return out
        page = pdf.pages[0]
        text = _get_page_text(page)
        out["first_page_text"] = text
        out["first_page_text_length"] = len(text)
        tables = page.extract_tables()
        out["table_count"] = len(tables)
        if tables:
            for i, t in enumerate(tables[:2]):
                out["table_preview"].append({"table_index": i, "row_count": len(t), "first_3_rows": [list(r) for r in (t[:3] if len(t) >= 3 else t)]})
        # Also try text strategy
        text_tables = page.extract_tables(table_settings={"vertical_strategy": "text", "horizontal_strategy": "text", "min_words_vertical": 2})
        out["table_count_text_strategy"] = len(text_tables)
        if text_tables and not out["table_preview"]:
            for i, t in enumerate(text_tables[:2]):
                out["table_preview"].append({"table_index": i, "strategy": "text", "row_count": len(t), "first_3_rows": [list(r) for r in (t[:3] if len(t) >= 3 else t)]})
    return out


def extract_from_pdf(
    pdf_path: str | Path,
    default_constituency_name: Optional[str] = None,
    default_booth_number: Optional[str] = None,
    use_ocr: bool = False,
    extraction_config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Extract voter records from an ECI-style electoral roll PDF.

    Args:
        pdf_path: Path to the PDF file.
        default_constituency_name: Override constituency if not found in PDF.
        default_booth_number: Override booth/part number if not found in PDF.
        use_ocr: If True and PDF has no text layer, use OCR (needs pdf2image, pytesseract, Tesseract).
        extraction_config: Optional config for position-based extraction (ABBYY-like).
            Keys: cards_per_row (default 9), header_top, data_bottom, margin_left, margin_right.

    Returns:
        {
            "records": [ {"epic_number", "name", "relative_name", "age", "gender", "house_no", "address", "booth_number", "constituency_name"}, ... ],
            "metadata": { "constituency_name", "booth_number", "part_name", "pages_processed", "raw_headers" }
        }
    """
    try:
        import pdfplumber
    except ImportError:
        raise ImportError("pdfplumber is required for PDF extraction. Install with: pip install pdfplumber")

    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    all_records: List[Dict[str, Any]] = []
    first_page_text = ""
    raw_headers: List[str] = []
    pages_processed = 0
    booth = default_booth_number or ""
    constituency = default_constituency_name or ""
    raw_page_texts: List[Dict[str, Any]] = []

    # Table settings for borderless tables (ECI PDFs often have no grid lines)
    text_table_settings = {
        "vertical_strategy": "text",
        "horizontal_strategy": "text",
        "min_words_vertical": 2,
        "min_words_horizontal": 1,
    }

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages):
            text = _get_page_text(page)
            raw_page_texts.append({"page": page_num + 1, "length": len(text), "text": text})
            if page_num == 0:
                first_page_text = text
                # Resolve metadata from first page so data pages get correct booth/constituency
                cn, pn, pname = _extract_metadata_from_text(first_page_text)
                if not constituency and cn:
                    constituency = cn
                if not booth and pn:
                    booth = pn
                if pname and not raw_headers:
                    raw_headers = []  # will be set from table or left empty
            tables = page.extract_tables()
            # If no tables found, try text-based detection (borderless tables)
            if not tables:
                tables = page.extract_tables(table_settings=text_table_settings)
            page_record_count_before = len(all_records)
            if tables and not all(len(t) < 2 for t in tables):
                for table in tables:
                    if not table or len(table) < 2:
                        continue
                    for header_idx in (0, 1):
                        if header_idx >= len(table):
                            break
                        header_row = table[header_idx]
                        header_row = [str(h).strip() if h is not None else "" for h in header_row]
                        mapped_headers = [_normalize_column_header(h) for h in header_row]
                        if any(mapped_headers):
                            break
                    data_start = header_idx + 1
                    if not any(mapped_headers) or data_start >= len(table):
                        continue
                    raw_headers = raw_headers or list(header_row)
                    for data_row in table[data_start:]:
                        if data_row is None:
                            continue
                        data_row = [str(c).strip() if c is not None else "" for c in data_row]
                        rec = _map_row_to_record(mapped_headers, data_row, booth, constituency)
                        if rec:
                            rec["page_number"] = page_num + 1
                            all_records.append(rec)
            # Try text-based segmentation (grid-aware) for voter card pages.
            # Skip page 0 (cover) and page 1 (map) — they have no voter cards.
            # Only run if tables extraction didn't already find records on this page.
            page_no = page_num + 1
            card_records: List[Dict[str, Any]] = []
            tables_added_records = len(all_records) > page_record_count_before
            if page_num >= 2 and not tables_added_records and text.strip():
                card_records = _parse_voter_cards_from_text(text, booth, constituency, page_no, extraction_config)
                if not card_records and RE_EPIC_ANYWHERE.search(text):
                    card_records = _parse_voter_cards_fallback(text, booth, constituency, page_no)
            # Position-based extraction as last fallback when text-based yields nothing
            if not card_records and not tables_added_records and page_num >= 2 and RE_EPIC_ANYWHERE.search(text):
                try:
                    pos_records = _extract_cards_by_position(
                        page, page_no, booth, constituency, extraction_config
                    )
                    if pos_records:
                        card_records = pos_records
                except Exception as e:
                    logger.debug("Position-based extraction failed for page %s: %s", page_no, e)
            if card_records:
                all_records.extend(card_records)
            elif not tables_added_records and text.strip():
                _append_from_text_lines(text, all_records, booth, constituency, page_no)
            else:
                for rec in all_records[page_record_count_before:]:
                    rec["page_number"] = page_no
            pages_processed += 1

    # If no text was extracted from any page (image-only PDF), run OCR automatically.
    # When use_ocr is True, always run OCR for extraction so we get per-card segmentation
    # (EPIC-first) instead of row-major text layer, which produces wrong field alignment.
    all_text_empty = all((not (p.get("text") or "").strip()) for p in raw_page_texts)
    run_ocr = use_ocr or (not all_records and all_text_empty) or (
        not all_records and use_ocr and (not first_page_text or not first_page_text.strip())
    )
    if run_ocr and use_ocr and all_records:
        # Force OCR path: discard text-layer records so we replace with OCR (per-card) results.
        all_records = []
    segmentation_metrics_ocr: Optional[Dict[str, Any]] = None
    if run_ocr:
        cfg = _merge_ocr_config(extraction_config)
        ecfg = extraction_config or {}
        num_cols = int(ecfg.get("cards_per_row", 3))
        # Spatial OCR: returns per-page list of pre-segmented card blocks
        page_blocks_list = _extract_blocks_via_ocr(
            pdf_path,
            max_pages=cfg.get("ocr_max_pages", 1000),
            dpi=cfg.get("ocr_dpi", 300),
            preprocess=cfg.get("ocr_preprocess", False),
            num_cols=num_cols,
            extraction_config=ecfg,
        )
        if page_blocks_list:
            # Build flat text for metadata extraction from first page
            first_page_lines = [ln for block in (page_blocks_list[0] if page_blocks_list else []) for ln in block]
            first_page_text_ocr = "\n".join(first_page_lines)
            raw_page_texts = [
                {"page": i + 1, "length": sum(len(b) for b in pg), "text": "\n".join(ln for b in pg for ln in b)}
                for i, pg in enumerate(page_blocks_list)
            ]
            cn, pn, pname = _extract_metadata_from_text(first_page_text_ocr)
            if not constituency and cn:
                constituency = cn
            if not booth and pn:
                booth = pn
            if not first_page_text:
                first_page_text = first_page_text_ocr

            for ocr_page_idx, page_blocks in enumerate(page_blocks_list):
                page_no = ocr_page_idx + 1
                if not page_blocks:
                    continue
                # If spatial OCR returned multiple blocks → parse directly (already segmented)
                if len(page_blocks) > 1:
                    card_records = _parse_voter_cards_from_blocks(
                        page_blocks, booth, constituency, page_no
                    )
                else:
                    # Single block = flat text fallback; use text-based parser
                    page_text = "\n".join(page_blocks[0]) if page_blocks else ""
                    card_records = _parse_voter_cards_from_text(
                        page_text, booth, constituency, page_no, extraction_config
                    )
                    if not card_records and RE_EPIC_ANYWHERE.search(page_text):
                        card_records = _parse_voter_cards_fallback(page_text, booth, constituency, page_no)
                if card_records:
                    all_records.extend(card_records)
                else:
                    page_text = "\n".join(ln for b in page_blocks for ln in b)
                    _append_from_text_lines(page_text, all_records, booth, constituency, page_no)
            pages_processed = len(page_blocks_list)
            logger.info(
                "Spatial OCR complete: %d pages, %d records extracted",
                pages_processed,
                len(all_records),
            )
            total_cards = sum(len(p) for p in page_blocks_list)
            segmentation_metrics_ocr = {
                "total_cards_extracted": total_cards,
                "pages_with_blocks": sum(1 for p in page_blocks_list if p),
                "pages_processed": pages_processed,
            }

    # Resolve metadata from PDF header if not provided
    constituency_name, part_no, part_name = _extract_metadata_from_text(first_page_text)
    if default_constituency_name:
        constituency_name = default_constituency_name
    if default_booth_number:
        part_no = default_booth_number
    if not part_no and all_records:
        part_no = all_records[0].get("booth_number") or ""
    if not constituency_name and all_records:
        constituency_name = all_records[0].get("constituency_name") or ""

    # Apply metadata and EPIC normalization (WOD→WQD, WQ0→WQD for OCR errors)
    cfg = extraction_config or {}
    try:
        from services.epic_validation import repair_epic as _repair_epic
    except ImportError:
        _repair_epic = None
    for r in all_records:
        if not r.get("booth_number") and part_no:
            r["booth_number"] = part_no
        if not r.get("constituency_name") and constituency_name:
            r["constituency_name"] = constituency_name
        if r.get("epic_number"):
            normalized, prefix_fixed = _normalize_epic(r["epic_number"], cfg)
            r["epic_number"] = normalized
            if prefix_fixed:
                r.setdefault("_warnings", [])
                if "epic_prefix_ocr_corrected" not in r["_warnings"]:
                    r["_warnings"].append("epic_prefix_ocr_corrected")
            # EPIC validation + auto-repair (strict-script style): repair if still invalid
            if _repair_epic and normalized and not RE_EPIC_VALID.match(normalized):
                repaired, was_repaired = _repair_epic(normalized)
                if was_repaired and repaired and RE_EPIC_VALID.match(repaired):
                    r["epic_number"] = repaired
                    r.setdefault("_warnings", [])
                    if "epic_auto_repaired" not in r["_warnings"]:
                        r["_warnings"].append("epic_auto_repaired")
        r.setdefault("serial_number", None)

    # Structural layer: validation, confidence scoring, duplicate detection
    all_records, validation_stats = _validate_and_score_records(all_records)

    # ----- DEBUG: 5) Parsed record (wrong output); 6) Expected record template (manual) -----
    debug_cfg = _get_debug_config()
    if debug_cfg:
        debug_dir = debug_cfg["debug_dir"]
        debug_dir.mkdir(parents=True, exist_ok=True)
        page_records = [r for r in all_records if r.get("page_number") == debug_cfg["debug_page"]]
        idx = debug_cfg["debug_card_index"]
        if idx < len(page_records):
            rec = page_records[idx]
            parsed_out = {
                "epic": rec.get("epic_number"),
                "name": rec.get("name"),
                "father_name": rec.get("relative_name"),
                "house_no": rec.get("house_no"),
                "age": rec.get("age"),
                "gender": rec.get("gender"),
                "page_number": rec.get("page_number"),
                "validation_status": rec.get("validation_status"),
                "confidence_score": rec.get("confidence_score"),
            }
            with open(debug_dir / "parsed_record.json", "w", encoding="utf-8") as f:
                json.dump(parsed_out, f, indent=2, ensure_ascii=False)
            expected_template = {
                "epic": "",
                "name": "",
                "father_name": "",
                "house_no": "",
                "age": None,
                "gender": "",
                "_comment": "Fill in correct values for comparison",
            }
            with open(debug_dir / "expected_record.json", "w", encoding="utf-8") as f:
                json.dump(expected_template, f, indent=2, ensure_ascii=False)
            logger.info("DEBUG: wrote parsed_record.json and expected_record.json to %s", debug_dir)

    meta = {
        "constituency_name": constituency_name or "",
        "booth_number": part_no or "",
        "part_name": _extract_metadata_from_text(first_page_text)[2] or "",
        "pages_processed": pages_processed,
        "raw_headers": raw_headers,
    }
    meta.update(_extract_extended_metadata(first_page_text))
    meta["validation_stats"] = validation_stats
    if segmentation_metrics_ocr:
        meta["segmentation_metrics"] = segmentation_metrics_ocr
    return {
        "records": all_records,
        "metadata": meta,
        "raw_page_texts": raw_page_texts,
    }


def _append_from_text_lines(
    text: str,
    records: List[Dict[str, Any]],
    default_booth: str,
    default_constituency: str,
    page_number: int = 1,
) -> None:
    """
    Fallback: parse lines that look like voter entries.
    ECI PDFs often extract as: "S.No  EPIC No   Name   Father's Name   Age  Sex  House No   Address"
    Split by 2+ spaces or tabs; require at least name-like and number (age or EPIC).
    """
    # Skip header-like lines
    header_keywords = ("epic", "name of elector", "father", "husband", "age", "sex", "house no", "address", "s.no", "sl no", "serial")
    for line in text.splitlines():
        line = line.strip()
        if not line or len(line) < 15:
            continue
        line_lower = line.lower()
        if any(h in line_lower for h in header_keywords) and ("elector" in line_lower or "name" in line_lower and "father" in line_lower or "s.no" in line_lower):
            continue
        parts = re.split(r"\t+|\s{2,}", line)
        parts = [p.strip() for p in parts if p.strip()]
        if len(parts) < 3:
            continue
        # Find age (1-3 digit number, 18-120) and EPIC (alphanumeric, often starts with letters)
        age_val = None
        epic_val = None
        name_candidates = []
        for i, p in enumerate(parts):
            if p.isdigit() and 1 <= len(p) <= 3:
                n = int(p)
                if 18 <= n <= 120:
                    age_val = n
            if re.match(r"^[A-Za-z]{2,4}[0-9]{5,}$", p.replace(" ", "")) or (len(p) >= 6 and p.replace(" ", "").isalnum()):
                epic_val = p.replace(" ", "")
            if p and not p.isdigit() and len(p) > 2 and not re.match(r"^[0-9/\-]+$", p):
                name_candidates.append(p)
        if not name_candidates and not epic_val:
            continue
        # Build record: try common order S.No, EPIC, Name, Relative, Age, Sex, House No, Address
        name = name_candidates[0] if name_candidates else ""
        relative = name_candidates[1] if len(name_candidates) > 1 else ""
        rec = {
            "epic_number": epic_val or None,
            "name": name,
            "relative_name": relative,
            "age": age_val,
            "gender": None,
            "house_no": "",
            "address": " ".join(parts[5:]) if len(parts) > 5 else "",
            "booth_number": default_booth,
            "constituency_name": default_constituency,
            "page_number": page_number,
        }
        for i, p in enumerate(parts):
            if p in ("M", "F", "Male", "Female"):
                rec["gender"] = "M" if p.upper().startswith("M") else "F"
                break
            if i >= 4 and p and re.match(r"^[0-9/\-\.A-Za-z]+$", p) and not rec.get("house_no"):
                rec["house_no"] = _normalize_house_no(p)
                break
        if rec.get("name") or rec.get("epic_number"):
            records.append(rec)


def _detect_voter_boxes_adaptive(page_img: "Any") -> List[Tuple[int, int, int, int]]:
    """
    Adaptive smart grid detection: find voter card boxes by contour area clustering.
    Returns list of (x, y, w, h) sorted by (y, x). Use with use_hybrid_contour for per-card OCR.
    """
    try:
        import cv2
        import numpy as np
    except ImportError:
        return []
    if hasattr(page_img, "size"):
        arr = np.array(page_img)
        gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY) if len(arr.shape) == 3 else arr
    else:
        gray = cv2.imread(str(page_img), cv2.IMREAD_GRAYSCALE)
        if gray is None:
            return []
    th = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, 10
    )
    contours, _ = cv2.findContours(th, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boxes = []
    areas = []
    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        if y < 80:
            continue
        area = w * h
        areas.append(area)
        boxes.append((x, y, w, h, area))
    if not areas:
        return []
    median_area = float(np.median(areas))
    final = [
        (x, y, w, h)
        for x, y, w, h, a in boxes
        if 0.6 * median_area < a < 1.5 * median_area
    ]
    return sorted(final, key=lambda b: (b[1], b[0]))


def _save_debug_page_with_boxes(
    page_img: "Any",
    boxes: List[Tuple[int, int, int, int]],
    path: str,
) -> None:
    """Draw green rectangles around detected card boxes and save for visual debug."""
    try:
        import cv2
        import numpy as np
    except ImportError:
        return
    if hasattr(page_img, "size"):
        img = cv2.cvtColor(np.array(page_img), cv2.COLOR_RGB2BGR)
    else:
        img = cv2.imread(str(page_img))
        if img is None:
            return
    for (x, y, w, h) in boxes:
        cv2.rectangle(img, (x, y), (x + w, y + h), (0, 255, 0), 2)
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        cv2.imwrite(path, img)
    except OSError:
        pass
