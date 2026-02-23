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

/** Upload Pre-SIR electoral roll as PDF (ECI format). Optional: constituency_name, booth_number. */
export const uploadPreSirPdf = (formData: FormData) =>
    api.post(API_ENDPOINTS.SIR_UPLOAD_PRE_PDF, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });

/** Upload Post-SIR electoral roll as PDF (ECI format). Optional: constituency_name, booth_number. */
export const uploadPostSirPdf = (formData: FormData) =>
    api.post(API_ENDPOINTS.SIR_UPLOAD_POST_PDF, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });

/** Extract electoral roll from PDF only (no DB save). Returns { records, metadata } for preview. */
export const extractPdfRoll = (formData: FormData) =>
    api.post(API_ENDPOINTS.SIR_EXTRACT_PDF, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });

/** List PDF files in backend/pdf folder. Uses fetch fallback to avoid auth blocking. */
export const listPdfFiles = async (): Promise<{ data: { files: string[]; folder: string } }> => {
    try {
        const res = await api.get(API_ENDPOINTS.SIR_PDF_FILES);
        return res;
    } catch {
        const url = `${API_BASE_URL}${API_ENDPOINTS.SIR_PDF_FILES}`;
        const r = await fetch(url, { credentials: 'omit' });
        if (!r.ok) throw new Error(`Failed to load PDF list: ${r.status}`);
        const data = await r.json();
        return { data };
    }
};

/** Fetch PDF from backend/pdf as blob URL (supports auth). */
export const getPdfBlobUrl = async (filename: string): Promise<string> => {
    const res = await api.get(`${API_ENDPOINTS.SIR_PDF_FILE}?filename=${encodeURIComponent(filename)}`, {
        responseType: 'blob',
    });
    return URL.createObjectURL(res.data as Blob);
};

/** Extract from PDF in backend/pdf folder by filename. Supports extraction_config for coordinate tuning. */
export const extractPdfByPath = (body: {
    filename: string;
    constituency_name?: string;
    booth_number?: string;
    use_ocr?: boolean;
    extraction_config?: Record<string, number | string>;
}) => api.post(API_ENDPOINTS.SIR_EXTRACT_PDF_BY_PATH, body);

/** Debug PDF: returns raw page text and structure (when extraction returns 0 records). */
export const debugPdfRoll = (formData: FormData) =>
    api.post(API_ENDPOINTS.SIR_DEBUG_PDF, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });

/** Production v1: Extract voters (auto-detect text vs scanned). Returns { data, metadata, extraction_mode, errors, warnings }. */
export const extractVotersV1 = (formData: FormData) =>
    api.post(API_ENDPOINTS.EXTRACTOR_V1_EXTRACT, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });

/** Production v1: Extractor health (OCR engines, OpenCV, PyMuPDF availability). */
export const extractorHealth = () => api.get(API_ENDPOINTS.EXTRACTOR_V1_HEALTH);

/** Database connection info (no password). */
export const getDbInfo = () => api.get(API_ENDPOINTS.DB_INFO);

/** Download electoral roll PDF from ECI portal (automated: pre-fill, captcha OCR, select first row). Returns blob for PDF download. */
export const downloadEciRoll = async (params: {
    state?: string;
    revyear?: string;
    district?: string;
    ac_name?: string;
}): Promise<Blob> => {
    const formData = new FormData();
    formData.append('state', params.state ?? 'Andhra Pradesh');
    formData.append('revyear', params.revyear ?? '2025');
    formData.append('district', params.district ?? 'Kurnool');
    formData.append('ac_name', params.ac_name ?? 'Kurnool');
    const res = await api.post(API_ENDPOINTS.SIR_ECI_DOWNLOAD, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob',
    });
    return res.data;
};

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

/** Summary of uploaded Pre-SIR and Post-SIR data per constituency/booth (see where your upload went). */
export const getRollSummary = () =>
    api.get(API_ENDPOINTS.SIR_DASHBOARD_ROLL_SUMMARY);

/** Sample of voter records for a constituency (pre or post roll) to verify extracted data. */
export const getRollSample = (constituencyId: number, roll: 'pre' | 'post', limit: number = 50) =>
    api.get(API_ENDPOINTS.SIR_DASHBOARD_ROLL_SAMPLE, {
        params: { constituency_id: constituencyId, roll, limit }
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
