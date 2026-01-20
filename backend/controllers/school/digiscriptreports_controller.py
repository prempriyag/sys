"""
DigiScript Reports Controller - College Module
FastAPI version of CI3 Digiscriptreports controller
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
import logging

from database.connection import get_db
from helpers.permission_dependency import require_permission
from models import User
from models.digiscript_reports_model import DigiScriptReportsModel

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/school/digiscriptreports",
    tags=["digiscriptreports"],
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
    STUDENT_ID: Optional[str] = None
    STUDENT_FULL_NAME: Optional[str] = None
    fromDate: Optional[str] = None
    toDate: Optional[str] = None


# ---------------------- #
# AJAX LIST
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
    Get DigiScript reports data for DataTables
    Matches CI3 Digiscriptreports::ajaxlist() -> Digiscript_model::getreportsdata()
    """
    try:
        # Convert request to dict format expected by model
        request_data = {
            "draw": request.draw,
            "start": request.start,
            "length": request.length,
            "search": request.search,
            "order": request.order,
            "columns": request.columns,
            "STUDENT_ID": request.STUDENT_ID,
            "STUDENT_FULL_NAME": request.STUDENT_FULL_NAME,
            "from_date": request.fromDate,
            "to_date": request.toDate,
        }

        # Check if user has update permission (temporarily defaulting to False)
        has_update_permission = False
        # TODO: Re-enable when authentication is restored
        # has_update_permission = current_user and hasattr(current_user, 'permissions') and ...

        # Get data from model
        result = DigiScriptReportsModel.get_reports_data(
            db=db,
            request_data=request_data,
            has_update_permission=has_update_permission,
        )

        return result

    except Exception as e:
        logger.exception("DigiScript reports ajaxlist error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")



