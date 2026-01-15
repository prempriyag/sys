"""Settings Controller - Handles SMS and SMTP settings endpoints"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import logging
from database.connection import get_db
from helpers.db_helper import get_setting
from models.master_settings_model import MasterSettingsModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/settings", tags=["settings"])

class SmsSettingsRequest(BaseModel):
    """SMS settings update request"""
    sms_api_key: str = None
    sms_api_secret: str = None
    sms_from_number: str = None
    sms_enabled: str = None

@router.get("/sms", response_model=dict)
async def get_sms_settings(db: Session = Depends(get_db)):
    """
    Get SMS settings from BUSINESS_SETTINGS table
    Returns SMS-related settings as a dictionary
    """
    try:
        # Get SMS-related settings from BUSINESS_SETTINGS
        sms_settings = {
            "sms_api_key": get_setting(db, "sms_api_key") or "",
            "sms_api_secret": get_setting(db, "sms_api_secret") or "",
            "sms_from_number": get_setting(db, "sms_from_number") or "",
            "sms_enabled": get_setting(db, "sms_enabled") or "0",
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
        
        # Map request fields to database keycodes
        field_mapping = {
            "sms_api_key": "sms_api_key",
            "sms_api_secret": "sms_api_secret",
            "sms_from_number": "sms_from_number",
            "sms_enabled": "sms_enabled",
        }
        
        for field, keycode in field_mapping.items():
            if field in request_dict and request_dict[field] is not None:
                if MasterSettingsModel.update_setting(db, keycode, request_dict[field]):
                    updated_count += 1
        
        if updated_count > 0:
            return {"status": 1, "message": "Successfully updated.", "refresh": False, "modal_close": True}
        else:
            return {"status": 0, "message": "No settings were updated.", "refresh": False, "modal_close": False}
    except Exception as e:
        logger.exception("SMS settings update error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.get("/smtp", response_model=dict)
async def get_smtp_settings(db: Session = Depends(get_db)):
    """
    Get SMTP settings - returns the first SMTP configuration
    This endpoint is used by MasterSettings page
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
                    "host": record_dict.get("host", ""),
                    "username": record_dict.get("username", ""),
                    "password": record_dict.get("password", ""),
                    "port": record_dict.get("port", ""),
                }
            }
        else:
            # Return empty SMTP settings if none found
            return {
                "status": 1,
                "data": {
                    "id": None,
                    "host": "",
                    "username": "",
                    "password": "",
                    "port": "",
                }
            }
    except Exception as e:
        logger.exception("SMTP settings get error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

