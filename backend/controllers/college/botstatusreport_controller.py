"""Bot Status Report Controller"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import logging
from database.connection import get_db
from models.bot_status_report_model import BotStatusReportModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/botstatusreport", tags=["botstatusreport"])

class DataTableRequest(BaseModel):
    draw: int
    start: int
    length: int
    search: dict
    order: list
    columns: list
    bot_process_name: str = ""
    no_of_days: int = 7

@router.post("/ajaxlist", response_model=dict)
async def ajaxlist(request: DataTableRequest, db: Session = Depends(get_db)):
    try:
        request_data = {
            "draw": request.draw,
            "start": request.start,
            "length": request.length,
            "search": request.search,
            "order": request.order,
            "columns": request.columns,
            "bot_process_name": request.bot_process_name,
            "no_of_days": request.no_of_days,
        }
        result = BotStatusReportModel.get_bot_status_report_data(db=db, request_data=request_data)
        return result
    except Exception as e:
        logger.exception("Bot status report ajaxlist error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

