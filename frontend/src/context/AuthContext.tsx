import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useNavigate } from "react-router";
import { api, API_ENDPOINTS, setAuthToken, removeAuthToken, getAuthToken } from "../config/api";

interface UserPermissions {
  [permissionKey: string]: {
    ADD: number | string;
    VIEW: number | string;
    UPDATE: number | string;
    DELETE: number | string;
  };
}

interface User {
  id: number;
  name: string;
  email: string;
  role_id: number;
  status: number;
  college_perm: number;
  hs_perm: number;
  ocr_perm: number;
  last_login?: string;
  permissions?: UserPermissions;
}

interface AuthContextType {
  user: User | null;
  permissions: UserPermissions | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  hasPermission: (permission: string, action?: string) => boolean;
  hasAnyPermission: (permissions: string[], action?: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Check if user is already logged in
  useEffect(() => {
    const token = getAuthToken();
    const storedUser = localStorage.getItem("user");
    const storedPermissions = localStorage.getItem("user_permissions");
    
    if (token && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        
        // Load permissions from localStorage
        if (storedPermissions) {
          try {
            const parsedPermissions = JSON.parse(storedPermissions);
            // Attach permissions to user object if not already present
            if (!parsedUser.permissions) {
              parsedUser.permissions = parsedPermissions;
            }
            setPermissions(parsedPermissions);
          } catch (error) {
            console.error("Error parsing stored permissions:", error);
          }
        }
        
        setUser(parsedUser);
      } catch (error) {
        console.error("Error parsing stored user:", error);
        removeAuthToken();
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post(API_ENDPOINTS.LOGIN, {
        email,
        password,
      });

      if (response.access_token) {
        setAuthToken(response.access_token);
        
        // Store permissions in localStorage (similar to PHP session)
        // API returns permissions as both user.permissions and top-level permissions
        // Prefer top-level permissions, fallback to user.permissions
        const userPermissions = response.permissions || response.user?.permissions || {};
        
        // Attach permissions to user object for easy access
        const userWithPermissions = {
          ...response.user,
          permissions: userPermissions,
        };
        
        localStorage.setItem("user", JSON.stringify(userWithPermissions));
        localStorage.setItem("user_permissions", JSON.stringify(userPermissions));
        setUser(userWithPermissions);
        setPermissions(userPermissions);

        // Redirect based on permissions
        if (response.user.college_perm === 1) {
          navigate("/dashboard");
        } else if (response.user.hs_perm === 1) {
          navigate("/school/dashboard");
        } else if (response.user.ocr_perm === 1) {
          navigate("/ocrverify/dashboard");
        } else {
          throw new Error("You don't have proper permissions to login.");
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Login failed. Please try again.");
    }
  };

  const logout = () => {
    removeAuthToken();
    localStorage.removeItem("user_permissions");
    setUser(null);
    setPermissions(null);
    navigate("/signin");
  };

  // Check if user has a specific permission (similar to checkpermission in PHP)
  // API returns permissions as strings ("0", "1"), so we check both number and string
  const hasPermission = (permission: string, action: string = "VIEW"): boolean => {
    if (!permissions || !permission) {
      return false;
    }
    
    const actionUpper = action.toUpperCase();
    if (permissions[permission] && permissions[permission][actionUpper] !== undefined) {
      const value = permissions[permission][actionUpper];
      // Check for both number 1 and string "1" (API returns strings)
      return value === 1 || String(value) === "1";
    }
    
    return false;
  };

  // Check if user has any of the specified permissions (similar to checkallpermission in PHP)
  // API returns permissions as strings ("0", "1"), so we check both number and string
  const hasAnyPermission = (permissionList: string[], action: string = "VIEW"): boolean => {
    if (!permissions || !Array.isArray(permissionList) || permissionList.length === 0) {
      return false;
    }
    
    const actionUpper = action.toUpperCase();
    return permissionList.some((permission) => {
      if (permissions[permission] && permissions[permission][actionUpper] !== undefined) {
        const value = permissions[permission][actionUpper];
        // Check for both number 1 and string "1" (API returns strings)
        return value === 1 || String(value) === "1";
      }
      return false;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
        hasPermission,
        hasAnyPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
