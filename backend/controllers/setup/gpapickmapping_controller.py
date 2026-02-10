"""GPA Pick Mapping Controller"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional
import logging
from datetime import datetime
from database.connection import get_db
from helpers.security_helper import get_username_from_token
from models.gpa_pick_mapping_model import GpaPickMappingModel
from config.constants import TBL_GPA_PICK_MAPPING

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/gpapickmapping", tags=["gpapickmapping"])

class DataTableRequest(BaseModel):
    draw: int
    start: int
    length: int
    search: dict
    order: list
    columns: list

class GpaPickRequest(BaseModel):
    GPA_SCALE: Optional[str] = ""
    WEIGHTED_GPA: Optional[str] = ""
    UNWEIGHTED_GPA: Optional[str] = ""
    CGPA: Optional[str] = ""
    PREFERRED_GPA: Optional[str] = ""

class GpaPickUpdateRequest(BaseModel):
    Id: int
    GPA_SCALE: Optional[str] = ""
    WEIGHTED_GPA: Optional[str] = ""
    UNWEIGHTED_GPA: Optional[str] = ""
    CGPA: Optional[str] = ""
    PREFERRED_GPA: Optional[str] = ""

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
        result = GpaPickMappingModel.get_gpa_pick_mapping_data(db=db, request_data=request_data)
        return result
    except Exception as e:
        logger.exception("GPA Pick mapping ajaxlist error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/insert", response_model=dict)
async def insert(request: GpaPickRequest, http_request: Request, db: Session = Depends(get_db)):
    try:
        insert_query = text(f"""
            INSERT INTO {TBL_GPA_PICK_MAPPING} (GPA_SCALE, WEIGHTED_GPA, UNWEIGHTED_GPA, CGPA, PREFERRED_GPA, CREATED_BY, CREATED_DATE)
            VALUES (:gpa_scale, :weighted_gpa, :unweighted_gpa, :cgpa, :preferred_gpa, :created_by, :created_date)
        """)
        db.execute(insert_query, {
            "gpa_scale": request.GPA_SCALE.strip() if request.GPA_SCALE else "",
            "weighted_gpa": request.WEIGHTED_GPA.strip() if request.WEIGHTED_GPA else "",
            "unweighted_gpa": request.UNWEIGHTED_GPA.strip() if request.UNWEIGHTED_GPA else "",
            "cgpa": request.CGPA.strip() if request.CGPA else "",
            "preferred_gpa": request.PREFERRED_GPA.strip() if request.PREFERRED_GPA else "",
            "created_by": get_username_from_token(http_request),
            "created_date": datetime.now().strftime('%Y-%m-%d %H:%M:%S.000')
        })
        db.commit()
        return {"status": 1, "message": "Successfully added", "refresh": False, "modal_close": True}
    except Exception as e:
        logger.exception("GPA Pick mapping insert error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/get", response_model=dict)
async def get_gpa_pick(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        query = text(f"SELECT id, GPA_SCALE, WEIGHTED_GPA, UNWEIGHTED_GPA, CGPA, PREFERRED_GPA FROM {TBL_GPA_PICK_MAPPING} WHERE id = :id")
        result = db.execute(query, {"id": request.id}).fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="GPA Pick Mapping not found")
        record = dict(result._mapping)
        return {
            "Id": record.get("id") or record.get("Id") or record.get("ID"),
            "GPA_SCALE": record.get("GPA_SCALE", ""),
            "WEIGHTED_GPA": record.get("WEIGHTED_GPA", ""),
            "UNWEIGHTED_GPA": record.get("UNWEIGHTED_GPA", ""),
            "CGPA": record.get("CGPA", ""),
            "PREFERRED_GPA": record.get("PREFERRED_GPA", ""),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("GPA Pick mapping get error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/update", response_model=dict)
async def update(request: GpaPickUpdateRequest, http_request: Request, db: Session = Depends(get_db)):
    try:
        update_query = text(f"""
            UPDATE {TBL_GPA_PICK_MAPPING}
            SET GPA_SCALE = :gpa_scale,
                WEIGHTED_GPA = :weighted_gpa,
                UNWEIGHTED_GPA = :unweighted_gpa,
                CGPA = :cgpa,
                PREFERRED_GPA = :preferred_gpa,
                CREATED_BY = :created_by,
                CREATED_DATE = :created_date
            WHERE id = :id
        """)
        result = db.execute(update_query, {
            "id": request.Id,
            "gpa_scale": request.GPA_SCALE.strip() if request.GPA_SCALE else "",
            "weighted_gpa": request.WEIGHTED_GPA.strip() if request.WEIGHTED_GPA else "",
            "unweighted_gpa": request.UNWEIGHTED_GPA.strip() if request.UNWEIGHTED_GPA else "",
            "cgpa": request.CGPA.strip() if request.CGPA else "",
            "preferred_gpa": request.PREFERRED_GPA.strip() if request.PREFERRED_GPA else "",
            "created_by": get_username_from_token(http_request),
            "created_date": datetime.now().strftime('%Y-%m-%d %H:%M:%S.000')
        })
        db.commit()
        return {"status": 1, "message": "Successfully updated.", "refresh": False, "modal_close": True} if result.rowcount > 0 else {"status": 0, "message": "Sorry record not updated please try again.", "refresh": False, "modal_close": True}
    except Exception as e:
        logger.exception("GPA Pick mapping update error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/delete", response_model=dict)
async def delete(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        delete_query = text(f"DELETE FROM {TBL_GPA_PICK_MAPPING} WHERE Id = :id")
        result = db.execute(delete_query, {"id": request.id})
        db.commit()
        return {"status": "Success"} if result.rowcount > 0 else {"status": "Error"}
    except Exception as e:
        logger.exception("GPA Pick mapping delete error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
