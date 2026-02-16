"""
SOP-aligned PDF parser for ECI electoral roll PDFs.
Supports text-based (digital) PDFs via pdfplumber.
Scanned PDFs are handled by upload_controller OCR fallback.
"""
import io
import re
import logging
from typing import List, Dict, Any, Tuple, Optional

logger = logging.getLogger(__name__)

try:
    import pdfplumber
    _PDFPLUMBER_AVAILABLE = True
except ImportError:
    pdfplumber = None
    _PDFPLUMBER_AVAILABLE = False
    logger.warning("pdfplumber not installed; text PDF extraction unavailable. Install with: pip install pdfplumber")


def parse_electoral_roll_pdf(
    content: bytes,
    default_constituency_name: Optional[str] = None,
    default_booth_number: Optional[str] = None,
    default_part_number: Optional[str] = None,
) -> Tuple[List[Dict[str, Any]], Optional[str], Optional[str]]:
    """
    Extract voter records from digital (text-based) electoral roll PDF.
    Returns (records, parsed_constituency_name, parsed_booth_number).
    If PDF is scanned or has no extractable text, returns ([], None, None) so caller can use OCR.
    """
    parsed_const = default_constituency_name
    parsed_booth = default_booth_number or default_part_number
    records = []

    if not _PDFPLUMBER_AVAILABLE or not pdfplumber:
        return records, parsed_const, parsed_booth

    try:
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if not text or not text.strip():
                    continue
                page_records = _parse_text_to_records(text)
                records.extend(page_records)
                if not parsed_const or not parsed_booth:
                    part_match = re.search(r"Part\s*(?:No\.?)?\s*[:\-]?\s*(\d+)", text, re.I)
                    if part_match and not parsed_booth:
                        parsed_booth = part_match.group(1)
                    ac_match = re.search(r"(?:Assembly|AC|Constituency)\s*(?:Name)?\s*[:\-]?\s*(.+)", text, re.I)
                    if ac_match and not parsed_const:
                        parsed_const = ac_match.group(1).strip()[:150]
    except Exception as e:
        logger.exception("pdf_parser failed: %s", e)
        return [], default_constituency_name, default_booth_number or default_part_number

    return records, parsed_const, parsed_booth


def _parse_text_to_records(text: str) -> List[Dict[str, Any]]:
    """Parse continuous text into list of voter record dicts (epic_number, name, relative_name, age, gender, house_no, address)."""
    records = []
    epic_re = re.compile(r"\b([A-Z]{2,5}\d{5,10})\b", re.I)
    blocks = re.split(r"\n\s*\n", text)
    for block in blocks:
        block = block.strip()
        if not block:
            continue
        m = epic_re.search(block)
        if not m:
            continue
        epic = m.group(1).upper().replace("/", "")
        name = ""
        name_m = re.search(r"Name\s*[:\-]?\s*(.+)", block, re.I)
        if name_m:
            name = name_m.group(1).strip().split("\n")[0].strip()
        rel_m = re.search(r"(?:Father|Mother|Husband)(?:'s)?\s*Name\s*[:\-]?\s*(.+)", block, re.I)
        relative_name = rel_m.group(1).strip().split("\n")[0].strip() if rel_m else ""
        house_m = re.search(r"House\s*(?:No\.?|Number)?\s*[:\-]?\s*(.+)", block, re.I)
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
            gender = "M"
        elif re.search(r"\bFemale\b", block, re.I):
            gender = "F"
        records.append({
            "epic_number": epic,
            "name": name,
            "relative_name": relative_name,
            "age": age,
            "gender": gender,
            "house_no": house_no,
            "address": "",
        })
    return records


def electoral_roll_records_to_csv_rows(
    records: List[Dict[str, Any]],
    constituency_name: str,
    booth_number: str,
) -> List[Dict[str, str]]:
    """Convert list of voter records to CSV row dicts (epic_number, name, relative_name, age, gender, house_no, address, booth_number, constituency_name)."""
    rows = []
    for r in records:
        age_val = r.get("age")
        rows.append({
            "epic_number": str(r.get("epic_number") or ""),
            "name": str(r.get("name") or ""),
            "relative_name": str(r.get("relative_name") or ""),
            "age": str(age_val) if age_val is not None else "",
            "gender": str(r.get("gender") or ""),
            "house_no": str(r.get("house_no") or ""),
            "address": str(r.get("address") or ""),
            "booth_number": str(booth_number),
            "constituency_name": str(constituency_name),
        })
    return rows
