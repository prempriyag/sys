"""
Database helper functions
"""
from typing import Optional, Union, List, Dict
from sqlalchemy.orm import Session
from models import User, BusinessSettings, Role
from config.constants import TBL_BUSINESS, TBL_ROLES


def get_setting(db: Session, key: str = '') -> Optional[Union[str, List[Dict]]]:
    """
    Get setting value from BUSINESS_SETTINGS table
    Based on getSetting() from common_helper.php
    """
    if key != '':
        setting = db.query(BusinessSettings).filter(BusinessSettings.KEYCODE == key).first()
        if setting:
            return setting.KEYVALUE
        return None
    else:
        # Return all settings
        settings = db.query(BusinessSettings).all()
        return [{"KEYCODE": s.KEYCODE, "KEYVALUE": s.KEYVALUE} for s in settings]


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """
    Get user by email (case-insensitive)
    """
    return db.query(User).filter(
        User.email.ilike(email),
        User.status == 1
    ).first()


def update_last_login(db: Session, user_id: int):
    """
    Update user's last login timestamp
    """
    from datetime import datetime
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.last_login = datetime.utcnow()
        db.commit()


def roletype(db: Session, type_val: str = 'name', role_id: int = None) -> Optional[str]:
    """
    Get role name or key based on role_id
    Based on roletype() from permission_helper.php
    """
    if role_id is None:
        return None
    
    role = db.query(Role).filter(Role.ID == role_id).first()
    if not role:
        return None
    
    if type_val == 'name':
        return role.ROLE_NAME
    elif type_val == 'key':
        return role.ROLE_KEY
    return None

