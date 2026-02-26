"""
Production ECI Voter Roll Extractor API (v1).

Endpoints:
- POST /api/v1/extract-voters - Extract voters from PDF (auto-detect text vs scanned)
- POST /api/v1/ocr-upload - Save extracted records to ocr_voter_uploads table
- GET /api/v1/extractor/health - Health check including OCR availability
"""
import asyncio
import importlib.util
import logging
import os
import tempfile
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.connection import get_db
from models.sir.ocr_voter_upload import OcrVoterUpload

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Extractor v1"])


class ExtractorHealthResponse(BaseModel):
    status: str
    tesseract_available: bool
    easyocr_available: bool
    opencv_available: bool
    pymupdf_available: bool
    pdfplumber_available: bool


class OcrUploadRecord(BaseModel):
    epic_number: Optional[str] = None
    name: Optional[str] = None
    relative_name: Optional[str] = None
    relation_type: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    house_no: Optional[str] = None
    address: Optional[str] = None
    booth_number: Optional[str] = None
    constituency_name: Optional[str] = None
    page_number: Optional[int] = None
    card_index: Optional[int] = None
    section_name: Optional[str] = None
    source_block: Optional[str] = None
    confidence: Optional[float] = None
    epic_confidence: Optional[float] = None
    quality_flag: Optional[str] = None

    class Config:
        extra = "allow"


class OcrUploadRequest(BaseModel):
    records: List[OcrUploadRecord]
    constituency_name: Optional[str] = None
    booth_number: Optional[str] = None


@router.get("/extractor/health", response_model=ExtractorHealthResponse)
async def extractor_health():
    """
    Health check for extraction service.
    Reports availability of OCR engines (Tesseract, EasyOCR), OpenCV, PyMuPDF, pdfplumber.
    """
    # Keep this endpoint lightweight. Importing EasyOCR can take minutes (torch init)
    # and will slow down the UI if called on page load.
    def _has_module(name: str) -> bool:
        return importlib.util.find_spec(name) is not None

    def check_tesseract() -> bool:
        try:
            import pytesseract
            pytesseract.get_tesseract_version()
            return True
        except Exception:
            return False

    loop = asyncio.get_event_loop()
    tesseract = await loop.run_in_executor(None, check_tesseract)
    easyocr = _has_module("easyocr")
    opencv = _has_module("cv2")
    pymupdf = _has_module("fitz")
    pdfplumber = _has_module("pdfplumber")

    ocr_ok = tesseract or easyocr
    return ExtractorHealthResponse(
        status="healthy" if (pymupdf and pdfplumber and ocr_ok) else "degraded",
        tesseract_available=tesseract,
        easyocr_available=easyocr,
        opencv_available=opencv,
        pymupdf_available=pymupdf,
        pdfplumber_available=pdfplumber,
    )


@router.post("/extract-voters")
async def extract_voters(
    file: UploadFile = File(...),
    constituency_name: Optional[str] = Form(None),
    booth_number: Optional[str] = Form(None),
    force_ocr: str = Form("false"),
    use_preprocessing: str = Form("true"),
    max_pages: Optional[int] = Form(None),
):
    """
    Extract structured voter data from ECI electoral roll PDF.

    - Auto-detects text-based vs scanned PDF
    - Text PDF: PyMuPDF + block parsing
    - Scanned PDF: OCR (Tesseract/EasyOCR) with optional OpenCV preprocessing
    - Returns validated JSON with records, metadata, errors, warnings

    Max file size: 100 MB (configurable via EXTRACT_MAX_FILE_MB).
    """
    from config.extraction_config import get_extraction_config
    from services.voter_extractor_service import extract_voters as do_extract

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    cfg = get_extraction_config()
    max_bytes = cfg.max_file_size_mb * 1024 * 1024

    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max {cfg.max_file_size_mb} MB allowed.",
        )

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        ocr_max = max_pages if max_pages is not None and max_pages > 0 else cfg.ocr_max_pages
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: do_extract(
                tmp_path,
                default_constituency_name=constituency_name or None,
                default_booth_number=booth_number or None,
                force_ocr=force_ocr.lower() in ("true", "1", "yes"),
                use_preprocessing=use_preprocessing.lower() in ("true", "1", "yes"),
                ocr_dpi=cfg.ocr_dpi,
                extraction_config={
                    "ocr_preprocess": use_preprocessing.lower() in ("true", "1", "yes"),
                    "ocr_dpi": cfg.ocr_dpi,
                    "ocr_max_pages": ocr_max,
                },
            ),
        )
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Extraction failed")
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


# Batch size for bulk insert (optimized for ~7 lakh records)
OCR_UPLOAD_BATCH_SIZE = 5000


def _coerce_int(val: Any) -> Optional[int]:
    if val is None:
        return None
    if isinstance(val, int):
        return val
    try:
        return int(val)
    except (TypeError, ValueError):
        return None


def _coerce_float(val: Any) -> Optional[float]:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


@router.post("/ocr-upload")
async def ocr_upload(
    body: OcrUploadRequest,
    db: Session = Depends(get_db),
):
    """
    Save extracted voter records from OCR PDF Detector into the sys database
    (table: ocr_voter_uploads). Batch insert for ~7 lakh records; commits every
    OCR_UPLOAD_BATCH_SIZE rows.
    """
    if not body.records:
        raise HTTPException(status_code=400, detail="No records to upload.")

    default_constituency = (body.constituency_name or "").strip() or None
    default_booth = (body.booth_number or "").strip() or None
    inserted = 0
    errors: List[str] = []

    for idx, r in enumerate(body.records):
        try:
            rec = r.model_dump() if hasattr(r, "model_dump") else (r.dict() if hasattr(r, "dict") else dict(r))
            constituency = (rec.get("constituency_name") or "").strip() or default_constituency
            booth = (rec.get("booth_number") or "").strip() or default_booth

            row = OcrVoterUpload(
                epic_number=(rec.get("epic_number") or "").strip() or None,
                name=(rec.get("name") or "").strip() or None,
                relative_name=(rec.get("relative_name") or "").strip() or None,
                relation_type=(rec.get("relation_type") or "").strip() or None,
                age=_coerce_int(rec.get("age")),
                gender=(rec.get("gender") or "").strip().upper() or None,
                house_no=(rec.get("house_no") or "").strip() or None,
                address=(rec.get("address") or "").strip() or None,
                booth_number=booth,
                constituency_name=constituency,
                page_number=_coerce_int(rec.get("page_number")),
                card_index=_coerce_int(rec.get("card_index")),
                section_name=(rec.get("section_name") or "").strip() or None,
                source_block=(rec.get("source_block") or "").strip() or None,
                confidence=_coerce_float(rec.get("confidence")),
                epic_confidence=_coerce_float(rec.get("epic_confidence")),
                quality_flag=(rec.get("quality_flag") or "").strip() or None,
            )
            db.add(row)
            inserted += 1
            if inserted % OCR_UPLOAD_BATCH_SIZE == 0:
                db.commit()
        except Exception as e:
            errors.append(f"Row {idx + 1}: {e}")

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}") from e

    return {
        "inserted": inserted,
        "total_sent": len(body.records),
        "errors": errors[:20],
    }
