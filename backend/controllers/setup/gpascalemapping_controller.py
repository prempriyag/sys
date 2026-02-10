"""GPA Scale Mapping Controller"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
import logging
from datetime import datetime
from database.connection import get_db
from helpers.security_helper import get_username_from_token
from models.gpa_scale_mapping_model import GpaScaleMappingModel
from config.constants import TBL_GPA_SCALE_MAPPING

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/gpascalemapping", tags=["gpascalemapping"])

class DataTableRequest(BaseModel):
    draw: int
    start: int
    length: int
    search: dict
    order: list
    columns: list

class GpaScaleRequest(BaseModel):
    PERCENTAGE: str
    GPA: str

class GpaScaleUpdateRequest(BaseModel):
    Id: int
    PERCENTAGE: str
    GPA: str

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
        result = GpaScaleMappingModel.get_gpa_scale_mapping_data(db=db, request_data=request_data)
        return result
    except Exception as e:
        logger.exception("GPA Scale mapping ajaxlist error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/insert", response_model=dict)
async def insert(request: GpaScaleRequest, http_request: Request, db: Session = Depends(get_db)):
    try:
        if not request.PERCENTAGE or not request.PERCENTAGE.strip():
            return {"status": 0, "message": "Please Enter Percentage", "refresh": False, "modal_close": False}
        if not request.GPA or not request.GPA.strip():
            return {"status": 0, "message": "Please Enter GPA", "refresh": False, "modal_close": False}
        insert_query = text(f"""
            INSERT INTO {TBL_GPA_SCALE_MAPPING} (PERCENTAGE, GPA, UPDATED_BY, UPDATED_DATE)
            VALUES (:percentage, :gpa, :updated_by, :updated_date)
        """)
        db.execute(insert_query, {
            "percentage": request.PERCENTAGE.strip(),
            "gpa": request.GPA.strip(),
            "updated_by": get_username_from_token(http_request),
            "updated_date": datetime.now().strftime('%Y-%m-%d %H:%M:%S.000')
        })
        db.commit()
        return {"status": 1, "message": "Successfully added", "refresh": False, "modal_close": True}
    except Exception as e:
        logger.exception("GPA Scale mapping insert error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/get", response_model=dict)
async def get_gpa_scale(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        query = text(f"SELECT Id, PERCENTAGE, GPA FROM {TBL_GPA_SCALE_MAPPING} WHERE Id = :id")
        result = db.execute(query, {"id": request.id}).fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="GPA Scale Mapping not found")
        record = dict(result._mapping)
        return {
            "Id": record.get("Id") or record.get("id") or record.get("ID"),
            "PERCENTAGE": record.get("PERCENTAGE", ""),
            "GPA": record.get("GPA", ""),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("GPA Scale mapping get error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/update", response_model=dict)
async def update(request: GpaScaleUpdateRequest, http_request: Request, db: Session = Depends(get_db)):
    try:
        if not request.PERCENTAGE or not request.PERCENTAGE.strip():
            return {"status": 0, "message": "Please Enter Percentage", "refresh": False, "modal_close": False}
        if not request.GPA or not request.GPA.strip():
            return {"status": 0, "message": "Please Enter GPA", "refresh": False, "modal_close": False}
        update_query = text(f"""
            UPDATE {TBL_GPA_SCALE_MAPPING}
            SET PERCENTAGE = :percentage,
                GPA = :gpa,
                UPDATED_BY = :updated_by,
                UPDATED_DATE = :updated_date
            WHERE Id = :id
        """)
        result = db.execute(update_query, {
            "id": request.Id,
            "percentage": request.PERCENTAGE.strip(),
            "gpa": request.GPA.strip(),
            "updated_by": get_username_from_token(http_request),
            "updated_date": datetime.now().strftime('%Y-%m-%d %H:%M:%S.000')
        })
        db.commit()
        return {"status": 1, "message": "Successfully updated.", "refresh": False, "modal_close": True} if result.rowcount > 0 else {"status": 0, "message": "Sorry record not updated please try again.", "refresh": False, "modal_close": True}
    except Exception as e:
        logger.exception("GPA Scale mapping update error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/delete", response_model=dict)
async def delete(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        delete_query = text(f"DELETE FROM {TBL_GPA_SCALE_MAPPING} WHERE Id = :id")
        result = db.execute(delete_query, {"id": request.id})
        db.commit()
        return {"status": "Success"} if result.rowcount > 0 else {"status": "Error"}
    except Exception as e:
        logger.exception("GPA Scale mapping delete error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
