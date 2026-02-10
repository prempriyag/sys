"""Skip Courses Controller"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
import logging
from datetime import datetime
from database.connection import get_db
from helpers.security_helper import get_username_from_token
from models.skip_courses_model import SkipCoursesModel
from config.constants import TBL_COURSES

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/skipcourses", tags=["skipcourses"])

class DataTableRequest(BaseModel):
    draw: int
    start: int
    length: int
    search: dict
    order: list
    columns: list

class SkipCourseRequest(BaseModel):
    INSTITUTION_ID: str
    EXTERNAL_SUBJECT: str
    EXTERNAL_COURSE_ID: str

class SkipCourseUpdateRequest(BaseModel):
    Id: int
    INSTITUTION_ID: str
    EXTERNAL_SUBJECT: str
    EXTERNAL_COURSE_ID: str

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
        result = SkipCoursesModel.get_skip_courses_data(db=db, request_data=request_data)
        return result
    except Exception as e:
        logger.exception("Skip courses ajaxlist error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/insert", response_model=dict)
async def insert(request: SkipCourseRequest, http_request: Request, db: Session = Depends(get_db)):
    try:
        if not request.INSTITUTION_ID or not request.EXTERNAL_SUBJECT or not request.EXTERNAL_COURSE_ID:
            return {"status": 0, "message": "Please select an Institution ID and enter external subject name and course ID", "refresh": False}
        check_query = text(f"""
            SELECT COUNT(*) as count FROM {TBL_COURSES}
            WHERE INSTITUTION_ID = :institution_id AND EXTERNAL_SUBJECT = :external_subject AND EXTERNAL_COURSE_ID = :external_course_id
        """)
        check_result = db.execute(check_query, {
            "institution_id": request.INSTITUTION_ID,
            "external_subject": request.EXTERNAL_SUBJECT.strip().upper(),
            "external_course_id": request.EXTERNAL_COURSE_ID.strip().lower()
        }).fetchone()
        if check_result and (check_result.count if hasattr(check_result, 'count') else check_result[0]) > 0:
            return {"status": 0, "message": "Duplicate record found. The course already exists.", "refresh": False}
        insert_query = text(f"""
            INSERT INTO {TBL_COURSES} (INSTITUTION_ID, EXTERNAL_SUBJECT, EXTERNAL_COURSE_ID, UPDATED_BY, LAST_UPDATED_DATETIME)
            VALUES (:institution_id, :external_subject, :external_course_id, :updated_by, :last_updated_datetime)
        """)
        db.execute(insert_query, {
            "institution_id": request.INSTITUTION_ID,
            "external_subject": request.EXTERNAL_SUBJECT.strip().upper(),
            "external_course_id": request.EXTERNAL_COURSE_ID.strip().lower(),
            "updated_by": get_username_from_token(http_request),
            "last_updated_datetime": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        })
        db.commit()
        return {"status": 1, "message": "Successfully added", "refresh": False, "modal_close": True}
    except Exception as e:
        logger.exception("Skip courses insert error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/get", response_model=dict)
async def get_course(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        query = text(f"SELECT * FROM {TBL_COURSES} WHERE Id = :id")
        result = db.execute(query, {"id": request.id}).fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="Course not found")
        return dict(result._mapping)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Skip courses get error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/update", response_model=dict)
async def update(request: SkipCourseUpdateRequest, http_request: Request, db: Session = Depends(get_db)):
    try:
        if not request.INSTITUTION_ID or not request.EXTERNAL_SUBJECT or not request.EXTERNAL_COURSE_ID:
            return {"status": 0, "message": "Please select an Institution ID and enter external subject name and course ID", "refresh": False}
        check_query = text(f"""
            SELECT COUNT(*) as count FROM {TBL_COURSES}
            WHERE INSTITUTION_ID = :institution_id AND EXTERNAL_SUBJECT = :external_subject 
            AND EXTERNAL_COURSE_ID = :external_course_id AND Id <> :id
        """)
        check_result = db.execute(check_query, {
            "institution_id": request.INSTITUTION_ID,
            "external_subject": request.EXTERNAL_SUBJECT.strip().upper(),
            "external_course_id": request.EXTERNAL_COURSE_ID.strip().lower(),
            "id": request.Id
        }).fetchone()
        if check_result and (check_result.count if hasattr(check_result, 'count') else check_result[0]) > 0:
            return {"status": 0, "message": "Duplicate record found. The course already exists.", "refresh": False}
        update_query = text(f"""
            UPDATE {TBL_COURSES}
            SET INSTITUTION_ID = :institution_id, EXTERNAL_SUBJECT = :external_subject,
                EXTERNAL_COURSE_ID = :external_course_id, UPDATED_BY = :updated_by,
                LAST_UPDATED_DATETIME = :last_updated_datetime
            WHERE Id = :id
        """)
        result = db.execute(update_query, {
            "id": request.Id,
            "institution_id": request.INSTITUTION_ID,
            "external_subject": request.EXTERNAL_SUBJECT.strip().upper(),
            "external_course_id": request.EXTERNAL_COURSE_ID.strip().lower(),
            "updated_by": get_username_from_token(http_request),
            "last_updated_datetime": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        })
        db.commit()
        return {"status": 1, "message": "Successfully updated.", "refresh": False, "modal_close": True} if result.rowcount > 0 else {"status": 0, "message": "Sorry record not updated please try again.", "refresh": False, "modal_close": True}
    except Exception as e:
        logger.exception("Skip courses update error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/delete", response_model=dict)
async def delete(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        delete_query = text(f"DELETE FROM {TBL_COURSES} WHERE Id = :id")
        result = db.execute(delete_query, {"id": request.id})
        db.commit()
        return {"status": "Success"} if result.rowcount > 0 else {"status": "Error"}
    except Exception as e:
        logger.exception("Skip courses delete error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")



