"""
Transcript Line OCR Controller - College Module
FastAPI version of CI3 Transcriptlineocr controller
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
import logging

from database.connection import get_db
from helpers.permission_dependency import require_permission
from models import User
from models.transcript_line_ocr_model import TranscriptLineOcrModel

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/transcriptlineocr",
    tags=["transcriptlineocr"],
)


class DataTableRequest(BaseModel):
    draw: int
    start: int
    length: int
    search: dict
    order: list
    columns: list
    fieldType: Optional[str] = None
    fieldName: Optional[str] = None


@router.post("/ajaxlist", response_model=dict)
async def ajaxlist(
    request: DataTableRequest,
    # Temporarily disabled authentication for testing
    # current_user: User = Depends(
    #     require_permission("college_transcript_line_ocr", "VIEW")
    # ),
    db: Session = Depends(get_db),
):
    """
    Get Transcript Line OCR data for DataTables
    Matches CI3 Transcriptlineocr::ajaxlist() -> Transcripts_model::gettranscriptlineocrdata()
    """
    try:
        request_data = {
            "draw": request.draw,
            "start": request.start,
            "length": request.length,
            "search": request.search,
            "order": request.order,
            "columns": request.columns,
            "fieldType": request.fieldType,
            "fieldName": request.fieldName,
        }

        has_update_permission = False

        result = TranscriptLineOcrModel.get_reports_data(
            db=db,
            request_data=request_data,
            has_update_permission=has_update_permission,
        )

        return result

    except Exception as e:
        logger.exception("Transcript Line OCR ajaxlist error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")



