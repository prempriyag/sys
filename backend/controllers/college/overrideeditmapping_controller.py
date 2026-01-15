"""Override Edit Mapping Controller"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
import logging
from datetime import datetime
from database.connection import get_db
from models.override_edit_mapping_model import OverrideEditMappingModel
from config.constants import TBL_OVERRRIDE

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/overrideeditmapping", tags=["overrideeditmapping"])

class DataTableRequest(BaseModel):
    draw: int
    start: int
    length: int
    search: dict
    order: list
    columns: list

class OverrideRequest(BaseModel):
    INSTITUTION_ID: str
    TERM: str
    SUBJECT: str
    COURSE: str
    EQV_SUBJECT: str
    EQV_COURSE: str
    COURSE_ATTRIBUTE: str = None

class OverrideUpdateRequest(BaseModel):
    Id: int
    INSTITUTION_ID: str
    TERM: str
    SUBJECT: str
    COURSE: str
    EQV_SUBJECT: str
    EQV_COURSE: str
    COURSE_ATTRIBUTE: str = None

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
        result = OverrideEditMappingModel.get_override_edit_mapping_data(db=db, request_data=request_data)
        return result
    except Exception as e:
        logger.exception("Override edit mapping ajaxlist error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/insert", response_model=dict)
async def insert(request: OverrideRequest, db: Session = Depends(get_db)):
    try:
        if not request.INSTITUTION_ID or not request.TERM or not request.SUBJECT or not request.COURSE:
            return {"status": 0, "message": "Please fill all required fields", "refresh": False, "modal_close": False}
        insert_query = text(f"""
            INSERT INTO {TBL_OVERRRIDE} (INSTITUTION_ID, TERM, SUBJECT, COURSE, EQV_SUBJECT, EQV_COURSE, COURSE_ATTRIBUTE, UPDATED_BY, UPDATED_ON)
            VALUES (:institution_id, :term, :subject, :course, :eqv_subject, :eqv_course, :course_attribute, :updated_by, :updated_on)
        """)
        db.execute(insert_query, {
            "institution_id": request.INSTITUTION_ID.lower() if request.INSTITUTION_ID and request.INSTITUTION_ID.lower() != "null" else None,
            "term": request.TERM.lower() if request.TERM and request.TERM.lower() != "null" else None,
            "subject": request.SUBJECT.lower() if request.SUBJECT and request.SUBJECT.lower() != "null" else None,
            "course": request.COURSE.lower() if request.COURSE and request.COURSE.lower() != "null" else None,
            "eqv_subject": request.EQV_SUBJECT.lower() if request.EQV_SUBJECT and request.EQV_SUBJECT.lower() != "null" else None,
            "eqv_course": request.EQV_COURSE.lower() if request.EQV_COURSE and request.EQV_COURSE.lower() != "null" else None,
            "course_attribute": request.COURSE_ATTRIBUTE.lower() if request.COURSE_ATTRIBUTE and request.COURSE_ATTRIBUTE.lower() != "null" else None,
            "updated_by": "System",
            "updated_on": datetime.now().strftime('%Y-%m-%d %H:%M:%S.000')
        })
        db.commit()
        return {"status": 1, "message": "Successfully added", "refresh": False, "modal_close": True}
    except Exception as e:
        logger.exception("Override edit mapping insert error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/get", response_model=dict)
async def get_override(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        query = text(f"SELECT * FROM {TBL_OVERRRIDE} WHERE Id = :id")
        result = db.execute(query, {"id": request.id}).fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="Override not found")
        return dict(result._mapping)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Override edit mapping get error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/update", response_model=dict)
async def update(request: OverrideUpdateRequest, db: Session = Depends(get_db)):
    try:
        if not request.INSTITUTION_ID or not request.TERM or not request.SUBJECT or not request.COURSE:
            return {"status": 0, "message": "Please fill all required fields", "refresh": False, "modal_close": False}
        update_query = text(f"""
            UPDATE {TBL_OVERRRIDE}
            SET INSTITUTION_ID = :institution_id, TERM = :term, SUBJECT = :subject, COURSE = :course,
                EQV_SUBJECT = :eqv_subject, EQV_COURSE = :eqv_course, COURSE_ATTRIBUTE = :course_attribute,
                UPDATED_BY = :updated_by, UPDATED_ON = :updated_on
            WHERE Id = :id
        """)
        result = db.execute(update_query, {
            "id": request.Id,
            "institution_id": request.INSTITUTION_ID.lower() if request.INSTITUTION_ID and request.INSTITUTION_ID.lower() != "null" else None,
            "term": request.TERM.lower() if request.TERM and request.TERM.lower() != "null" else None,
            "subject": request.SUBJECT.lower() if request.SUBJECT and request.SUBJECT.lower() != "null" else None,
            "course": request.COURSE.lower() if request.COURSE and request.COURSE.lower() != "null" else None,
            "eqv_subject": request.EQV_SUBJECT.lower() if request.EQV_SUBJECT and request.EQV_SUBJECT.lower() != "null" else None,
            "eqv_course": request.EQV_COURSE.lower() if request.EQV_COURSE and request.EQV_COURSE.lower() != "null" else None,
            "course_attribute": request.COURSE_ATTRIBUTE.lower() if request.COURSE_ATTRIBUTE and request.COURSE_ATTRIBUTE.lower() != "null" else None,
            "updated_by": "System",
            "updated_on": datetime.now().strftime('%Y-%m-%d %H:%M:%S.000')
        })
        db.commit()
        return {"status": 1, "message": "Successfully updated.", "refresh": False, "modal_close": True} if result.rowcount > 0 else {"status": 0, "message": "Sorry record not updated please try again.", "refresh": False, "modal_close": True}
    except Exception as e:
        logger.exception("Override edit mapping update error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/delete", response_model=dict)
async def delete(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        delete_query = text(f"DELETE FROM {TBL_OVERRRIDE} WHERE Id = :id")
        result = db.execute(delete_query, {"id": request.id})
        db.commit()
        return {"status": "Success"} if result.rowcount > 0 else {"status": "Error"}
    except Exception as e:
        logger.exception("Override edit mapping delete error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")



