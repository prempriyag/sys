"""
Articulation Reports Controller - College Module
FastAPI version of CI3 Articulationreports controller
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
import logging

from database.connection import get_db
from helpers.permission_dependency import require_permission
from models import User
from models.articulation_reports_model import ArticulationReportsModel

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/articulationreports",
    tags=["articulationreports"],
)


# ---------------------- #
# Test endpoint
# ---------------------- #
@router.get("/test")
async def test_endpoint():
    """Test endpoint to verify router is working"""
    return {"status": "ok", "message": "Articulation reports router is working"}


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
# AJAX LIST (Common endpoint for all articulation report types)
# ---------------------- #
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
    Get articulation reports data for DataTables
    Common endpoint for all types: Failed, Phase_2, Processed, Rerun
    Matches CI3 Articulationreports::ajaxlist() -> Articulation_model::getreportsdata()
    """
    print("=" * 80)
    print("[ArticulationReports Controller] ====== ajaxlist called ======")
    print(f"[ArticulationReports Controller] Search_Field: {request.Search_Field}")
    print(f"[ArticulationReports Controller] draw: {request.draw}, start: {request.start}, length: {request.length}")
    print("=" * 80)
    
    try:
        # Convert request to dict format expected by model
        request_data = {
            "draw": request.draw,
            "start": request.start,
            "length": request.length,
            "search": request.search,
            "order": request.order,
            "columns": request.columns,
            "Search_Field": request.Search_Field,
            "fieldType": request.fieldType,
            "fieldName": request.fieldName,
            "fromDate": request.fromDate,
            "toDate": request.toDate,
            "STUDENT_ID": request.STUDENT_ID,
            "BATCH_ID": request.BATCH_ID,
        }

        print(f"[ArticulationReports Controller] Request data prepared: Search_Field={request_data.get('Search_Field')}")

        # Check if user has update permission (temporarily defaulting to False)
        has_update_permission = False
        # TODO: Re-enable when authentication is restored
        # has_update_permission = current_user and hasattr(current_user, 'permissions') and ...

        print("[ArticulationReports Controller] Calling model.get_reports_data()...")
        # Get data from model
        result = ArticulationReportsModel.get_reports_data(
            db=db,
            request_data=request_data,
            has_update_permission=has_update_permission,
        )

        print(f"[ArticulationReports Controller] Model returned - recordsTotal: {result.get('recordsTotal')}, data rows: {len(result.get('data', []))}")
        print("[ArticulationReports Controller] ====== ajaxlist completed ======")
        print("=" * 80)
        
        return result

    except Exception as e:
        print(f"[ArticulationReports Controller] ERROR: {str(e)}")
        import traceback
        print(traceback.format_exc())
        logger.exception("Articulation ajaxlist error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

