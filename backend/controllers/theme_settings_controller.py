"""
Settings controller for theme and UI settings
Stores settings in BUSINESS_SETTINGS table
"""
from typing import Dict, Optional, List, Any
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from database.connection import get_db
from models import BusinessSettings
from helpers.security_helper import get_current_user
from helpers.db_helper import get_setting
from pydantic import BaseModel
import os
import shutil
from pathlib import Path
import traceback

router = APIRouter(prefix="/api/theme-settings", tags=["Theme Settings"])


class SettingsResponse(BaseModel):
    """Settings response model"""
    primaryColor: str
    logoUrl: Optional[str] = None
    logoIconUrl: Optional[str] = None
    logoLightUrl: Optional[str] = None
    logoDarkUrl: Optional[str] = None
    headerBgColor: str
    headerTextColor: str
    sidebarBgColor: str
    sidebarTextColor: str


class SettingsUpdate(BaseModel):
    """Settings update model"""
    primaryColor: Optional[str] = None
    logoUrl: Optional[str] = None
    logoIconUrl: Optional[str] = None
    logoLightUrl: Optional[str] = None
    logoDarkUrl: Optional[str] = None
    headerBgColor: Optional[str] = None
    headerTextColor: Optional[str] = None
    sidebarBgColor: Optional[str] = None
    sidebarTextColor: Optional[str] = None


def update_setting(db: Session, key: str, value: str):
    """Update or create a setting in BUSINESS_SETTINGS"""
    setting = db.query(BusinessSettings).filter(BusinessSettings.KEYCODE == key).first()
    if setting:
        setting.KEYVALUE = value
    else:
        setting = BusinessSettings(KEYCODE=key, KEYVALUE=value)
        db.add(setting)
    db.commit()
    db.refresh(setting)
    return setting


@router.get("", response_model=SettingsResponse)
async def get_settings(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all theme settings from BUSINESS_SETTINGS table
    """
    # Default values
    defaults = {
        "primaryColor": "#465fff",
        "logoUrl": "/images/logo/logo.svg",
        "logoIconUrl": "/images/logo/logo-icon.svg",
        "logoLightUrl": "/images/logo/connors-color.png",
        "logoDarkUrl": "/images/logo/connors-white.png",
        "headerBgColor": "#ffffff",
        "headerTextColor": "#1d2939",
        "sidebarBgColor": "#ffffff",
        "sidebarTextColor": "#1d2939",
    }
    
    # Get settings from database
    settings = {}
    for key in defaults.keys():
        value = get_setting(db, f"theme_{key}")
        settings[key] = value if value is not None else defaults[key]
    
    return SettingsResponse(**settings)


@router.put("")
async def update_settings(
    settings: SettingsUpdate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update theme settings in BUSINESS_SETTINGS table
    """
    try:
        updated = []
        
        # Update each setting that was provided
        if settings.primaryColor is not None:
            update_setting(db, "theme_primaryColor", settings.primaryColor)
            updated.append("primaryColor")
        
        if settings.logoUrl is not None:
            update_setting(db, "theme_logoUrl", settings.logoUrl)
            updated.append("logoUrl")
        
        if settings.logoIconUrl is not None:
            update_setting(db, "theme_logoIconUrl", settings.logoIconUrl)
            updated.append("logoIconUrl")
        
        if settings.logoLightUrl is not None:
            update_setting(db, "theme_logoLightUrl", settings.logoLightUrl)
            updated.append("logoLightUrl")
        
        if settings.logoDarkUrl is not None:
            update_setting(db, "theme_logoDarkUrl", settings.logoDarkUrl)
            updated.append("logoDarkUrl")
        
        if settings.headerBgColor is not None:
            update_setting(db, "theme_headerBgColor", settings.headerBgColor)
            updated.append("headerBgColor")
        
        if settings.headerTextColor is not None:
            update_setting(db, "theme_headerTextColor", settings.headerTextColor)
            updated.append("headerTextColor")
        
        if settings.sidebarBgColor is not None:
            update_setting(db, "theme_sidebarBgColor", settings.sidebarBgColor)
            updated.append("sidebarBgColor")
        
        if settings.sidebarTextColor is not None:
            update_setting(db, "theme_sidebarTextColor", settings.sidebarTextColor)
            updated.append("sidebarTextColor")
        
        return {
            "message": "Settings updated successfully",
            "updated": updated
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating settings: {str(e)}"
        )


@router.post("/upload-logo")
async def upload_logo(
    logo: UploadFile = File(...),
    type: str = Form(...),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload logo file and save path to BUSINESS_SETTINGS
    """
    # Validate file type
    if not logo.content_type or not logo.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image"
        )
    
    # Validate file size (max 5MB)
    file_size = 0
    content = await logo.read()
    file_size = len(content)
    if file_size > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size must be less than 5MB"
        )
    
    # Save file to public/images/logo directory
    upload_dir = Path("frontend/public/images/logo")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate filename
    file_extension = Path(logo.filename).suffix if logo.filename else ".png"
    filename = f"logo_{type}{file_extension}"
    file_path = upload_dir / filename
    
    # Write file
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Save path to database
    logo_url = f"/images/logo/{filename}"
    update_setting(db, f"theme_logo{type.capitalize()}Url", logo_url)
    
    return {
        "message": "Logo uploaded successfully",
        "logoUrl": logo_url
    }
