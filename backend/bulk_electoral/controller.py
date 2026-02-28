"""
Bulk Electoral Roll API routes.
PDF extraction + insert to voter_data. Isolated from upload controller.
"""
import asyncio
import json
import logging
import queue
import shutil
import tempfile
import threading
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database.connection import SessionLocal, get_db
from models.sir.bulk_voter_import import BulkVoterImport

from .service import get_extracted_base, process_files, process_folder

logger = logging.getLogger(__name__)

Opt = Optional

router = APIRouter(prefix="/api/bulk-electoral-roll", tags=["bulk-electoral-roll"])


@router.get("/count")
def bulk_electoral_roll_count(db: Session = Depends(get_db)):
    """Return row count in voter_data."""
    try:
        count = db.query(BulkVoterImport).count()
        return {"count": count, "table": "voter_data"}
    except Exception as e:
        err = str(e).lower()
        if "does not exist" in err or "relation" in err:
            raise HTTPException(
                status_code=503,
                detail="Table voter_data missing. Run: python create_sir_tables.py or alembic upgrade head",
            ) from e
        raise HTTPException(status_code=500, detail=str(e)) from e


def _err_msg_db_columns(e: Exception) -> str:
    err = str(e).strip()
    if "pdf_name" in err or "box_id" in err or "uq_voter_data_pdf_box" in err:
        return "Table voter_data needs new columns. Run: cd backend && alembic upgrade head (or scripts/sql/add_voter_data_pdf_box_columns.sql). " + err
    if "voter_data" in err and ("does not exist" in err or "relation" in err.lower()):
        return "Table voter_data missing. Run: python create_sir_tables.py or alembic upgrade head"
    if "bulk_voter_import" in err and ("does not exist" in err or "relation" in err.lower()):
        return "Table voter_data missing. Run: cd backend && alembic upgrade head"
    if "year" in err and "column" in err.lower() and "does not exist" in err.lower():
        return "Column 'year' missing. Run: cd backend && alembic upgrade head"
    return err


@router.post("")
async def bulk_electoral_roll(
    db: Session = Depends(get_db),
    folder_path: Opt[str] = Form(None),
    files: Opt[List[UploadFile]] = File(None),
    constituency_name: Opt[str] = Form(None),
    year: Opt[str] = Form(None),
    state: Opt[str] = Form(None),
    district: Opt[str] = Form(None),
):
    """
    Bulk Electoral Roll: folder path (production) or file uploads.
    - Folder: extract each PDF, insert to voter_data, move to extracted/.
    - Files: run bulk engine, insert, move.
    """
    extracted_base = get_extracted_base()

    if folder_path and folder_path.strip() and (not files or len(files) == 0):
        folder = Path(folder_path.strip())
        if not folder.is_dir():
            raise HTTPException(status_code=400, detail="folder_path is not a valid directory")
        try:
            result = process_folder(
                folder_path.strip(),
                db,
                extracted_base,
                constituency_name=constituency_name,
                state=state,
                year=year,
                district=district,
                use_ocr=True,
            )
        except Exception as e:
            logger.exception("process_folder failed: %s", e)
            raise HTTPException(status_code=500, detail=_err_msg_db_columns(e)) from e
        if result.get("errors") and result.get("total_inserted", 0) == 0:
            detail = "; ".join(result["errors"][:5])
            raise HTTPException(status_code=500, detail=_err_msg_db_columns(Exception(detail)))
        return result

    pdf_paths: List[str] = []
    temp_dir = None

    if files and len(files) > 0:
        temp_dir = tempfile.mkdtemp(prefix="bulk_roll_")
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
                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception:
                pass
        return {
            "total_found": 0,
            "inserted": 0,
            "duplicates_skipped": 0,
            "invalid_epic_count": 0,
            "invalid_epics": [],
            "message": "No PDF files found.",
        }

    try:
        result = process_files(
            pdf_paths,
            SessionLocal,
            extracted_base=extracted_base,
            constituency_name=constituency_name,
            year=year,
            state=state,
            district=district,
            max_workers=1,
            batch_size=500,
        )
    except Exception as e:
        logger.exception("bulk-electoral-roll failed: %s", e)
        if temp_dir:
            try:
                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=_err_msg_db_columns(e)) from e

    if temp_dir:
        try:
            shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception:
            pass

    return result


@router.post("/stream")
async def bulk_electoral_roll_stream(
    folder_path: Opt[str] = Form(None),
    files: Opt[List[UploadFile]] = File(None),
    constituency_name: Opt[str] = Form(None),
    year: Opt[str] = Form(None),
    state: Opt[str] = Form(None),
    district: Opt[str] = Form(None),
):
    """
    Same as POST but returns Server-Sent Events for progress (current, total, pdf_name, records_so_far).
    """
    pdf_paths: List[str] = []
    temp_dir = None
    use_folder_flow = False

    if files and len(files) > 0:
        temp_dir = tempfile.mkdtemp(prefix="bulk_roll_")
        for f in files:
            if f.filename and f.filename.lower().endswith(".pdf"):
                path = Path(temp_dir) / (f.filename or "upload.pdf")
                content = await f.read()
                path.write_bytes(content)
                pdf_paths.append(str(path))
    elif folder_path and folder_path.strip():
        folder = Path(folder_path.strip())
        if not folder.is_dir():
            raise HTTPException(status_code=400, detail="folder_path is not a valid directory")
        pdf_paths = [str(p) for p in sorted(folder.glob("*.pdf"))]
        use_folder_flow = True
    else:
        raise HTTPException(
            status_code=400,
            detail="Provide either folder_path or upload multiple PDF files",
        )

    if not pdf_paths:
        if temp_dir:
            try:
                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception:
                pass
        return {"total_found": 0, "inserted": 0, "pdf_count": 0, "message": "No PDF files found."}

    extracted_base = get_extracted_base()
    progress_queue: queue.Queue = queue.Queue()

    def run_with_progress():
        def on_progress(current: int, total: int, pdf_name: str, records_so_far: int):
            progress_queue.put({
                "type": "progress",
                "current": current,
                "total": total,
                "pdf_name": pdf_name,
                "records_so_far": records_so_far,
            })

        try:
            if use_folder_flow:
                db = SessionLocal()
                try:
                    result = process_folder(
                        folder_path.strip(),
                        db,
                        extracted_base,
                        constituency_name=constituency_name,
                        state=state,
                        year=year,
                        district=district,
                        use_ocr=True,
                        progress_callback=on_progress,
                    )
                    progress_queue.put({"type": "done", "result": result})
                finally:
                    db.close()
            else:
                result = process_files(
                    pdf_paths,
                    SessionLocal,
                    extracted_base=extracted_base,
                    constituency_name=constituency_name,
                    year=year,
                    state=state,
                    district=district,
                    max_workers=1,
                    batch_size=500,
                    progress_callback=on_progress,
                )
                progress_queue.put({"type": "done", "result": result})
        except Exception as e:
            logger.exception("bulk-electoral-roll-stream failed: %s", e)
            progress_queue.put({"type": "error", "detail": str(e)})

    thread = threading.Thread(target=run_with_progress)
    thread.start()

    async def event_stream():
        while True:
            try:
                item = await asyncio.get_event_loop().run_in_executor(
                    None, lambda: progress_queue.get(timeout=1)
                )
            except queue.Empty:
                yield ": keepalive\n\n"
                continue
            yield f"data: {json.dumps(item)}\n\n"
            if item.get("type") in ("done", "error"):
                break
        thread.join(timeout=2)
        if temp_dir:
            try:
                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception:
                pass

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
