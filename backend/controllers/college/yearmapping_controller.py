"""Year Mapping Controller"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
import logging
from database.connection import get_db
from models.year_mapping_model import YearMappingModel
from config.constants import TBL_YEAR_MAPPING

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/yearmapping", tags=["yearmapping"])

class DataTableRequest(BaseModel):
    draw: int
    start: int
    length: int
    search: dict
    order: list
    columns: list

class YearRequest(BaseModel):
    YEAR_CD: str

class YearUpdateRequest(BaseModel):
    YEAR_CD: str
    OLD_YEAR_CD: str

class DeleteRequest(BaseModel):
    id: str

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
        result = YearMappingModel.get_year_mapping_data(db=db, request_data=request_data)
        return result
    except Exception as e:
        logger.exception("Year mapping ajaxlist error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/insert", response_model=dict)
async def insert(request: YearRequest, db: Session = Depends(get_db)):
    try:
        if not request.YEAR_CD:
            return {"status": 0, "message": "Please Enter Year Code", "refresh": False, "modal_close": False}
        check_query = text(f"SELECT COUNT(*) as count FROM {TBL_YEAR_MAPPING} WHERE YEAR_CD = :year_cd")
        check_result = db.execute(check_query, {"year_cd": request.YEAR_CD}).fetchone()
        if check_result and (check_result.count if hasattr(check_result, 'count') else check_result[0]) > 0:
            return {"status": 0, "message": "Duplicate Data found.", "refresh": False, "modal_close": True}
        insert_query = text(f"INSERT INTO {TBL_YEAR_MAPPING} (YEAR_CD) VALUES (:year_cd)")
        db.execute(insert_query, {"year_cd": request.YEAR_CD})
        db.commit()
        return {"status": 1, "message": "Successfully added.", "refresh": False, "modal_close": True}
    except Exception as e:
        logger.exception("Year mapping insert error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/get", response_model=dict)
async def get_year(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        query = text(f"SELECT YEAR_CD FROM {TBL_YEAR_MAPPING} WHERE YEAR_CD = :id")
        result = db.execute(query, {"id": request.id}).fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="Year not found")
        return {"YEAR_CD": result.YEAR_CD}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Year mapping get error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/update", response_model=dict)
async def update(request: YearUpdateRequest, db: Session = Depends(get_db)):
    try:
        if not request.YEAR_CD:
            return {"status": 0, "message": "Please Enter Year Code", "refresh": False, "modal_close": False}
        check_query = text(f"SELECT COUNT(*) as count FROM {TBL_YEAR_MAPPING} WHERE YEAR_CD = :year_cd AND YEAR_CD <> :old_year_cd")
        check_result = db.execute(check_query, {"year_cd": request.YEAR_CD, "old_year_cd": request.OLD_YEAR_CD}).fetchone()
        if check_result and (check_result.count if hasattr(check_result, 'count') else check_result[0]) > 0:
            return {"status": 0, "message": "Duplicate Data found.", "refresh": False, "modal_close": True}
        update_query = text(f"UPDATE {TBL_YEAR_MAPPING} SET YEAR_CD = :year_cd WHERE YEAR_CD = :old_year_cd")
        result = db.execute(update_query, {"year_cd": request.YEAR_CD, "old_year_cd": request.OLD_YEAR_CD})
        db.commit()
        return {"status": 1, "message": "Successfully updated.", "refresh": False, "modal_close": True} if result.rowcount > 0 else {"status": 0, "message": "Sorry record not updated please try again.", "refresh": False, "modal_close": True}
    except Exception as e:
        logger.exception("Year mapping update error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/delete", response_model=dict)
async def delete(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        delete_query = text(f"DELETE FROM {TBL_YEAR_MAPPING} WHERE YEAR_CD = :id")
        result = db.execute(delete_query, {"id": request.id})
        db.commit()
        return {"status": "Success"} if result.rowcount > 0 else {"status": "Error"}
    except Exception as e:
        logger.exception("Year mapping delete error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")



