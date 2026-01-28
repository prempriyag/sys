"""GPA Scale Mapping Controller"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
import logging
from datetime import datetime
from database.connection import get_db
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
    GPA_SCALE: str

class GpaScaleUpdateRequest(BaseModel):
    Id: int
    GPA_SCALE: str

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
async def insert(request: GpaScaleRequest, db: Session = Depends(get_db)):
    try:
        if not request.GPA_SCALE or not request.GPA_SCALE.strip():
            return {"status": 0, "message": "Please Enter GPA Scale", "refresh": False, "modal_close": False}
        insert_query = text(f"""
            INSERT INTO {TBL_GPA_SCALE_MAPPING} (GPA_SCALE, UPDATED_BY, LAST_UPDATED_DATETIME)
            VALUES (:gpa_scale, :updated_by, :last_updated_datetime)
        """)
        db.execute(insert_query, {
            "gpa_scale": request.GPA_SCALE.strip(),
            "updated_by": "System",
            "last_updated_datetime": datetime.now().strftime('%Y-%m-%d %H:%M:%S.000')
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
        query = text(f"SELECT ID, GPA_SCALE FROM {TBL_GPA_SCALE_MAPPING} WHERE ID = :id")
        result = db.execute(query, {"id": request.id}).fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="GPA Scale not found")
        return {"Id": result.ID if hasattr(result, 'ID') else result[0], "GPA_SCALE": result.GPA_SCALE if hasattr(result, 'GPA_SCALE') else result[1]}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("GPA Scale mapping get error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/update", response_model=dict)
async def update(request: GpaScaleUpdateRequest, db: Session = Depends(get_db)):
    try:
        if not request.GPA_SCALE or not request.GPA_SCALE.strip():
            return {"status": 0, "message": "Please Enter GPA Scale", "refresh": False, "modal_close": False}
        update_query = text(f"""
            UPDATE {TBL_GPA_SCALE_MAPPING}
            SET GPA_SCALE = :gpa_scale,
                UPDATED_BY = :updated_by, LAST_UPDATED_DATETIME = :last_updated_datetime
            WHERE ID = :id
        """)
        result = db.execute(update_query, {
            "id": request.Id,
            "gpa_scale": request.GPA_SCALE.strip(),
            "updated_by": "System",
            "last_updated_datetime": datetime.now().strftime('%Y-%m-%d %H:%M:%S.000')
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

