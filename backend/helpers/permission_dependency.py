"""
FastAPI dependencies for permission checking
"""
from typing import Optional
from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from database.connection import get_db
from models import User
from helpers.security_helper import get_current_user
from helpers.permission_helper import check_permission, user_main_permission


def require_permission(permission: str, action: str = 'VIEW'):
    """
    FastAPI dependency factory for permission checking
    Usage: @router.get("/endpoint", dependencies=[Depends(require_permission('user_management', 'VIEW'))])
    """
    async def permission_checker(
        request: Request,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ):
        # Get URL from request
        url = str(request.url.path)
        
        # Check permission
        has_permission = check_permission(
            db=db,
            per=permission,
            action=action,
            user=current_user,
            url=url
        )
        
        if not has_permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You don't have permission to {action.lower()} {permission}"
            )
        
        return current_user
    
    return permission_checker


def require_any_permission(permissions: list, action: str = 'VIEW'):
    """
    FastAPI dependency factory for checking any of multiple permissions
    """
    async def permission_checker(
        request: Request,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ):
        from helpers.permission_helper import check_all_permission
        
        url = str(request.url.path)
        
        # Check if user has any of the permissions
        has_permission = check_all_permission(
            db=db,
            per=permissions,
            action=action,
            user=current_user
        )
        
        # Also check page permission
        page_perm = user_main_permission(current_user, url)
        
        if not has_permission or not page_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You don't have permission to {action.lower()} this resource"
            )
        
        return current_user
    
    return permission_checker



