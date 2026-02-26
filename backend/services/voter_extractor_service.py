"""
Production-grade ECI Voter Roll Extractor Service.

Architecture:
    Upload PDF → Auto-detect type → Text pipeline or OCR pipeline → Validation → JSON output

Supports:
- Text-based PDFs (PyMuPDF + existing electoral_roll_pdf_extractor)
- Scanned PDFs (OCR with optional preprocessing)
- Data validation and structured response
"""
import re
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# EPIC patterns: [A-Z]{3}[0-9]{7} or [A-Z]{3}[0-9]{6}
RE_EPIC = re.compile(r"[A-Z]{3}[0-9]{6,7}")

_TESSERACT_HELP = (
    "Tesseract OCR is not installed or not in PATH. "
    "Install Tesseract and either add it to PATH, or set TESSERACT_CMD to the full path "
    r"(example: C:\Program Files\Tesseract-OCR\tesseract.exe)."
)


def _configure_tesseract_cmd() -> None:
    cmd = (os.getenv("TESSERACT_CMD") or "").strip()
    if not cmd:
        return
    try:
        import pytesseract
        pytesseract.pytesseract.tesseract_cmd = cmd
    except Exception:
        return


def _require_tesseract() -> None:
    _configure_tesseract_cmd()
    try:
        import pytesseract
        pytesseract.get_tesseract_version()
    except Exception as e:
        raise RuntimeError(_TESSERACT_HELP) from e


def _preprocess_image_for_ocr(img) -> "Image":
    """Apply OpenCV preprocessing for better OCR accuracy (grayscale, blur, Otsu threshold)."""
    try:
        import cv2
        import numpy as np
        from PIL import Image
    except ImportError:
        logger.warning("opencv-python not installed; skipping OCR preprocessing")
        return img

    if hasattr(img, "size"):
        arr = np.array(img)
        if len(arr.shape) == 3:
            gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
        else:
            gray = arr
    else:
        gray = cv2.imread(str(img), cv2.IMREAD_GRAYSCALE)
        if gray is None:
            return img

    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    _, thresh = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return Image.fromarray(thresh)


def is_scanned_pdf(
    pdf_path: str | Path,
    min_text_chars_per_page: int = 50,
    sample_pages: int = 5,
) -> bool:
    """
    Auto-detect if PDF is scanned (image-based) vs text-based.

    Logic:
    - Sample first N pages
    - If average text per page < threshold → scanned
    - Uses PyMuPDF for fast text extraction (no OCR)
    """
    try:
        import fitz
    except ImportError:
        logger.warning("PyMuPDF not installed; assuming text PDF")
        return False

    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    doc = fitz.open(str(pdf_path))
    try:
        total_chars = 0
        pages_checked = 0
        for i in range(min(sample_pages, len(doc))):
            text = doc[i].get_text().strip()
            total_chars += len(text)
            pages_checked += 1
        if pages_checked == 0:
            return True
        avg_chars = total_chars / pages_checked
        return avg_chars < min_text_chars_per_page
    finally:
        doc.close()


def _extract_text_via_ocr_with_preprocessing(
    pdf_path: Path,
    max_pages: int = 1000,
    dpi: int = 300,
    preprocess: bool = True,
) -> List[str]:
    """
    Extract text from scanned PDF using OCR with optional OpenCV preprocessing.
    Uses pdf2image or PyMuPDF for images; Tesseract or EasyOCR for text.
    """
    images: List[Any] = []

    try:
        from pdf2image import convert_from_path
        images = convert_from_path(str(pdf_path), first_page=1, last_page=max_pages, dpi=dpi)
    except Exception as e:
        err = str(e).lower()
        if "poppler" in err or "page count" in err or "unable" in err:
            try:
                import fitz
                import io
                from PIL import Image
                doc = fitz.open(str(pdf_path))
                scale = dpi / 72.0
                mat = fitz.Matrix(scale, scale)
                for i in range(min(len(doc), max_pages)):
                    page = doc[i]
                    pix = page.get_pixmap(matrix=mat, alpha=False)
                    img_bytes = pix.tobytes("png")
                    images.append(Image.open(io.BytesIO(img_bytes)))
                doc.close()
            except Exception as e2:
                logger.warning("OCR image extraction failed: %s", e2)
                return []
        else:
            logger.warning("pdf2image failed: %s", e)
            return []

    if not images:
        return []

    if preprocess:
        images = [_preprocess_image_for_ocr(img) for img in images]

    allow_easyocr = os.getenv("ALLOW_EASYOCR_FALLBACK", "").strip().lower() in ("1", "true", "yes")
    try:
        import pytesseract
        if not allow_easyocr:
            _require_tesseract()
        return [pytesseract.image_to_string(img, lang="eng") for img in images]
    except Exception as e:
        err_msg = str(e).lower()
        if "tesseract" not in err_msg and "path" not in err_msg:
            logger.warning("Tesseract OCR failed: %s", e)
        if not allow_easyocr:
            raise RuntimeError(_TESSERACT_HELP) from e
        try:
            import easyocr
            import numpy as np
            reader = easyocr.Reader(["en"], gpu=False, verbose=False)
            result = []
            for img in images:
                arr = np.array(img)
                if len(arr.shape) == 3:
                    arr = arr[:, :, :3]
                detections = reader.readtext(arr)
                page_text = "\n".join([t[1] for t in detections])
                result.append(page_text)
            logger.info("OCR completed using EasyOCR fallback")
            return result
        except ImportError:
            logger.warning("Tesseract not in PATH. Install Tesseract or: pip install easyocr")
            return []
        except Exception as e2:
            logger.warning("EasyOCR failed: %s", e2)
            return []


def validate_records(
    records: List[Dict[str, Any]],
    age_min: int = 18,
    age_max: int = 120,
) -> Tuple[List[Dict[str, Any]], List[str], List[str]]:
    """
    Validate and clean extracted records.
    Returns (validated_records, errors, warnings).
    """
    errors: List[str] = []
    warnings: List[str] = []
    seen_epics: Dict[str, int] = {}
    validated: List[Dict[str, Any]] = []

    for idx, r in enumerate(records):
        rec = dict(r)
        row_num = idx + 1

        epic = (rec.get("epic_number") or "").strip()
        if epic:
            if not RE_EPIC.match(epic):
                warnings.append(f"Row {row_num}: EPIC format unusual: {epic[:20]}...")
            if epic in seen_epics:
                warnings.append(f"Row {row_num}: Duplicate EPIC {epic}")
            seen_epics[epic] = seen_epics.get(epic, 0) + 1

        age = rec.get("age")
        if age is not None:
            try:
                a = int(age)
                if a < age_min or a > age_max:
                    rec["age"] = None
                    warnings.append(f"Row {row_num}: Age {a} out of range [18,120], cleared")
                else:
                    rec["age"] = a
            except (ValueError, TypeError):
                rec["age"] = None
                warnings.append(f"Row {row_num}: Invalid age '{age}', cleared")

        gender = (rec.get("gender") or "").strip().upper()
        if gender:
            if gender.startswith("M"):
                rec["gender"] = "M"
            elif gender.startswith("F"):
                rec["gender"] = "F"
            elif gender in ("O", "OTHER"):
                rec["gender"] = "O"
            else:
                rec["gender"] = None
                warnings.append(f"Row {row_num}: Unusual gender '{gender}', cleared")

        name = (rec.get("name") or "").strip()
        if name:
            rec["name"] = name.upper()
        rel = (rec.get("relative_name") or "").strip()
        if rel:
            rec["relative_name"] = rel.upper()

        house_no = (rec.get("house_no") or "").strip()
        if house_no and re.match(r"^\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4}$", house_no):
            rec["house_no"] = None
            warnings.append(f"Row {row_num}: House no looks like date '{house_no}', cleared")
        else:
            rec["house_no"] = house_no or None

        validated.append(rec)

    return validated, errors, warnings


def extract_voters(
    pdf_path: str | Path,
    default_constituency_name: Optional[str] = None,
    default_booth_number: Optional[str] = None,
    force_ocr: bool = False,
    use_preprocessing: bool = True,
    ocr_dpi: int = 300,
    extraction_config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Main entry point: auto-detect PDF type, extract voters, validate, return structured JSON.

    Returns:
        {
            "total_records": int,
            "data": [...],
            "metadata": {...},
            "extraction_mode": "text" | "ocr",
            "errors": [...],
            "warnings": [...],
            "raw_page_texts": [...],
        }
    """
    from services.electoral_roll_pdf_extractor import extract_from_pdf

    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    scanned = is_scanned_pdf(pdf_path) or force_ocr
    extraction_mode = "ocr" if scanned else "text"

    cfg = dict(extraction_config or {})
    cfg.setdefault("ocr_preprocess", use_preprocessing)
    cfg.setdefault("ocr_dpi", ocr_dpi)
    cfg.setdefault("ocr_max_pages", 1000)

    result = extract_from_pdf(
        pdf_path,
        default_constituency_name=default_constituency_name,
        default_booth_number=default_booth_number,
        use_ocr=scanned,
        extraction_config=cfg,
    )

    records = result.get("records", [])
    metadata = result.get("metadata", {})
    raw_page_texts = result.get("raw_page_texts", [])

    validated, val_errors, val_warnings = validate_records(records)
    errors = val_errors
    warnings = val_warnings

    return {
        "total_records": len(validated),
        "data": validated,
        "metadata": metadata,
        "extraction_mode": extraction_mode,
        "errors": errors,
        "warnings": warnings,
        "raw_page_texts": raw_page_texts,
    }
