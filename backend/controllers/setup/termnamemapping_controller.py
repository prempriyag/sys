"""Term Name Mapping Controller"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
import logging
from datetime import datetime
from database.connection import get_db
from helpers.security_helper import get_username_from_token
from models.term_name_mapping_model import TermNameMappingModel
from config.constants import TBL_TERM_NAMEMAPPING

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/termnamemapping", tags=["termnamemapping"])

class DataTableRequest(BaseModel):
    draw: int
    start: int
    length: int
    search: dict
    order: list
    columns: list

class TermNameRequest(BaseModel):
    OCR_TERM_NAME: str
    TERM_NAME: str

class TermNameUpdateRequest(BaseModel):
    Id: int
    OCR_TERM_NAME: str
    TERM_NAME: str

class DeleteRequest(BaseModel):
    id: int

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
        result = TermNameMappingModel.get_term_name_mapping_data(db=db, request_data=request_data)
        return result
    except Exception as e:
        logger.exception("Term name mapping ajaxlist error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/insert", response_model=dict)
async def insert(request: TermNameRequest, http_request: Request, db: Session = Depends(get_db)):
    try:
        if not request.OCR_TERM_NAME or not request.TERM_NAME:
            return {"status": 0, "message": "Please Enter OCR Term Name and Term Name", "refresh": False, "modal_close": False}
        check_query = text(f"SELECT COUNT(*) as count FROM {TBL_TERM_NAMEMAPPING} WHERE lower(OCR_TERM_NAME) = lower(:ocr_term_name) AND lower(TERM_NAME) = lower(:term_name)")
        check_result = db.execute(check_query, {"ocr_term_name": request.OCR_TERM_NAME, "term_name": request.TERM_NAME}).fetchone()
        if check_result and (check_result.count if hasattr(check_result, 'count') else check_result[0]) > 0:
            return {"status": 0, "message": "Duplicate Data found.", "refresh": False, "modal_close": True}
        insert_query = text(f"INSERT INTO {TBL_TERM_NAMEMAPPING} (OCR_TERM_NAME, TERM_NAME, Updated_by, Updated_on) VALUES (:ocr_term_name, :term_name, :updated_by, :updated_on)")
        db.execute(insert_query, {"ocr_term_name": request.OCR_TERM_NAME, "term_name": request.TERM_NAME, "updated_by": get_username_from_token(http_request), "updated_on": datetime.now().strftime('%Y-%m-%d %H:%M:%S.000')})
        db.commit()
        return {"status": 1, "message": "Successfully added.", "refresh": False, "modal_close": True}
    except Exception as e:
        logger.exception("Term name mapping insert error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/get", response_model=dict)
async def get_termname(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        query = text(f"SELECT * FROM {TBL_TERM_NAMEMAPPING} WHERE Id = :id")
        result = db.execute(query, {"id": request.id}).fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="Term name not found")
        return dict(result._mapping)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Term name mapping get error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/update", response_model=dict)
async def update(request: TermNameUpdateRequest, http_request: Request, db: Session = Depends(get_db)):
    try:
        if not request.OCR_TERM_NAME or not request.TERM_NAME:
            return {"status": 0, "message": "Please Enter OCR Term Name and Term Name", "refresh": False, "modal_close": False}
        check_query = text(f"SELECT COUNT(*) as count FROM {TBL_TERM_NAMEMAPPING} WHERE lower(OCR_TERM_NAME) = lower(:ocr_term_name) AND lower(TERM_NAME) = lower(:term_name) AND Id <> :id")
        check_result = db.execute(check_query, {"ocr_term_name": request.OCR_TERM_NAME, "term_name": request.TERM_NAME, "id": request.Id}).fetchone()
        if check_result and (check_result.count if hasattr(check_result, 'count') else check_result[0]) > 0:
            return {"status": 0, "message": "Duplicate Data found.", "refresh": False, "modal_close": True}
        update_query = text(f"UPDATE {TBL_TERM_NAMEMAPPING} SET OCR_TERM_NAME = :ocr_term_name, TERM_NAME = :term_name, Updated_by = :updated_by, Updated_on = :updated_on WHERE Id = :id")
        result = db.execute(update_query, {"id": request.Id, "ocr_term_name": request.OCR_TERM_NAME, "term_name": request.TERM_NAME, "updated_by": get_username_from_token(http_request), "updated_on": datetime.now().strftime('%Y-%m-%d %H:%M:%S.000')})
        db.commit()
        return {"status": 1, "message": "Successfully updated.", "refresh": False, "modal_close": True} if result.rowcount > 0 else {"status": 0, "message": "Sorry record not updated please try again.", "refresh": False, "modal_close": True}
    except Exception as e:
        logger.exception("Term name mapping update error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/delete", response_model=dict)
async def delete(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        delete_query = text(f"DELETE FROM {TBL_TERM_NAMEMAPPING} WHERE Id = :id")
        result = db.execute(delete_query, {"id": request.id})
        db.commit()
        return {"status": "Success"} if result.rowcount > 0 else {"status": "Error"}
    except Exception as e:
        logger.exception("Term name mapping delete error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")



