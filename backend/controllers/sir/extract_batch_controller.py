"""
API controller for automated file processing (extract batches).
Master list + drill-down detail (headers + lines).
"""
import logging
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database.connection import get_db
from models.extract_batch import ExtractDownload, ExtractHeader, ExtractLine
from services.extract_folder_watcher import start_folder_watcher, _get_watch_folder, _get_archive_folder
from services.extract_batch_service import process_file_and_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/extract-batches", tags=["extract-batches"])


# ----- Response models -----
class DownloadListItem(BaseModel):
    batch_id: str
    original_file_name: str
    file_created_datetime: Optional[str]
    total_pages: Optional[int]
    stored_path: Optional[str]
    created_at: Optional[str]

    class Config:
        from_attributes = True


class HeaderItem(BaseModel):
    header_key: str
    header_value: Optional[str]


class LineItem(BaseModel):
    id: int
    line_number: Optional[int]
    page_number: Optional[int]
    epic_number: Optional[str]
    name: Optional[str]
    relative_name: Optional[str]
    age: Optional[int]
    gender: Optional[str]
    house_no: Optional[str]
    address: Optional[str]
    booth_number: Optional[str]
    constituency_name: Optional[str]
    confidence_score: Optional[float]

    class Config:
        from_attributes = True


class BatchDetailResponse(BaseModel):
    download: DownloadListItem
    headers: List[HeaderItem]
    lines: List[LineItem]


def _handle_extract_table_error(e: Exception):
    """Return helpful 503 when extract_downloads table is missing."""
    from fastapi import HTTPException
    err = str(e).lower()
    if "extract_downloads" in err and ("does not exist" in err or "relation" in err):
        raise HTTPException(
            status_code=503,
            detail="Tables extract_downloads, extract_headers, extract_lines are missing. Run: cd backend && alembic upgrade head",
        ) from e
    raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/list", response_model=List[DownloadListItem])
def list_downloads(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Master list of all processed files (Downloads table)."""
    try:
        rows = (
            db.query(ExtractDownload)
            .order_by(ExtractDownload.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
    except Exception as e:
        _handle_extract_table_error(e)
    return [
        DownloadListItem(
            batch_id=r.batch_id,
            original_file_name=r.original_file_name,
            file_created_datetime=r.file_created_datetime.isoformat() if r.file_created_datetime else None,
            total_pages=r.total_pages,
            stored_path=r.stored_path,
            created_at=r.created_at.isoformat() if r.created_at else None,
        )
        for r in rows
    ]


@router.post("/start-watcher")
def start_watcher():
    """Start the folder watcher (if EXTRACT_OCR_FOLDER is set)."""
    started = start_folder_watcher()
    watch_folder = _get_watch_folder()
    return {
        "started": started,
        "watch_folder": str(watch_folder) if watch_folder else None,
        "message": "Watcher started" if started else "EXTRACT_OCR_FOLDER not set; add to .env",
    }


@router.post("/process-file")
def process_uploaded_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Manually process an uploaded PDF file.
    Same flow: generate batch_id, extract, store in Downloads/Headers/Lines, archive.
    """
    from fastapi import HTTPException
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        content = file.file.read()
        tmp.write(content)
        tmp_path = Path(tmp.name)
    try:
        archive_base = _get_archive_folder()
        result = process_file_and_store(tmp_path, archive_base, db, use_ocr=True)
        return result
    except Exception as e:
        _handle_extract_table_error(e)
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except OSError:
            pass


@router.get("/{batch_id}", response_model=BatchDetailResponse)
def get_batch_detail(batch_id: str, db: Session = Depends(get_db)):
    """Drill-down: headers + lines for a batch."""
    try:
        down = db.query(ExtractDownload).filter(ExtractDownload.batch_id == batch_id).first()
    except Exception as e:
        _handle_extract_table_error(e)
    if not down:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Batch not found")

    headers = db.query(ExtractHeader).filter(ExtractHeader.batch_id == batch_id).all()
    lines = db.query(ExtractLine).filter(ExtractLine.batch_id == batch_id).order_by(ExtractLine.line_number).all()

    return BatchDetailResponse(
        download=DownloadListItem(
            batch_id=down.batch_id,
            original_file_name=down.original_file_name,
            file_created_datetime=down.file_created_datetime.isoformat() if down.file_created_datetime else None,
            total_pages=down.total_pages,
            stored_path=down.stored_path,
            created_at=down.created_at.isoformat() if down.created_at else None,
        ),
        headers=[HeaderItem(header_key=h.header_key, header_value=h.header_value) for h in headers],
        lines=[
            LineItem(
                id=ln.id,
                line_number=ln.line_number,
                page_number=ln.page_number,
                epic_number=ln.epic_number,
                name=ln.name,
                relative_name=ln.relative_name,
                age=ln.age,
                gender=ln.gender,
                house_no=ln.house_no,
                address=ln.address,
                booth_number=ln.booth_number,
                constituency_name=ln.constituency_name,
                confidence_score=ln.confidence_score,
            )
            for ln in lines
        ],
    )
