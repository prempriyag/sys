"""
Production ECI Voter Roll Extractor API (v1).

Endpoints:
- POST /api/v1/extract-voters - Extract voters from PDF (auto-detect text vs scanned)
- GET /api/v1/extractor/health - Health check including OCR availability
"""
import asyncio
import importlib.util
import logging
import os
import tempfile
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Extractor v1"])


class ExtractorHealthResponse(BaseModel):
    status: str
    tesseract_available: bool
    easyocr_available: bool
    opencv_available: bool
    pymupdf_available: bool
    pdfplumber_available: bool


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
                    "ocr_max_pages": cfg.ocr_max_pages,
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
