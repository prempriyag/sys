import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { checkPermission } from "../../utils/permissions";

interface PermissionRouteProps {
  children: ReactNode;
  permission: string; // Permission key to check
  action?: string; // Action to check (VIEW, ADD, UPDATE, DELETE), defaults to VIEW
  redirectTo?: string; // Where to redirect if permission denied
}

/**
 * Permission-based route guard component
 * Similar to checkpermission() check in PHP controllers (e.g., Users.php line 18-20)
 * 
 * Usage:
 * <Route path="/college/users" element={
 *   <PermissionRoute permission="user_management" action="VIEW">
 *     <UserManagement />
 *   </PermissionRoute>
 * } />
 */
export default function PermissionRoute({ 
  children, 
  permission, 
  action = "VIEW",
  redirectTo = "/college/dashboard"
}: PermissionRouteProps) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
          <p className="mt-4 text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check permission
  if (!user || !checkPermission(user, permission, action)) {
    // Redirect to permission error page or dashboard
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}



