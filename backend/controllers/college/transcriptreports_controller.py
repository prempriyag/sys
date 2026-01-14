"""
Transcript Reports Controller - College Module
FastAPI version of CI3 Transcriptreports controller
Uses TranscriptReportsModel for all query logic (common code like CI3)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
import logging

from database.connection import get_db
from helpers.permission_dependency import require_permission
from models import User
from models.transcript_reports_model import TranscriptReportsModel

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/transcriptreports",
    tags=["transcriptreports"],
)


# ---------------------- #
# DataTables Request
# ---------------------- #
class DataTableRequest(BaseModel):
    draw: int
    start: int
    length: int
    search: dict
    order: list
    columns: list
    Search_Field: Optional[str] = None
    fieldType: Optional[str] = None
    fieldName: Optional[str] = None
    fromDate: Optional[str] = None
    toDate: Optional[str] = None
    STUDENT_ID: Optional[str] = None
    BATCH_ID: Optional[str] = None


# ---------------------- #
# AJAX LIST (Common endpoint for all transcript report types)
# ---------------------- #
@router.get("/test")
async def test_query(
    # Temporarily disabled authentication for testing
    # current_user: User = Depends(
    #     require_permission("college_digiscript_reports", "VIEW")
    # ),
    db: Session = Depends(get_db),
):
    """
    Test endpoint to verify database connection and check for data
    """
    from sqlalchemy import text
    from config.constants import TBL_KICKOUT, TBL_TRANSCRIPTHDRDATA, TBL_DOWNLOAD, COLLEGE_PROJECT_ID
    
    try:
        # Test 1: Check if table exists and has any data
        test1 = db.execute(text(f"SELECT COUNT(*) as cnt FROM {TBL_KICKOUT} WITH(NOLOCK)")).fetchone()
        
        # Test 2: Check records with PROJECT_ID
        test2 = db.execute(text(f"SELECT COUNT(*) as cnt FROM {TBL_KICKOUT} WITH(NOLOCK) WHERE PROJECT_ID = {COLLEGE_PROJECT_ID}")).fetchone()
        
        # Test 3: Check if joins work
        test3_sql = f"""
            SELECT COUNT(*) as cnt
            FROM {TBL_KICKOUT} k WITH(NOLOCK)
            INNER JOIN {TBL_TRANSCRIPTHDRDATA} h WITH(NOLOCK) ON h.BATCH_ID=k.BATCH_ID
            INNER JOIN {TBL_DOWNLOAD} d WITH(NOLOCK) ON d.BATCH_ID=k.BATCH_ID
            WHERE k.PROJECT_ID = {COLLEGE_PROJECT_ID}
        """
        test3 = db.execute(text(test3_sql)).fetchone()
        
        # Test 4: Get a sample record
        sample_sql = f"""
            SELECT TOP 1 k.BATCH_ID, k.PROJECT_ID, k.TRANSCRIPT_STATUS_FLAG
            FROM {TBL_KICKOUT} k WITH(NOLOCK)
            WHERE k.PROJECT_ID = {COLLEGE_PROJECT_ID}
        """
        sample = db.execute(text(sample_sql)).fetchone()
        
        return {
            "test1_total_records": test1.cnt if test1 else 0,
            "test2_records_with_project_id": test2.cnt if test2 else 0,
            "test3_records_with_joins": test3.cnt if test3 else 0,
            "sample_record": dict(sample._mapping) if sample else None,
            "project_id": COLLEGE_PROJECT_ID,
            "table_names": {
                "kickout": TBL_KICKOUT,
                "hdrdata": TBL_TRANSCRIPTHDRDATA,
                "download": TBL_DOWNLOAD,
            }
        }
    except Exception as e:
        logger.exception("Test query error")
        return {"error": str(e)}


@router.post("/ajaxlist", response_model=dict)
async def ajaxlist(
    request: DataTableRequest,
    # Temporarily disabled authentication for testing
    # current_user: User = Depends(
    #     require_permission("college_digiscript_reports", "VIEW")
    # ),
    db: Session = Depends(get_db),
):
    """
    Get transcript reports data for DataTables
    Common endpoint for all types: Failed, Processed, Rerun, Articulation-Kickouts, equivalenthours
    Matches CI3 Transcriptreports::ajaxlist() -> Transcripts_model::getreportsdata()
    """
    try:
        # Convert Pydantic model to dict for model
        request_data = request.model_dump()

        # Check if user has update permission (for rendering action dropdowns)
        # Temporarily disabled for testing
        has_update_permission = False
        # try:
        #     from helpers.permission_helper import check_permission
        #     has_update_permission = check_permission(
        #         current_user, "college_digiscript_reports", "UPDATE"
        #     )
        # except:
        #     pass

        # Use model to get data (common code like CI3)
        result = TranscriptReportsModel.get_reports_data(
            db=db,
            request_data=request_data,
            has_update_permission=has_update_permission,
        )

        return result

    except Exception as e:
        logger.exception("Transcript ajaxlist error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

