"""Accepted Grades Mapping Controller"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
import logging
from datetime import datetime
from database.connection import get_db
from helpers.security_helper import get_username_from_token
from models.accepted_grades_mapping_model import AcceptedGradesMappingModel
from config.constants import TBL_ACCEPTED_GRADES_MAPPING

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/acceptedgrades", tags=["acceptedgrades"])

class DataTableRequest(BaseModel):
    draw: int
    start: int
    length: int
    search: dict
    order: list
    columns: list

class AcceptedGradeRequest(BaseModel):
    INSTITUTION_ID: str
    ACCEPTED_GRADE: str
    TRANSFER_GRADE: str

class AcceptedGradeUpdateRequest(BaseModel):
    Id: int
    INSTITUTION_ID: str
    ACCEPTED_GRADE: str
    TRANSFER_GRADE: str

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
        result = AcceptedGradesMappingModel.get_accepted_grades_mapping_data(db=db, request_data=request_data)
        return result
    except Exception as e:
        logger.exception("Accepted grades ajaxlist error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/insert", response_model=dict)
async def insert(request: AcceptedGradeRequest, http_request: Request, db: Session = Depends(get_db)):
    try:
        insert_query = text(f"""
            INSERT INTO {TBL_ACCEPTED_GRADES_MAPPING} (INSTITUTION_ID, ACCEPTED_GRADE, TRANSFER_GRADE, UPDATED_BY, UPDATED_ON)
            VALUES (:institution_id, :accepted_grade, :transfer_grade, :updated_by, :updated_on)
        """)
        db.execute(insert_query, {
            "institution_id": request.INSTITUTION_ID,
            "accepted_grade": request.ACCEPTED_GRADE.upper() if request.ACCEPTED_GRADE and request.ACCEPTED_GRADE.upper() != "NULL" else None,
            "transfer_grade": request.TRANSFER_GRADE.upper() if request.TRANSFER_GRADE and request.TRANSFER_GRADE.upper() != "NULL" else None,
            "updated_by": get_username_from_token(http_request),
            "updated_on": datetime.now().strftime('%Y-%m-%d %H:%M:%S.000')
        })
        db.commit()
        return {"status": 1, "message": "Successfully added", "refresh": False, "modal_close": True}
    except Exception as e:
        logger.exception("Accepted grades insert error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/get", response_model=dict)
async def get_grade(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        query = text(f"SELECT ID, INSTITUTION_ID, ACCEPTED_GRADE, TRANSFER_GRADE FROM {TBL_ACCEPTED_GRADES_MAPPING} WHERE ID = :id")
        result = db.execute(query, {"id": request.id}).fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="Accepted grade not found")
        return {"ID": result.ID, "INSTITUTION_ID": result.INSTITUTION_ID, "ACCEPTED_GRADE": result.ACCEPTED_GRADE, "TRANSFER_GRADE": result.TRANSFER_GRADE}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Accepted grades get error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/update", response_model=dict)
async def update(request: AcceptedGradeUpdateRequest, http_request: Request, db: Session = Depends(get_db)):
    try:
        update_query = text(f"""
            UPDATE {TBL_ACCEPTED_GRADES_MAPPING}
            SET INSTITUTION_ID = :institution_id, ACCEPTED_GRADE = :accepted_grade,
                TRANSFER_GRADE = :transfer_grade, UPDATED_BY = :updated_by, UPDATED_ON = :updated_on
            WHERE ID = :id
        """)
        result = db.execute(update_query, {
            "id": request.Id,
            "institution_id": request.INSTITUTION_ID,
            "accepted_grade": request.ACCEPTED_GRADE.upper() if request.ACCEPTED_GRADE and request.ACCEPTED_GRADE.upper() != "NULL" else None,
            "transfer_grade": request.TRANSFER_GRADE.upper() if request.TRANSFER_GRADE and request.TRANSFER_GRADE.upper() != "NULL" else None,
            "updated_by": get_username_from_token(http_request),
            "updated_on": datetime.now().strftime('%Y-%m-%d %H:%M:%S.000')
        })
        db.commit()
        return {"status": 1, "message": "Successfully updated.", "refresh": False, "modal_close": True} if result.rowcount > 0 else {"status": 0, "message": "Sorry record not updated please try again.", "refresh": False, "modal_close": True}
    except Exception as e:
        logger.exception("Accepted grades update error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/delete", response_model=dict)
async def delete(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        delete_query = text(f"DELETE FROM {TBL_ACCEPTED_GRADES_MAPPING} WHERE ID = :id")
        result = db.execute(delete_query, {"id": request.id})
        db.commit()
        return {"status": "Success"} if result.rowcount > 0 else {"status": "Error"}
    except Exception as e:
        logger.exception("Accepted grades delete error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")



