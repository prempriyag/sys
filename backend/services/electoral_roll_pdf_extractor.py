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


# EPIC number pattern: letter + alphanumerics + 3+ digits, optional /digits (e.g. WQD2616720, W0D259/805)
RE_EPIC = re.compile(r"^[A-Za-z][A-Za-z0-9]*[0-9]{3,}(/[0-9]+)?$", re.IGNORECASE)
# EPIC anywhere in string (for finding in mixed lines)
RE_EPIC_ANYWHERE = re.compile(r"[A-Za-z][A-Za-z0-9]*[0-9]{3,}(/[0-9]+)?")
# Start of voter card: optional serial number then EPIC on same line or next
RE_RECORD_START = re.compile(r"^\s*(\d+)\s+([A-Za-z]{2,4}[0-9]{5,})\s*$")
RE_RECORD_START_SERIAL_ONLY = re.compile(r"^\s*(\d+)\s*$")
# Relation line: "Father Name: xxx", "Husband Name: xxx", "Mother Name: xxx"
RE_FATHER = re.compile(r"father\s*name\s*[:\-]\s*(.+)", re.IGNORECASE)
RE_HUSBAND = re.compile(r"husband\s*name\s*[:\-]\s*(.+)", re.IGNORECASE)
RE_MOTHER = re.compile(r"mother\s*name\s*[:\-]\s*(.+)", re.IGNORECASE)
# "Name: xxx" (elector name with prefix, sample line 77)
RE_NAME_PREFIX = re.compile(r"^name\s*[:\-]\s*(.+)", re.IGNORECASE)
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
# Father/Husband/Mother with typos: Falhe Naine, Falner Name, Falhar Namie
RE_FATHER_FUZZY = re.compile(r"(?:falhe?r?|father|falner|falhar)\s*(?:naine?|name|namie)?\s*[:\-\"]?\s*(.*)$", re.IGNORECASE)
RE_HUSBAND_FUZZY = re.compile(r"husband\s*(?:name)?\s*[:\-]?\s*(.*)$", re.IGNORECASE)
RE_MOTHER_FUZZY = re.compile(r"mother\s*(?:name)?\s*[:\-]?\s*(.*)$", re.IGNORECASE)
# House Number with typos: Housc Numoor, Houso Numbci, Houso Numbor
RE_HOUSE_NUMBER_FUZZY = re.compile(r"hous[eoc]?\s*num[bp]?[eo]*r?\s*[:\-]?\s*(.*)$", re.IGNORECASE)
# Name with optional colon and value on same line
RE_NAME_FUZZY = re.compile(r"^name\s*[:\-]?\s*(.*)$", re.IGNORECASE)
# Age then optional "Gender" typo (Genocr, Gendcr, Cendor): "32 Genocr", "26 Gendcr", "Age 24 Cendor"
RE_AGE_FUZZY = re.compile(r"(?:age|ago|aga)\s*[:\-]?\s*(\d{1,3})\s*(?:genocr|gendcr|cendor|gender)?", re.IGNORECASE)
RE_AGE_LEADING = re.compile(r"^(\d{1,3})\s+(?:genocr|gendcr|cendor|gender)", re.IGNORECASE)
# Gender value with OCR: Mole, Ma 0, Foma 0, Male, Female
RE_GENDER_FUZZY = re.compile(r"^(?:ma?\s*0?|male|mole|m)\s*$", re.IGNORECASE)
RE_GENDER_FEMALE_FUZZY = re.compile(r"^(?:foma?\s*0?|female|f)\s*$", re.IGNORECASE)
# Reject dates as house_no: 09-May, Oct-99, 12-Jan
RE_DATE_LIKE = re.compile(r"^(?:\d{1,2}[-/](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-/]\d{2,4})\s*$", re.IGNORECASE)


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


# ----- Position-aware extraction (TN ECI: 3 sections × 3 cards = 9 per row) -----
# Extraction config: cards_per_row, header_top (y above which = header), data_bottom (y below which = footer)
EXTRACTION_CONFIG_DEFAULTS = {
    "cards_per_row": 9,       # 3 sections × 3 cards each
    "sections_per_row": 3,
    "cards_per_section": 3,
    "header_top": 120,        # Skip content above this y (page header)
    "data_bottom": 750,       # Skip content below this y (footer, page numbers)
    "margin_left": 20,
    "margin_right": 20,
}


def _extract_cards_by_position(
    page,
    page_number: int,
    default_booth: str,
    default_constituency: str,
    config: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Extract voter cards using word positions. TN ECI format: 9 cards per row
    (3 sections × 3 cards). Divides page into columns by x0, groups words per card.
    """
    cfg = {**EXTRACTION_CONFIG_DEFAULTS, **(config or {})}
    cards_per_row = int(cfg.get("cards_per_row", 9))
    header_top = float(cfg.get("header_top", 120))
    data_bottom = float(cfg.get("data_bottom", 750))
    margin_left = float(cfg.get("margin_left", 20))
    margin_right = float(cfg.get("margin_right", 20))

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

    row_gap = 20
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
        if rec.get("name") or rec.get("epic_number"):
            records.append(rec)
    return records


def _parse_one_card_block(
    block: List[str],
    rec: Dict[str, Any],
) -> None:
    """
    Fill one voter record from a list of lines (one card).
    Uses OCR-tolerant patterns: fuzzy Father/House/Age/Gender labels and values.
    """
    i = 0
    while i < len(block):
        bl = block[i].strip()
        if not bl or bl.lower() in ("photo", "available", "pnoio"):
            i += 1
            continue
        # Name: "Name : value" or "Name" then next line is value
        m_name = RE_NAME_PREFIX.match(bl) or RE_NAME_FUZZY.match(bl)
        if m_name:
            val = (m_name.group(1) or "").strip().rstrip("-")
            if val and val.lower() not in ("name", "naine", "namie"):
                rec["name"] = val
            elif i + 1 < len(block):
                next_val = block[i + 1].strip()
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
            label_like = re.sub(r"[\s\"]+", "", val).lower() in ("name", "naine", "namie") or len(val) < 3
            if val and not label_like:
                rec["relative_name"] = val
            elif i + 1 < len(block):
                rec["relative_name"] = block[i + 1].strip().rstrip("-").rstrip('"').strip()
                i += 1
            i += 1
            continue
        if m_h:
            val = (m_h.group(1) or "").strip().rstrip("-")
            if val:
                rec["relative_name"] = val
            elif i + 1 < len(block):
                rec["relative_name"] = block[i + 1].strip().rstrip("-").strip()
                i += 1
            i += 1
            continue
        if m_m:
            val = (m_m.group(1) or "").strip().rstrip("-")
            if val:
                rec["relative_name"] = val
            elif i + 1 < len(block):
                rec["relative_name"] = block[i + 1].strip().rstrip("-").strip()
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
                rec["house_no"] = val
            elif i + 1 < len(block):
                val2 = block[i + 1].strip()
                if val2 and not _is_date_like(val2) and not RE_EPIC.match(val2):
                    rec["house_no"] = val2
                    i += 1
            i += 1
            continue
        # Standalone age label "Ago"/"Aga"/"Age" with value on next line (e.g. "32 Genocr", then "Mole")
        if bl.lower() in ("ago", "aga", "age") and i + 1 < len(block):
            next_ln = block[i + 1].strip()
            m_next = RE_AGE_LEADING.match(next_ln) or RE_AGE_FUZZY.search(next_ln) or (RE_AGE.match(next_ln) and next_ln)
            if m_next:
                try:
                    a = int(m_next.group(1) if hasattr(m_next, "group") else m_next)
                    if 1 <= a <= 120:
                        rec["age"] = a
                except (ValueError, AttributeError, TypeError):
                    pass
                if i + 2 < len(block):
                    g_line = block[i + 2].strip()
                    if RE_GENDER_FUZZY.match(g_line):
                        rec["gender"] = "M"
                        i += 1
                    elif RE_GENDER_FEMALE_FUZZY.match(g_line):
                        rec["gender"] = "F"
                        i += 1
                i += 1
            i += 1
            continue
        # Age + optional Gender on same line: "32 Genocr", "Age 24 Cendor", "Ago 26 Gendcr"
        m_age_line = RE_AGE_GENDER_LINE.search(bl) or RE_AGE_FUZZY.search(bl) or RE_AGE_LEADING.match(bl)
        if m_age_line:
            try:
                a = int(m_age_line.group(1))
                if 1 <= a <= 120:
                    rec["age"] = a
            except ValueError:
                pass
            # Next line may be gender value (Mole, Foma 0)
            if i + 1 < len(block):
                g_line = block[i + 1].strip()
                if RE_GENDER.match(g_line):
                    rec["gender"] = "M" if g_line.upper().startswith("M") else "F"
                    i += 1
                elif RE_GENDER_FUZZY.match(g_line):
                    rec["gender"] = "M"
                    i += 1
                elif RE_GENDER_FEMALE_FUZZY.match(g_line):
                    rec["gender"] = "F"
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
        # Gender (exact or fuzzy: Mole, Ma 0, Foma 0) — check Female before Male so "Foma 0" isn't matched as "ma"
        if RE_GENDER.match(bl):
            rec["gender"] = "M" if bl.upper().startswith("M") else "F"
            i += 1
            continue
        if RE_GENDER_FEMALE_FUZZY.match(bl):
            rec["gender"] = "F"
            i += 1
            continue
        if RE_GENDER_FUZZY.match(bl):
            rec["gender"] = "M"
            i += 1
            continue
        # Standalone house number (not EPIC, not date, not a label line)
        bl_lower = bl.lower()
        is_house_label = "hous" in bl_lower and ("num" in bl_lower or "no" in bl_lower)
        if not rec.get("house_no") and RE_HOUSE_NO.match(bl) and len(bl) <= 80 and not is_house_label:
            if not RE_EPIC.match(bl) and not RE_EPIC_ANYWHERE.search(bl) and not _is_date_like(bl):
                rec["house_no"] = bl
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


def _parse_voter_cards_from_text(
    text: str,
    default_booth: str,
    default_constituency: str,
    page_number: int = 1,
) -> List[Dict[str, Any]]:
    """
    Parse voter entries from card-style layout (TN ECI format).
    Supports: (1) Column grid layout (EPIC1, EPIC2, EPIC3 then row-major cells);
    (2) Sequential cards (Serial+EPIC then block of lines per card).
    Uses OCR-tolerant patterns for scanned PDFs.
    """
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    # Try column layout first (scanned grid: N EPICs then rows of N cells)
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
            serial_str = ""
        else:
            i += 1
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
        block = lines[idx + 1 : min(idx + 10, len(lines))]
        # Stop at next EPIC
        stop = next((j for j, ln in enumerate(block) if RE_EPIC.match(ln)), len(block))
        block = block[:stop]
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
            # If no records from tables, try position-based extraction first (TN ECI: 9 cards/row)
            # Skip page 0 (cover) and page 1 (map) for position-based - they have no voter cards
            page_no = page_num + 1
            card_records: List[Dict[str, Any]] = []
            if page_num >= 2 and RE_EPIC_ANYWHERE.search(text):
                try:
                    pos_records = _extract_cards_by_position(
                        page, page_no, booth, constituency, extraction_config
                    )
                    if pos_records:
                        card_records = pos_records
                except Exception as e:
                    logger.debug("Position-based extraction failed for page %s: %s", page_no, e)
            if not card_records and len(all_records) == page_record_count_before and text.strip():
                card_records = _parse_voter_cards_from_text(text, booth, constituency, page_no)
                if not card_records and RE_EPIC_ANYWHERE.search(text):
                    card_records = _parse_voter_cards_fallback(text, booth, constituency, page_no)
            if card_records:
                all_records.extend(card_records)
            elif len(all_records) == page_record_count_before and text.strip():
                _append_from_text_lines(text, all_records, booth, constituency, page_no)
            else:
                for rec in all_records[page_record_count_before:]:
                    rec["page_number"] = page_no
            pages_processed += 1

    # If no text was extracted from any page (image-only PDF), run OCR automatically
    all_text_empty = all((not (p.get("text") or "").strip()) for p in raw_page_texts)
    if not all_records and all_text_empty:
        ocr_texts = _extract_text_via_ocr(pdf_path)
        if ocr_texts:
            logger.info("OCR extracted text from %s pages (image-only PDF)", len(ocr_texts))
            raw_page_texts = [{"page": i + 1, "length": len(t), "text": t} for i, t in enumerate(ocr_texts)]
            first_page_text = ocr_texts[0] if ocr_texts else ""
            cn, pn, pname = _extract_metadata_from_text(first_page_text)
            if not constituency and cn:
                constituency = cn
            if not booth and pn:
                booth = pn
            for ocr_page_idx, page_text in enumerate(ocr_texts):
                page_no = ocr_page_idx + 1
                card_records = _parse_voter_cards_from_text(page_text, booth, constituency, page_no)
                if not card_records and RE_EPIC_ANYWHERE.search(page_text):
                    card_records = _parse_voter_cards_fallback(page_text, booth, constituency, page_no)
                if card_records:
                    all_records.extend(card_records)
                else:
                    _append_from_text_lines(page_text, all_records, booth, constituency, page_no)
            pages_processed = len(ocr_texts)
    # Legacy: explicit use_ocr when text was empty
    elif not all_records and use_ocr and (not first_page_text or not first_page_text.strip()):
        ocr_texts = _extract_text_via_ocr(pdf_path)
        if ocr_texts:
            raw_page_texts = [{"page": i + 1, "length": len(t), "text": t} for i, t in enumerate(ocr_texts)]
            first_page_text = ocr_texts[0] if ocr_texts else ""
            cn, pn, pname = _extract_metadata_from_text(first_page_text)
            if not constituency and cn:
                constituency = cn
            if not booth and pn:
                booth = pn
            for ocr_page_idx, page_text in enumerate(ocr_texts):
                page_no = ocr_page_idx + 1
                card_records = _parse_voter_cards_from_text(page_text, booth, constituency, page_no)
                if not card_records and RE_EPIC_ANYWHERE.search(page_text):
                    card_records = _parse_voter_cards_fallback(page_text, booth, constituency, page_no)
                if card_records:
                    all_records.extend(card_records)
                else:
                    _append_from_text_lines(page_text, all_records, booth, constituency, page_no)
            pages_processed = len(ocr_texts)

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

    meta = {
        "constituency_name": constituency_name or "",
        "booth_number": part_no or "",
        "part_name": _extract_metadata_from_text(first_page_text)[2] or "",
        "pages_processed": pages_processed,
        "raw_headers": raw_headers,
    }
    meta.update(_extract_extended_metadata(first_page_text))
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
            if i >= 4 and p and re.match(r"^[0-9/\-\.]+$", p) and not rec.get("house_no"):
                rec["house_no"] = p
                break
        if rec.get("name") or rec.get("epic_number"):
            records.append(rec)
