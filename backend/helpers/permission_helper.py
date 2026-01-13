"""
Permission helper functions
Based on permission_helper.php from CodeIgniter
"""
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_
from models import Role, User, Permission, RolePermission
from database.connection import get_db
from datetime import datetime
import json

# In-memory cache for permissions (in production, use Redis or similar)
_permissions_cache: Dict[int, Dict[str, Dict[str, int]]] = {}


def load_user_permissions(db: Session, role_id: int, user_email: Optional[str] = None) -> Dict[str, Dict[str, int]]:
    """
    Load user permissions from database and cache them
    Based on load_user_permissions() from permission_helper.php (lines 72-102)
    
    Returns a dictionary like:
    {
        'permission_key': {
            'ADD': 1,
            'VIEW': 1,
            'UPDATE': 0,
            'DELETE': 0
        }
    }
    """
    import time
    start_time = time.time()
    
    # Check cache first
    if role_id in _permissions_cache:
        print(f"[load_user_permissions] Using cached permissions for role_id: {role_id}")
        return _permissions_cache[role_id]
    
    print(f"[load_user_permissions] Loading permissions from database for role_id: {role_id}")
    
    try:
        # Fetch all permissions for the user's role
        query_start = time.time()
        permissions = db.query(
            Permission.PERMISSION_KEY,
            RolePermission.ADD,
            RolePermission.VIEW,
            RolePermission.UPDATE,
            RolePermission.DELETE
        ).join(
            RolePermission, RolePermission.PERMISSION_ID == Permission.ID
        ).filter(
            RolePermission.ROLE_ID == role_id
        ).all()
        print(f"[load_user_permissions] Query completed in {time.time() - query_start:.2f}s, found {len(permissions)} permissions")
        
        # Store permissions in an associative array for easy access
        perm_data = {}
        for perm in permissions:
            perm_data[perm.PERMISSION_KEY] = {
                'ADD': perm.ADD,
                'VIEW': perm.VIEW,
                'UPDATE': perm.UPDATE,
                'DELETE': perm.DELETE,
            }
        
        # Note: Removed last_login update from here - it's handled separately in login endpoint
        # This was causing potential issues with transaction management
        
        # Cache permissions
        _permissions_cache[role_id] = perm_data
        
        total_time = time.time() - start_time
        print(f"[load_user_permissions] Total time: {total_time:.2f}s")
        
        return perm_data
    except Exception as e:
        print(f"[load_user_permissions] ERROR: {type(e).__name__}: {str(e)}")
        import traceback
        print(f"[load_user_permissions] Traceback: {traceback.format_exc()}")
        # Return empty dict on error rather than failing
        return {}


def clear_permissions_cache(role_id: Optional[int] = None):
    """
    Clear permissions cache (useful when permissions are updated)
    """
    global _permissions_cache
    if role_id:
        _permissions_cache.pop(role_id, None)
    else:
        _permissions_cache.clear()


def check_permission(
    db: Session,
    per: str,
    action: str = 'VIEW',
    role_id: Optional[int] = None,
    user: Optional[User] = None,
    url: str = ''
) -> bool:
    """
    Check if user has permission for a specific action
    Based on checkpermission() from permission_helper.php (lines 104-119)
    
    Args:
        db: Database session
        per: Permission key (e.g., 'user_management')
        action: Action to check ('VIEW', 'ADD', 'UPDATE', 'DELETE')
        role_id: Role ID (optional, will use user.role_id if user provided)
        user: User object (optional)
        url: Current URL path (for page permission check)
    
    Returns:
        bool: True if user has permission, False otherwise
    """
    if not per:
        return False
    
    # Get role_id from user if not provided
    if not role_id and user:
        role_id = user.role_id
    
    if not role_id:
        return False
    
    # Load permissions
    permissions = load_user_permissions(db, role_id)
    
    # Debug logging
    print(f"[check_permission] Checking permission: {per}, action: {action}, role_id: {role_id}")
    print(f"[check_permission] Permission exists: {per in permissions}")
    if per in permissions:
        print(f"[check_permission] Permission data: {permissions[per]}")
    
    # Check page permission (usermainpermission)
    page_perm = user_main_permission(user, url) if user else False
    print(f"[check_permission] Page permission (user_main_permission): {page_perm}, url: {url}")
    if user:
        print(f"[check_permission] User perms - college: {user.college_perm}, hs: {user.hs_perm}, ocr: {user.ocr_perm}")
    
    # Check specific permission
    action_upper = action.upper()
    if per in permissions and action_upper in permissions[per]:
        # Handle both integer and string values (database returns int, JSON might serialize as string)
        perm_value = permissions[per][action_upper]
        is_allowed = perm_value == 1 or str(perm_value) == "1"
        print(f"[check_permission] Permission value: {perm_value} (type: {type(perm_value)}), is_allowed: {is_allowed}")
        result = is_allowed and page_perm
        print(f"[check_permission] Final result: {result} (is_allowed={is_allowed}, page_perm={page_perm})")
        return result
    
    print(f"[check_permission] Permission check failed - permission not found or action not found")
    return False


def check_all_permission(
    db: Session,
    per: List[str],
    action: str = 'VIEW',
    role_id: Optional[int] = None,
    user: Optional[User] = None
) -> bool:
    """
    Check if user has any of the permissions in the list
    Based on checkallpermission() from permission_helper.php (lines 120-137)
    
    Args:
        db: Database session
        per: List of permission keys
        action: Action to check ('VIEW', 'ADD', 'UPDATE', 'DELETE')
        role_id: Role ID (optional, will use user.role_id if user provided)
        user: User object (optional)
    
    Returns:
        bool: True if user has any of the permissions, False otherwise
    """
    if not isinstance(per, list) or len(per) == 0:
        return False
    
    # Get role_id from user if not provided
    if not role_id and user:
        role_id = user.role_id
    
    if not role_id:
        return False
    
    # Load permissions
    permissions = load_user_permissions(db, role_id)
    
    action_upper = action.upper()
    for permission in per:
        if permission in permissions and action_upper in permissions[permission]:
            # Handle both integer and string values (database returns int, JSON might serialize as string)
            perm_value = permissions[permission][action_upper]
            if perm_value == 1 or str(perm_value) == "1":
                return True
    
    return False


def check_role_permission(
    db: Session,
    role_id: int,
    permission_id: int,
    action: str = 'view'
) -> bool:
    """
    Check role permission directly
    Based on checkrolepermission() from permission_helper.php (lines 139-151)
    
    Args:
        db: Database session
        role_id: Role ID
        permission_id: Permission ID
        action: Action to check ('view', 'add', 'update', 'delete')
    
    Returns:
        bool: True if role has permission, False otherwise
    """
    action_upper = action.upper()
    result = db.query(RolePermission).filter(
        and_(
            RolePermission.ROLE_ID == role_id,
            RolePermission.PERMISSION_ID == permission_id,
            getattr(RolePermission, action_upper) == 1
        )
    ).first()
    
    return result is not None


def user_main_permission(user: Optional[User] = None, url: str = '') -> bool:
    """
    Check user main permission based on URL and user permissions
    Based on usermainpermission() from permission_helper.php (lines 153-176)
    
    Args:
        user: User object
        url: Current URL path
    
    Returns:
        bool: True if user has access to the page type, False otherwise
    """
    if not user:
        print(f"[user_main_permission] No user provided")
        return False
    
    # Determine type based on URL
    if 'school' in url.lower():
        perm_type = 'school'
    elif 'ocrverify' in url.lower():
        perm_type = 'ocrverify'
    else:
        perm_type = 'college'  # Default to college for /api/users, /api/college, etc.
    
    print(f"[user_main_permission] URL: {url}, perm_type: {perm_type}")
    print(f"[user_main_permission] User perms - college: {user.college_perm} (type: {type(user.college_perm)}), hs: {user.hs_perm}, ocr: {user.ocr_perm}")
    
    # Check for ajaxlist exception
    if (user.ocr_perm == 1 or str(user.ocr_perm) == "1") and 'ajaxlist' in url.lower():
        print(f"[user_main_permission] ajaxlist exception triggered")
        return True
    
    # Check permissions based on type
    # Handle both integer and string values
    college_ok = (user.college_perm == 1 or str(user.college_perm) == "1") and perm_type == 'college'
    hs_ok = (user.hs_perm == 1 or str(user.hs_perm) == "1") and perm_type == 'school'
    ocr_ok = (user.ocr_perm == 1 or str(user.ocr_perm) == "1") and perm_type == 'ocrverify'
    
    result = college_ok or hs_ok or ocr_ok
    print(f"[user_main_permission] Result: {result} (college_ok={college_ok}, hs_ok={hs_ok}, ocr_ok={ocr_ok})")
    
    return result


def roletype(db: Session, type_val: str = 'name', role_id: Optional[int] = None) -> Optional[str]:
    """
    Get role name or key based on role_id
    Based on roletype() from permission_helper.php (lines 6-21)
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


def get_user_clients(db: Session, user_id: int, getsingle: bool = False):
    """
    Get user clients
    Based on getuserclients() from permission_helper.php (lines 22-35)
    """
    # Note: This would need a UserClients model if the table exists
    # For now, returning empty list
    # query = db.query(UserClients).filter(UserClients.USER_ID == user_id).all()
    # if getsingle:
    #     return query[0].CLIENT_ID if query else None
    # return [q.CLIENT_ID for q in query]
    return []


def logged_in_user(db: Session, role: str, current_user: Optional[User] = None) -> bool:
    """
    Check if logged in user has specific role
    Based on LoggedInUser() from common_helper.php
    """
    if not current_user:
        return False
    
    user_role = roletype(db, 'key', current_user.role_id)
    if user_role and user_role.lower() == role.lower():
        return True
    
    return False
