"""Roles Controller"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import logging
from database.connection import get_db
from models.roles_model import RolesModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/roles", tags=["roles"])

class PermissionAssignment(BaseModel):
    permission_id: int
    add: bool = False
    view: bool = False
    update: bool = False
    delete: bool = False

class RoleRequest(BaseModel):
    role_name: str
    role_key: str
    permissions: Optional[List[PermissionAssignment]] = []

class RoleUpdateRequest(BaseModel):
    id: int
    role_name: str
    role_key: str
    permissions: Optional[List[PermissionAssignment]] = []

class DeleteRequest(BaseModel):
    id: int

@router.get("/list", response_model=dict)
async def get_roles_list(db: Session = Depends(get_db)):
    try:
        roles = RolesModel.get_roles_list(db)
        return {"status": 1, "data": roles}
    except Exception as e:
        logger.exception("Roles list error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/get", response_model=dict)
async def get_role(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        role = RolesModel.get_role_by_id(db, request.id)
        if role:
            permissions = RolesModel.get_role_permissions(db, request.id)
            role["permissions"] = permissions
            return {"status": 1, "data": role}
        else:
            raise HTTPException(status_code=404, detail="Role not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Role get error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/add", response_model=dict)
async def add_role(request: RoleRequest, db: Session = Depends(get_db)):
    try:
        permissions_list = [p.dict() for p in request.permissions] if request.permissions else []
        role_id = RolesModel.add_role(db, request.role_name, request.role_key, permissions_list)
        if role_id > 0:
            return {"status": 1, "message": "Successfully added.", "refresh": True, "modal_close": True}
        else:
            return {"status": 0, "message": "Failed to add role.", "refresh": False, "modal_close": False}
    except Exception as e:
        logger.exception("Role add error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/update", response_model=dict)
async def update_role(request: RoleUpdateRequest, db: Session = Depends(get_db)):
    try:
        permissions_list = [p.dict() for p in request.permissions] if request.permissions else []
        success = RolesModel.update_role(db, request.id, request.role_name, request.role_key, permissions_list)
        if success:
            return {"status": 1, "message": "Successfully updated.", "refresh": True, "modal_close": True}
        else:
            return {"status": 0, "message": "Failed to update role.", "refresh": False, "modal_close": False}
    except Exception as e:
        logger.exception("Role update error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/delete", response_model=dict)
async def delete_role(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        success = RolesModel.delete_role(db, request.id)
        if success:
            return {"status": "Success"}
        else:
            return {"status": "Error"}
    except Exception as e:
        logger.exception("Role delete error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")



