"""Master Settings Controller"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import logging
from database.connection import get_db
from models.master_settings_model import MasterSettingsModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/mastersettings", tags=["mastersettings"])

class SystemSettingsRequest(BaseModel):
    system_name: str = None
    system_title: str = None
    address: str = None
    mobile: str = None
    system_email: str = None
    email_password: str = None
    terms: str = None
    facebook: str = None
    twiter: str = None
    youtube: str = None
    skype: str = None
    pinterest: str = None
    privacy: str = None
    two_way_auth: str = None
    two_way_auth_exept: str = None
    trigger_update: str = None
    trigger_update_mail: str = None
    ktech_SSO_client_secret: str = None
    ktech_SSO_clientId: str = None
    ktech_SSO_tenantId: str = None
    bot_process_name: str = None
    Develper_mail: str = None

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



