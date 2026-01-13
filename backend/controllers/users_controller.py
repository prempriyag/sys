"""
Users controller
Based on Users.php controller from CodeIgniter
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc
from database.connection import get_db
from models import User, Role
from schemas.auth import MessageResponse, UserResponse
from helpers.security_helper import get_current_user
from helpers.auth_helper import hash_password, password_form_validation
from helpers.common_helper import generate_rand_number, upr2lwr
from helpers.permission_helper import check_permission, logged_in_user, roletype, user_main_permission
from helpers.db_helper import get_setting, roletype as get_roletype
from helpers.permission_dependency import require_permission
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime

router = APIRouter(prefix="/api/users", tags=["Users"])


class UserCreate(BaseModel):
    """User create schema"""
    name: str = Field(..., min_length=1)
    email: EmailStr
    role_id: int
    college_perm: Optional[int] = 0
    hs_perm: Optional[int] = 0
    ocr_perm: Optional[int] = 0
    status: Optional[int] = 1


class UserUpdate(BaseModel):
    """User update schema"""
    name: str = Field(..., min_length=1)
    role_id: int
    college_perm: Optional[int] = 0
    hs_perm: Optional[int] = 0
    ocr_perm: Optional[int] = 0
    status: Optional[int] = 1


class UserListRequest(BaseModel):
    """User list request (DataTables format)"""
    draw: int
    start: int
    length: int
    order: List[dict] = []
    columns: List[dict] = []
    search: dict = {"value": "", "regex": False}


class ResetPasswordRequest(BaseModel):
    """Reset password request"""
    npassword: str = Field(..., min_length=8, max_length=15)
    cpassword: str = Field(..., min_length=8, max_length=15)


@router.get("/", response_model=dict)
async def index(
    type: Optional[str] = Query(None, alias="type"),
    current_user: User = Depends(require_permission('user_management', 'VIEW')),
    db: Session = Depends(get_db)
):
    """
    Get users list page data
    Based on index() method from Users.php
    """
    
    # Get roles based on user role
    if logged_in_user(db, 'super_admin', current_user):
        roles = db.query(Role).all()
    else:
        roles = db.query(Role).filter(Role.ROLE_KEY != 'super_admin').all()
    
    return {
        "roles": [{"ID": r.ID, "ROLE_NAME": r.ROLE_NAME, "ROLE_KEY": r.ROLE_KEY} for r in roles],
        "type": type or ""
    }


@router.post("/ajaxlist", response_model=dict)
async def ajaxlist(
    request: UserListRequest,
    type: Optional[str] = Query(None),
    current_user: User = Depends(require_permission('user_management', 'VIEW')),
    db: Session = Depends(get_db)
):
    """
    Get users list (DataTables)
    Based on ajaxlist() method from Users.php
    """
    draw = request.draw
    start = request.start
    rowperpage = request.length
    column_index = request.order[0]['column'] if request.order else 0
    column_name = request.columns[column_index]['data'] if request.columns else 'id'
    column_sort_order = request.order[0]['dir'] if request.order else 'asc'
    search_value = request.search.get('value', '')
    
    # Build query
    query = db.query(User, Role).join(Role, User.role_id == Role.ID)
    
    # Default filter - exclude verifiers role
    query = query.filter(func.lower(Role.ROLE_KEY) != 'verifiers')
    
    # Column-specific search filters
    has_column_search = False
    if request.columns:
        for col_idx, col in enumerate(request.columns):
            col_search_value = col.get('search', {}).get('value', '').strip()
            if col_search_value:
                has_column_search = True
                col_data = col.get('data', '')
                # Map column data names to database fields
                if col_data == 'name':
                    query = query.filter(func.lower(User.name).contains(col_search_value.lower()))
                elif col_data == 'email':
                    query = query.filter(func.lower(User.email).contains(col_search_value.lower()))
                elif col_data == 'ROLE_NAME':
                    query = query.filter(func.lower(Role.ROLE_NAME).contains(col_search_value.lower()))
                elif col_data == 'permission':
                    # Search in permission: check if search value matches permission keywords
                    search_lower = col_search_value.lower()
                    permission_filters = []
                    if 'college' in search_lower:
                        permission_filters.append(User.college_perm == 1)
                    if 'high school' in search_lower or 'school' in search_lower:
                        permission_filters.append(User.hs_perm == 1)
                    if 'ocr' in search_lower:
                        permission_filters.append(User.ocr_perm == 1)
                    if permission_filters:
                        query = query.filter(or_(*permission_filters))
                elif col_data == 'created_by':
                    query = query.filter(func.lower(User.created_by).contains(col_search_value.lower()))
                elif col_data == 'updated_by':
                    query = query.filter(func.lower(User.updated_by).contains(col_search_value.lower()))
                elif col_data == 'created_at':
                    # Date search - try to match date patterns
                    query = query.filter(func.cast(User.created_at, db.String).contains(col_search_value))
                elif col_data == 'updated_at':
                    query = query.filter(func.cast(User.updated_at, db.String).contains(col_search_value))
                elif col_data == 'last_login':
                    query = query.filter(func.cast(User.last_login, db.String).contains(col_search_value))
    
    # Global search filter (only applies if no column-specific search)
    if search_value and not has_column_search:
        search_filter = or_(
            func.lower(User.name).contains(search_value.lower()),
            func.lower(User.email).contains(search_value.lower()),
            func.lower(User.created_by).contains(search_value.lower()),
            func.lower(User.updated_by).contains(search_value.lower()),
            func.lower(Role.ROLE_KEY).contains(search_value.lower()),
            func.lower(Role.ROLE_NAME).contains(search_value.lower())
        )
        query = query.filter(search_filter)
    
    # Type filter
    if type:
        query = query.filter(func.lower(Role.ROLE_KEY) == type.lower())
    
    # Get total count
    total_records = query.count()
    
    # Order by
    if hasattr(User, column_name):
        order_column = getattr(User, column_name)
        if column_sort_order == 'desc':
            query = query.order_by(desc(order_column))
        else:
            query = query.order_by(order_column)
    
    # Pagination
    query = query.offset(start).limit(rowperpage)
    records = query.all()
    
    # Format response
    data = []
    for user, role in records:
        # Build permission string
        permission = []
        if user.college_perm == 1:
            permission.append('College')
        if user.hs_perm == 1:
            permission.append('High School')
        if user.ocr_perm == 1:
            permission.append('OCR Portal')
        permission_str = ', '.join(permission) if permission else ''
        
        # Status badge
        if user.status == 0:
            status_html = f'<a href="javascript:void(0)" class="badge badge-light-warning statusid" id="{user.id}" data-val="1" title="Make Active">Inactive</a>'
        elif user.status == 2:
            status_html = f'<a href="javascript:void(0)" class="badge badge-light-warning statusid" id="{user.id}" title="Make Active" data-val="1">Blocked</a>'
        else:
            status_html = f'<a href="javascript:void(0)" class="badge badge-light-success statusid" id="{user.id}" title="Make Inactive" data-val="0">Active</a>'
        
        # Actions (simplified - would need permission checks)
        action = f'<a href="" onclick="getUserValue({user.id})" class="fa-duotone fa-pen-to-square" data-bs-toggle="modal" data-bs-target="#Edituser"></a>'
        action += f'<a href="javascript:void(0)" class="fa-duotone fa-trash-can ml-3 deleteid" id="{user.id}" title="Delete"></a>'
        
        # Reset password link
        reset_password = f'<a href="#" onclick="getUsername({user.id})" data-bs-toggle="modal" data-bs-target="#resetpassword" data-username="{user.name}">Reset Password</a>'
        
        data.append({
            "name": user.name,
            "email": user.email,
            "ROLE_NAME": role.ROLE_NAME,
            "permission": permission_str,
            "password": reset_password,
            "status": status_html,
            "created_by": user.created_by or '',
            "created_at": user.created_at.strftime('%Y-%m-%d %H:%M:%S') if user.created_at else '',
            "last_login": user.last_login.strftime('%Y-%m-%d %H:%M:%S') if user.last_login else '',
            "updated_by": user.updated_by or '',
            "updated_at": user.updated_at.strftime('%Y-%m-%d %H:%M:%S') if user.updated_at else '',
            "actions": action
        })
    
    return {
        "draw": draw,
        "recordsTotal": total_records,
        "recordsFiltered": total_records,
        "iTotalRecords": total_records,  # Keep for backward compatibility
        "iTotalDisplayRecords": total_records,  # Keep for backward compatibility
        "aaData": data,
        "data": data  # Also provide in 'data' format
    }


@router.post("/insert", response_model=MessageResponse)
async def insert(
    user_data: UserCreate,
    current_user: User = Depends(require_permission('user_management', 'ADD')),
    db: Session = Depends(get_db)
):
    """
    Create new user
    Based on insert() method from Users.php
    """
    
    # Validate permissions
    if not user_data.college_perm and not user_data.hs_perm and not user_data.ocr_perm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please Select at least one Permission"
        )
    
    # Check if email exists
    existing_user = db.query(User).filter(func.lower(User.email) == user_data.email.lower()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The email address is already taken."
        )
    
    # Generate password
    password = generate_rand_number(8)
    hashed_password = hash_password(password)
    
    # Get role key
    role_key = get_roletype(db, 'key', user_data.role_id)
    
    # Create user
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
    db.refresh(new_user)
    
    # TODO: Send email with password
    # sendmail(user_data.email, get_setting(db, 'system_name') + ' User Registration Email', message)
    
    return MessageResponse(
        message="Successfully added",
        success=True
    )


@router.get("/edit/{user_id}", response_model=dict)
async def edit(
    user_id: int,
    current_user: User = Depends(require_permission('user_management', 'UPDATE')),
    db: Session = Depends(get_db)
):
    """
    Get user details for editing
    Based on edit() method from Users.php
    """
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    role = db.query(Role).filter(Role.ID == user.role_id).first()
    roles = db.query(Role).all()
    
    # Build role list HTML
    role_list = '<option value="">Select Role</option>'
    for r in roles:
        selected = 'selected=""' if user.role_id == r.ID else ''
        role_list += f'<option {selected} value="{r.ID}">{r.ROLE_NAME}</option>'
    
    return {
        'userid': user.id,
        'name': user.name,
        'college_perm': user.college_perm,
        'hs_perm': user.hs_perm,
        'ocr_perm': user.ocr_perm,
        'roles': role_list,
        'client': ''  # Would need client mapping
    }


@router.put("/update/{user_id}", response_model=MessageResponse)
async def update(
    user_id: int,
    user_data: UserUpdate,
    current_user: User = Depends(require_permission('user_management', 'UPDATE')),
    db: Session = Depends(get_db)
):
    """
    Update user
    Based on update() method from Users.php
    """
    
    # Validate permissions
    if not user_data.college_perm and not user_data.hs_perm and not user_data.ocr_perm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please Select at least one Permission"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get role key
    role_key = get_roletype(db, 'key', user_data.role_id)
    
    # Update user
    user.name = user_data.name.strip()
    user.role_id = user_data.role_id
    user.college_perm = user_data.college_perm
    user.hs_perm = user_data.hs_perm
    user.ocr_perm = user_data.ocr_perm
    user.status = user_data.status
    user.updated_at = datetime.now()
    user.updated_by = current_user.name
    
    db.commit()
    
    return MessageResponse(
        message="Successfully updated",
        success=True
    )


@router.delete("/delete/{user_id}", response_model=MessageResponse)
async def delete(
    user_id: int,
    current_user: User = Depends(require_permission('user_management', 'DELETE')),
    db: Session = Depends(get_db)
):
    """
    Delete user
    Based on delete() method from Users.php
    """
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    db.delete(user)
    db.commit()
    
    return MessageResponse(
        message="Successfully deleted",
        success=True
    )


@router.post("/updateStatus/{user_id}", response_model=MessageResponse)
async def update_status(
    user_id: int,
    status_val: int = Query(..., alias="dvalue"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update user status
    Based on updateStatus() method from Users.php
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user.status = status_val
    db.commit()
    
    return MessageResponse(
        message="Successfully updated",
        success=True
    )


@router.post("/resetpassword/{user_id}", response_model=MessageResponse)
async def resetpassword(
    user_id: int,
    password_data: ResetPasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reset user password
    Based on resetpassword() method from Users.php
    """
    # Validate passwords match
    if password_data.npassword != password_data.cpassword:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match"
        )
    
    # Validate password format
    if not password_form_validation(password_data.npassword):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please follow the password format."
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update password
    user.password = hash_password(password_data.npassword)
    db.commit()
    
    return MessageResponse(
        message="Successfully updated",
        success=True
    )

