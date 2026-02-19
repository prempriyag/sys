"""
Users controller
Permission removed - Only login required
"""
import logging
import time
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc
from database.connection import get_db
from models import User, Role
from schemas.auth import MessageResponse
from helpers.security_helper import get_current_user
from helpers.auth_helper import hash_password, password_form_validation
from helpers.common_helper import generate_rand_number
from helpers.db_helper import roletype as get_roletype
from helpers.email_helper import send_user_registration_email
from helpers.encryption_helper import encrypt as encrypt_string
from config.settings import settings
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/users", tags=["Users"])


# =========================
# SCHEMAS
# =========================

class UserCreate(BaseModel):
    name: str = Field(..., min_length=1)
    email: EmailStr
    role_id: int
    college_perm: Optional[int] = 0
    hs_perm: Optional[int] = 0
    ocr_perm: Optional[int] = 0
    status: Optional[int] = 1


class UserUpdate(BaseModel):
    name: str = Field(..., min_length=1)
    role_id: int
    college_perm: Optional[int] = 0
    hs_perm: Optional[int] = 0
    ocr_perm: Optional[int] = 0
    status: Optional[int] = 1


class UserListRequest(BaseModel):
    draw: int
    start: int
    length: int
    order: List[dict] = []
    columns: List[dict] = []
    search: dict = {"value": "", "regex": False}


class ResetPasswordRequest(BaseModel):
    npassword: str = Field(..., min_length=8, max_length=15)
    cpassword: str = Field(..., min_length=8, max_length=15)


# =========================
# GET USERS PAGE DATA
# =========================

@router.get("/", response_model=dict)
async def index(
    type: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    roles = db.query(Role).all()

    return {
        "roles": [{"ID": r.ID, "ROLE_NAME": r.ROLE_NAME, "ROLE_KEY": r.ROLE_KEY} for r in roles],
        "type": type or ""
    }


# =========================
# USER LIST (DATATABLE)
# =========================

@router.post("/ajaxlist", response_model=dict)
async def ajaxlist(
    request: UserListRequest,
    type: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(User, Role).join(Role, User.role_id == Role.ID)

    if type:
        query = query.filter(func.lower(Role.ROLE_KEY) == type.lower())

    total_records = query.count()
    query = query.offset(request.start).limit(request.length)
    records = query.all()

    data = []

    for user, role in records:
        permission = []
        if user.college_perm == 1:
            permission.append('College')
        if user.hs_perm == 1:
            permission.append('High School')
        if user.ocr_perm == 1:
            permission.append('OCR Portal')

        data.append({
            "name": user.name,
            "email": user.email,
            "ROLE_NAME": role.ROLE_NAME,
            "permission": ', '.join(permission),
            "status": user.status,
            "created_at": user.created_at.strftime('%Y-%m-%d %H:%M:%S') if user.created_at else '',
        })

    return {
        "draw": request.draw,
        "recordsTotal": total_records,
        "recordsFiltered": total_records,
        "data": data
    }


# =========================
# INSERT USER
# =========================

@router.post("/insert", response_model=MessageResponse)
async def insert(
    user_data: UserCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    existing_user = db.query(User).filter(
        func.lower(User.email) == user_data.email.lower()
    ).first()

    if existing_user:
        raise HTTPException(status_code=400, detail="Email already exists")

    password = generate_rand_number(8)
    hashed_password = hash_password(password)

    new_user = User(
        name=user_data.name.strip(),
        email=user_data.email.lower().strip(),
        password=hashed_password,
        role_id=user_data.role_id,
        college_perm=user_data.college_perm,
        hs_perm=user_data.hs_perm,
        ocr_perm=user_data.ocr_perm,
        status=user_data.status,
        created_at=datetime.now(),
        created_by=current_user.name,
        updated_at=datetime.now(),
        updated_by=current_user.name
    )

    db.add(new_user)
    db.commit()

    try:
        encoded_token = encrypt_string(f"{user_data.email}/{int(time.time())}")
        reset_link = f"{settings.FRONTEND_URL}/reset-password?token={encoded_token}"

        send_user_registration_email(
            db=db,
            email=user_data.email,
            name=user_data.name,
            reset_link=reset_link
        )
    except Exception as e:
        logger.exception("Email send error")

    return MessageResponse(message="Successfully added", success=True)


# =========================
# EDIT USER
# =========================

@router.get("/edit/{user_id}", response_model=dict)
async def edit(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role_id": user.role_id,
        "college_perm": user.college_perm,
        "hs_perm": user.hs_perm,
        "ocr_perm": user.ocr_perm,
        "status": user.status,
    }


# =========================
# UPDATE USER
# =========================

@router.put("/update/{user_id}", response_model=MessageResponse)
async def update(
    user_id: int,
    user_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.name = user_data.name.strip()
    user.role_id = user_data.role_id
    user.college_perm = user_data.college_perm
    user.hs_perm = user_data.hs_perm
    user.ocr_perm = user_data.ocr_perm
    user.status = user_data.status
    user.updated_at = datetime.now()
    user.updated_by = current_user.name

    db.commit()

    return MessageResponse(message="Successfully updated", success=True)


# =========================
# DELETE USER
# =========================

@router.delete("/delete/{user_id}", response_model=MessageResponse)
async def delete(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()

    return MessageResponse(message="Successfully deleted", success=True)


# =========================
# RESET PASSWORD
# =========================

@router.post("/resetpassword/{user_id}", response_model=MessageResponse)
async def resetpassword(
    user_id: int,
    password_data: ResetPasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if password_data.npassword != password_data.cpassword:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    if not password_form_validation(password_data.npassword):
        raise HTTPException(status_code=400, detail="Invalid password format")

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password = hash_password(password_data.npassword)
    db.commit()

    return MessageResponse(message="Successfully updated", success=True)
