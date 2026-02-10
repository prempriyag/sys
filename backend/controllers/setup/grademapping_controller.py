"""Grade Mapping Controller - Equivalent Grades"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
import logging
from datetime import datetime
from database.connection import get_db
from helpers.security_helper import get_username_from_token
from models.grade_mapping_model import GradeMappingModel
from config.constants import TBL_GRADE

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/grademapping", tags=["grademapping"])

class DataTableRequest(BaseModel):
    draw: int
    start: int
    length: int
    search: dict
    order: list
    columns: list

class GradeRequest(BaseModel):
    GRADE: str
    GRADE_TO_CONSIDER: str

class GradeUpdateRequest(BaseModel):
    Id: int
    GRADE: str
    GRADE_TO_CONSIDER: str

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
        result = GradeMappingModel.get_grade_mapping_data(db=db, request_data=request_data)
        return result
    except Exception as e:
        logger.exception("Grade mapping ajaxlist error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/insert", response_model=dict)
async def insert(request: GradeRequest, http_request: Request, db: Session = Depends(get_db)):
    try:
        if not request.GRADE or not request.GRADE_TO_CONSIDER:
            return {"status": 0, "message": "Please Enter Grade and Grade To Consider", "refresh": False, "modal_close": False}
        insert_query = text(f"""
            INSERT INTO {TBL_GRADE} (EQUIVALENT_GRADE, TRANSCRIPT_GRADE, UPDATED_BY, UPDATED_ON)
            VALUES (:equivalent_grade, :transcript_grade, :updated_by, :updated_on)
        """)
        db.execute(insert_query, {
            "equivalent_grade": request.GRADE.upper() if request.GRADE.upper() != "NULL" else None,
            "transcript_grade": request.GRADE_TO_CONSIDER.upper() if request.GRADE_TO_CONSIDER.upper() != "NULL" else None,
            "updated_by": get_username_from_token(http_request),
            "updated_on": datetime.now().strftime('%Y-%m-%d %H:%M:%S.000')
        })
        db.commit()
        return {"status": 1, "message": "Successfully added", "refresh": False, "modal_close": True}
    except Exception as e:
        logger.exception("Grade mapping insert error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/get", response_model=dict)
async def get_grade(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        query = text(f"SELECT ID, EQUIVALENT_GRADE, TRANSCRIPT_GRADE FROM {TBL_GRADE} WHERE ID = :id")
        result = db.execute(query, {"id": request.id}).fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="Grade not found")
        return {"ID": result.ID, "EQUIVALENT_GRADE": result.EQUIVALENT_GRADE, "TRANSCRIPT_GRADE": result.TRANSCRIPT_GRADE}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Grade mapping get error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/update", response_model=dict)
async def update(request: GradeUpdateRequest, http_request: Request, db: Session = Depends(get_db)):
    try:
        if not request.GRADE or not request.GRADE_TO_CONSIDER:
            return {"status": 0, "message": "Please Enter Grade and Grade To Consider", "refresh": False, "modal_close": False}
        update_query = text(f"""
            UPDATE {TBL_GRADE}
            SET EQUIVALENT_GRADE = :equivalent_grade, TRANSCRIPT_GRADE = :transcript_grade,
                UPDATED_BY = :updated_by, UPDATED_ON = :updated_on
            WHERE ID = :id
        """)
        result = db.execute(update_query, {
            "id": request.Id,
            "equivalent_grade": request.GRADE.upper() if request.GRADE.upper() != "NULL" else None,
            "transcript_grade": request.GRADE_TO_CONSIDER.upper() if request.GRADE_TO_CONSIDER.upper() != "NULL" else None,
            "updated_by": get_username_from_token(http_request),
            "updated_on": datetime.now().strftime('%Y-%m-%d %H:%M:%S.000')
        })
        db.commit()
        return {"status": 1, "message": "Successfully updated.", "refresh": False, "modal_close": True} if result.rowcount > 0 else {"status": 0, "message": "Sorry record not updated please try again.", "refresh": False, "modal_close": True}
    except Exception as e:
        logger.exception("Grade mapping update error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/delete", response_model=dict)
async def delete(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        delete_query = text(f"DELETE FROM {TBL_GRADE} WHERE ID = :id")
        result = db.execute(delete_query, {"id": request.id})
        db.commit()
        return {"status": "Success"} if result.rowcount > 0 else {"status": "Error"}
    except Exception as e:
        logger.exception("Grade mapping delete error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")



