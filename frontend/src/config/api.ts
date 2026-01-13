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
  TRANSCRIPTS_LIST: "/api/transcripts/ajaxlist",
  // Users endpoints
  USERS: "/api/users",
  USERS_LIST: "/api/users/ajaxlist",
  USERS_INSERT: "/api/users/insert",
  USERS_EDIT: "/api/users/edit",
  USERS_UPDATE: "/api/users/update",
  USERS_DELETE: "/api/users/delete",
  USERS_UPDATE_STATUS: "/api/users/updateStatus",
  USERS_RESET_PASSWORD: "/api/users/resetpassword",
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
    if (response.status === 401) {
      // Unauthorized - clear token and redirect to login
      removeAuthToken();
      window.location.href = "/signin";
    }
    
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
