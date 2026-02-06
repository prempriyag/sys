"""Master Settings Controller"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import logging
from database.connection import get_db
from models.master_settings_model import MasterSettingsModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/mastersettings", tags=["mastersettings"])

class SystemSettingsRequest(BaseModel):
    system_name: Optional[str] = None
    system_title: Optional[str] = None
    address: Optional[str] = None
    mobile: Optional[str] = None
    system_email: Optional[str] = None
    email_password: Optional[str] = None
    terms: Optional[str] = None
    facebook: Optional[str] = None
    twiter: Optional[str] = None
    youtube: Optional[str] = None
    skype: Optional[str] = None
    pinterest: Optional[str] = None
    privacy: Optional[str] = None
    two_way_auth: Optional[str] = None
    two_way_auth_exept: Optional[str] = None
    trigger_update: Optional[str] = None
    trigger_update_mail: Optional[str] = None
    ktech_SSO_client_secret: Optional[str] = None
    ktech_SSO_clientId: Optional[str] = None
    ktech_SSO_tenantId: Optional[str] = None
    bot_process_name: Optional[str] = None
    Develper_mail: Optional[str] = None
    
    class Config:
        extra = "ignore"  # Ignore extra fields from frontend

@router.get("/get", response_model=dict)
async def get_settings(db: Session = Depends(get_db)):
    try:
        settings = MasterSettingsModel.get_business_settings(db)
        return {"status": 1, "data": settings}
    except Exception as e:
        logger.exception("Master settings get error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/update", response_model=dict)
async def update_settings(request: SystemSettingsRequest, db: Session = Depends(get_db)):
    try:
        updated_count = 0
        request_dict = request.dict(exclude_none=True)
        
        for key, value in request_dict.items():
            if value is not None:
                if MasterSettingsModel.update_setting(db, key, value):
                    updated_count += 1
        
        if updated_count > 0:
            return {"status": 1, "message": "Successfully updated.", "refresh": False, "modal_close": True}
        else:
            return {"status": 0, "message": "No settings were updated.", "refresh": False, "modal_close": False}
    except Exception as e:
        logger.exception("Master settings update error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")



