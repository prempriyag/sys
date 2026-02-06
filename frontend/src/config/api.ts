// Import toast functions for error notifications
import { alerterror } from "../utils/toast";

// Import centralized app config
import { APP_ENV, API_BASE_URL as CONFIG_API_BASE_URL } from "./app.config";

// Re-export from centralized config for backward compatibility
export const API_BASE_URL = CONFIG_API_BASE_URL;
export const APP_ENVIRONMENT = APP_ENV;

export const API_ENDPOINTS = {
  LOGIN: "/api/login",
  LOGOUT: "/api/logout",
  VERIFY: "/api/verify",
  ME: "/api/me",
  FORGOT_PASSWORD: "/api/forgot-password",
  FORGOT_PASSWORD_RESET: "/api/forgot-password/reset",
  TRANSCRIPT_REPORTS: "/api/transcriptreports",
  TRANSCRIPT_REPORTS_LIST: "/api/transcriptreports/ajaxlist",
  ARTICULATION_REPORTS_LIST: "/api/articulationreports/ajaxlist",
  DIGISCRIPT_REPORTS_LIST: "/api/digiscriptreports/ajaxlist",
  TRANSCRIPT_HDR_OCR_LIST: "/api/transcripthdrocr/ajaxlist",
  TRANSCRIPT_LINE_OCR_LIST: "/api/transcriptlineocr/ajaxlist",
  TRANSCRIPT_HDR_DATA_LIST: "/api/transcripthdrdata/ajaxlist",
  TRANSCRIPT_LINE_DATA_LIST: "/api/transcriptlinedata/ajaxlist",
  DIGISCRIPT_BOT_LOG_LIST: "/api/digiscriptbotlog/ajaxlist",
  ARTICULATION_BOT_LOG_LIST: "/api/articulationbotlog/ajaxlist",
  TRANSCRIPTS_LIST: "/api/transcripts/ajaxlist",
  TRANSCRIPTS_UPLOAD: "/api/transcripts/upload",
  TRANSCRIPTS_SOURCES: "/api/transcripts/sources",
  DEGREE_MAPPING_LIST: "/api/degreemapping/ajaxlist",
  TERM_MAPPING_LIST: "/api/termmapping/ajaxlist",
  TERM_NAME_MAPPING_LIST: "/api/termnamemapping/ajaxlist",
  GRADE_MAPPING_LIST: "/api/grademapping/ajaxlist",
  SKIP_KEYWORDS_LIST: "/api/skipkeywords/ajaxlist",
  SKIP_COURSES_LIST: "/api/skipcourses/ajaxlist",
  YEAR_MAPPING_LIST: "/api/yearmapping/ajaxlist",
  BOT_SCHEDULE_LIST: "/api/botschedule/ajaxlist",
  BOT_STATUS_REPORT_LIST: "/api/botstatusreport/ajaxlist",
  SUFFIX_NAME_LIST: "/api/suffixname/ajaxlist",
  PREFIX_NAME_LIST: "/api/prefixname/ajaxlist",
  COMBINED_NAME_LIST: "/api/combinedname/ajaxlist",
  ACCEPTED_GRADES_LIST: "/api/acceptedgrades/ajaxlist",
  TRANSFER_GRADES_LIST: "/api/transfergrades/ajaxlist",
  INSTITUTION_MAPPING_LIST: "/api/institutionmapping/ajaxlist",
  ACCREDITED_INSTITUTION_LIST: "/api/accreditedinstitution/ajaxlist",
  OVERRIDE_EDIT_MAPPING_LIST: "/api/overrideeditmapping/ajaxlist",
  STORED_PROCEDURE_GET_NAME: "/api/storedprocedure/getname",
  STORED_PROCEDURE_RUN: "/api/storedprocedure/run",
  ERROR_LOG_LIST: "/api/errorlog/ajaxlist",
  ERROR_LOG_UPDATE_STATUS: "/api/errorlog/updatestatus",
  SMTP_LIST: "/api/smtp/ajaxlist",
  SMTP_ADD: "/api/smtp/insert",
  SMTP_GET: "/api/smtp/get",
  SMTP_UPDATE: "/api/smtp/update",
  SMTP_DELETE: "/api/smtp/delete",
  // Users endpoints
  USERS: "/api/users",
  USERS_LIST: "/api/users/ajaxlist",
  USERS_INSERT: "/api/users/insert",
  USERS_EDIT: "/api/users/edit",
  USERS_UPDATE: "/api/users/update",
  USERS_DELETE: "/api/users/delete",
  USERS_UPDATE_STATUS: "/api/users/updateStatus",
  USERS_RESET_PASSWORD: "/api/users/resetpassword",
  // Student View endpoints
  STUDENTVIEW: "/api/studentview",
  STUDENTVIEW_GET_STUDENTS: "/api/studentview/getstudentslist",
  DASHBOARD_COLLEGES_LIST: "/api/dashboard/colleges",
  STUDENTVIEW_VIEW_PAGE_LOAD: "/api/studentview/viewpageload",
  STUDENTVIEW_ARTICULATION_PAGE_LOAD: "/api/studentview/articulationviewpageload",
  // Theme Settings endpoints
  SETTINGS: "/api/theme-settings",
  SETTINGS_UPLOAD_LOGO: "/api/theme-settings/upload-logo",
  
  // SSO endpoints
  SSO_CLIENT: "/sso/client",
  SSO_KTECH: "/sso/ktech",
  SSO_CLIENT_OAUTH_CALLBACK: "/api/sso/client/oauth/callback",
  SSO_CLIENT_SAML_CALLBACK: "/api/sso/client/saml/callback",
  SSO_KTECH_OAUTH_CALLBACK: "/api/sso/ktech/oauth/callback",
  SSO_KTECH_SAML_CALLBACK: "/api/sso/ktech/saml/callback",

  //School
  SCHOOL_TRANSCRIPT_REPORTS: "/api/school/transcriptreports",
  SCHOOL_TRANSCRIPT_REPORTS_LIST: "/api/school/transcriptreports/ajaxlist",
  SCHOOL_DIGISCRIPT_REPORTS_LIST: "/api/school/digiscriptreports/ajaxlist",
  SCHOOL_TRANSCRIPT_HDR_OCR_LIST: "/api/school/transcripthdrocr/ajaxlist",
  SCHOOL_TRANSCRIPT_LINE_OCR_LIST: "/api/school/transcriptlineocr/ajaxlist",
  SCHOOL_TRANSCRIPT_HDR_DATA_LIST: "/api/school/transcripthdrdata/ajaxlist",
  SCHOOL_TRANSCRIPT_LINE_DATA_LIST: "/api/school/transcriptlinedata/ajaxlist",
  SCHOOL_DIGISCRIPT_BOT_LOG_LIST: "/api/school/digiscriptbotlog/ajaxlist",
  SCHOOL_TRANSCRIPTS_LIST: "/api/school/transcripts/ajaxlist",
  SCHOOL_TRANSCRIPTS_UPLOAD: "/api/school/transcripts/upload",
  SCHOOL_TRANSCRIPTS_SOURCES: "/api/school/transcripts/sources",
  SCHOOL_INSTITUTION_MAPPING_LIST: "/api/school/institutionmapping/ajaxlist",

  // Student View endpoints
  SCHOOL_STUDENTVIEW: "/api/school/studentview",
  SCHOOL_STUDENTVIEW_GET_STUDENTS: "/api/school/studentview/getstudentslist",
  SCHOOL_STUDENTVIEW_VIEW_PAGE_LOAD: "/api/school/studentview/viewpageload",

  // OCR Verify module
  OCR_DASHBOARD_COUNTS: "/api/ocrverify/dashboard/counts",
  OCR_DASHBOARD_GET_COLLEGE_LIST: "/api/ocrverify/dashboard/getcollegelist",
  OCR_VERIFIERS: "/api/ocrverify/verifiers",
  OCR_ASSIGN_BATCHES: "/api/ocrverify/assignbatches",
  OCR_ASSIGN_BATCHES_AJAXLIST: "/api/ocrverify/assignbatches/ajaxlist",
  OCR_ASSIGN_BATCHES_SAVE: "/api/ocrverify/assignbatches/save",
  OCR_ASSIGN_BATCHES_DELETE: "/api/ocrverify/assignbatches/delete",
  OCR_TOBEASSIGN_BATCHES: "/api/ocrverify/tobeassignbatches",
  OCR_TOBEASSIGN_BATCHES_AJAXLIST: "/api/ocrverify/tobeassignbatches/ajaxlist",
  OCR_COLLEGE_OCR_BATCHES: "/api/ocrverify/collegeocrbatches",
  OCR_COLLEGE_OCR_AJAX_VERIFIER_BATCH_LIST: "/api/ocrverify/collegeocr/ajaxverifierbatchelist",
  OCR_COLLEGE_OCR_BATCH: "/api/ocrverify/collegeocrbatch",
  OCR_COLLEGE_OCR_BATCH_SEARCH: "/api/ocrverify/collegeocrbatch/search",
  OCR_CHANGE_ADDITIONAL_STATUS: "/api/ocrverify/changeAdditionalStatus",
  OCR_CHANGE_BATCH_VERIFY_STATUS: "/api/ocrverify/changeBatchVerifyStatus",
  OCR_UPDATE_BATCH_DATA_LINE: "/api/ocrverify/updatebatchdataline",
  OCR_DELETE_LINE_DATA: "/api/ocrverify/deletelinedata",
  OCR_DELETE_SEQUENCE: "/api/ocrverify/deletesequence",
  OCR_MULTIPLE_UPDATE: "/api/ocrverify/multiple_update",
  OCR_COLLEGE_HDR_DATA: "/api/ocrverify/collegehdrdata",
  OCR_COLLEGE_HDR_AJAXLIST: "/api/ocrverify/collegehdrdata/ajaxlist",
  OCR_COLLEGE_HDR_BATCH: "/api/ocrverify/collegehdrbatch",
  OCR_COLLEGE_HDR_UPDATE_BATCH_HDR: "/api/ocrverify/collegehdrdata/updatebatchdatahdr",
  OCR_COLLEGE_HDR_UPDATE_LINE: "/api/ocrverify/collegehdrdata/updatebatchdataline",
  OCR_COLLEGE_HDR_DELETE_LINE: "/api/ocrverify/collegehdrdata/deletelinedata",
  OCR_COLLEGE_OCR_REASSIGN_VERIFIER: "/api/ocrverify/collegeocr/reassign_verifier",
  OCR_SCHOOL_OCR_BATCH: "/api/ocrverify/schoolocrbatch",
  OCR_SCHOOL_OCR_BATCH_SEARCH: "/api/ocrverify/schoolocrbatch/search",
  OCR_SCHOOL_OCR_BATCHES: "/api/ocrverify/schoolocrbatches",
  OCR_SCHOOL_OCR_AJAX_VERIFIER_BATCH_LIST: "/api/ocrverify/schoolocr/ajaxverifierbatchelist",
  OCR_SCHOOL_OCR_REASSIGN_VERIFIER: "/api/ocrverify/schoolocr/reassign_verifier",
  OCR_SCHOOL_OCR_UPDATE_BATCH_LINE: "/api/ocrverify/schoolocr/updatebatchdataline",
  OCR_UPDATE_BATCH_DATA_OCR: "/api/ocrverify/updatebatchdataocr",
  OCR_SCHOOL_DELETE_LINE_DATA: "/api/ocrverify/schooldeletelinedata",
  OCR_SCHOOL_DELETE_SEQUENCE: "/api/ocrverify/schooldeletesequence",
  OCR_SCHOOL_MULTIPLE_UPDATE: "/api/ocrverify/school_multiple_update",
  OCR_SCHOOL_HDR_DATA: "/api/ocrverify/schoolhdrdata",
  OCR_SCHOOL_HDR_AJAXLIST: "/api/ocrverify/schoolhdrdata/ajaxlist",
  OCR_SCHOOL_HDR_BATCH: "/api/ocrverify/schoolhdrbatch",
  OCR_SCHOOL_HDR_UPDATE_BATCH_HDR: "/api/ocrverify/schoolhdrdata/updatebatchdatahdr",
  OCR_UPDATE_BATCH_DATA_HDR: "/api/ocrverify/updatebatchdatahdr",
  
  // Profiler endpoints (for debugging - KTech users only)
  PROFILER_DATA: "/api/profiler/data",
  PROFILER_STATUS: "/api/profiler/status",
  PROFILER_SPEEDTEST: "/api/profiler/speedtest",
};

// Helper function to get auth token from localStorage
export const getAuthToken = (): string | null => {
  return localStorage.getItem("auth_token");
};

// Helper function to set auth token
export const setAuthToken = (token: string): void => {
  localStorage.setItem("auth_token", token);
};

// Helper function to remove auth token
export const removeAuthToken = (): void => {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("user");
};

// API fetch wrapper with auth headers
export const apiRequest = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const token = getAuthToken();
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response: Response;
  
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (fetchError: unknown) {
    // Network error - backend is not running or unreachable
    const errorMessage = fetchError instanceof Error ? fetchError.message : "Network error";
    
    // Check if it's a network/connection error
    if (
      errorMessage.includes("Failed to fetch") ||
      errorMessage.includes("NetworkError") ||
      errorMessage.includes("Network request failed") ||
      errorMessage.includes("ERR_INTERNET_DISCONNECTED") ||
      errorMessage.includes("ERR_CONNECTION_REFUSED") ||
      errorMessage.includes("ERR_CONNECTION_TIMED_OUT")
    ) {
      alerterror(
        "Unable to connect to the server. Please check if the backend server is running.",
        false
      );
      const error = new Error("Backend server is not running or unreachable");
      (error as any).status = 0;
      (error as any).isNetworkError = true;
      throw error;
    }
    
    // Re-throw other errors
    throw fetchError;
  }

  if (!response.ok) {
    // Try to get error message from response
    let errorMessage = `API Error: ${response.status} ${response.statusText}`;
    let errorDetail = "";
    
    try {
      const errorData = await response.clone().json();
      if (errorData.detail) {
        errorMessage = errorData.detail;
        errorDetail = errorData.detail;
      } else if (errorData.message) {
        errorMessage = errorData.message;
        errorDetail = errorData.message;
      }
    } catch {
      // If JSON parsing fails, try to get text
      try {
        const errorText = await response.clone().text();
        if (errorText) {
          errorDetail = errorText;
        }
      } catch {
        // If text parsing also fails, use default message
      }
    }
    
    // Check for database connection errors
    const isDbError = 
      errorDetail.toLowerCase().includes("database") ||
      errorDetail.toLowerCase().includes("db connection") ||
      errorDetail.toLowerCase().includes("connection to database") ||
      errorDetail.toLowerCase().includes("operationalerror") ||
      errorDetail.toLowerCase().includes("could not connect") ||
      errorDetail.toLowerCase().includes("connection refused") ||
      response.status === 503; // Service Unavailable often indicates DB issues
    
    // Handle session expiry (401 Unauthorized)
    if (response.status === 401) {
      const currentPath = window.location.pathname;
      // Don't redirect if we're already on login page (allows error to be displayed)
      if (currentPath !== "/login" && !currentPath.includes("/login")) {
        removeAuthToken();
        localStorage.removeItem("user");
        localStorage.removeItem("user_permissions");
        alerterror("Your session has expired. Please login again.", false);
        // Use setTimeout to allow toast to show before redirect
        setTimeout(() => {
          window.location.href = "/login";
        }, 1000);
        const error = new Error("Session expired");
        (error as any).status = 401;
        (error as any).isSessionExpired = true;
        throw error;
      }
      // If on login page, just clear token but don't redirect
      removeAuthToken();
    }
    
    // Show database connection error message
    if (isDbError) {
      alerterror(
        "Database connection error. Please check if the database server is running and accessible.",
        false
      );
      const error = new Error("Database connection error");
      (error as any).status = response.status;
      (error as any).isDbError = true;
      throw error;
    }
    
    // Handle 500 Internal Server Error
    if (response.status === 500) {
      const currentPath = window.location.pathname;
      const isFormSubmission = options.method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method.toUpperCase());
      
      // For form submissions, don't redirect - let the form handle the error
      // Only redirect GET requests to the error page
      if (!isFormSubmission && currentPath !== "/server-error" && !currentPath.includes("/server-error")) {
        // Store error message in sessionStorage to pass to error page
        sessionStorage.setItem("serverError", JSON.stringify({
          message: errorMessage,
          detail: errorDetail,
          timestamp: new Date().toISOString()
        }));
        // Navigate to server error page
        window.location.href = "/server-error";
        // Return early to prevent throwing error during redirect
        const error = new Error("Internal Server Error");
        (error as any).status = 500;
        (error as any).isServerError = true;
        throw error;
      }
      // For form submissions, throw error with detail so form can handle it
      const error = new Error(errorMessage || "Internal Server Error");
      (error as any).status = 500;
      (error as any).isServerError = true;
      (error as any).detail = errorDetail;
      throw error;
    }
    
    // For other 5xx errors, show the error message
    if (response.status >= 500 && response.status !== 500) {
      alerterror(
        `Server error: ${errorMessage}. Please try again later or contact support.`,
        false
      );
    }
    
    const error = new Error(errorMessage);
    (error as any).status = response.status;
    throw error;
  }

  return response;
};

// API helper functions
export const api = {
  get: async (endpoint: string, options?: RequestInit) => {
    const response = await apiRequest(endpoint, { ...options, method: "GET" });
    return response.json();
  },

  post: async (endpoint: string, data?: unknown, options?: RequestInit) => {
    // Handle FormData differently - don't stringify and let browser set Content-Type
    const isFormData = data instanceof FormData;
    
    if (isFormData) {
      // For FormData, use fetch directly to avoid Content-Type header issues
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      // Don't set Content-Type - browser will set it with correct boundary
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers,
        body: data as FormData,
      });
      return response.json();
    }
    
    const response = await apiRequest(endpoint, {
      ...options,
      method: "POST",
      body: JSON.stringify(data),
    });
    return response.json();
  },

  put: async (endpoint: string, data?: unknown, options?: RequestInit) => {
    const response = await apiRequest(endpoint, {
      ...options,
      method: "PUT",
      body: JSON.stringify(data),
    });
    return response.json();
  },

  delete: async (endpoint: string, options?: RequestInit) => {
    const response = await apiRequest(endpoint, { ...options, method: "DELETE" });
    return response.json();
  },
};

// SSO Helper Functions
/**
 * Redirect to Client SSO login
 * @param returnTo Optional URL to return to after SSO login
 */
export const redirectToClientSSO = (returnTo?: string) => {
  const url = new URL(`${API_BASE_URL}${API_ENDPOINTS.SSO_CLIENT}`);
  if (returnTo) {
    url.searchParams.set("return_to", returnTo);
  }
  window.location.href = url.toString();
};

/**
 * Redirect to KTech SSO login
 * @param returnTo Optional URL to return to after SSO login
 */
export const redirectToKTechSSO = (returnTo?: string) => {
  const url = new URL(`${API_BASE_URL}${API_ENDPOINTS.SSO_KTECH}`);
  if (returnTo) {
    url.searchParams.set("return_to", returnTo);
  }
  window.location.href = url.toString();
};
