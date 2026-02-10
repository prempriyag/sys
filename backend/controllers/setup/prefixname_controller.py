"""Prefix Name Controller"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
import logging
from datetime import datetime
from database.connection import get_db
from helpers.security_helper import get_username_from_token
from models.prefix_name_model import PrefixNameModel
from config.constants import TBL_PrefixName

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/prefixname", tags=["prefixname"])

class DataTableRequest(BaseModel):
    draw: int
    start: int
    length: int
    search: dict
    order: list
    columns: list

class PrefixRequest(BaseModel):
    Prefix: str

class PrefixUpdateRequest(BaseModel):
    Id: int
    Prefix: str

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
        result = PrefixNameModel.get_prefix_name_data(db=db, request_data=request_data)
        return result
    except Exception as e:
        logger.exception("Prefix name ajaxlist error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/insert", response_model=dict)
async def insert(request: PrefixRequest, http_request: Request, db: Session = Depends(get_db)):
    try:
        if not request.Prefix:
            return {"status": 0, "message": "Please enter a prefix", "refresh": False, "modal_close": False}
        prefix = request.Prefix.strip().capitalize()
        check_query = text(f"SELECT COUNT(*) as count FROM {TBL_PrefixName} WHERE UPPER(Prefix) = UPPER(:prefix)")
        check_result = db.execute(check_query, {"prefix": prefix}).fetchone()
        if check_result and (check_result.count if hasattr(check_result, 'count') else check_result[0]) > 0:
            return {"status": 0, "message": "Duplicate prefix found.", "refresh": False, "modal_close": False}
        insert_query = text(f"INSERT INTO {TBL_PrefixName} (Prefix, Updated_By, Updated_on) VALUES (:prefix, :updated_by, :updated_on)")
        db.execute(insert_query, {
            "prefix": prefix if prefix != "NULL" else None,
            "updated_by": get_username_from_token(http_request),
            "updated_on": datetime.now().strftime('%Y-%m-%d %H:%M:%S.000')
        })
        db.commit()
        return {"status": 1, "message": "Successfully added", "refresh": False, "modal_close": True}
    except Exception as e:
        logger.exception("Prefix name insert error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/get", response_model=dict)
async def get_prefix(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        query = text(f"SELECT * FROM {TBL_PrefixName} WHERE ID = :id")
        result = db.execute(query, {"id": request.id}).fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="Prefix not found")
        return dict(result._mapping)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Prefix name get error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/update", response_model=dict)
async def update(request: PrefixUpdateRequest, http_request: Request, db: Session = Depends(get_db)):
    try:
        if not request.Prefix:
            return {"status": 0, "message": "Please enter a prefix", "refresh": False, "modal_close": False}
        prefix = request.Prefix.strip().capitalize()
        check_query = text(f"SELECT COUNT(*) as count FROM {TBL_PrefixName} WHERE UPPER(Prefix) = UPPER(:prefix) AND ID <> :id")
        check_result = db.execute(check_query, {"prefix": prefix, "id": request.Id}).fetchone()
        if check_result and (check_result.count if hasattr(check_result, 'count') else check_result[0]) > 0:
            return {"status": 0, "message": "Duplicate prefix found.", "refresh": False, "modal_close": False}
        update_query = text(f"UPDATE {TBL_PrefixName} SET Prefix = :prefix, Updated_By = :updated_by, Updated_on = :updated_on WHERE ID = :id")
        result = db.execute(update_query, {
            "id": request.Id,
            "prefix": prefix if prefix != "NULL" else None,
            "updated_by": get_username_from_token(http_request),
            "updated_on": datetime.now().strftime('%Y-%m-%d %H:%M:%S.000')
        })
        db.commit()
        return {"status": 1, "message": "Successfully updated.", "refresh": False, "modal_close": True} if result.rowcount > 0 else {"status": 0, "message": "Sorry record not updated please try again.", "refresh": False, "modal_close": True}
    except Exception as e:
        logger.exception("Prefix name update error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/delete", response_model=dict)
async def delete(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        delete_query = text(f"DELETE FROM {TBL_PrefixName} WHERE ID = :id")
        result = db.execute(delete_query, {"id": request.id})
        db.commit()
        return {"status": "Success"} if result.rowcount > 0 else {"status": "Error"}
    except Exception as e:
        logger.exception("Prefix name delete error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")



