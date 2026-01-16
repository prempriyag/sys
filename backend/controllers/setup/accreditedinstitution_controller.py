"""Accredited Institution Controller"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
import logging
from datetime import datetime
from database.connection import get_db
from models.accredited_institution_model import AccreditedInstitutionModel
from config.constants import TBL_ACCREDITED_INSTITUTION

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/accreditedinstitution", tags=["accreditedinstitution"])

class DataTableRequest(BaseModel):
    draw: int
    start: int
    length: int
    search: dict
    order: list
    columns: list

class AccreditedInstitutionRequest(BaseModel):
    INSTITUTION_ID: str
    EFFECTIVE_START_TERM: str
    EFFECTIVE_END_TERM: str

class AccreditedInstitutionUpdateRequest(BaseModel):
    Id: int
    INSTITUTION_ID: str
    EFFECTIVE_START_TERM: str
    EFFECTIVE_END_TERM: str

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
        result = AccreditedInstitutionModel.get_accredited_institution_data(db=db, request_data=request_data)
        return result
    except Exception as e:
        logger.exception("Accredited institution ajaxlist error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/insert", response_model=dict)
async def insert(request: AccreditedInstitutionRequest, db: Session = Depends(get_db)):
    try:
        if not request.INSTITUTION_ID or not request.EFFECTIVE_START_TERM or not request.EFFECTIVE_END_TERM:
            return {"status": 0, "message": "Please fill all required fields", "refresh": False, "modal_close": False}
        insert_query = text(f"""
            INSERT INTO {TBL_ACCREDITED_INSTITUTION} (INSTITUTION_ID, EFFECTIVE_START_TERM, EFFECTIVE_END_TERM, UPDATED_BY, UPDATED_ON)
            VALUES (:institution_id, :effective_start_term, :effective_end_term, :updated_by, :updated_on)
        """)
        db.execute(insert_query, {
            "institution_id": request.INSTITUTION_ID,
            "effective_start_term": request.EFFECTIVE_START_TERM.lower() if request.EFFECTIVE_START_TERM and request.EFFECTIVE_START_TERM.lower() != "null" else None,
            "effective_end_term": request.EFFECTIVE_END_TERM.lower() if request.EFFECTIVE_END_TERM and request.EFFECTIVE_END_TERM.lower() != "null" else None,
            "updated_by": "System",
            "updated_on": datetime.now().strftime('%Y-%m-%d %H:%M:%S.000')
        })
        db.commit()
        return {"status": 1, "message": "Successfully added", "refresh": False, "modal_close": True}
    except Exception as e:
        logger.exception("Accredited institution insert error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/get", response_model=dict)
async def get_accredited(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        query = text(f"SELECT * FROM {TBL_ACCREDITED_INSTITUTION} WHERE Id = :id")
        result = db.execute(query, {"id": request.id}).fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="Accredited institution not found")
        return dict(result._mapping)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Accredited institution get error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/update", response_model=dict)
async def update(request: AccreditedInstitutionUpdateRequest, db: Session = Depends(get_db)):
    try:
        if not request.INSTITUTION_ID or not request.EFFECTIVE_START_TERM or not request.EFFECTIVE_END_TERM:
            return {"status": 0, "message": "Please fill all required fields", "refresh": False, "modal_close": False}
        update_query = text(f"""
            UPDATE {TBL_ACCREDITED_INSTITUTION}
            SET INSTITUTION_ID = :institution_id, EFFECTIVE_START_TERM = :effective_start_term,
                EFFECTIVE_END_TERM = :effective_end_term, UPDATED_BY = :updated_by, UPDATED_ON = :updated_on
            WHERE Id = :id
        """)
        result = db.execute(update_query, {
            "id": request.Id,
            "institution_id": request.INSTITUTION_ID,
            "effective_start_term": request.EFFECTIVE_START_TERM.lower() if request.EFFECTIVE_START_TERM and request.EFFECTIVE_START_TERM.lower() != "null" else None,
            "effective_end_term": request.EFFECTIVE_END_TERM.lower() if request.EFFECTIVE_END_TERM and request.EFFECTIVE_END_TERM.lower() != "null" else None,
            "updated_by": "System",
            "updated_on": datetime.now().strftime('%Y-%m-%d %H:%M:%S.000')
        })
        db.commit()
        return {"status": 1, "message": "Successfully Updated", "refresh": False, "modal_close": True} if result.rowcount > 0 else {"status": 0, "message": "Sorry record not updated please try again.", "refresh": False, "modal_close": True}
    except Exception as e:
        logger.exception("Accredited institution update error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/delete", response_model=dict)
async def delete(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        delete_query = text(f"DELETE FROM {TBL_ACCREDITED_INSTITUTION} WHERE Id = :id")
        result = db.execute(delete_query, {"id": request.id})
        db.commit()
        return {"status": "Success"} if result.rowcount > 0 else {"status": "Error"}
    except Exception as e:
        logger.exception("Accredited institution delete error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")



