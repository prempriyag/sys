import os
import tempfile
import logging
from typing import Optional

from fastapi import APIRouter, File, HTTPException, Query, UploadFile

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Docling Extractor"])

def _force_disable_hf_symlinks_on_windows() -> None:
    """
    HuggingFace Hub uses symlinks in its cache layout. On Windows this requires Developer Mode
    (or admin rights). If unavailable, downloads can fail with WinError 1314.

    We force "symlinks unsupported" for the HF cache dir so the hub falls back to copy/move.
    """
    if os.name != "nt":
        return
    # Allow opting out if the user *wants* symlinks and has Developer Mode enabled
    if os.getenv("HF_HUB_FORCE_DISABLE_SYMLINKS", "true").strip().lower() not in ("1", "true", "yes"):
        return
    try:
        from pathlib import Path
        from huggingface_hub import constants  # type: ignore
        import huggingface_hub.file_download as fd  # type: ignore

        cache_dir = str(Path(constants.HF_HUB_CACHE).expanduser().resolve())
        # HuggingFace hub checks symlink support per-directory and memoizes it.
        # We force-disable it to avoid WinError 1314 (symlink privilege not held).
        if hasattr(fd, "_are_symlinks_supported_in_dir"):
            memo = fd._are_symlinks_supported_in_dir  # type: ignore[attr-defined]
            memo[cache_dir] = False
            # Add a few normalized variants to avoid path-string mismatches.
            memo[str(Path(cache_dir))] = False
            memo[str(Path(cache_dir).resolve())] = False
            memo[str(Path(cache_dir).parent.resolve())] = False
            memo[str((Path(cache_dir) / "hub").resolve())] = False

        # Strongest approach: monkeypatch the check to always return False.
        # `_create_symlink()` will then never attempt os.symlink(), and will copy/move instead.
        if hasattr(fd, "are_symlinks_supported"):
            fd.are_symlinks_supported = lambda *_args, **_kwargs: False  # type: ignore[assignment]
        # Also silence warning spam
        os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
    except Exception:
        # Best-effort only
        return


@router.post("/upload-docling")
async def upload_docling(
    file: UploadFile = File(...),
    line_y_threshold: float = 6.0,
    block_y_gap_threshold: float = 28.0,
    max_pages: Optional[int] = Query(15, ge=1, le=500, description="Max PDF pages to process (limits memory use)"),
):
    """
    Upload a PDF and extract voter records using Docling layout extraction.
    Returns:
      { total_extracted, is_scanned, data: [...] }
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    tmp_path: Optional[str] = None
    try:
        content = await file.read()
        if not content or len(content) < 100:
            raise HTTPException(
                status_code=400,
                detail="Uploaded file is empty or too small to be a valid PDF.",
            )
        if not content.lstrip().startswith(b"%PDF"):
            raise HTTPException(
                status_code=400,
                detail="File does not appear to be a valid PDF (missing PDF header).",
            )
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(content)
            tmp.flush()
            tmp_path = tmp.name

        _force_disable_hf_symlinks_on_windows()

        try:
            from app.services.docling_extractor import extract_voters_from_pdf, is_scanned_pdf_quick
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail="Docling extractor is not available. Install dependency: pip install docling",
            ) from e

        is_scanned = is_scanned_pdf_quick(tmp_path)
        data = extract_voters_from_pdf(
            tmp_path,
            line_y_threshold=line_y_threshold,
            block_y_gap_threshold=block_y_gap_threshold,
            max_num_pages=max_pages,
        )

        return {
            "total_extracted": len(data),
            "is_scanned": is_scanned,
            "data": data,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Docling extraction failed")
        # Prefer app settings over os.getenv because .env is loaded by pydantic settings.
        try:
            from config.settings import settings
            debug = bool(getattr(settings, "DEBUG", False))
        except Exception:
            debug = False

        # Fail-fast, user-actionable messages for common docling install issues
        msg_lower = str(e).lower()
        if isinstance(e, ModuleNotFoundError) and ("docling" in msg_lower):
            raise HTTPException(status_code=500, detail="Docling is not installed. Run: pip install docling") from e
        # Windows symlink privilege error from HuggingFace cache
        if os.name == "nt" and ("winerror 1314" in msg_lower or "required privilege is not held" in msg_lower):
            raise HTTPException(
                status_code=500,
                detail=(
                    "Docling model download failed on Windows due to symlink privileges (WinError 1314). "
                    "Fix: enable Windows Developer Mode, or run the backend as Administrator. "
                    "Workaround: set HF_HUB_FORCE_DISABLE_SYMLINKS=true and restart backend."
                ),
            ) from e

        # Docling C++ preprocess can raise std::bad_alloc (OOM) on large PDFs
        if "bad_alloc" in msg_lower or "memory" in msg_lower:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Docling ran out of memory processing this PDF. "
                    "Try a smaller file or limit pages: use ?max_pages=10 (or 15) on the request."
                ),
            ) from e

        # Docling rejects corrupted or unsupported PDFs with "is not valid"
        if "is not valid" in msg_lower or "not valid" in msg_lower:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Docling could not open this PDF. The file may be corrupted, "
                    "password-protected, or in an unsupported format. Try re-saving or re-exporting the PDF."
                ),
            ) from e

        msg = str(e) if debug else "Docling extraction failed"
        raise HTTPException(status_code=500, detail=msg) from e
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

