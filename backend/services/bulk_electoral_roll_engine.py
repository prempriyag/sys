"""
Bulk Electoral Roll Hybrid Engine.
- Detect text-based vs scanned PDF.
- Text: pdfminer.six extraction.
- Scanned: convert to images, preprocess (grayscale, threshold), Tesseract OCR.
- Parse voter data, validate EPIC (3 uppercase + 7 digits), bulk insert with ON CONFLICT DO NOTHING.
Scalable for lakhs; multiprocessing for multiple PDFs.
"""
import io
import logging
import os
import re
import shutil
import sys
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Strict EPIC: 3 uppercase letters + 7 digits
RE_EPIC_STRICT = re.compile(r"^[A-Z]{3}[0-9]{7}$")
# Loose pattern to find EPIC in text (letters can be OCR misreads)
RE_EPIC_FIND = re.compile(r"\b([A-Za-z]{3}[0-9]{7})\b")

# Common OCR letter substitutions in EPIC (wrong -> right). Applied only to first 3 chars.
# e.g. HAG -> HRG (A misread as R)
EPIC_OCR_LETTER_ALTERNATIVES: Dict[int, List[Tuple[str, str]]] = {
    0: [("O", "Q"), ("I", "L"), ("L", "I"), ("S", "5")],   # position 0
    1: [("A", "R"), ("R", "A"), ("O", "D"), ("D", "O"), ("B", "E"), ("E", "B")],
    2: [("A", "R"), ("G", "C"), ("C", "G"), ("O", "Q"), ("I", "L")],
}
# Single global list: (wrong_char, right_char) for any position (try in order)
EPIC_OCR_SUBSTITUTIONS = [("A", "R"), ("O", "Q"), ("I", "L"), ("G", "C"), ("S", "5"), ("0", "O"), ("1", "I")]

# Minimum text length from first page to consider PDF as "text-based"
TEXT_PDF_MIN_CHARS = 200


def _safe_folder_name(s: Optional[str]) -> str:
    """Sanitize for folder path (same idea as download structure)."""
    if not s or not str(s).strip():
        return "unknown"
    s = str(s).strip().replace("\\", "_").replace("/", "_").replace(":", "_")
    for c in '*?"<>|':
        s = s.replace(c, "_")
    s = re.sub(r"\s+", "_", s).strip("_")
    return s or "unknown"

# Default Tesseract path on Windows when not in PATH (override with env TESSERACT_CMD)
_TESSERACT_WINDOWS_PATHS = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
)
_tesseract_configured: bool = False


def _configure_tesseract() -> None:
    """Set pytesseract tesseract_cmd from TESSERACT_CMD env or Windows default paths (once per process)."""
    global _tesseract_configured
    if _tesseract_configured:
        return
    cmd = (os.getenv("TESSERACT_CMD") or "").strip()
    if cmd and os.path.isfile(cmd):
        try:
            import pytesseract
            pytesseract.pytesseract.tesseract_cmd = cmd
            _tesseract_configured = True
            logger.info("Tesseract configured: %s", cmd)
            return
        except Exception:
            pass
    if sys.platform == "win32":
        for path in _TESSERACT_WINDOWS_PATHS:
            if os.path.isfile(path):
                try:
                    import pytesseract
                    pytesseract.pytesseract.tesseract_cmd = path
                    _tesseract_configured = True
                    logger.info("Tesseract configured: %s", path)
                    return
                except Exception:
                    pass
    _tesseract_configured = True  # avoid retrying every PDF


def clean_epic(raw: Optional[str]) -> str:
    """Remove spaces, uppercase. Does not validate."""
    if not raw or not isinstance(raw, str):
        return ""
    return raw.strip().upper().replace(" ", "")


def _try_correct_epic_ocr(epic: str) -> Optional[str]:
    """
    Try to fix common OCR errors in EPIC (3 letters + 7 digits).
    Returns corrected EPIC if it becomes valid, else None.
    """
    if len(epic) != 10:
        return None
    letters, digits = epic[:3], epic[3:]
    if not digits.isdigit():
        return None
    # Try no change first
    if RE_EPIC_STRICT.match(letters + digits):
        return letters + digits
    # Try single-character substitutions in letter part (e.g. A->R for HAG->HRG)
    for pos in range(3):
        c = letters[pos]
        for wrong, right in EPIC_OCR_SUBSTITUTIONS:
            if c == wrong or c == right:
                try_letter = right if c == wrong else wrong
                try_letters = letters[:pos] + try_letter + letters[pos + 1:]
                if RE_EPIC_STRICT.match(try_letters + digits):
                    return try_letters + digits
    # Try position-specific alternatives
    for pos in range(3):
        if pos in EPIC_OCR_LETTER_ALTERNATIVES:
            for wrong, right in EPIC_OCR_LETTER_ALTERNATIVES[pos]:
                if letters[pos] == wrong:
                    try_letters = letters[:pos] + right + letters[pos + 1:]
                    if RE_EPIC_STRICT.match(try_letters + digits):
                        return try_letters + digits
    return None


def validate_and_correct_epic(raw: Optional[str]) -> Tuple[Optional[str], bool]:
    """
    Validate EPIC (3 uppercase letters + 7 digits). If invalid, try OCR correction.
    Returns (valid_epic, was_corrected). If still invalid, returns (None, False).
    """
    epic = clean_epic(raw)
    if not epic or len(epic) != 10:
        return None, False
    if RE_EPIC_STRICT.match(epic):
        return epic, False
    corrected = _try_correct_epic_ocr(epic)
    if corrected:
        return corrected, True
    return None, False


def validate_epic(epic: Optional[str]) -> bool:
    """Strict: 3 uppercase letters + 7 digits only."""
    s = clean_epic(epic)
    return bool(RE_EPIC_STRICT.match(s))


# Strip labels like "Name :", "Father's Name:", "Name of relative :" at start of line
RE_NAME_LABEL = re.compile(
    r"^(?:name\s*[:\s]*|nama\s*[¢\s]*|father['\u2019]?s?\s*name\s*[:\s]*|husband['\u2019]?s?\s*name\s*[:\s]*|relative\s*name\s*[:\s]*|name\s+of\s+relative\s*[:\s]*)*",
    re.IGNORECASE,
)
# Split when multiple "Name" segments appear on one line (OCR often puts "Name ! Name : Kamala" in one cell)
RE_NAME_SEPARATOR = re.compile(r"\s+[Nn]ame\s*[:\s!¢]+\s*", re.IGNORECASE)


def _one_value_only(s: Optional[str], max_len: int = 150) -> Optional[str]:
    """
    One value per column: strip labels, then if the line contains multiple "Name" segments
    (e.g. "Rangammal Name ! Name : Kamala"), take only the FIRST segment so each column
    gets a single name (Rangammal in name, Kamala would be in relative on next line).
    """
    if not s or not isinstance(s, str):
        return None
    line = s.strip()
    if not line:
        return None
    line = RE_NAME_LABEL.sub("", line).strip()
    line = re.sub(r"\s+", " ", line).strip()
    if not line or len(line) < 2:
        return None
    # If line has multiple "Name" / "Name :" / "Name !" segments, take only the first segment
    parts = RE_NAME_SEPARATOR.split(line, maxsplit=1)
    first = (parts[0] if parts else line).strip()
    first = RE_NAME_LABEL.sub("", first).strip()
    first = re.sub(r"\s+", " ", first).strip()
    first = re.sub(r"[\s¢!]+$", "", first).strip()  # trim trailing junk
    if not first or len(first) < 2:
        return None
    return first[:max_len] if len(first) > max_len else first


def _sanitize_single_line(s: Optional[str], max_len: int = 150) -> Optional[str]:
    """Alias: one value per field (name or relative)."""
    return _one_value_only(s, max_len)


def detect_pdf_type(pdf_path: str) -> str:
    """Return 'text' or 'scanned' based on first-page text length."""
    try:
        from pdfminer.high_level import extract_text_to_fp
        from pdfminer.layout import LAParams
        from pdfminer.pdfpage import PDFPage
        from pdfminer.pdfinterp import PDFResourceManager, PDFPageInterpreter
        from pdfminer.converter import TextConverter

        with open(pdf_path, "rb") as f:
            rsrc = PDFResourceManager()
            out = io.StringIO()
            laparams = LAParams()
            device = TextConverter(rsrc, out, laparams=laparams)
            interpreter = PDFPageInterpreter(rsrc, device)
            for i, page in enumerate(PDFPage.get_pages(f)):
                if i >= 1:
                    break
                interpreter.process_page(page)
            text = out.getvalue() or ""
        return "text" if len(text.strip()) >= TEXT_PDF_MIN_CHARS else "scanned"
    except Exception as e:
        logger.warning("detect_pdf_type failed for %s: %s", pdf_path, e)
        return "scanned"


def extract_text_with_pdfminer(pdf_path: str) -> Dict[int, str]:
    """Extract text per page using pdfminer.six. Returns {1: text1, 2: text2, ...}."""
    result = {}
    try:
        from pdfminer.high_level import extract_pages
        from pdfminer.layout import LTTextContainer

        for page_num, page in enumerate(extract_pages(pdf_path), start=1):
            parts = []
            for el in page:
                if isinstance(el, LTTextContainer):
                    parts.append(el.get_text())
            result[page_num] = "\n".join(parts)
    except Exception as e:
        logger.warning("pdfminer extract failed for %s: %s", pdf_path, e)
    return result


def extract_text_with_ocr(pdf_path: str) -> Dict[int, str]:
    """Convert PDF to images, preprocess (grayscale, threshold), Tesseract OCR. Returns {1: text1, ...}."""
    result = {}
    try:
        import pytesseract
        from PIL import Image

        _configure_tesseract()
        try:
            import fitz  # pymupdf
            doc = fitz.open(pdf_path)
            for i in range(len(doc)):
                page = doc.load_page(i)
                pix = page.get_pixmap(dpi=150)
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                gray = img.convert("L")
                # Threshold to binary
                thresh = 150
                binary = gray.point(lambda p: 255 if p > thresh else 0, mode="1")
                text = pytesseract.image_to_string(binary, lang="eng")
                result[i + 1] = text or ""
            doc.close()
        except ImportError:
            from pdf2image import convert_from_path
            images = convert_from_path(pdf_path, dpi=150)
            for page_num, img in enumerate(images, start=1):
                gray = img.convert("L")
                thresh = 150
                binary = gray.point(lambda p: 255 if p > thresh else 0, mode="1")
                text = pytesseract.image_to_string(binary, lang="eng")
                result[page_num] = text or ""
    except Exception as e:
        err_msg = str(e).lower()
        if "tesseract" in err_msg and ("path" in err_msg or "not installed" in err_msg):
            allow_easyocr = os.getenv("ALLOW_EASYOCR_FALLBACK", "").strip().lower() in ("1", "true", "yes")
            if allow_easyocr:
                result = _extract_text_with_easyocr(pdf_path)
                if result:
                    return result
        logger.warning("OCR extract failed for %s: %s", pdf_path, e)
    return result


def _extract_text_with_easyocr(pdf_path: str) -> Dict[int, str]:
    """Fallback: PDF to images + EasyOCR when Tesseract is not available."""
    result = {}
    try:
        import easyocr
        import numpy as np
        from PIL import Image
        reader = easyocr.Reader(["en"], gpu=False, verbose=False)
        try:
            import fitz
            doc = fitz.open(pdf_path)
            for i in range(len(doc)):
                page = doc.load_page(i)
                pix = page.get_pixmap(dpi=150)
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                arr = np.array(img)
                if len(arr.shape) == 3:
                    arr = arr[:, :, :3]
                detections = reader.readtext(arr)
                text = "\n".join([t[1] for t in detections])
                result[i + 1] = text or ""
            doc.close()
        except ImportError:
            from pdf2image import convert_from_path
            images = convert_from_path(pdf_path, dpi=150)
            for page_num, img in enumerate(images, start=1):
                arr = np.array(img)
                if len(arr.shape) == 3:
                    arr = arr[:, :, :3]
                detections = reader.readtext(arr)
                text = "\n".join([t[1] for t in detections])
                result[page_num] = text or ""
        if result:
            logger.info("Bulk electoral roll OCR using EasyOCR (Tesseract not in PATH).")
    except ImportError:
        logger.warning("Tesseract not in PATH. Set TESSERACT_CMD or add to PATH; or pip install easyocr and set ALLOW_EASYOCR_FALLBACK=true")
    except Exception as e:
        logger.warning("EasyOCR fallback failed for %s: %s", pdf_path, e)
    return result


def parse_voter_records_from_text(
    text_per_page: Dict[int, str],
    source_pdf: str,
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Parse voter records: one EPIC per record, one line per field (name, relative, etc.).
    Validates and corrects EPIC (e.g. OCR HAG->HRG). Sanitizes name/relative to single clean line.
    Returns (records, invalid_epics_list).
    """
    records = []
    invalid_epics: List[str] = []
    for page_num, text in text_per_page.items():
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        i = 0
        while i < len(lines):
            line = lines[i]
            match = RE_EPIC_FIND.search(line)
            if match:
                epic_raw = match.group(1)
                epic_clean, was_corrected = validate_and_correct_epic(epic_raw)
                if not epic_clean:
                    invalid_epics.append(epic_raw)
                    i += 1
                    continue
                # One line per field; scan in order until next EPIC
                name = None
                relative_name = None
                house_no = None
                age = None
                gender = None
                idx = i + 1
                while idx < len(lines):
                    next_ln = lines[idx]
                    if RE_EPIC_FIND.search(next_ln):
                        break
                    if name is None and len(next_ln) > 1 and not next_ln.isdigit() and next_ln.upper() not in ("M", "F", "MALE", "FEMALE"):
                        name = _sanitize_single_line(next_ln, 150)
                    elif relative_name is None and name is not None and len(next_ln) > 1 and not next_ln.isdigit():
                        relative_name = _sanitize_single_line(next_ln, 150)
                    elif age is None and next_ln.isdigit() and len(next_ln) <= 3:
                        try:
                            age = int(next_ln)
                        except ValueError:
                            pass
                    elif gender is None and next_ln.upper() in ("M", "F", "MALE", "FEMALE"):
                        gender = next_ln.upper()[:1]
                    elif house_no is None and len(next_ln) <= 100 and any(c.isdigit() for c in next_ln) and ("/" in next_ln or next_ln.replace("/", "").replace("-", "").replace(" ", "").isdigit()):
                        house_no = next_ln[:100].strip() or None
                    idx += 1
                confidence = 0.95 if (name and epic_clean and was_corrected) else (0.9 if (name and epic_clean) else 0.6)
                records.append({
                    "epic_number": epic_clean,
                    "name": name,
                    "relative_name": relative_name,
                    "age": age,
                    "gender": gender,
                    "house_no": house_no,
                    "address": None,
                    "constituency_name": None,
                    "booth_number": None,
                    "source_pdf": source_pdf,
                    "page_number": page_num,
                    "confidence": confidence,
                })
            i += 1
    return records, invalid_epics


def process_one_pdf(pdf_path: str) -> Tuple[List[Dict[str, Any]], List[str], int]:
    """
    Detect type, extract text, parse, validate EPIC.
    Returns (valid_records, invalid_epic_list, total_found).
    """
    path = Path(pdf_path)
    if not path.exists():
        return [], [], 0
    source_name = path.name
    pdf_type = detect_pdf_type(str(path))
    if pdf_type == "text":
        text_per_page = extract_text_with_pdfminer(str(path))
    else:
        text_per_page = extract_text_with_ocr(str(path))
    if not text_per_page:
        return [], [], 0
    records, invalid_epics = parse_voter_records_from_text(text_per_page, source_name)
    total = len(records) + len(invalid_epics)
    return records, invalid_epics, total


# PostgreSQL (and psycopg2) limit ~32,767 bind parameters per statement. With ~17 columns per row, use batch_size <= 1500.
SAFE_BATCH_SIZE = 50


def _record_to_row(r: Dict[str, Any], source_pdf: str, box_id: int) -> Dict[str, Any]:
    """Build one voter_data row dict from a record (shared by bulk and one-by-one insert)."""
    epic = (r.get("epic_number") or "").strip() or None
    conf = r.get("confidence")
    if conf is not None:
        try:
            conf = float(conf)
        except (TypeError, ValueError):
            conf = None
    return {
        "pdf_name": source_pdf[:255],
        "page_number": r.get("page_number"),
        "box_id": box_id,
        "epic_number": epic,
        "name": (r.get("name") or "")[:255] if r.get("name") else None,
        "relative_name": (r.get("relative_name") or "")[:255] if r.get("relative_name") else None,
        "relation_type": (r.get("relation_type") or r.get("relation") or "")[:20] or None,
        "age": r.get("age"),
        "gender": (r.get("gender") or "")[:10] or None,
        "house_no": (r.get("house_no") or "")[:200] or None,
        "address": r.get("address"),
        "constituency_name": (r.get("constituency_name") or "")[:200] or None,
        "year": (r.get("year") or "")[:20] or None,
        "booth_number": (r.get("booth_number") or "")[:50] or None,
        "source_pdf": source_pdf[:500],
        "confidence_score": conf,
        "confidence": r.get("confidence"),
    }


def insert_records_one_by_one(
    db_session_factory,
    records: List[Dict[str, Any]],
) -> Tuple[int, int]:
    """
    Insert each record (one box) with an immediate commit. Same as folder flow: read one box, insert, commit, next.
    Uses ON CONFLICT (pdf_name, box_id) DO NOTHING. Returns (total_inserted, 0).
    """
    from sqlalchemy.dialects.postgresql import insert
    from models.sir.bulk_voter_import import BulkVoterImport

    if not records:
        return 0, 0
    db = db_session_factory()
    pdf_counter: Dict[str, int] = {}
    total_inserted = 0
    try:
        for r in records:
            source_pdf = (r.get("source_pdf") or "").strip() or "upload"
            pdf_counter[source_pdf] = pdf_counter.get(source_pdf, 0) + 1
            box_id = pdf_counter[source_pdf]
            one_row = _record_to_row(r, source_pdf, box_id)
            stmt = insert(BulkVoterImport).values(one_row).on_conflict_do_nothing(
                index_elements=["pdf_name", "box_id"]
            )
            res = db.execute(stmt)
            db.commit()
            total_inserted += res.rowcount if res.rowcount is not None and res.rowcount >= 0 else 1
    except Exception as e:
        db.rollback()
        logger.exception("DB INSERT FAILED (one-by-one): %s", e)
        raise
    finally:
        db.close()
    if total_inserted:
        logger.info("Committed %d boxes to voter_data (one box = one insert).", total_inserted)
    return total_inserted, 0


def bulk_insert_on_conflict_nothing(
    db_session_factory,
    records: List[Dict[str, Any]],
    batch_size: int = SAFE_BATCH_SIZE,
) -> Tuple[int, int]:
    """
    Bulk insert with ON CONFLICT (pdf_name, box_id) DO NOTHING when both set; else insert.
    Assigns pdf_name from source_pdf and box_id per-source_pdf so constraint is satisfied.
    batch_size is capped to avoid PostgreSQL 32k parameter limit (rows * columns < 32767).
    """
    from sqlalchemy.dialects.postgresql import insert
    from models.sir.bulk_voter_import import BulkVoterImport

    if not records:
        return 0, 0
    total_inserted = 0
    total_attempted = 0
    db = db_session_factory()
    pdf_counter: Dict[str, int] = {}
    values_list: List[Dict[str, Any]] = []
    for r in records:
        source_pdf = (r.get("source_pdf") or "").strip() or "upload"
        pdf_counter[source_pdf] = pdf_counter.get(source_pdf, 0) + 1
        box_id = pdf_counter[source_pdf]
        values_list.append(_record_to_row(r, source_pdf, box_id))
    if values_list:
        logger.info("Bulk insert: inserting %d records into voter_data (pdf_name + box_id).", len(values_list))
    # Cap batch to stay under PostgreSQL bind parameter limit (~32767)
    effective_batch = min(batch_size, 50)
    try:
        for i in range(0, len(values_list), effective_batch):
            batch = values_list[i : i + effective_batch]
            if not batch:
                continue
            total_attempted += len(batch)
            stmt = insert(BulkVoterImport).values(batch).on_conflict_do_nothing(
                index_elements=["pdf_name", "box_id"]
            )
            res = db.execute(stmt)
            db.commit()
            inserted_this_batch = res.rowcount if res.rowcount is not None and res.rowcount >= 0 else len(batch)
            total_inserted += inserted_this_batch
            logger.info("Committed %d rows to voter_data", inserted_this_batch)
    except Exception as e:
        db.rollback()
        logger.exception("DB INSERT FAILED (bulk): %s", e)
        raise
    finally:
        db.close()
    duplicates_skipped = total_attempted - total_inserted
    return total_inserted, duplicates_skipped


def _move_pdf_to_extracted(
    pdf_path: str,
    extracted_base: Path,
    state: Optional[str],
    year: Optional[str],
    district: Optional[str],
    constituency_name: Optional[str],
) -> bool:
    """Move PDF to extracted folder: state/year/district/constituency_name/filename. If all four are empty, use single folder 'bulk_rolls'."""
    try:
        src = Path(pdf_path)
        if not src.exists():
            return False
        has_any = bool((state or "").strip() or (year or "").strip() or (district or "").strip() or (constituency_name or "").strip())
        if not has_any:
            folder = extracted_base / "bulk_rolls"
        else:
            folder = (
                extracted_base
                / _safe_folder_name(state)
                / _safe_folder_name(year)
                / _safe_folder_name(district)
                / _safe_folder_name(constituency_name)
            )
        folder.mkdir(parents=True, exist_ok=True)
        dest = folder / src.name
        if dest.resolve() == src.resolve():
            return True
        shutil.move(str(src), str(dest))
        logger.info("Moved %s -> %s", src.name, dest)
        return True
    except Exception as e:
        logger.warning("Could not move PDF %s to extracted: %s", pdf_path, e)
        return False


def run_bulk(
    pdf_paths: List[str],
    db_session_factory,
    max_workers: Optional[int] = 1,
    batch_size: Optional[int] = None,
    constituency_name: Optional[str] = None,
    year: Optional[str] = None,
    extracted_base: Optional[str] = None,
    state: Optional[str] = None,
    district: Optional[str] = None,
    progress_callback: Optional[Callable[[int, int, str, int], None]] = None,
) -> Dict[str, Any]:
    """
    Process PDFs one by one: for each PDF, extract boxes → insert one box → commit → next box → then move PDF.
    No batching: one box = one insert = one commit (safe resume if crash).
    Optional constituency_name and year are stored on every inserted row.
    If extracted_base is set, each PDF is moved after processing to:
      extracted_base/<state>/<year>/<district>/<constituency_name>/<filename>
    max_workers is fixed at 1 (per-PDF processing only). batch_size is ignored (one-by-one insert).
    Returns: total_found, inserted, duplicates_skipped, invalid_epic_count, invalid_epics, pdf_count, moved_count, extracted_folder.
    """
    total_found = 0
    all_invalid_epics: List[str] = []
    seen_epic: set = set()
    moved_count = 0
    base_path: Optional[Path] = None
    if extracted_base and extracted_base.strip():
        base_path = Path(extracted_base.strip()).resolve()

    total_pdfs = len(pdf_paths)
    total_inserted = 0
    total_duplicates_skipped = 0

    # Strictly per-PDF: extract → insert one-by-one (one box → one commit) → then move PDF
    for current_index, pdf_path in enumerate(pdf_paths, start=1):
        try:
            if progress_callback:
                progress_callback(current_index - 1, total_pdfs, Path(pdf_path).name, total_inserted)
            records, invalid_epics, count = process_one_pdf(pdf_path)
            total_found += count
            all_invalid_epics.extend(invalid_epics)
            # Apply constituency/year to this PDF's records
            if constituency_name is not None or year is not None:
                for r in records:
                    if constituency_name is not None:
                        r["constituency_name"] = constituency_name.strip() or None
                    if year is not None:
                        r["year"] = str(year).strip() or None
            # Dedupe by EPIC when present; include all records (with or without EPIC)
            batch = []
            for r in records:
                epic = (r.get("epic_number") or "").strip()
                if epic:
                    if epic not in seen_epic:
                        seen_epic.add(epic)
                        batch.append(r)
                else:
                    batch.append(r)
            # One box → one insert → one commit (no batching)
            inserted, dup = insert_records_one_by_one(db_session_factory, batch)
            total_inserted += inserted
            total_duplicates_skipped += dup
            # Only then move this PDF to extracted folder
            if base_path is not None:
                if _move_pdf_to_extracted(
                    pdf_path, base_path, state, year, district, constituency_name
                ):
                    moved_count += 1
            if progress_callback:
                progress_callback(current_index, total_pdfs, Path(pdf_path).name, total_inserted)
        except Exception as e:
            logger.exception("process_one_pdf failed for %s: %s", pdf_path, e)
            if progress_callback:
                progress_callback(current_index, total_pdfs, Path(pdf_path).name, total_inserted)

    for ep in all_invalid_epics:
        logger.warning("Invalid EPIC (not stored): %s", ep)

    out: Dict[str, Any] = {
        "total_found": total_found,
        "inserted": total_inserted,
        "duplicates_skipped": total_duplicates_skipped,
        "invalid_epic_count": len(all_invalid_epics),
        "invalid_epics": all_invalid_epics[:100],
        "pdf_count": len(pdf_paths),
        "moved_count": moved_count,
    }
    if base_path is not None:
        out["extracted_folder"] = str(base_path)
    return out
