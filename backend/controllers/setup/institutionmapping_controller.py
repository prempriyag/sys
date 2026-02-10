"""Institution Mapping Controller"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
import logging
from datetime import datetime
from database.connection import get_db
from helpers.security_helper import get_username_from_token
from models.institution_mapping_model import InstitutionMappingModel
from config.constants import TBL_INSTITUTION_MAPPING

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/institutionmapping", tags=["institutionmapping"])

class DataTableRequest(BaseModel):
    draw: int
    start: int
    length: int
    search: dict
    order: list
    columns: list

class InstitutionRequest(BaseModel):
    INSTITUTION_TYPE: str = None
    INSTITUTION_ID: str
    INSTITUTION_NAME: str
    INSTITUTION_ZIPCODE: str = None
    SLATE_INSTITUTION_ID: str
    SLATE_INSTITUTION_NAME: str
    EXTERNAL_INSTITUTION_NAME: str
    EXTERNAL_INSTITUTION_ZIPCODE: str = None

class InstitutionUpdateRequest(BaseModel):
    Id: int
    INSTITUTION_TYPE: str = None
    INSTITUTION_ID: str
    INSTITUTION_NAME: str
    INSTITUTION_ZIPCODE: str = None
    SLATE_INSTITUTION_ID: str
    SLATE_INSTITUTION_NAME: str
    EXTERNAL_INSTITUTION_NAME: str
    EXTERNAL_INSTITUTION_ZIPCODE: str = None

class DeleteRequest(BaseModel):
    id: int

@router.post("/ajaxlist", response_model=dict)
async def ajaxlist(request: DataTableRequest, inst_type: str = Query("", alias="inst_type"), db: Session = Depends(get_db)):
    try:
        request_data = {
            "draw": request.draw,
            "start": request.start,
            "length": request.length,
            "search": request.search,
            "order": request.order,
            "columns": request.columns,
        }
        result = InstitutionMappingModel.get_institution_mapping_data(db=db, request_data=request_data, inst_type=inst_type)
        return result
    except Exception as e:
        logger.exception("Institution mapping ajaxlist error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/insert", response_model=dict)
async def insert(request: InstitutionRequest, http_request: Request, db: Session = Depends(get_db)):
    try:
        if not request.INSTITUTION_ID or not request.INSTITUTION_NAME or not request.SLATE_INSTITUTION_ID or not request.EXTERNAL_INSTITUTION_NAME or not request.SLATE_INSTITUTION_NAME:
            return {"status": 0, "message": "Please fill all required fields", "refresh": False, "modal_close": False}
        check_query = text(f"""
            SELECT COUNT(*) as count FROM {TBL_INSTITUTION_MAPPING}
            WHERE INSTITUTION_ID = :institution_id AND INSTITUTION_TYPE = :institution_type
            AND INSTITUTION_NAME = :institution_name AND EXTERNAL_INSTITUTION_NAME = :external_institution_name
        """)
        check_result = db.execute(check_query, {
            "institution_id": request.INSTITUTION_ID,
            "institution_type": request.INSTITUTION_TYPE if request.INSTITUTION_TYPE and request.INSTITUTION_TYPE.upper() != "NULL" else None,
            "institution_name": request.INSTITUTION_NAME.strip().upper() if request.INSTITUTION_NAME.strip().upper() != "NULL" else None,
            "external_institution_name": request.EXTERNAL_INSTITUTION_NAME.strip().upper() if request.EXTERNAL_INSTITUTION_NAME.strip().upper() != "NULL" else None
        }).fetchone()
        if check_result and (check_result.count if hasattr(check_result, 'count') else check_result[0]) > 0:
            return {"status": 0, "message": "Duplicate Data found", "refresh": False, "modal_close": False}
        insert_query = text(f"""
            INSERT INTO {TBL_INSTITUTION_MAPPING} (INSTITUTION_TYPE, INSTITUTION_ID, INSTITUTION_NAME, INSTITUTION_ZIPCODE,
                SLATE_INSTITUTION_NAME, EXTERNAL_INSTITUTION_NAME, EXTERNAL_INSTITUTION_ZIPCODE, SLATE_INSTITUTION_ID,
                UPDATED_BY, LAST_UPDATED_DATETIME)
            VALUES (:institution_type, :institution_id, :institution_name, :institution_zipcode,
                :slate_institution_name, :external_institution_name, :external_institution_zipcode, :slate_institution_id,
                :updated_by, :last_updated_datetime)
        """)
        db.execute(insert_query, {
            "institution_type": request.INSTITUTION_TYPE if request.INSTITUTION_TYPE and request.INSTITUTION_TYPE.upper() != "NULL" else None,
            "institution_id": request.INSTITUTION_ID if request.INSTITUTION_ID != "NULL" else None,
            "institution_name": request.INSTITUTION_NAME.strip().upper() if request.INSTITUTION_NAME.strip().upper() != "NULL" else None,
            "institution_zipcode": request.INSTITUTION_ZIPCODE if request.INSTITUTION_ZIPCODE and request.INSTITUTION_ZIPCODE != "NULL" else None,
            "slate_institution_name": request.SLATE_INSTITUTION_NAME.upper() if request.SLATE_INSTITUTION_NAME and request.SLATE_INSTITUTION_NAME.upper() != "NULL" else None,
            "external_institution_name": request.EXTERNAL_INSTITUTION_NAME.strip().upper() if request.EXTERNAL_INSTITUTION_NAME.strip().upper() != "NULL" else None,
            "external_institution_zipcode": request.EXTERNAL_INSTITUTION_ZIPCODE if request.EXTERNAL_INSTITUTION_ZIPCODE and request.EXTERNAL_INSTITUTION_ZIPCODE != "NULL" else None,
            "slate_institution_id": request.SLATE_INSTITUTION_ID.upper() if request.SLATE_INSTITUTION_ID and request.SLATE_INSTITUTION_ID.upper() != "NULL" else None,
            "updated_by": get_username_from_token(http_request),
            "last_updated_datetime": datetime.now().strftime('%Y-%m-%d %H:%M:%S.000')
        })
        db.commit()
        return {"status": 1, "message": "Successfully added", "refresh": False, "modal_close": True}
    except Exception as e:
        logger.exception("Institution mapping insert error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/get", response_model=dict)
async def get_institution(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        query = text(f"SELECT * FROM {TBL_INSTITUTION_MAPPING} WHERE Id = :id")
        result = db.execute(query, {"id": request.id}).fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="Institution not found")
        return dict(result._mapping)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Institution mapping get error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/update", response_model=dict)
async def update(request: InstitutionUpdateRequest, http_request: Request, db: Session = Depends(get_db)):
    try:
        if not request.INSTITUTION_ID or not request.INSTITUTION_NAME or not request.SLATE_INSTITUTION_ID or not request.EXTERNAL_INSTITUTION_NAME or not request.SLATE_INSTITUTION_NAME:
            return {"status": 0, "message": "Please fill all required fields", "refresh": False, "modal_close": False}
        check_query = text(f"""
            SELECT COUNT(*) as count FROM {TBL_INSTITUTION_MAPPING}
            WHERE INSTITUTION_ID = :institution_id AND INSTITUTION_TYPE = :institution_type
            AND INSTITUTION_NAME = :institution_name AND EXTERNAL_INSTITUTION_NAME = :external_institution_name
            AND Id <> :id
        """)
        check_result = db.execute(check_query, {
            "institution_id": request.INSTITUTION_ID,
            "institution_type": request.INSTITUTION_TYPE if request.INSTITUTION_TYPE and request.INSTITUTION_TYPE.upper() != "NULL" else None,
            "institution_name": request.INSTITUTION_NAME.strip().upper() if request.INSTITUTION_NAME.strip().upper() != "NULL" else None,
            "external_institution_name": request.EXTERNAL_INSTITUTION_NAME.strip().upper() if request.EXTERNAL_INSTITUTION_NAME.strip().upper() != "NULL" else None,
            "id": request.Id
        }).fetchone()
        if check_result and (check_result.count if hasattr(check_result, 'count') else check_result[0]) > 0:
            return {"status": 0, "message": "Duplicate Data found", "refresh": False, "modal_close": False}
        update_query = text(f"""
            UPDATE {TBL_INSTITUTION_MAPPING}
            SET INSTITUTION_TYPE = :institution_type, INSTITUTION_ID = :institution_id,
                INSTITUTION_NAME = :institution_name, INSTITUTION_ZIPCODE = :institution_zipcode,
                SLATE_INSTITUTION_NAME = :slate_institution_name, EXTERNAL_INSTITUTION_NAME = :external_institution_name,
                EXTERNAL_INSTITUTION_ZIPCODE = :external_institution_zipcode, SLATE_INSTITUTION_ID = :slate_institution_id,
                UPDATED_BY = :updated_by, LAST_UPDATED_DATETIME = :last_updated_datetime
            WHERE Id = :id
        """)
        result = db.execute(update_query, {
            "id": request.Id,
            "institution_type": request.INSTITUTION_TYPE if request.INSTITUTION_TYPE and request.INSTITUTION_TYPE.upper() != "NULL" else None,
            "institution_id": request.INSTITUTION_ID if request.INSTITUTION_ID != "NULL" else None,
            "institution_name": request.INSTITUTION_NAME.strip().upper() if request.INSTITUTION_NAME.strip().upper() != "NULL" else None,
            "institution_zipcode": request.INSTITUTION_ZIPCODE if request.INSTITUTION_ZIPCODE and request.INSTITUTION_ZIPCODE != "NULL" else None,
            "slate_institution_name": request.SLATE_INSTITUTION_NAME.upper() if request.SLATE_INSTITUTION_NAME and request.SLATE_INSTITUTION_NAME.upper() != "NULL" else None,
            "external_institution_name": request.EXTERNAL_INSTITUTION_NAME.strip().upper() if request.EXTERNAL_INSTITUTION_NAME.strip().upper() != "NULL" else None,
            "external_institution_zipcode": request.EXTERNAL_INSTITUTION_ZIPCODE if request.EXTERNAL_INSTITUTION_ZIPCODE and request.EXTERNAL_INSTITUTION_ZIPCODE != "NULL" else None,
            "slate_institution_id": request.SLATE_INSTITUTION_ID.upper() if request.SLATE_INSTITUTION_ID and request.SLATE_INSTITUTION_ID.upper() != "NULL" else None,
            "updated_by": get_username_from_token(http_request),
            "last_updated_datetime": datetime.now().strftime('%Y-%m-%d %H:%M:%S.000')
        })
        db.commit()
        return {"status": 1, "message": "Successfully Updated", "refresh": False, "modal_close": True} if result.rowcount > 0 else {"status": 0, "message": "Sorry record not updated please try again.", "refresh": False, "modal_close": True}
    except Exception as e:
        logger.exception("Institution mapping update error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/delete", response_model=dict)
async def delete(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        delete_query = text(f"DELETE FROM {TBL_INSTITUTION_MAPPING} WHERE Id = :id")
        result = db.execute(delete_query, {"id": request.id})
        db.commit()
        return {"status": "Success"} if result.rowcount > 0 else {"status": "Error"}
    except Exception as e:
        logger.exception("Institution mapping delete error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")



