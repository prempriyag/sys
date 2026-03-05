"""Permissions Controller"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import logging
from database.connection import get_db
from models.permissions_model import PermissionsModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/permissions", tags=["permissions"])

class PermissionRequest(BaseModel):
    permission_name: str
    permission_key: str
    type: str  # 'parent' or parent ID

class PermissionUpdateRequest(BaseModel):
    id: int
    permission_name: str
    permission_key: str
    type: str

class DeleteRequest(BaseModel):
    id: int

@router.get("/tree", response_model=dict)
async def get_permissions_tree(db: Session = Depends(get_db)):
    try:
        tree = PermissionsModel.get_permissions_tree(db)
        return {"status": 1, "data": tree}
    except Exception as e:
        logger.exception("Permissions tree error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.get("/list", response_model=dict)
async def get_all_permissions(db: Session = Depends(get_db)):
    try:
        permissions = PermissionsModel.get_all_permissions(db)
        return {"status": 1, "data": permissions}
    except Exception as e:
        logger.exception("Permissions list error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/get", response_model=dict)
async def get_permission(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        permission = PermissionsModel.get_permission_by_id(db, request.id)
        if permission:
            return {"status": 1, "data": permission}
        else:
            raise HTTPException(status_code=404, detail="Permission not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Permission get error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/getpermission", response_model=dict)
async def get_permission_for_edit(request: DeleteRequest, db: Session = Depends(get_db)):
    """Returns permission data in CI3 format for editing"""
    try:
        permission = PermissionsModel.get_permission_by_id(db, request.id)
        if not permission:
            raise HTTPException(status_code=404, detail="Permission not found")
        
        # Get all parent permissions for dropdown
        all_permissions = PermissionsModel.get_all_permissions(db)
        parent_permissions = [p for p in all_permissions if p.get("TYPE") == "parent"]
        
        # Build option list HTML (matching CI3 format)
        per_list = '<option value="parent"> This is parent</option>'
        for per in parent_permissions:
            selected = 'selected=""' if str(per.get("ID")) == str(permission.get("TYPE")) else ''
            per_list += f'<option value="{per.get("ID")}" {selected}>{per.get("PERMISSION_NAME")}</option>'
        
        return {
            "id": permission.get("ID"),
            "per_list": per_list,
            "per_name": permission.get("PERMISSION_NAME", ""),
            "per_key": permission.get("PERMISSION_KEY", ""),
            "per_type": permission.get("TYPE", "parent")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Permission getpermission error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/add", response_model=dict)
async def add_permission(request: PermissionRequest, db: Session = Depends(get_db)):
    try:
        permission_id = PermissionsModel.add_permission(
            db, request.permission_name, request.permission_key, request.type
        )
        if permission_id > 0:
            return {"status": 1, "message": "Successfully added.", "refresh": True, "modal_close": True}
        else:
            return {"status": 0, "message": "Failed to add permission.", "refresh": False, "modal_close": False}
    except Exception as e:
        logger.exception("Permission add error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/update", response_model=dict)
async def update_permission(request: PermissionUpdateRequest, db: Session = Depends(get_db)):
    try:
        success = PermissionsModel.update_permission(
            db, request.id, request.permission_name, request.permission_key, request.type
        )
        if success:
            return {"status": 1, "message": "Successfully updated.", "refresh": True, "modal_close": True}
        else:
            return {"status": 0, "message": "Failed to update permission.", "refresh": False, "modal_close": False}
    except Exception as e:
        logger.exception("Permission update error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/update/{id}", response_model=dict)
async def update_permission_by_id(id: int, request: PermissionRequest, db: Session = Depends(get_db)):
    """Update permission by ID in URL path (matching CI3 format)"""
    try:
        success = PermissionsModel.update_permission(
            db, id, request.permission_name, request.permission_key, request.type
        )
        if success:
            return {"status": 1, "message": "Successfully updated.", "refresh": True, "modal_close": True}
        else:
            return {"status": 0, "message": "Failed to update permission.", "refresh": False, "modal_close": False}
    except Exception as e:
        logger.exception("Permission update error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/delete", response_model=dict)
async def delete_permission(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        success = PermissionsModel.delete_permission(db, request.id)
        if success:
            return {"status": "Success"}
        else:
            return {"status": "Error"}
    except Exception as e:
        logger.exception("Permission delete error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

