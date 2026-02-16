"""
SOP-aligned PDF Parser for ECI Electoral Roll PDFs.
Document ID: TN-VOTER-ANALYTICS-01 | Section 3: Data Acquisition & Standardization

Supports:
- Text-based (digital) PDFs via pdfplumber (primary)
- Scanned PDFs via OCR fallback (handled in upload_controller)
Output: Records compatible with Pre-SIR/Post-SIR CSV upload
(epic_number, name, relative_name, age, gender, house_no, address, booth_number, constituency_name).
"""

import io
import re
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

# EPIC patterns: 3 letters + 7 digits (e.g. ABC1234567) or ECI format XX/YY/ZZZ/NNNNNN
EPIC_PATTERN = re.compile(
    r"\b([A-Z]{3}\d{7})\b|([A-Z]{2}/\d{2}/\d{3}/\d{6})\b",
    re.IGNORECASE
)
# Age on same line or next lines
AGE_PATTERN = re.compile(r"Age\s*[:\-]?\s*(\d{2,3})", re.IGNORECASE)
GENDER_PATTERNS = [
    (re.compile(r"\bMale\b", re.I), "M"),
    (re.compile(r"\bFemale\b", re.I), "F"),
    (re.compile(r"\bM\b", re.I), "M"),  # single letter after Age
    (re.compile(r"\bF\b", re.I), "F"),
    (re.compile(r"Third\s*Gender", re.I), "T"),
]
NAME_LABEL = re.compile(r"Name\s*[:\-]?\s*(.+)", re.IGNORECASE)
RELATION_LABEL = re.compile(
    r"(Father|Mother|Husband|Wife|Guardian|Other)\s*(?:'s)?\s*Name\s*[:\-]?\s*(.+)",
    re.IGNORECASE
)
S_O_D_O = re.compile(r"(?:S/O|D/O|W/O|C/O)\s*[:\-]?\s*(.+)", re.IGNORECASE)
HOUSE_LABEL = re.compile(r"House\s*(?:No|Number)?\s*[:\-]?\s*(.+)", re.IGNORECASE)
# AC/Constituency/Part from header
PART_AC_PATTERN = re.compile(r"Part\s*(?:No\.?)?\s*[:\-]?\s*(\d+)", re.IGNORECASE)
AC_NAME_PATTERN = re.compile(r"(?:Assembly|AC|Constituency)\s*(?:Name)?\s*[:\-]?\s*(.+)", re.IGNORECASE)


def _extract_text_with_pdfplumber(pdf_bytes: bytes) -> List[Dict[str, Any]]:
    """Extract text from digital PDF using pdfplumber. Returns list of page dicts with 'text' and 'tables'."""
    try:
        import pdfplumber
    except ImportError:
        logger.warning("pdfplumber not installed; text PDF extraction unavailable.")
        return []

    records_from_pages = []
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page_num, page in enumerate(pdf.pages):
                text = page.extract_text()
                if not text or not text.strip():
                    continue
                # Try to get tables (some ECI PDFs have tabular layout)
                tables = page.extract_tables()
                records_from_pages.append({
                    "page_num": page_num + 1,
                    "text": text,
                    "tables": tables or [],
                })
    except Exception as e:
        logger.exception("pdfplumber extraction failed: %s", e)
        return []
    return records_from_pages


def _parse_voter_blocks_from_text(text: str) -> List[Dict[str, Any]]:
    """
    Parse continuous text into voter blocks.
    ECI rolls often have blocks separated by blank lines or repeated EPIC pattern.
    """
    blocks = []
    # Split by double newline or by line that looks like start of new card (digit + EPIC)
    raw_blocks = re.split(r"\n\s*\n+", text)
    for raw in raw_blocks:
        raw = raw.strip()
        if not raw or len(raw) < 10:
            continue
        epic_m = EPIC_PATTERN.search(raw)
        if not epic_m:
            continue
        epic = (epic_m.group(1) or epic_m.group(2) or "").strip().upper()
        if not epic:
            continue
        # Replace slashes in EPIC for consistency (e.g. XX/YY/ZZZ/NNNNNN -> XXYYZZZNNNNNN for storage)
        epic_clean = epic.replace("/", "") if "/" in epic else epic

        name = ""
        rel_name = ""
        house_no = ""
        age = None
        gender = ""

        lines = [ln.strip() for ln in raw.split("\n") if ln.strip()]
        for line in lines:
            if NAME_LABEL.search(line) and not name:
                name = NAME_LABEL.search(line).group(1).strip()
            elif RELATION_LABEL.search(line):
                rel_name = RELATION_LABEL.search(line).group(2).strip()
            elif S_O_D_O.search(line) and not rel_name:
                rel_name = S_O_D_O.search(line).group(1).strip()
            elif HOUSE_LABEL.search(line):
                house_no = HOUSE_LABEL.search(line).group(1).strip()
        age_m = AGE_PATTERN.search(raw)
        if age_m:
            try:
                age = int(age_m.group(1))
            except (ValueError, IndexError):
                pass
        for pat, g in GENDER_PATTERNS:
            if pat.search(raw):
                gender = g
                break

        # SOP 3.2: Uppercase and alphanumeric normalization applied at upload; store raw here for CSV
        blocks.append({
            "epic_number": epic_clean[:20] if epic_clean else "",
            "name": name[:200] if name else "",
            "relative_name": rel_name[:200] if rel_name else "",
            "age": age,
            "gender": gender or "",
            "house_no": house_no[:100] if house_no else "",
            "address": "",  # Optional; some PDFs have full address in another line
        })
    return blocks


def _parse_tables_to_voters(tables: List[List[List[str]]]) -> List[Dict[str, Any]]:
    """Convert pdfplumber table(s) to voter records if columns match expected headers."""
    voters = []
    for table in tables:
        if not table or len(table) < 2:
            continue
        header = [str(c).strip().lower() if c else "" for row in table[:1] for c in (row if isinstance(table[0], (list, tuple)) else [row])]
        if not header:
            header = [str(c).strip().lower() for c in table[0]] if table[0] else []
        rows = table[1:] if len(table) > 1 else []
        for row in rows:
            cells = row if isinstance(row, (list, tuple)) else [row]
            if len(cells) < 2:
                continue
            # Map common column names to our keys
            row_dict = {}
            for i, cell in enumerate(cells):
                if i < len(header):
                    h = header[i]
                    val = str(cell).strip() if cell else ""
                    if "epic" in h or "elector" in h:
                        row_dict["epic_number"] = val.replace("/", "")[:20]
                    elif "name" in h and "father" not in h and "husband" not in h and "relative" not in h:
                        row_dict["name"] = val[:200]
                    elif "father" in h or "husband" in h or "mother" in h or "relative" in h or "s/o" in h or "d/o" in h:
                        row_dict["relative_name"] = val[:200]
                    elif "house" in h or "door" in h:
                        row_dict["house_no"] = val[:100]
                    elif "age" in h:
                        try:
                            row_dict["age"] = int(val) if val else None
                        except ValueError:
                            row_dict["age"] = None
                    elif "gender" in h or "sex" in h:
                        row_dict["gender"] = "M" if val.upper().startswith("M") else "F" if val.upper().startswith("F") else val[:1]
                    elif "address" in h:
                        row_dict["address"] = val[:500]
            if row_dict.get("epic_number") or row_dict.get("name"):
                voters.append({
                    "epic_number": row_dict.get("epic_number", ""),
                    "name": row_dict.get("name", ""),
                    "relative_name": row_dict.get("relative_name", ""),
                    "age": row_dict.get("age"),
                    "gender": row_dict.get("gender", ""),
                    "house_no": row_dict.get("house_no", ""),
                    "address": row_dict.get("address", ""),
                })
    return voters


def parse_electoral_roll_pdf(
    pdf_bytes: bytes,
    default_constituency_name: Optional[str] = None,
    default_booth_number: Optional[str] = None,
    default_part_number: Optional[str] = None,
) -> tuple[List[Dict[str, Any]], Optional[str], Optional[str]]:
    """
    Parse ECI-style electoral roll PDF (text-based). Returns (records, constituency_name, booth_number).
    Each record has: epic_number, name, relative_name, age, gender, house_no, address.
    constituency_name and booth_number can be taken from PDF header or from defaults.
    """
    import io
    page_data = _extract_text_with_pdfplumber(pdf_bytes)
    if not page_data:
        return [], default_constituency_name, default_booth_number

    all_records = []
    parsed_constituency = default_constituency_name
    parsed_booth = default_booth_number or default_part_number

    for page in page_data:
        text = page.get("text") or ""
        tables = page.get("tables") or []
        voters_from_table = _parse_tables_to_voters(tables) if tables else []
        if voters_from_table:
            all_records.extend(voters_from_table)
        else:
            blocks = _parse_voter_blocks_from_text(text)
            all_records.extend(blocks)
        # Parse header for Part/AC name (first page often has it)
        if page.get("page_num") == 1 and text:
            part_m = PART_AC_PATTERN.search(text)
            if part_m:
                parsed_booth = parsed_booth or part_m.group(1)
            ac_m = AC_NAME_PATTERN.search(text)
            if ac_m:
                parsed_constituency = parsed_constituency or ac_m.group(1).strip()[:150]

    # Deduplicate by EPIC
    seen_epic = set()
    unique = []
    for r in all_records:
        ep = (r.get("epic_number") or "").strip()
        if ep and ep not in seen_epic:
            seen_epic.add(ep)
            unique.append(r)

    constituency = parsed_constituency or default_constituency_name
    booth = parsed_booth or default_booth_number or default_part_number or "1"
    return unique, constituency, booth


def electoral_roll_records_to_csv_rows(
    records: List[Dict[str, Any]],
    constituency_name: str = "",
    booth_number: str = "1",
) -> List[Dict[str, str]]:
    """Convert parser output to CSV rows matching our upload format (SOP 3.2 applied at upload)."""
    constituency_name = constituency_name or "Unknown"
    booth_number = booth_number or "1"
    return [
        {
            "epic_number": r.get("epic_number", ""),
            "name": r.get("name", ""),
            "relative_name": r.get("relative_name", ""),
            "age": str(r.get("age", "")) if r.get("age") is not None else "",
            "gender": r.get("gender", ""),
            "house_no": r.get("house_no", ""),
            "address": r.get("address", ""),
            "booth_number": booth_number,
            "constituency_name": constituency_name,
        }
        for r in records
    ]
