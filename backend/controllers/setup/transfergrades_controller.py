"""Transfer Grades Mapping Controller"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
import logging
from datetime import datetime
from database.connection import get_db
from models.transfer_grades_mapping_model import TransferGradesMappingModel
from config.constants import TBL_TRANSFER_GRADES_MAPPING

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/transfergrades", tags=["transfergrades"])

class DataTableRequest(BaseModel):
    draw: int
    start: int
    length: int
    search: dict
    order: list
    columns: list

class TransferGradeRequest(BaseModel):
    TRANSFER_GRADE: str

class TransferGradeUpdateRequest(BaseModel):
    Id: int
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
        result = TransferGradesMappingModel.get_transfer_grades_mapping_data(db=db, request_data=request_data)
        return result
    except Exception as e:
        logger.exception("Transfer grades ajaxlist error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/insert", response_model=dict)
async def insert(request: TransferGradeRequest, db: Session = Depends(get_db)):
    try:
        if not request.TRANSFER_GRADE:
            return {"status": 0, "message": "Please Enter Transfer Grade", "refresh": False, "modal_close": False}
        insert_query = text(f"INSERT INTO {TBL_TRANSFER_GRADES_MAPPING} (TRANSFER_GRADE, UPDATED_BY, UPDATED_ON) VALUES (:transfer_grade, :updated_by, :updated_on)")
        db.execute(insert_query, {
            "transfer_grade": request.TRANSFER_GRADE.upper() if request.TRANSFER_GRADE and request.TRANSFER_GRADE.upper() != "NULL" else None,
            "updated_by": "System",
            "updated_on": datetime.now().strftime('%Y-%m-%d %H:%M:%S.000')
        })
        db.commit()
        return {"status": 1, "message": "Successfully added.", "refresh": False, "modal_close": True}
    except Exception as e:
        logger.exception("Transfer grades insert error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/get", response_model=dict)
async def get_grade(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        query = text(f"SELECT ID, TRANSFER_GRADE FROM {TBL_TRANSFER_GRADES_MAPPING} WHERE ID = :id")
        result = db.execute(query, {"id": request.id}).fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="Transfer grade not found")
        return {"ID": result.ID, "TRANSFER_GRADE": result.TRANSFER_GRADE}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Transfer grades get error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/update", response_model=dict)
async def update(request: TransferGradeUpdateRequest, db: Session = Depends(get_db)):
    try:
        if not request.TRANSFER_GRADE:
            return {"status": 0, "message": "Please Enter Transfer Grade", "refresh": False, "modal_close": False}
        update_query = text(f"UPDATE {TBL_TRANSFER_GRADES_MAPPING} SET TRANSFER_GRADE = :transfer_grade, UPDATED_BY = :updated_by, UPDATED_ON = :updated_on WHERE ID = :id")
        result = db.execute(update_query, {
            "id": request.Id,
            "transfer_grade": request.TRANSFER_GRADE.upper() if request.TRANSFER_GRADE and request.TRANSFER_GRADE.upper() != "NULL" else None,
            "updated_by": "System",
            "updated_on": datetime.now().strftime('%Y-%m-%d %H:%M:%S.000')
        })
        db.commit()
        return {"status": 1, "message": "Successfully updated.", "refresh": False, "modal_close": True} if result.rowcount > 0 else {"status": 0, "message": "Sorry record not updated please try again.", "refresh": False, "modal_close": True}
    except Exception as e:
        logger.exception("Transfer grades update error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/delete", response_model=dict)
async def delete(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        delete_query = text(f"DELETE FROM {TBL_TRANSFER_GRADES_MAPPING} WHERE ID = :id")
        result = db.execute(delete_query, {"id": request.id})
        db.commit()
        return {"status": "Success"} if result.rowcount > 0 else {"status": "Error"}
    except Exception as e:
        logger.exception("Transfer grades delete error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")



