"""
DigiScript Bot Log Controller - College Module
FastAPI version of CI3 Digiscriptbotlog controller
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
import logging

from database.connection import get_db
from helpers.permission_dependency import require_permission
from models import User
from models.digiscript_bot_log_model import DigiScriptBotLogModel

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/school/digiscriptbotlog",
    tags=["digiscriptbotlog"],
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
    #     require_permission("transcript_log", "VIEW")
    # ),
    db: Session = Depends(get_db),
):
    """
    Get DigiScript Bot Log data for DataTables
    Matches CI3 Digiscriptbotlog::ajaxlist() -> Digiscriptlog_model::getdigiscriptbotlogdata()
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

        result = DigiScriptBotLogModel.get_reports_data(
            db=db,
            request_data=request_data,
            has_update_permission=has_update_permission,
        )

        return result

    except Exception as e:
        logger.exception("DigiScript Bot Log ajaxlist error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")



