import axios from 'axios';
import { API_BASE_URL, API_ENDPOINTS, getAuthToken } from '../config/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
    const token = getAuthToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// SIR Upload APIs
export const uploadPreSir = (formData: FormData) => 
    api.post(API_ENDPOINTS.SIR_UPLOAD_PRE, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });

export const uploadPostSir = (formData: FormData) => 
    api.post(API_ENDPOINTS.SIR_UPLOAD_POST, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });

export const runMatching = (constituencyId: number) => 
    api.post(`${API_ENDPOINTS.SIR_MATCHING_RUN}/${constituencyId}`);

// SIR KPI APIs
export const getBoothKPI = (boothId: number) => 
    api.get(`${API_ENDPOINTS.SIR_KPI_BOOTH}/${boothId}`);

export const getConstituencyKPI = (constituencyId: number) => 
    api.get(`${API_ENDPOINTS.SIR_KPI_CONSTITUENCY}/${constituencyId}`);

export const calculateKPIs = (constituencyId: number) => 
    api.post(`${API_ENDPOINTS.SIR_KPI_CALCULATE}/${constituencyId}`);

export const getBoothsKPI = (constituencyId: number) => 
    api.get(`${API_ENDPOINTS.SIR_KPI_BOOTHS}/${constituencyId}`);

// SIR Dashboard APIs
export const getRiskMap = (constituencyId: number) => 
    api.get(`${API_ENDPOINTS.SIR_DASHBOARD_RISK_MAP}/${constituencyId}`);

export const getConstituencies = () => 
    api.get(API_ENDPOINTS.SIR_DASHBOARD_CONSTITUENCIES);
export const convertScannedPdf = (formData: FormData) =>
    api.post(API_ENDPOINTS.SIR_CONVERT_PDF, formData, { headers: { 'Content-Type': 'multipart/form-data' } });

/** SOP: Parse ECI electoral roll PDF (text or scanned); returns CSV file. */
export const parseElectoralRollPdf = (formData: FormData) =>
    api.post(API_ENDPOINTS.SIR_PARSE_ELECTORAL_PDF, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob',
    });

// SIR Analytics APIs
export const runAnalytics = (constituencyId: number) => 
    api.post(`${API_ENDPOINTS.SIR_ANALYTICS_RUN}/${constituencyId}`);

export const getHighRiskBooths = (constituencyId: number, limit: number = 10) => 
    api.get(`${API_ENDPOINTS.SIR_ANALYTICS_HIGH_RISK}/${constituencyId}`, {
        params: { limit }
    });

export const getValidationSample = (constituencyId: number, samplePercent: number = 5.0) => 
    api.get(`${API_ENDPOINTS.SIR_ANALYTICS_VALIDATION_SAMPLE}/${constituencyId}`, {
        params: { sample_percent: samplePercent }
    });

export default api;
