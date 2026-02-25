import os
import re
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Tuple


# Strict EPIC: 3 letters + 7 digits
RE_EPIC_STRICT = re.compile(r"\b([A-Z]{3}\d{7})\b")
RE_AGE_2DIGIT = re.compile(r"\b(\d{2})\b")
RE_GENDER = re.compile(r"\b(M|F)\b", re.IGNORECASE)


@dataclass(frozen=True)
class TextElement:
    page: int
    text: str
    # x0, y0, x1, y1
    bbox: Tuple[float, float, float, float]


def _clean_text(s: str) -> str:
    s = (s or "").replace("\u00a0", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _safe_float(v: Any, default: float = 0.0) -> float:
    try:
        return float(v)
    except Exception:
        return default


def _as_bbox(val: Any) -> Optional[Tuple[float, float, float, float]]:
    """
    Best-effort conversion for a bbox-like object to (x0,y0,x1,y1).
    Docling element schemas may vary by version; we keep this permissive.
    """
    if val is None:
        return None
    # Common: tuple/list of 4 numbers
    if isinstance(val, (list, tuple)) and len(val) == 4:
        x0, y0, x1, y1 = val
        return (_safe_float(x0), _safe_float(y0), _safe_float(x1), _safe_float(y1))
    # Common: dict with keys
    if isinstance(val, dict):
        keys = list(val.keys())
        if all(k in val for k in ("x0", "y0", "x1", "y1")):
            return (
                _safe_float(val["x0"]),
                _safe_float(val["y0"]),
                _safe_float(val["x1"]),
                _safe_float(val["y1"]),
            )
        if all(k in val for k in ("left", "top", "right", "bottom")):
            return (
                _safe_float(val["left"]),
                _safe_float(val["top"]),
                _safe_float(val["right"]),
                _safe_float(val["bottom"]),
            )
        # Some libs store points
        if "bbox" in val:
            return _as_bbox(val.get("bbox"))
        if "rect" in val:
            return _as_bbox(val.get("rect"))
        if "coordinates" in val:
            return _as_bbox(val.get("coordinates"))
    # Object with attributes
    for attr in ("bbox", "rect", "coordinates"):
        if hasattr(val, attr):
            return _as_bbox(getattr(val, attr))
    return None


def _iter_docling_text_elements(document: Any) -> List[TextElement]:
    """
    Convert Docling document to a list of TextElement(text + bbox).
    We only keep elements that have both non-empty text and bbox.
    """
    elements: List[TextElement] = []

    # Docling commonly exposes document.elements
    raw_elements: Iterable[Any] = getattr(document, "elements", None) or []

    for el in raw_elements:
        text = _clean_text(getattr(el, "text", "") or "")
        if not text:
            continue

        bbox = None
        # Try a few known locations
        if hasattr(el, "bbox"):
            bbox = _as_bbox(getattr(el, "bbox"))
        if bbox is None and hasattr(el, "prov"):
            prov = getattr(el, "prov")
            bbox = _as_bbox(getattr(prov, "bbox", None)) or _as_bbox(getattr(prov, "rect", None))

        if bbox is None:
            continue

        page = int(getattr(el, "page", getattr(el, "page_no", 1) or 1) or 1)
        elements.append(TextElement(page=page, text=text, bbox=bbox))

    return elements


def group_elements_into_blocks(
    elements: List[TextElement],
    line_y_threshold: float = 6.0,
    block_y_gap_threshold: float = 28.0,
) -> List[Dict[str, Any]]:
    """
    Group TextElements into blocks based on vertical spacing.

    1) cluster into lines (same page + y0 proximity)
    2) cluster lines into blocks by larger vertical gaps

    Returns blocks with:
      { page, bbox, lines: [str], elements: [TextElement] }
    """
    if not elements:
        return []

    # Sort reading order: page, y0, x0
    els = sorted(elements, key=lambda e: (e.page, e.bbox[1], e.bbox[0]))

    # Step 1: group elements into text "lines"
    #
    # Prefer SciPy clustering when available (more robust to jittery y positions).
    # Fallback to a deterministic sequential clustering when SciPy is not installed.
    lines: List[Dict[str, Any]] = []

    def _emit_line(page: int, line_elems: List[TextElement]) -> None:
        if not line_elems:
            return
        line_elems = sorted(line_elems, key=lambda e: e.bbox[0])  # left->right
        line_text = _clean_text(" ".join(e.text for e in line_elems))
        if not line_text:
            return
        x0 = min(e.bbox[0] for e in line_elems)
        y0 = min(e.bbox[1] for e in line_elems)
        x1 = max(e.bbox[2] for e in line_elems)
        y1 = max(e.bbox[3] for e in line_elems)
        lines.append({"page": page, "y0": y0, "bbox": (x0, y0, x1, y1), "text": line_text, "elements": line_elems})

    def _group_lines_scipy(page_els: List[TextElement]) -> None:
        import numpy as np
        from scipy.cluster.hierarchy import fclusterdata  # type: ignore

        ys = np.array([e.bbox[1] for e in page_els], dtype=float).reshape(-1, 1)
        labels = fclusterdata(ys, t=float(line_y_threshold), criterion="distance", metric="euclidean")
        by_label: Dict[int, List[TextElement]] = {}
        for el, lab in zip(page_els, labels):
            by_label.setdefault(int(lab), []).append(el)
        # Stable order: by min y0 then min x0
        ordered = sorted(
            by_label.values(),
            key=lambda group: (min(e.bbox[1] for e in group), min(e.bbox[0] for e in group)),
        )
        page = page_els[0].page
        for group in ordered:
            _emit_line(page, group)

    def _group_lines_fallback(page_els: List[TextElement]) -> None:
        page = page_els[0].page
        page_els = sorted(page_els, key=lambda e: (e.bbox[1], e.bbox[0]))
        current: List[TextElement] = []
        current_y: Optional[float] = None
        for el in page_els:
            y0 = el.bbox[1]
            if current_y is None:
                current = [el]
                current_y = y0
                continue
            if abs(y0 - current_y) <= line_y_threshold:
                current.append(el)
            else:
                _emit_line(page, current)
                current = [el]
                current_y = y0
        _emit_line(page, current)

    # Group per page
    i = 0
    while i < len(els):
        page = els[i].page
        j = i
        while j < len(els) and els[j].page == page:
            j += 1
        page_els = els[i:j]
        try:
            _group_lines_scipy(page_els)
        except Exception:
            _group_lines_fallback(page_els)
        i = j

    if not lines:
        return []

    # Step 2: group lines into blocks by vertical gaps
    blocks: List[Dict[str, Any]] = []
    current_block_lines: List[Dict[str, Any]] = [lines[0]]

    def flush_block():
        nonlocal current_block_lines
        if not current_block_lines:
            return
        page = current_block_lines[0]["page"]
        block_lines_text = [ln["text"] for ln in current_block_lines if ln["text"]]
        if not block_lines_text:
            current_block_lines = []
            return

        # bbox union
        x0 = min(ln["bbox"][0] for ln in current_block_lines)
        y0 = min(ln["bbox"][1] for ln in current_block_lines)
        x1 = max(ln["bbox"][2] for ln in current_block_lines)
        y1 = max(ln["bbox"][3] for ln in current_block_lines)
        block_elements: List[TextElement] = []
        for ln in current_block_lines:
            block_elements.extend(ln["elements"])
        blocks.append(
            {
                "page": page,
                "bbox": (x0, y0, x1, y1),
                "lines": block_lines_text,
                "elements": block_elements,
            }
        )
        current_block_lines = []

    for ln in lines[1:]:
        prev = current_block_lines[-1]
        if ln["page"] != prev["page"]:
            flush_block()
            current_block_lines = [ln]
            continue
        gap = ln["y0"] - prev["y0"]
        if gap > block_y_gap_threshold:
            flush_block()
            current_block_lines = [ln]
        else:
            current_block_lines.append(ln)

    flush_block()
    return blocks


def _extract_house_no(lines: List[str]) -> Optional[str]:
    # Very loose; electoral rolls vary by state.
    for ln in lines:
        m = re.search(r"\b(HOUSE|H\.?NO|HOUSE NO|DOOR NO)\b[:\-]?\s*([A-Z0-9/\-]+)", ln, re.IGNORECASE)
        if m:
            return _clean_text(m.group(2))
    # fallback: a short alphanumeric token
    for ln in lines:
        m = re.search(r"\b([A-Z]?\d{1,4}[A-Z]?(?:/\d{1,4})?)\b", ln)
        if m:
            return _clean_text(m.group(1))
    return None


def _extract_serial(lines: List[str]) -> Optional[str]:
    # Typical formats: "1 ABC1234567" or "1." or "S.No 1"
    for ln in lines[:2]:
        m = re.match(r"^\s*(\d{1,4})\s*[.)]?\s+", ln)
        if m:
            return m.group(1)
    return None


def parse_voter_block(lines: List[str]) -> Optional[Dict[str, Any]]:
    """
    Parse one voter block.
    Returns None if the block doesn't look like a voter card.
    """
    clean_lines = [_clean_text(l) for l in lines if _clean_text(l)]
    if not clean_lines:
        return None

    full = " ".join(clean_lines).upper()
    epic_m = RE_EPIC_STRICT.search(full)
    epic = epic_m.group(1) if epic_m else None
    if not epic:
        return None

    age = None
    for m in RE_AGE_2DIGIT.finditer(full):
        try:
            a = int(m.group(1))
            if 18 <= a <= 120:
                age = a
                break
        except Exception:
            continue

    gender = None
    gm = RE_GENDER.search(full)
    if gm:
        gender = gm.group(1).upper()

    serial_no = _extract_serial(clean_lines)
    house_no = _extract_house_no(clean_lines)

    voter_name = None
    relation_name = None

    # Prefer labeled extraction if present
    for ln in clean_lines:
        if re.search(r"\bNAME\b", ln, re.IGNORECASE):
            voter_name = _clean_text(ln.split(":", 1)[-1])
        if re.search(r"\b(FATHER|HUSBAND|MOTHER)\b", ln, re.IGNORECASE):
            relation_name = _clean_text(ln.split(":", 1)[-1])

    # Fallback: pick plausible name-like line around EPIC
    if not voter_name:
        # choose first line that isn't epic/age/gender-like
        for ln in clean_lines:
            if RE_EPIC_STRICT.search(ln.upper()):
                continue
            if re.search(r"\b(AGE|SEX|GENDER|HOUSE|H\.?NO|DOOR)\b", ln, re.IGNORECASE):
                continue
            if len(ln) >= 3:
                voter_name = ln
                break

    # Confidence (0..1)
    filled = 0
    for v in (serial_no, epic, voter_name, relation_name, house_no, age, gender):
        if v is not None and v != "":
            filled += 1
    confidence = round(filled / 7.0, 2)

    return {
        "serial_no": serial_no,
        "epic": epic,
        "voter_name": voter_name,
        "relation_name": relation_name,
        "house_no": house_no,
        "age": age,
        "gender": gender,
        "confidence": confidence,
    }


def extract_voters_from_pdf(
    pdf_path: str,
    *,
    line_y_threshold: float = 6.0,
    block_y_gap_threshold: float = 28.0,
    max_num_pages: Optional[int] = 15,
) -> List[Dict[str, Any]]:
    """
    Docling-based extractor:
      PDF -> Docling layout -> Text elements (with bbox) -> blocks -> parsed voters -> validation.
    Limits processing to max_num_pages to avoid std::bad_alloc on large/high-res PDFs.
    """
    # Lazy import so the service doesn't crash at import-time if docling isn't installed.
    try:
        from docling.document_converter import DocumentConverter  # type: ignore
    except ModuleNotFoundError as e:
        raise RuntimeError("Docling is not installed. Install with: pip install docling") from e

    converter = DocumentConverter()
    # Limit pages to avoid OOM (std::bad_alloc) on large PDFs; Docling supports max_num_pages.
    convert_kw: Dict[str, Any] = {}
    if max_num_pages is not None and max_num_pages > 0:
        convert_kw["max_num_pages"] = max_num_pages
    try:
        result = converter.convert(pdf_path, **convert_kw)
    except TypeError:
        # Older Docling may not support max_num_pages
        result = converter.convert(pdf_path)
    document = getattr(result, "document", None)
    if document is None:
        return []

    elements = _iter_docling_text_elements(document)
    blocks = group_elements_into_blocks(
        elements,
        line_y_threshold=line_y_threshold,
        block_y_gap_threshold=block_y_gap_threshold,
    )

    out: List[Dict[str, Any]] = []
    seen_epics: set[str] = set()

    for b in blocks:
        parsed = parse_voter_block(b.get("lines") or [])
        if not parsed:
            continue
        epic = parsed.get("epic")
        if not epic or not RE_EPIC_STRICT.match(str(epic).upper()):
            continue
        if epic in seen_epics:
            continue
        seen_epics.add(epic)
        out.append(parsed)

    return out


def is_scanned_pdf_quick(pdf_path: str, sample_pages: int = 2, min_chars: int = 50) -> bool:
    """
    Quick heuristic using PyMuPDF text layer; used to annotate metadata only.
    (Docling itself may still OCR.)
    """
    try:
        import fitz  # PyMuPDF
    except Exception:
        return False
    doc = fitz.open(pdf_path)
    try:
        total = 0
        n = min(sample_pages, len(doc))
        for i in range(n):
            total += len((doc[i].get_text() or "").strip())
        if n == 0:
            return True
        return (total / n) < min_chars
    finally:
        doc.close()

