"""
Term Mapping Controller
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
import logging
from datetime import datetime
from database.connection import get_db
from models.term_mapping_model import TermMappingModel
from config.constants import TBL_TERM_MAPPING
from helpers.common_helper import check_special_name

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/termmapping", tags=["termmapping"])

class DataTableRequest(BaseModel):
    draw: int
    start: int
    length: int
    search: dict
    order: list
    columns: list

class TermRequest(BaseModel):
    TERM: str
    TERM_CODE: str
    TERM_START: str
    TERM_END: str
    IS_ACTIVE: str
    GRACE_PERIOD: int

class TermUpdateRequest(BaseModel):
    Id: int
    TERM: str
    TERM_CODE: str
    TERM_START: str
    TERM_END: str
    IS_ACTIVE: str
    GRACE_PERIOD: int

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
        result = TermMappingModel.get_term_mapping_data(db=db, request_data=request_data)
        return result
    except Exception as e:
        logger.exception("Term mapping ajaxlist error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/insert", response_model=dict)
async def insert(request: TermRequest, db: Session = Depends(get_db)):
    try:
        from datetime import datetime as dt
        term_start = dt.strptime(request.TERM_START, "%Y-%m-%d").strftime("%m-%d-%Y")
        term_end = dt.strptime(request.TERM_END, "%Y-%m-%d").strftime("%m-%d-%Y")
        check_query = text(f"""
            SELECT COUNT(*) as count FROM {TBL_TERM_MAPPING}
            WHERE lower(TERM) = lower(:term) AND lower(TERM_CODE) = lower(:term_code)
            AND TERM_START = :term_start AND TERM_END = :term_end
            AND lower(IS_ACTIVE) = lower(:is_active) AND GRACE_PERIOD = :grace_period
        """)
        check_result = db.execute(check_query, {
            "term": request.TERM.strip().lower(),
            "term_code": request.TERM_CODE.strip().lower(),
            "term_start": term_start.lower(),
            "term_end": term_end.lower(),
            "is_active": request.IS_ACTIVE.strip().lower(),
            "grace_period": request.GRACE_PERIOD
        }).fetchone()
        if check_result and (check_result.count if hasattr(check_result, 'count') else check_result[0]) > 0:
            return {"status": 0, "message": "Duplicate Data found.", "refresh": False, "modal_close": True}
        insert_query = text(f"""
            INSERT INTO {TBL_TERM_MAPPING} (TERM, TERM_CODE, TERM_START, TERM_END, IS_ACTIVE, GRACE_PERIOD, UPDATED_BY, LAST_UPDATED_DATETIME)
            VALUES (lower(:term), lower(:term_code), lower(:term_start), lower(:term_end), lower(:is_active), :grace_period, :updated_by, :last_updated_datetime)
        """)
        db.execute(insert_query, {
            "term": request.TERM.strip(),
            "term_code": request.TERM_CODE.strip(),
            "term_start": term_start,
            "term_end": term_end,
            "is_active": request.IS_ACTIVE.strip(),
            "grace_period": request.GRACE_PERIOD,
            "updated_by": "System",
            "last_updated_datetime": datetime.now().strftime('%Y-%m-%d %H:%M:%S.000')
        })
        db.commit()
        return {"status": 1, "message": "Successfully added.", "refresh": False, "modal_close": True}
    except Exception as e:
        logger.exception("Term mapping insert error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/get", response_model=dict)
async def get_term(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        query = text(f"SELECT * FROM {TBL_TERM_MAPPING} WHERE Id = :id")
        result = db.execute(query, {"id": request.id}).fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="Term not found")
        return dict(result._mapping)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Term mapping get error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/update", response_model=dict)
async def update(request: TermUpdateRequest, db: Session = Depends(get_db)):
    try:
        from datetime import datetime as dt
        term_start = dt.strptime(request.TERM_START, "%Y-%m-%d").strftime("%m-%d-%Y")
        term_end = dt.strptime(request.TERM_END, "%Y-%m-%d").strftime("%m-%d-%Y")
        check_query = text(f"""
            SELECT COUNT(*) as count FROM {TBL_TERM_MAPPING}
            WHERE lower(TERM) = lower(:term) AND lower(TERM_CODE) = lower(:term_code)
            AND TERM_START = :term_start AND TERM_END = :term_end
            AND lower(IS_ACTIVE) = lower(:is_active) AND GRACE_PERIOD = :grace_period
            AND Id <> :id
        """)
        check_result = db.execute(check_query, {
            "term": request.TERM.strip().lower(),
            "term_code": request.TERM_CODE.strip().lower(),
            "term_start": term_start.lower(),
            "term_end": term_end.lower(),
            "is_active": request.IS_ACTIVE.strip().lower(),
            "grace_period": request.GRACE_PERIOD,
            "id": request.Id
        }).fetchone()
        if check_result and (check_result.count if hasattr(check_result, 'count') else check_result[0]) > 0:
            return {"status": 0, "message": "Duplicate Data found.", "refresh": False, "modal_close": True}
        update_query = text(f"""
            UPDATE {TBL_TERM_MAPPING}
            SET TERM = lower(:term), TERM_CODE = lower(:term_code), TERM_START = lower(:term_start),
                TERM_END = lower(:term_end), IS_ACTIVE = lower(:is_active), GRACE_PERIOD = :grace_period,
                UPDATED_BY = :updated_by, LAST_UPDATED_DATETIME = :last_updated_datetime
            WHERE Id = :id
        """)
        result = db.execute(update_query, {
            "id": request.Id,
            "term": request.TERM.strip(),
            "term_code": request.TERM_CODE.strip(),
            "term_start": term_start,
            "term_end": term_end,
            "is_active": request.IS_ACTIVE.strip(),
            "grace_period": request.GRACE_PERIOD,
            "updated_by": "System",
            "last_updated_datetime": datetime.now().strftime('%Y-%m-%d %H:%M:%S.000')
        })
        db.commit()
        if result.rowcount > 0:
            return {"status": 1, "message": "Successfully updated.", "refresh": False, "modal_close": True}
        else:
            return {"status": 0, "message": "Sorry record not updated please try again.", "refresh": False, "modal_close": True}
    except Exception as e:
        logger.exception("Term mapping update error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/delete", response_model=dict)
async def delete(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        delete_query = text(f"DELETE FROM {TBL_TERM_MAPPING} WHERE Id = :id")
        result = db.execute(delete_query, {"id": request.id})
        db.commit()
        return {"status": "Success"} if result.rowcount > 0 else {"status": "Error"}
    except Exception as e:
        logger.exception("Term mapping delete error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")



