"""SMTP Controller"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
import logging
from datetime import datetime
from database.connection import get_db
from models.smtp_model import SmtpModel
from config.constants import TBL_SMTP

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/smtp", tags=["smtp"])

class DataTableRequest(BaseModel):
    draw: int
    start: int
    length: int
    search: dict
    order: list
    columns: list

class SmtpRequest(BaseModel):
    host: str
    username: str
    password: str
    port: str

class SmtpUpdateRequest(BaseModel):
    id: int
    host: str
    username: str
    password: str
    port: str

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
        result = SmtpModel.get_smtp_data(db=db, request_data=request_data)
        return result
    except Exception as e:
        logger.exception("SMTP ajaxlist error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/insert", response_model=dict)
async def insert(request: SmtpRequest, db: Session = Depends(get_db)):
    try:
        insert_query = text(f"""
            INSERT INTO {TBL_SMTP} (host, username, password, port)
            VALUES (:host, :username, :password, :port)
        """)
        db.execute(insert_query, {
            "host": request.host,
            "username": request.username,
            "password": request.password,
            "port": request.port,
        })
        db.commit()
        return {"status": 1, "message": "Successfully added.", "refresh": True, "modal_close": True}
    except Exception as e:
        logger.exception("SMTP insert error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/get", response_model=dict)
async def get_smtp(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        query = text(f"SELECT id, host, username, password, port FROM {TBL_SMTP} WHERE id = :id")
        result = db.execute(query, {"id": request.id}).fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="SMTP configuration not found")
        record_dict = dict(result._mapping)
        return {
            "id": record_dict.get("id"),
            "host": record_dict.get("host", ""),
            "username": record_dict.get("username", ""),
            "password": record_dict.get("password", ""),
            "port": record_dict.get("port", ""),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("SMTP get error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/update", response_model=dict)
async def update(request: SmtpUpdateRequest, db: Session = Depends(get_db)):
    try:
        update_query = text(f"""
            UPDATE {TBL_SMTP}
            SET host = :host, username = :username, password = :password, port = :port
            WHERE id = :id
        """)
        result = db.execute(update_query, {
            "id": request.id,
            "host": request.host,
            "username": request.username,
            "password": request.password,
            "port": request.port,
        })
        db.commit()
        return {"status": 1, "message": "Successfully updated.", "refresh": False, "modal_close": True} if result.rowcount > 0 else {"status": 0, "message": "Sorry record not updated please try again.", "refresh": False, "modal_close": True}
    except Exception as e:
        logger.exception("SMTP update error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/delete", response_model=dict)
async def delete(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        delete_query = text(f"DELETE FROM {TBL_SMTP} WHERE id = :id")
        result = db.execute(delete_query, {"id": request.id})
        db.commit()
        return {"status": "Success"} if result.rowcount > 0 else {"status": "Error"}
    except Exception as e:
        logger.exception("SMTP delete error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

