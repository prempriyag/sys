"""Settings Controller - Handles SMS, SMTP, and Logo settings endpoints"""
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import logging
import os
from pathlib import Path
from database.connection import get_db
from helpers.db_helper import get_setting
from models.master_settings_model import MasterSettingsModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/settings", tags=["settings"])

class SmsSettingsRequest(BaseModel):
    """SMS settings update request - matches frontend field names"""
    sms_username: Optional[str] = None
    sms_sender: Optional[str] = None
    sms_hash: Optional[str] = None
    
    class Config:
        extra = "ignore"

class SmtpSettingsRequest(BaseModel):
    """SMTP settings update request - matches frontend field names"""
    smtp_port: Optional[str] = None
    smtp_host: Optional[str] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    
    class Config:
        extra = "ignore"

@router.get("/sms", response_model=dict)
async def get_sms_settings(db: Session = Depends(get_db)):
    """
    Get SMS settings from BUSINESS_SETTINGS table
    Returns SMS-related settings as a dictionary
    """
    try:
        # Get SMS-related settings from BUSINESS_SETTINGS
        sms_settings = {
            "sms_username": get_setting(db, "sms_username") or "",
            "sms_sender": get_setting(db, "sms_sender") or "",
            "sms_hash": get_setting(db, "sms_hash") or "",
        }
        return {"status": 1, "data": sms_settings}
    except Exception as e:
        logger.exception("SMS settings get error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/sms/update", response_model=dict)
async def update_sms_settings(request: SmsSettingsRequest, db: Session = Depends(get_db)):
    """
    Update SMS settings in BUSINESS_SETTINGS table
    """
    try:
        updated_count = 0
        request_dict = request.dict(exclude_none=True)
        
        for field, value in request_dict.items():
            if value is not None:
                if MasterSettingsModel.update_setting(db, field, value):
                    updated_count += 1
        
        if updated_count > 0:
            return {"status": 1, "message": "SMS settings updated successfully.", "refresh": False, "modal_close": True}
        else:
            return {"status": 0, "message": "No SMS settings were updated.", "refresh": False, "modal_close": False}
    except Exception as e:
        logger.exception("SMS settings update error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.get("/smtp", response_model=dict)
async def get_smtp_settings(db: Session = Depends(get_db)):
    """
    Get SMTP settings - returns the first SMTP configuration
    This endpoint is used by MasterSettings page
    Field names match frontend: smtp_port, smtp_host, smtp_username, smtp_password
    """
    try:
        from sqlalchemy import text
        from config.constants import TBL_SMTP
        
        # Get the first SMTP configuration
        query = text(f"SELECT TOP 1 id, host, username, password, port FROM {TBL_SMTP} ORDER BY id")
        result = db.execute(query).fetchone()
        
        if result:
            record_dict = dict(result._mapping)
            return {
                "status": 1,
                "data": {
                    "id": record_dict.get("id"),
                    "smtp_host": record_dict.get("host", ""),
                    "smtp_username": record_dict.get("username", ""),
                    "smtp_password": record_dict.get("password", ""),
                    "smtp_port": str(record_dict.get("port", "")),
                }
            }
        else:
            # Return empty SMTP settings if none found
            return {
                "status": 1,
                "data": {
                    "id": None,
                    "smtp_host": "",
                    "smtp_username": "",
                    "smtp_password": "",
                    "smtp_port": "",
                }
            }
    except Exception as e:
        logger.exception("SMTP settings get error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/smtp/update", response_model=dict)
async def update_smtp_settings(request: SmtpSettingsRequest, db: Session = Depends(get_db)):
    """
    Update SMTP settings in the SMTP table
    """
    try:
        from sqlalchemy import text
        from config.constants import TBL_SMTP
        
        # Check if an SMTP record exists
        check_query = text(f"SELECT TOP 1 id FROM {TBL_SMTP} ORDER BY id")
        existing = db.execute(check_query).fetchone()
        
        request_dict = request.dict(exclude_none=True)
        
        if not request_dict:
            return {"status": 0, "message": "No SMTP settings to update.", "refresh": False, "modal_close": False}
        
        # Map frontend field names to database column names
        field_mapping = {
            "smtp_host": "host",
            "smtp_username": "username",
            "smtp_password": "password",
            "smtp_port": "port",
        }
        
        if existing:
            # Update existing record
            update_parts = []
            params = {"id": existing.id}
            
            for frontend_field, db_column in field_mapping.items():
                if frontend_field in request_dict:
                    update_parts.append(f"{db_column} = :{db_column}")
                    params[db_column] = request_dict[frontend_field]
            
            if update_parts:
                update_query = text(f"UPDATE {TBL_SMTP} SET {', '.join(update_parts)} WHERE id = :id")
                db.execute(update_query, params)
                db.commit()
        else:
            # Insert new record
            columns = []
            values = []
            params = {}
            
            for frontend_field, db_column in field_mapping.items():
                if frontend_field in request_dict:
                    columns.append(db_column)
                    values.append(f":{db_column}")
                    params[db_column] = request_dict[frontend_field]
            
            if columns:
                insert_query = text(f"INSERT INTO {TBL_SMTP} ({', '.join(columns)}) VALUES ({', '.join(values)})")
                db.execute(insert_query, params)
                db.commit()
        
        return {"status": 1, "message": "SMTP settings updated successfully.", "refresh": False, "modal_close": True}
    except Exception as e:
        logger.exception("SMTP settings update error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/logo/update", response_model=dict)
async def update_logo_settings(
    BLACK_LOGO: Optional[UploadFile] = File(None),
    SMALL_LOGO: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    """
    Update logo files - handles BLACK_LOGO and SMALL_LOGO uploads
    """
    try:
        # Create upload directory if it doesn't exist
        upload_dir = Path("static/logos")
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        updated_logos = []
        
        # Handle BLACK_LOGO (main logo)
        if BLACK_LOGO and BLACK_LOGO.filename:
            # Validate file type
            if not BLACK_LOGO.content_type or not BLACK_LOGO.content_type.startswith("image/"):
                raise HTTPException(status_code=400, detail="BLACK_LOGO must be an image file")
            
            # Read content
            content = await BLACK_LOGO.read()
            
            # Validate file size (max 5MB)
            if len(content) > 5 * 1024 * 1024:
                raise HTTPException(status_code=400, detail="BLACK_LOGO file size must be less than 5MB")
            
            # Get file extension
            file_extension = Path(BLACK_LOGO.filename).suffix or ".png"
            filename = f"black_logo{file_extension}"
            file_path = upload_dir / filename
            
            # Write file
            with open(file_path, "wb") as f:
                f.write(content)
            
            # Update database setting
            logo_url = f"/static/logos/{filename}"
            MasterSettingsModel.update_setting(db, "BLACK_LOGO", logo_url)
            updated_logos.append("BLACK_LOGO")
        
        # Handle SMALL_LOGO
        if SMALL_LOGO and SMALL_LOGO.filename:
            # Validate file type
            if not SMALL_LOGO.content_type or not SMALL_LOGO.content_type.startswith("image/"):
                raise HTTPException(status_code=400, detail="SMALL_LOGO must be an image file")
            
            # Read content
            content = await SMALL_LOGO.read()
            
            # Validate file size (max 5MB)
            if len(content) > 5 * 1024 * 1024:
                raise HTTPException(status_code=400, detail="SMALL_LOGO file size must be less than 5MB")
            
            # Get file extension
            file_extension = Path(SMALL_LOGO.filename).suffix or ".png"
            filename = f"small_logo{file_extension}"
            file_path = upload_dir / filename
            
            # Write file
            with open(file_path, "wb") as f:
                f.write(content)
            
            # Update database setting
            logo_url = f"/static/logos/{filename}"
            MasterSettingsModel.update_setting(db, "SMALL_LOGO", logo_url)
            updated_logos.append("SMALL_LOGO")
        
        if updated_logos:
            return {
                "status": 1,
                "message": f"Logo(s) updated successfully: {', '.join(updated_logos)}",
                "refresh": False,
                "modal_close": True
            }
        else:
            return {
                "status": 0,
                "message": "No logos were uploaded.",
                "refresh": False,
                "modal_close": False
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Logo settings update error")
        raise HTTPException(status_code=500, detail=f"Error uploading logos: {str(e)}")
