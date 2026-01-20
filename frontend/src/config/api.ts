// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const API_ENDPOINTS = {
  LOGIN: "/api/login",
  LOGOUT: "/api/logout",
  VERIFY: "/api/verify",
  ME: "/api/me",
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
  STUDENTVIEW_VIEW_PAGE_LOAD: "/api/studentview/viewpageload",
  STUDENTVIEW_ARTICULATION_PAGE_LOAD: "/api/studentview/articulationviewpageload",
  // Theme Settings endpoints
  SETTINGS: "/api/theme-settings",
  SETTINGS_UPLOAD_LOGO: "/api/theme-settings/upload-logo",

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

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // Try to get error message from response
    let errorMessage = `API Error: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.clone().json();
      if (errorData.detail) {
        errorMessage = errorData.detail;
      }
    } catch {
      // If JSON parsing fails, use default message
    }
    
    // Only redirect on 401 if we're NOT on the login page
    // This prevents page refresh when login fails
    if (response.status === 401) {
      const currentPath = window.location.pathname;
      // Don't redirect if we're already on login page (allows error to be displayed)
      if (currentPath !== "/login" && !currentPath.includes("/login")) {
        removeAuthToken();
        window.location.href = "/login";
        return response; // Return early to prevent throwing error during redirect
      }
      // If on login page, just clear token but don't redirect
      removeAuthToken();
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
