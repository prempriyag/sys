"""
Degree Mapping Controller - College Module
FastAPI version of CI3 Degreemapping controller
Handles CRUD operations for Degree Mapping
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from pydantic import BaseModel
import logging
from datetime import datetime

from database.connection import get_db
from helpers.permission_dependency import require_permission
from models import User
from models.degree_mapping_model import DegreeMappingModel
from config.constants import TBL_DEGREE

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/degreemapping",
    tags=["degreemapping"],
)


class DataTableRequest(BaseModel):
    draw: int
    start: int
    length: int
    search: dict
    order: list
    columns: list


class DegreeRequest(BaseModel):
    DEGREE_CD: str
    DEGREE_NAME: str


class DegreeUpdateRequest(BaseModel):
    Id: int
    DEGREE_CD: str
    DEGREE_NAME: str


class DeleteRequest(BaseModel):
    id: int


@router.post("/ajaxlist", response_model=dict)
async def ajaxlist(
    request: DataTableRequest,
    # Temporarily disabled authentication for testing
    # current_user: User = Depends(
    #     require_permission("college_degree", "VIEW")
    # ),
    db: Session = Depends(get_db),
):
    """
    Get Degree Mapping data for DataTables
    Matches CI3 Degreemapping::ajaxlist() -> Mapping_model::getdegreemappingdata()
    """
    try:
        request_data = {
            "draw": request.draw,
            "start": request.start,
            "length": request.length,
            "search": request.search,
            "order": request.order,
            "columns": request.columns,
        }

        result = DegreeMappingModel.get_degree_mapping_data(
            db=db,
            request_data=request_data,
        )

        return result

    except Exception as e:
        logger.exception("Degree mapping ajaxlist error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.post("/insert", response_model=dict)
async def insert(
    request: DegreeRequest,
    # Temporarily disabled authentication for testing
    # current_user: User = Depends(
    #     require_permission("college_degree", "ADD")
    # ),
    db: Session = Depends(get_db),
):
    """
    Insert new Degree Mapping
    Matches CI3 Degreemapping::insert() method
    """
    try:
        if not request.DEGREE_CD or not request.DEGREE_NAME:
            return {
                "status": 0,
                "message": "Please Enter Degree Code and Degree Name",
                "refresh": False,
                "modal_close": False,
            }

        # Check for duplicates
        check_query = text(f"""
            SELECT COUNT(*) as count
            FROM {TBL_DEGREE}
            WHERE DEGREE_CD = :degree_cd AND DEGREE_NAME = :degree_name
        """)
        
        check_result = db.execute(check_query, {
            "degree_cd": request.DEGREE_CD,
            "degree_name": request.DEGREE_NAME
        }).fetchone()
        
        if check_result and (check_result.count if hasattr(check_result, 'count') else check_result[0]) > 0:
            return {
                "status": 0,
                "message": "Duplicate Data found.",
                "refresh": False,
                "modal_close": True,
            }

        # Insert new record
        insert_query = text(f"""
            INSERT INTO {TBL_DEGREE} (DEGREE_CD, DEGREE_NAME, UPDATED_BY, LAST_UPDATED_DATETIME)
            VALUES (:degree_cd, :degree_name, :updated_by, :last_updated_datetime)
        """)
        
        db.execute(insert_query, {
            "degree_cd": request.DEGREE_CD,
            "degree_name": request.DEGREE_NAME,
            "updated_by": "System",  # TODO: Get from current_user when auth is enabled
            "last_updated_datetime": datetime.now().strftime('%Y-%m-%d %H:%M:%S.000')
        })
        db.commit()

        return {
            "status": 1,
            "message": "Successfully added.",
            "refresh": True,
            "modal_close": True,
        }

    except Exception as e:
        logger.exception("Degree mapping insert error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.post("/get", response_model=dict)
async def get_degree(
    request: DeleteRequest,  # Reusing DeleteRequest for id parameter
    # Temporarily disabled authentication for testing
    # current_user: User = Depends(
    #     require_permission("college_degree", "VIEW")
    # ),
    db: Session = Depends(get_db),
):
    """
    Get single Degree Mapping by ID
    Matches CI3 Degreemapping::getdegree() method
    """
    try:
        query = text(f"""
            SELECT Id, DEGREE_CD, DEGREE_NAME
            FROM {TBL_DEGREE}
            WHERE Id = :id
        """)
        
        result = db.execute(query, {"id": request.id}).fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="Degree not found")
        
        return {
            "Id": result.Id,
            "DEGREE_CD": result.DEGREE_CD,
            "DEGREE_NAME": result.DEGREE_NAME,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Degree mapping get error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.post("/update", response_model=dict)
async def update(
    request: DegreeUpdateRequest,
    # Temporarily disabled authentication for testing
    # current_user: User = Depends(
    #     require_permission("college_degree", "UPDATE")
    # ),
    db: Session = Depends(get_db),
):
    """
    Update Degree Mapping
    Matches CI3 Degreemapping::update() method
    """
    try:
        if not request.DEGREE_CD or not request.DEGREE_NAME:
            return {
                "status": 0,
                "message": "Please Enter Degree Code and Degree Name",
                "refresh": False,
                "modal_close": False,
            }

        # Check for duplicates (excluding current record)
        check_query = text(f"""
            SELECT COUNT(*) as count
            FROM {TBL_DEGREE}
            WHERE DEGREE_CD = :degree_cd AND DEGREE_NAME = :degree_name AND Id <> :id
        """)
        
        check_result = db.execute(check_query, {
            "degree_cd": request.DEGREE_CD,
            "degree_name": request.DEGREE_NAME,
            "id": request.Id
        }).fetchone()
        
        if check_result and (check_result.count if hasattr(check_result, 'count') else check_result[0]) > 0:
            return {
                "status": 0,
                "message": "Duplicate Data found.",
                "refresh": False,
                "modal_close": True,
            }

        # Update record
        update_query = text(f"""
            UPDATE {TBL_DEGREE}
            SET DEGREE_CD = :degree_cd,
                DEGREE_NAME = :degree_name,
                UPDATED_BY = :updated_by,
                LAST_UPDATED_DATETIME = :last_updated_datetime
            WHERE Id = :id
        """)
        
        result = db.execute(update_query, {
            "id": request.Id,
            "degree_cd": request.DEGREE_CD,
            "degree_name": request.DEGREE_NAME,
            "updated_by": "System",  # TODO: Get from current_user when auth is enabled
            "last_updated_datetime": datetime.now().strftime('%Y-%m-%d %H:%M:%S.000')
        })
        db.commit()

        if result.rowcount > 0:
            return {
                "status": 1,
                "message": "Successfully updated.",
                "refresh": False,
                "modal_close": True,
            }
        else:
            return {
                "status": 0,
                "message": "Sorry record not updated please try again.",
                "refresh": False,
                "modal_close": True,
            }

    except Exception as e:
        logger.exception("Degree mapping update error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.post("/delete", response_model=dict)
async def delete(
    request: DeleteRequest,
    # Temporarily disabled authentication for testing
    # current_user: User = Depends(
    #     require_permission("college_degree", "DELETE")
    # ),
    db: Session = Depends(get_db),
):
    """
    Delete Degree Mapping
    Matches CI3 Degreemapping::delete() method
    """
    try:
        delete_query = text(f"""
            DELETE FROM {TBL_DEGREE}
            WHERE Id = :id
        """)
        
        result = db.execute(delete_query, {"id": request.id})
        db.commit()

        if result.rowcount > 0:
            return {"status": "Success"}
        else:
            return {"status": "Error"}

    except Exception as e:
        logger.exception("Degree mapping delete error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

