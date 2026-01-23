import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { API_BASE_URL, API_ENDPOINTS, setAuthToken } from "../../config/api";

/**
 * SSO Callback Page
 * Handles OAuth and SAML callbacks from the backend
 * The backend redirects here with the access token
 */
export default function SSOCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleSSOCallback = async () => {
      try {
        // Check if we have an error from SSO
        const errorParam = searchParams.get("error");
        if (errorParam) {
          const errorDescription = searchParams.get("error_description") || errorParam;
          setError(errorDescription);
          setLoading(false);
          setTimeout(() => {
            navigate("/login");
          }, 3000);
          return;
        }

        // Backend redirects here with access_token in query parameter
        const token = searchParams.get("access_token");
        if (token) {
          await handleSSOLogin(token);
          return;
        }

        // No token found
        setError("SSO login failed. Token not received.");
        setLoading(false);
        setTimeout(() => {
          navigate("/login");
        }, 3000);
      } catch (err) {
        console.error("SSO Callback Error:", err);
        setError(err instanceof Error ? err.message : "An error occurred during SSO login");
        setLoading(false);
        setTimeout(() => {
          navigate("/login");
        }, 3000);
      }
    };

    handleSSOCallback();
  }, [searchParams, navigate]);

  const handleSSOLogin = async (token: string) => {
    try {
      setAuthToken(token);
      
      // Try to get user data from URL parameters first (passed from backend)
      const userParam = searchParams.get("user");
      const permissionsParam = searchParams.get("permissions");
      
      let userData;
      
      if (userParam) {
        // User data passed directly from backend (matches CI3 behavior)
        try {
          userData = JSON.parse(decodeURIComponent(userParam));
          
          // Store user and permissions
          localStorage.setItem("user", JSON.stringify(userData));
          
          if (permissionsParam) {
            try {
              const permissions = JSON.parse(decodeURIComponent(permissionsParam));
              localStorage.setItem("user_permissions", JSON.stringify(permissions));
            } catch (e) {
              console.warn("Failed to parse permissions from URL", e);
            }
          }
        } catch (e) {
          console.error("Failed to parse user data from URL", e);
          // Fallback to API call
          userData = await fetchUserFromAPI(token);
        }
      } else {
        // Fallback: Get user info using the token (if not in URL)
        userData = await fetchUserFromAPI(token);
      }

      // Redirect based on permissions (matching CI3 login/index.php behavior)
      if (userData.college_perm === 1) {
        navigate("/college/dashboard");
      } else if (userData.hs_perm === 1) {
        navigate("/school/dashboard");
      } else if (userData.ocr_perm === 1) {
        navigate("/ocrverify/dashboard");
      } else {
        // No specific permission, redirect to dashboard anyway
        navigate("/college/dashboard");
      }
    } catch (err) {
      console.error("SSO Login Error:", err);
      setError(err instanceof Error ? err.message : "Failed to complete SSO login");
      setLoading(false);
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    }
  };

  const fetchUserFromAPI = async (token: string) => {
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.ME}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to get user information");
    }

    const userData = await response.json();
    
    // Store user and permissions
    localStorage.setItem("user", JSON.stringify(userData));
    if (userData.permissions) {
      localStorage.setItem("user_permissions", JSON.stringify(userData.permissions));
    }
    
    return userData;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-brand-500 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Completing SSO login...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <h2 className="text-lg font-semibold text-red-800 dark:text-red-400 mb-2">
            SSO Login Error
          </h2>
          <p className="text-red-600 dark:text-red-300 mb-4">{error}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Redirecting to login page...
          </p>
        </div>
      </div>
    );
  }

  return null;
}
