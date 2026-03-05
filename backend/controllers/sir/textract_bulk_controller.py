"""
Bulk Textract Extract: Process assembly PDFs one by one via AWS Textract.
Extract → insert to voter_data → move to extracted/state/year/district/constituency.
New route: /api/upload/bulk-textract-extract
"""
import json
import logging
import os
import tempfile
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database.connection import SessionLocal, get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/upload", tags=["Bulk Textract Extract"])


def _resolve_folder_path(folder_path: str) -> Path:
    """Resolve folder_path to absolute. Relative paths are resolved against backend dir."""
    fp = Path(folder_path.strip())
    if not fp.is_absolute():
        backend_dir = Path(__file__).resolve().parent.parent.parent
        fp = (backend_dir / fp).resolve()
    return fp


def _resolve_meta(
    state: Optional[str],
    year: Optional[str],
    district: Optional[str],
    constituency_name: Optional[str],
    folder_path: Optional[str] = None,
) -> tuple:
    """Return (state, year, district, constituency) with safe defaults. Infers from folder_path if provided."""
    from controllers.sir.upload_controller import _resolve_extract_path_meta
    from services.textract_bulk_service import _infer_meta_from_folder_path

    inferred = _infer_meta_from_folder_path(folder_path) if folder_path else {}
    eff_state = (state or "").strip() or inferred.get("state")
    eff_year = (year or "").strip() or inferred.get("year")
    eff_district = (district or "").strip() or inferred.get("district")
    eff_constituency = (constituency_name or "").strip() or inferred.get("constituency_name")
    return _resolve_extract_path_meta(eff_state, eff_year, eff_district, eff_constituency)


@router.get("/bulk-folder-paths")
async def get_bulk_folder_paths():
    """
    List all server folders that contain PDFs. For bulk upload dropdown.
    Scans BULK_SCAN_ROOTS (default: download, bulk_rolls). Returns paths relative to backend.
    """
    from services.textract_bulk_service import discover_pdf_folder_paths
    paths = discover_pdf_folder_paths()
    return {"paths": paths, "count": len(paths)}


@router.post("/bulk-textract-extract")
async def bulk_textract_extract(
    db: Session = Depends(get_db),
    folder_path: Optional[str] = Form(None),
    files: Optional[List[UploadFile]] = File(None),
    constituency_name: Optional[str] = Form(None),
    year: Optional[str] = Form(None),
    state: Optional[str] = Form(None),
    district: Optional[str] = Form(None),
):
    """
    Bulk Textract Extract: Process all PDFs in a folder or uploaded files.
    For each PDF: AWS Textract extract → insert to voter_data → move to extracted/.
    Extracted folder: extracted/state/year/district/constituency/ (matches download structure).
    Processes one PDF at a time.
    """
    from services.textract_bulk_service import list_pdfs_in_folder, run_bulk_textract

    try:
        import boto3  # noqa: F401
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="boto3 required. In venv run: pip install boto3. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_BUCKET in .env",
        )

    extracted_base = os.environ.get("EXTRACTED_FOLDER", "").strip()
    if not extracted_base:
        backend_dir = Path(__file__).resolve().parent.parent.parent
        extracted_base = str(backend_dir / "extracted")

    pdf_paths: List[str] = []
    temp_dir = None
    resolved_folder: Optional[Path] = None

    if folder_path and folder_path.strip() and (not files or len(files) == 0):
        folder = _resolve_folder_path(folder_path)
        resolved_folder = folder
        if not folder.is_dir():
            raise HTTPException(status_code=400, detail="folder_path is not a valid directory")
        pdf_paths = list_pdfs_in_folder(str(folder))
        if not pdf_paths:
            return {
                "total_found": 0,
                "inserted": 0,
                "duplicates_skipped": 0,
                "pdf_count": 0,
                "moved_count": 0,
                "extracted_folder": extracted_base,
                "message": "No PDF files found in folder.",
            }

    elif files and len(files) > 0:
        temp_dir = tempfile.mkdtemp(prefix="bulk_textract_")
        for f in files:
            if f.filename and f.filename.lower().endswith(".pdf"):
                path = Path(temp_dir) / (f.filename or "upload.pdf")
                content = await f.read()
                path.write_bytes(content)
                pdf_paths.append(str(path))
    else:
        raise HTTPException(
            status_code=400,
            detail="Provide folder_path (server path) or upload PDF files",
        )

    if not pdf_paths:
        if temp_dir:
            try:
                import shutil
                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception:
                pass
        return {
            "total_found": 0,
            "inserted": 0,
            "duplicates_skipped": 0,
            "pdf_count": 0,
            "moved_count": 0,
            "extracted_folder": extracted_base,
            "message": "No PDF files found.",
        }

    eff_state, eff_year, eff_district, eff_constituency = _resolve_meta(
        state, year, district, constituency_name,
        folder_path=str(resolved_folder) if resolved_folder else (folder_path.strip() if folder_path else None),
    )

    try:
        result = run_bulk_textract(
            pdf_paths,
            SessionLocal,
            extracted_base=extracted_base,
            state=eff_state,
            year=eff_year,
            district=eff_district,
            constituency_name=eff_constituency,
            folder_path=str(resolved_folder) if resolved_folder else (folder_path.strip() if folder_path else None),
        )
    except Exception as e:
        logger.exception("bulk-textract-extract failed: %s", e)
        if temp_dir:
            try:
                import shutil
                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=str(e))

    if temp_dir:
        try:
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception:
            pass

    return result


@router.post("/bulk-textract-extract-stream")
async def bulk_textract_extract_stream(
    db: Session = Depends(get_db),
    folder_path: Optional[str] = Form(None),
    files: Optional[List[UploadFile]] = File(None),
    constituency_name: Optional[str] = Form(None),
    year: Optional[str] = Form(None),
    state: Optional[str] = Form(None),
    district: Optional[str] = Form(None),
):
    """
    Same as bulk-textract-extract but returns Server-Sent Events.
    Streams progress events during processing, then final result.
    """
    from services.textract_bulk_service import list_pdfs_in_folder, run_bulk_textract

    try:
        import boto3  # noqa: F401
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="boto3 required. pip install boto3. Set AWS credentials in .env",
        )

    extracted_base = os.environ.get("EXTRACTED_FOLDER", "").strip()
    if not extracted_base:
        backend_dir = Path(__file__).resolve().parent.parent.parent
        extracted_base = str(backend_dir / "extracted")

    pdf_paths: List[str] = []
    temp_dir = None
    resolved_folder_stream: Optional[Path] = None

    if folder_path and folder_path.strip() and (not files or len(files) == 0):
        folder = _resolve_folder_path(folder_path)
        resolved_folder_stream = folder
        if not folder.is_dir():
            raise HTTPException(status_code=400, detail="folder_path is not a valid directory")
        pdf_paths = list_pdfs_in_folder(str(folder))
    elif files and len(files) > 0:
        temp_dir = tempfile.mkdtemp(prefix="bulk_textract_")
        for f in files:
            if f.filename and f.filename.lower().endswith(".pdf"):
                path = Path(temp_dir) / (f.filename or "upload.pdf")
                content = await f.read()
                path.write_bytes(content)
                pdf_paths.append(str(path))
    else:
        raise HTTPException(status_code=400, detail="Provide folder_path or upload PDF files")

    if not pdf_paths:
        if temp_dir:
            try:
                import shutil
                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception:
                pass

        def empty_gen():
            yield f"data: {json.dumps({'type': 'done', 'result': {'message': 'No PDF files found.'}})}\n\n"

        return StreamingResponse(empty_gen(), media_type="text/event-stream")

    eff_state, eff_year, eff_district, eff_constituency = _resolve_meta(
        state, year, district, constituency_name,
        folder_path=str(resolved_folder_stream) if resolved_folder_stream else (folder_path.strip() if folder_path else None),
    )

    def sse_gen():
        try:
            result = run_bulk_textract(
                pdf_paths,
                SessionLocal,
                extracted_base=extracted_base,
                state=eff_state,
                year=eff_year,
                district=eff_district,
                constituency_name=eff_constituency,
                folder_path=str(resolved_folder_stream) if resolved_folder_stream else (folder_path.strip() if folder_path else None),
            )
            yield f"data: {json.dumps({'type': 'done', 'result': result})}\n\n"
        except Exception as e:
            logger.exception("bulk-textract-extract-stream failed: %s", e)
            yield f"data: {json.dumps({'type': 'error', 'detail': str(e)})}\n\n"
        finally:
            if temp_dir:
                try:
                    import shutil
                    shutil.rmtree(temp_dir, ignore_errors=True)
                except Exception:
                    pass

    return StreamingResponse(sse_gen(), media_type="text/event-stream")
