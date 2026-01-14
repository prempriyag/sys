"""Error Log Controller"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
import logging
from database.connection import get_db
from models.error_log_model import ErrorLogModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/errorlog", tags=["errorlog"])

class DataTableRequest(BaseModel):
    draw: int
    start: int
    length: int
    search: dict
    order: list
    columns: list

class UpdateStatusRequest(BaseModel):
    id: int
    status: str

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
        }
        result = ErrorLogModel.get_error_log_data(db=db, request_data=request_data)
        return result
    except Exception as e:
        logger.exception("Error log ajaxlist error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/updatestatus", response_model=dict)
async def update_status(request: UpdateStatusRequest, db: Session = Depends(get_db)):
    try:
        # Toggle status: Open/Unresolved -> Resolved, Resolved -> Unresolved
        if request.status in ['Open', 'Unresolved']:
            new_status = 'Resolved'
        else:
            new_status = 'Unresolved'
        
        update_query = text("UPDATE Error_Log SET STATUS = :status WHERE ID = :id")
        result = db.execute(update_query, {"status": new_status, "id": request.id})
        db.commit()
        
        if result.rowcount > 0:
            return {"status": 1, "message": "Successfully updated.", "refresh": True, "modal_close": True}
        else:
            return {"status": 0, "message": "Sorry record not updated please try again.", "refresh": True, "modal_close": True}
    except Exception as e:
        logger.exception("Error log update status error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

