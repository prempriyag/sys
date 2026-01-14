/**
 * Permission checking utilities
 * Based on permission_helper.php from CI3
 */

import { useAuth } from "../context/AuthContext";

/**
 * Check if user has a specific permission for an action
 * Similar to checkpermission() in PHP (lines 104-119)
 * 
 * @param user - User object from AuthContext
 * @param permission - Permission key (e.g., 'user_management')
 * @param action - Action to check ('VIEW', 'ADD', 'UPDATE', 'DELETE'), defaults to 'VIEW'
 * @returns boolean - True if user has permission, False otherwise
 */
export const checkPermission = (user: any, permission: string, action: string = "VIEW", currentModule?: string): boolean => {
  if (!user || !permission) {
    return false;
  }

  // Get permissions from user object or localStorage
  // API returns permissions as strings ("0", "1"), so we accept both number and string
  let userPermissions: { [key: string]: { [key: string]: number | string } } | null = null;
  if (user.permissions) {
    userPermissions = user.permissions;
  } else {
    // Try to get from localStorage (similar to PHP session)
    const storedPermissions = localStorage.getItem("user_permissions");
    if (storedPermissions) {
      try {
        userPermissions = JSON.parse(storedPermissions);
      } catch (error) {
        return false;
      }
    }
  }

  if (!userPermissions) {
    return false;
  }

  const actionUpper = action.toUpperCase();
  
  // Check if permission exists
  if (!userPermissions[permission]) {
    return false;
  }

  // Check if action is allowed
  if (userPermissions[permission][actionUpper] === undefined) {
    return false;
  }

  // Check if action is enabled (value is 1 or '1')
  // PHP compares to string '1', so we check both number and string
  const actionValue = userPermissions[permission][actionUpper];
  const isAllowed = actionValue === 1 || String(actionValue) === '1';
  
  // Also check page permission (usermainpermission equivalent)
  // PHP checkpermission() checks both permission AND usermainpermission()
  const pagePerm = userMainPermission(user, currentModule);
  
  const result = isAllowed && pagePerm;
  return result;
};

/**
 * Check if user has any of the specified permissions
 * Similar to checkallpermission() in PHP (lines 120-137)
 * 
 * @param user - User object from AuthContext
 * @param permissions - Array of permission keys
 * @param action - Action to check ('VIEW', 'ADD', 'UPDATE', 'DELETE'), defaults to 'VIEW'
 * @returns boolean - True if user has any of the permissions, False otherwise
 */
export const checkAnyPermission = (
  user: any,
  permissions: string[],
  action: string = "VIEW"
): boolean => {
  if (!user || !Array.isArray(permissions) || permissions.length === 0) {
    return false;
  }

  // Get permissions from user object or localStorage
  let userPermissions: { [key: string]: { [key: string]: number | string } } | null = null;
  
  if (user.permissions) {
    userPermissions = user.permissions;
  } else {
    const storedPermissions = localStorage.getItem("user_permissions");
    if (storedPermissions) {
      try {
        userPermissions = JSON.parse(storedPermissions);
      } catch (error) {
        return false;
      }
    }
  }

  if (!userPermissions) {
    return false;
  }

  const actionUpper = action.toUpperCase();
  
  // Check if any permission in the list is allowed
  // PHP checkallpermission() does NOT check usermainpermission() - it only checks permissions
  // It compares to string '1' (PHP loose comparison), so we check for both 1 and '1'
  const result = permissions.some((permission) => {
    if (userPermissions![permission] && userPermissions![permission][actionUpper] !== undefined) {
      const actionValue = userPermissions![permission][actionUpper];
      // Check if value is 1 (number) or '1' (string) - matching PHP behavior
      const isAllowed = actionValue === 1 || String(actionValue) === '1';
      if (isAllowed) {
        return true;
      }
    }
    return false;
  });
  
  return result;
};

/**
 * Check user main permission based on module access
 * Similar to usermainpermission() in PHP (lines 153-176)
 * 
 * @param user - User object from AuthContext
 * @param url - Current URL path (optional, for module detection)
 * @returns boolean - True if user has access to the module, False otherwise
 */
export const userMainPermission = (user: any, currentModule: string = 'college'): boolean => {
  if (!user) {
    return false;
  }

  // PHP usermainpermission() checks the URL segment to determine module type
  // For sidebar, we use the current module from context
  // Default to 'college' if not specified (matching PHP behavior)
  const moduleType = currentModule || 'college';
  
  // PHP checks: (college_perm == 1 && type == 'college') || (hs_perm == 1 && type == 'school') || (ocr_perm == 1 && type == 'ocrverify')
  // Also has special case for ajaxlist requests with ocr_perm
  let hasAccess = false;
  
  if (moduleType === 'college' && (user.college_perm === 1 || user.college_perm === '1')) {
    hasAccess = true;
  } else if (moduleType === 'school' && (user.hs_perm === 1 || user.hs_perm === '1')) {
    hasAccess = true;
  } else if (moduleType === 'ocrverify' && (user.ocr_perm === 1 || user.ocr_perm === '1')) {
    hasAccess = true;
  }
  
  return hasAccess;
};

/**
 * React hook to check permissions
 * Provides convenient access to permission checking functions
 */
export const usePermissions = () => {
  const { user, hasPermission, hasAnyPermission } = useAuth();

  return {
    hasPermission: (permission: string, action: string = "VIEW") => 
      hasPermission ? hasPermission(permission, action) : checkPermission(user, permission, action),
    hasAnyPermission: (permissions: string[], action: string = "VIEW") =>
      hasAnyPermission ? hasAnyPermission(permissions, action) : checkAnyPermission(user, permissions, action),
    checkPermission: (permission: string, action: string = "VIEW") => 
      checkPermission(user, permission, action),
    checkAnyPermission: (permissions: string[], action: string = "VIEW") =>
      checkAnyPermission(user, permissions, action),
    user,
  };
};

