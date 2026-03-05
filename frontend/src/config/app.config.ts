/**
 * Application Configuration
 * All configurable values from environment variables (.env)
 * 
 * Create a .env file in the frontend root with these variables:
 * 
 * # Environment: DEV | UAT | PROD
 * VITE_APP_ENV=DEV
 * 
 * # Backend API Base URL (optional)
 * VITE_API_BASE_URL=http://localhost:8000
 * 
 * # Application Name
 * VITE_APP_NAME=DigiScript
 * 
 * # Profiler - allowed email domains (comma-separated)
 * VITE_PROFILER_ALLOWED_DOMAINS=ktechproducts.com,ktech.com
 * 
 * # Profiler - enable/disable globally
 * VITE_PROFILER_ENABLED=true
 * 
 * # Show environment badge in header
 * VITE_SHOW_ENV_BADGE=true
 * 
 * # Debug mode
 * VITE_DEBUG_MODE=false
 */

// Environment
export const APP_ENV = (import.meta.env.VITE_APP_ENV || "DEV").toUpperCase();
export const IS_DEV = APP_ENV === "DEV";
export const IS_UAT = APP_ENV === "UAT";
export const IS_PROD = APP_ENV === "PROD";

// Application
export const APP_NAME = import.meta.env.VITE_APP_NAME || "KK Surveys";

// API Base URLs by environment
const API_BASE_URL_BY_ENV: Record<string, string> = {
  DEV: "http://localhost:8000",
  UAT: "http://65.1.93.82/backend",
  PROD: "https://digiscript-csc.ktechproducts.com/backend",
};

export const API_BASE_URL = (() => {
  const raw =
    import.meta.env.VITE_API_BASE_URL || API_BASE_URL_BY_ENV[APP_ENV] || API_BASE_URL_BY_ENV.DEV;
  // Avoid using literal "undefined" when env var is missing or mis-set
  if (raw === undefined || raw === "undefined" || raw === "") {
    return API_BASE_URL_BY_ENV.DEV;
  }
  return raw;
})();

// Profiler Configuration
export const PROFILER_ENABLED = import.meta.env.VITE_PROFILER_ENABLED !== "false";
export const PROFILER_ALLOWED_DOMAINS = (
  import.meta.env.VITE_PROFILER_ALLOWED_DOMAINS || "ktechproducts.com,ktech.com"
).split(",").map((d: string) => d.trim().toLowerCase());

// UI Configuration
export const SHOW_ENV_BADGE = import.meta.env.VITE_SHOW_ENV_BADGE !== "false";

// Debug - enable in DEV by default for easier debugging
export const DEBUG_MODE = import.meta.env.VITE_DEBUG_MODE === "true" || IS_DEV;

/**
 * Check if an email domain is allowed to access profiler
 * Matches CI3 checkemailktech() but configurable via env
 */
export const isProfilerAllowedEmail = (email: string): boolean => {
  console.log("[isProfilerAllowedEmail] Checking email:", email);
  console.log("[isProfilerAllowedEmail] PROFILER_ENABLED:", PROFILER_ENABLED);
  console.log("[isProfilerAllowedEmail] Allowed domains:", PROFILER_ALLOWED_DOMAINS);
  
  if (!PROFILER_ENABLED) return false;
  if (!email) return false;
  
  const emailLower = email.toLowerCase();
  const isAllowed = PROFILER_ALLOWED_DOMAINS.some((domain: string) => {
    const match = emailLower.endsWith(`@${domain}`) || emailLower.includes(domain);
    console.log(`[isProfilerAllowedEmail] Checking domain "${domain}": ${match}`);
    return match;
  });
  
  console.log("[isProfilerAllowedEmail] Result:", isAllowed);
  return isAllowed;
};

/**
 * Check if current logged-in user can access profiler
 */
export const canAccessProfiler = (): boolean => {
  if (!PROFILER_ENABLED) {
    if (DEBUG_MODE) console.log("[Profiler] Disabled via config");
    return false;
  }
  
  try {
    // Try multiple possible storage keys for user data
    let userStr = localStorage.getItem("user");
    let user = null;
    
    if (userStr) {
      user = JSON.parse(userStr);
    }
    
    // Also check auth_user key
    if (!user) {
      userStr = localStorage.getItem("auth_user");
      if (userStr) {
        user = JSON.parse(userStr);
      }
    }
    
    if (!user) {
      if (DEBUG_MODE) console.log("[Profiler] No user found in localStorage");
      return false;
    }
    
    const email = user?.email || "";
    const canAccess = isProfilerAllowedEmail(email);
    
    if (DEBUG_MODE) {
      console.log("[Profiler] User email:", email);
      console.log("[Profiler] Allowed domains:", PROFILER_ALLOWED_DOMAINS);
      console.log("[Profiler] Can access:", canAccess);
    }
    
    return canAccess;
  } catch (e) {
    if (DEBUG_MODE) console.log("[Profiler] Error:", e);
    return false;
  }
};

// Log configuration in debug mode
if (DEBUG_MODE) {
  console.log("[AppConfig]", {
    APP_ENV,
    API_BASE_URL,
    PROFILER_ENABLED,
    PROFILER_ALLOWED_DOMAINS,
    SHOW_ENV_BADGE,
  });
}
