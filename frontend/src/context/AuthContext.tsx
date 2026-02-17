import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { useNavigate } from "react-router";
import { api, API_ENDPOINTS, setAuthToken, removeAuthToken, getAuthToken } from "../config/api";
import { alerterror } from "../utils/toast";

interface UserPermissions {
  [permissionKey: string]: {
    ADD: number | string;
    VIEW: number | string;
    UPDATE: number | string;
    DELETE: number | string;
    [action: string]: number | string;
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
  profile_image?: string; // SSO profile image URL from Microsoft Graph
}

// Two-way auth pending state
export interface TwoWayAuthPending {
  temp_token: string;
  verify_data: number[];
  email_masked: string;
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
  twoWayPending: TwoWayAuthPending | null;
  verifyTwoWayCode: (code: string) => Promise<void>;
  resendTwoWayCode: () => Promise<number[]>;
  cancelTwoWay: () => void;
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
  const [twoWayPending, setTwoWayPending] = useState<TwoWayAuthPending | null>(null);
  const navigate = useNavigate();

  // Use ref for navigate to avoid dependency changes triggering re-execution
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  // Ref to prevent StrictMode double-execution of verifySession
  const sessionVerified = useRef(false);

  // Check if user is already logged in and verify session
  useEffect(() => {
    // Prevent double execution in StrictMode
    if (sessionVerified.current) return;
    sessionVerified.current = true;

    const verifySession = async () => {
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

          // Verify token is still valid by making a request to /api/me
          try {
            await api.get(API_ENDPOINTS.ME);
            setUser(parsedUser);
          } catch (error: unknown) {
            // If verification fails (401 or network error), clear session
            console.error("Session verification failed:", error);
            removeAuthToken();
            localStorage.removeItem("user_permissions");
            setUser(null);
            setPermissions(null);
            // Only redirect if not already on login page
            const currentPath = window.location.pathname;
            if (currentPath !== "/login" && !currentPath.includes("/login")) {
              navigateRef.current("/login");
            }
          }
        } catch (error) {
          console.error("Error parsing stored user:", error);
          removeAuthToken();
          localStorage.removeItem("user_permissions");
        }
      }
      setLoading(false);
    };

    verifySession();
  }, []); // Empty deps - run only once on mount

  const _handleLoginSuccess = (response: any) => {
    setAuthToken(response.access_token);

    const userPermissions = response.permissions || response.user?.permissions || {};
    const userWithPermissions = {
      ...response.user,
      permissions: userPermissions,
    };

    localStorage.setItem("user", JSON.stringify(userWithPermissions));
    localStorage.setItem("user_permissions", JSON.stringify(userPermissions));
    setUser(userWithPermissions);
    setPermissions(userPermissions);
    setTwoWayPending(null);

    // Redirect based on permissions
    // For SIR System, we redirect everyone to the main dashboard
    // Legacy redirects removed
    navigate("/");

    /* 
    if (response.user.college_perm === 1) {
      navigate("/college/dashboard");
    } else if (response.user.hs_perm === 1) {
      navigate("/school/dashboard");
    } else if (response.user.ocr_perm === 1) {
      navigate("/ocrverify/dashboard");
    } else {
      // Default fallback
      navigate("/");
    }
    */
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post(API_ENDPOINTS.LOGIN, {
        email,
        password,
      });

      console.log("[LOGIN] Response from /api/login:", JSON.stringify(response, null, 2));

      // Check if two-way verification is required
      if (response.requires_verification && response.temp_token) {
        console.log("[LOGIN] 2FA required - redirecting to /verify");
        setTwoWayPending({
          temp_token: response.temp_token,
          verify_data: response.verify_data || [],
          email_masked: response.email_masked || "",
        });
        navigate("/verify");
        return;
      }

      if (response.access_token) {
        console.log("[LOGIN] Direct login - access_token received");
        _handleLoginSuccess(response);
      } else {
        console.log("[LOGIN] No access_token and no requires_verification - unexpected response");
      }
    } catch (error: unknown) {
      console.error("[LOGIN] Login error:", error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Login failed. Please try again.");
    }
  };

  const verifyTwoWayCode = async (code: string) => {
    if (!twoWayPending) {
      throw new Error("No verification session active. Please login again.");
    }
    try {
      const response = await api.post(API_ENDPOINTS.VERIFY, {
        temp_token: twoWayPending.temp_token,
        verifycode: code,
      });

      if (response.access_token) {
        _handleLoginSuccess(response);
      } else {
        throw new Error("Verification failed. Please try again.");
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Verification failed. Please try again.");
    }
  };

  const resendTwoWayCode = async (): Promise<number[]> => {
    if (!twoWayPending) {
      throw new Error("No verification session active. Please login again.");
    }
    try {
      const response = await api.post(API_ENDPOINTS.VERIFY_RESEND, {
        temp_token: twoWayPending.temp_token,
      });

      if (response.verify_data) {
        setTwoWayPending((prev) =>
          prev ? { ...prev, verify_data: response.verify_data } : null
        );
        return response.verify_data;
      }
      return twoWayPending.verify_data;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to resend code. Please try again.");
    }
  };

  const cancelTwoWay = () => {
    setTwoWayPending(null);
    navigate("/login");
  };

  const logout = useCallback(() => {
    removeAuthToken();
    localStorage.removeItem("user_permissions");
    setUser(null);
    setPermissions(null);
    navigate("/login");
  }, [navigate]);

  // Idle timeout: logout after 30 minutes of inactivity
  useEffect(() => {
    if (!user) return;

    let idleTimeout: ReturnType<typeof setTimeout> | null = null;
    const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

    const resetIdleTimer = () => {
      // Clear existing timeout
      if (idleTimeout) {
        clearTimeout(idleTimeout);
      }

      // Set new timeout for logout after inactivity
      idleTimeout = setTimeout(() => {
        // User has been idle for 30 minutes
        console.log("User idle for 30 minutes, logging out...");
        removeAuthToken();
        localStorage.removeItem("user_permissions");
        setUser(null);
        setPermissions(null);
        alerterror("You have been inactive for 30 minutes. Please login again.", false);
        setTimeout(() => {
          navigateRef.current("/login");
        }, 1000);
      }, IDLE_TIMEOUT);
    };

    // Activity events that reset the idle timer
    const activityEvents = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
      "keydown",
    ];

    // Set up activity listeners
    const handleActivity = () => {
      // Only reset timer if page is visible (not in background tab)
      if (!document.hidden) {
        resetIdleTimer();
      }
    };

    // Handle visibility change (tab switch)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden - pause the timer (don't clear, just pause)
        if (idleTimeout) {
          clearTimeout(idleTimeout);
          idleTimeout = null;
        }
      } else {
        // Tab is visible again - resume the timer
        resetIdleTimer();
      }
    };

    // Add event listeners
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, true);
    });

    // Listen for visibility changes
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Initialize the timer
    resetIdleTimer();

    // Cleanup
    return () => {
      if (idleTimeout) {
        clearTimeout(idleTimeout);
      }
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity, true);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user]); // navigateRef is stable, no need in deps

  // Use ref for logout to avoid dependency changes
  const logoutRef = useRef(logout);
  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  // Periodic session verification (every 10 minutes) - only when user is active
  // This checks if the session is still valid on the server side
  useEffect(() => {
    if (!user) return;

    const verifyInterval = setInterval(async () => {
      const token = getAuthToken();
      if (!token) {
        logoutRef.current();
        return;
      }

      try {
        await api.get(API_ENDPOINTS.ME);
      } catch (error: unknown) {
        // Session expired or network error
        const err = error as { status?: number; isNetworkError?: boolean; isSessionExpired?: boolean };
        if (err.status === 401 || err.isSessionExpired) {
          // Session expired on server side
          removeAuthToken();
          localStorage.removeItem("user_permissions");
          setUser(null);
          setPermissions(null);
          alerterror("Your session has expired. Please login again.", false);
          setTimeout(() => {
            navigateRef.current("/login");
          }, 1000);
        }
        // For network errors, don't logout - just log the error
        // The apiRequest will show the appropriate error message
      }
    }, 10 * 60 * 1000); // Check every 10 minutes (only when user is active)

    return () => clearInterval(verifyInterval);
  }, [user]); // refs are stable, only re-run when user changes

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
        twoWayPending,
        verifyTwoWayCode,
        resendTwoWayCode,
        cancelTwoWay,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
