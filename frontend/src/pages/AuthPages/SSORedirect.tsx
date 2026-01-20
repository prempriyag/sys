import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { redirectToClientSSO, redirectToKTechSSO, API_BASE_URL } from "../../config/api";

/**
 * SSO Redirect Component
 * Handles /sso/client and /sso/ktech routes and redirects to backend
 * 
 * NOTE: SSO requires the backend to be running because:
 * - OAuth requires server-side token exchange (client secret must be on server)
 * - SAML requires server-side XML processing and certificate validation
 * - The backend generates the JWT token after successful authentication
 */
export default function SSORedirect() {
  const location = useLocation();
  const navigate = useNavigate();
  const [backendError, setBackendError] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkBackendAndRedirect = async () => {
      const path = location.pathname;
      
      // First, check if backend is available
      try {
        const response = await fetch(`${API_BASE_URL}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(3000), // 3 second timeout
        });
        
        if (!response.ok) {
          throw new Error('Backend not available');
        }
        
        setChecking(false);
        
        // Backend is available, proceed with SSO redirect
        if (path === "/sso/client" || path.startsWith("/sso/client")) {
          redirectToClientSSO();
        } else if (path === "/sso/ktech" || path.startsWith("/sso/ktech")) {
          redirectToKTechSSO();
        } else {
          navigate("/login");
        }
      } catch (error) {
        // Backend is not available
        setChecking(false);
        setBackendError(true);
        console.error("Backend connection error:", error);
      }
    };

    checkBackendAndRedirect();
  }, [location.pathname, navigate]);

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-brand-500 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Checking backend connection...</p>
        </div>
      </div>
    );
  }

  if (backendError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <h2 className="text-lg font-semibold text-yellow-800 dark:text-yellow-400 mb-2">
            Backend Server Not Available
          </h2>
          <p className="text-yellow-700 dark:text-yellow-300 mb-4">
            SSO authentication requires the backend server to be running.
          </p>
          <div className="text-left text-sm text-yellow-600 dark:text-yellow-400 mb-4 space-y-2">
            <p><strong>Why?</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>OAuth requires server-side token exchange (client secrets must be on server)</li>
              <li>SAML requires server-side XML processing and certificate validation</li>
              <li>The backend generates the JWT token after successful authentication</li>
            </ul>
          </div>
          <div className="text-sm text-yellow-600 dark:text-yellow-400 mb-4">
            <p><strong>To fix:</strong></p>
            <p className="mt-2">1. Start the backend server (FastAPI on port 8000)</p>
            <p>2. Ensure the backend is accessible at: <code className="bg-yellow-100 dark:bg-yellow-900/50 px-2 py-1 rounded">{API_BASE_URL}</code></p>
            <p>3. Try again</p>
          </div>
          <button
            onClick={() => navigate("/login")}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
          >
            Go to Login Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-brand-500 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Redirecting to SSO login...</p>
      </div>
    </div>
  );
}
