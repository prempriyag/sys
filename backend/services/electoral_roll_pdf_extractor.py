"""
Electoral Roll PDF Extractor - SIR Data Acquisition Module
Per SOP Section 3: Data Acquisition & Standardization.
Parses ECI-style electoral roll PDFs (e.g. SIR Draft Roll) and returns
standardized rows for database ingestion.

If the PDF has no text layer (scanned/image PDF), use --ocr when running
the CLI script (requires: pip install pdf2image pytesseract, and Tesseract installed).
"""
import re
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)


def _extract_text_via_ocr(pdf_path: Path, max_pages: Optional[int] = 50) -> List[str]:
    """
    Extract text from PDF using OCR (for scanned/image PDFs with no text layer).
    Tries pdf2image (needs poppler) first; if that fails, uses PyMuPDF (no poppler needed).
    Requires: pytesseract + Tesseract OCR; and either pdf2image+poppler OR pymupdf.
    """
    try:
        import pytesseract
    except ImportError:
        logger.warning("OCR skipped: install pytesseract (and Tesseract OCR) for scanned PDFs.")
        return []

    images = []
    # 1) Try pdf2image (requires poppler on PATH - often missing on Windows)
    try:
        from pdf2image import convert_from_path
        images = convert_from_path(str(pdf_path), first_page=1, last_page=max_pages, dpi=200)
    except Exception as e:
        err = str(e).lower()
        if "poppler" in err or "page count" in err or "unable" in err:
            # 2) Fallback: PyMuPDF (no poppler) - pip install pymupdf
            try:
                import fitz  # PyMuPDF
                import tempfile
                import io
                doc = fitz.open(str(pdf_path))
                for i in range(min(len(doc), max_pages)):
                    page = doc[i]
                    mat = fitz.Matrix(2.0, 2.0)  # 2x scale for better OCR
                    pix = page.get_pixmap(matrix=mat, alpha=False)
                    img_bytes = pix.tobytes("png")
                    try:
                        from PIL import Image
                        img = Image.open(io.BytesIO(img_bytes))
                    except ImportError:
                        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                            tmp.write(img_bytes)
                            tmp.flush()
                            img = tmp.name
                    images.append(img)
                doc.close()
            except ImportError:
                logger.warning(
                    "OCR failed (poppler not in PATH). Install PyMuPDF for OCR without poppler: pip install pymupdf"
                )
                return []
            except Exception as e2:
                logger.warning("OCR via PyMuPDF failed: %s", e2)
                return []
        else:
            logger.warning("OCR failed: %s", e)
            return []

    if not images:
        return []

    def _img_to_numpy(img):
        """Convert PIL Image or file path to numpy array for EasyOCR."""
        import numpy as np
        if hasattr(img, "size"):
            return np.array(img)
        from PIL import Image
        return np.array(Image.open(img))

    # Try Tesseract first
    try:
        return [pytesseract.image_to_string(img) for img in images]
    except Exception as e:
        err_msg = str(e).lower()
        if "tesseract" not in err_msg and "path" not in err_msg:
            logger.warning("Tesseract OCR failed: %s", e)
            return []
        # Fallback: EasyOCR (no system Tesseract needed) - pip install easyocr
        try:
            import easyocr
            import numpy as np
            reader = easyocr.Reader(["en"], gpu=False, verbose=False)
            result = []
            for img in images:
                arr = _img_to_numpy(img)
                detections = reader.readtext(arr)
                page_text = "\n".join([t[1] for t in detections])
                result.append(page_text)
            logger.info("OCR completed using EasyOCR (Tesseract not in PATH).")
            return result
        except ImportError:
            logger.warning(
                "Tesseract is not installed or not in PATH. "
                "Either install Tesseract and add to PATH, or install EasyOCR: pip install easyocr"
            )
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
HEADER_PATTERNS = {
    "constituency": re.compile(
        r"(?:assembly\s+constituency|ac\s+name|constituency)\s*[:\-]\s*([^\n]+)",
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
}


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


def _extract_metadata_from_text(first_page_text: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """Extract constituency_name, part_no (booth), part_name from first page text."""
    constituency_name = None
    part_no = None
    part_name = None
    for pattern_name, pattern in HEADER_PATTERNS.items():
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
        text = page.extract_text() or ""
        out["first_page_text"] = text[:4000]
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
) -> Dict[str, Any]:
    """
    Extract voter records from an ECI-style electoral roll PDF.

    Args:
        pdf_path: Path to the PDF file.
        default_constituency_name: Override constituency if not found in PDF.
        default_booth_number: Override booth/part number if not found in PDF.
        use_ocr: If True and PDF has no text layer, use OCR (needs pdf2image, pytesseract, Tesseract).

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

    # Table settings for borderless tables (ECI PDFs often have no grid lines)
    text_table_settings = {
        "vertical_strategy": "text",
        "horizontal_strategy": "text",
        "min_words_vertical": 2,
        "min_words_horizontal": 1,
    }

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            if page_num == 0:
                first_page_text = text
            tables = page.extract_tables()
            # If no tables found, try text-based detection (borderless tables)
            if not tables:
                tables = page.extract_tables(table_settings=text_table_settings)
            if not tables or all(len(t) < 2 for t in tables):
                _append_from_text_lines(text, all_records, booth, constituency)
                pages_processed += 1
                continue
            page_record_count_before = len(all_records)
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
                        all_records.append(rec)
                pages_processed += 1
            if len(all_records) == page_record_count_before and text.strip():
                _append_from_text_lines(text, all_records, booth, constituency)
                pages_processed += 1

    # If no text and no tables at all, try OCR (scanned PDF)
    if not all_records and use_ocr and (not first_page_text or not first_page_text.strip()):
        ocr_texts = _extract_text_via_ocr(pdf_path)
        for page_text in ocr_texts:
            _append_from_text_lines(page_text, all_records, booth, constituency)
            pages_processed += 1

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

    # Apply metadata to all records that don't have booth/constituency
    for r in all_records:
        if not r.get("booth_number") and part_no:
            r["booth_number"] = part_no
        if not r.get("constituency_name") and constituency_name:
            r["constituency_name"] = constituency_name

    return {
        "records": all_records,
        "metadata": {
            "constituency_name": constituency_name or "",
            "booth_number": part_no or "",
            "part_name": _extract_metadata_from_text(first_page_text)[2] or "",
            "pages_processed": pages_processed,
            "raw_headers": raw_headers,
        },
    }


def _append_from_text_lines(
    text: str,
    records: List[Dict[str, Any]],
    default_booth: str,
    default_constituency: str,
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
        }
        for i, p in enumerate(parts):
            if p in ("M", "F", "Male", "Female"):
                rec["gender"] = "M" if p.upper().startswith("M") else "F"
                break
            if i >= 4 and p and re.match(r"^[0-9/\-\.]+$", p) and not rec.get("house_no"):
                rec["house_no"] = p
                break
        if rec.get("name") or rec.get("epic_number"):
            records.append(rec)
