import axios, { AxiosRequestConfig } from 'axios';
import { API_BASE_URL, API_ENDPOINTS, getAuthToken, buildApiUrl } from '../config/api';

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

export type VoterDataItem = {
    id: number;
    pdf_name?: string | null;
    page_number?: number | null;
    box_id?: number | null;
    epic_number?: string | null;
    name?: string | null;
    relative_name?: string | null;
    relation_type?: string | null;
    age?: number | null;
    gender?: string | null;
    house_no?: string | null;
    address?: string | null;
    constituency_name?: string | null;
    year?: string | null;
    booth_number?: string | null;
    source_pdf?: string | null;
    confidence_score?: number | null;
    created_at?: string | null;
};

export type VoterDataPage = {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
    items: VoterDataItem[];
};

export type VoterDataQualityRow = {
    pdf_name: string | null;
    total_records: number;
    epic_present_pct: number;
    name_present_pct: number;
    age_present_pct: number;
    gender_present_pct: number;
    house_no_present_pct: number;
    address_present_pct: number;
    avg_confidence_pct: number;
};

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
        const url = buildApiUrl(API_ENDPOINTS.SIR_PDF_FILES);
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
    use_textract?: boolean;
    extraction_config?: Record<string, number | string>;
    save_to_db?: boolean;
    year?: string;
}) => api.post(API_ENDPOINTS.SIR_EXTRACT_PDF_BY_PATH, body);

/** Debug PDF: returns raw page text and structure (when extraction returns 0 records). */
export const debugPdfRoll = (formData: FormData) =>
    api.post(API_ENDPOINTS.SIR_DEBUG_PDF, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });


/** ECI dropdown options: states (all), districts (by state), assembly constituencies (by state + district). */
export const getEciStates = () =>
  api.get<{ states: string[] }>(API_ENDPOINTS.SIR_ECI_STATES);
export const getEciDistricts = (state: string) =>
  api.get<{ districts: string[] }>(API_ENDPOINTS.SIR_ECI_DISTRICTS, { params: { state } });
export const getEciAssemblyConstituencies = (state: string, district: string) =>
  api.get<{ assembly_constituencies: string[] }>(API_ENDPOINTS.SIR_ECI_ASSEMBLY_CONSTITUENCIES, { params: { state, district } });

/** Docling-based extraction (layout-aware). Returns { total_extracted, is_scanned, data }. Optional max_pages limits PDF pages (default 15) to avoid OOM. */
export const extractWithDocling = (
    formData: FormData,
    config?: AxiosRequestConfig,
    params?: { max_pages?: number },
) => {
    const url = params?.max_pages != null
        ? `${API_ENDPOINTS.SIR_DOCLING_UPLOAD}?max_pages=${params.max_pages}`
        : API_ENDPOINTS.SIR_DOCLING_UPLOAD;
    return api.post(url, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30 * 60 * 1000,
        ...(config || {}),
    });
};

/** Database connection info (no password). */
export const getDbInfo = () => api.get(API_ENDPOINTS.DB_INFO);

/** Download electoral roll PDF from ECI portal. Returns { blob, recordSaved } so UI can show if DB record was saved. */
export const downloadEciRoll = async (params: {
    state?: string;
    revyear?: string;
    district?: string;
    ac_name?: string;
    language?: string;
    manual_captcha?: boolean;
}): Promise<{ blob: Blob; recordSaved: boolean }> => {
    const formData = new FormData();
    formData.append('state', params.state ?? 'Tamil Nadu');
    formData.append('revyear', params.revyear ?? '2026');
    formData.append('district', params.district ?? 'Chennai');
    formData.append('ac_name', params.ac_name ?? '11 - Dr.Radhakrishnan Nagar');
    formData.append('language', params.language ?? 'English');
    formData.append('manual_captcha', params.manual_captcha ? 'true' : 'false');
    const res = await api.post(API_ENDPOINTS.SIR_ECI_DOWNLOAD, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob',
        timeout: 600000, // 10 minutes — ECI download can take several minutes
    });
    const recordSaved = (res.headers['x-eci-record-saved'] ?? '').toLowerCase() === 'true';
    return { blob: res.data, recordSaved };
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

export const getConstituencies = (includeVoterData?: boolean) =>
    api.get(API_ENDPOINTS.SIR_DASHBOARD_CONSTITUENCIES, { params: includeVoterData ? { include_voter_data: true } : {} });

export const getVoterDataSummaryByConstituencyYear = () =>
    api.get(API_ENDPOINTS.SIR_VOTER_DATA_SUMMARY_BY_CONSTITUENCY_YEAR);
export const convertScannedPdf = (formData: FormData) =>
    api.post(API_ENDPOINTS.SIR_CONVERT_PDF, formData, { headers: { 'Content-Type': 'multipart/form-data' } });

/** SOP: Parse ECI electoral roll PDF (text or scanned); returns CSV file. */
export const parseElectoralRollPdf = (formData: FormData) =>
    api.post(API_ENDPOINTS.SIR_PARSE_ELECTORAL_PDF, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob',
    });

// Extract batches (automated file processing)
export const getExtractBatchesList = (params?: { skip?: number; limit?: number }) =>
    api.get(API_ENDPOINTS.EXTRACT_BATCHES_LIST, { params });
export const getExtractBatchDetail = (batchId: string) =>
    api.get(`${API_ENDPOINTS.EXTRACT_BATCH_DETAIL}/${batchId}`);
export const startExtractFolderWatcher = () =>
    api.post(API_ENDPOINTS.EXTRACT_BATCHES_START_WATCHER);
export const processExtractFile = (formData: FormData) =>
    api.post(API_ENDPOINTS.EXTRACT_BATCHES_PROCESS_FILE, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000,
    });

/** Summary of uploaded Pre-SIR and Post-SIR data per constituency/booth (see where your upload went). */
export const getRollSummary = () =>
    api.get(API_ENDPOINTS.SIR_DASHBOARD_ROLL_SUMMARY);

/** Sample of voter records for a constituency (pre or post roll) to verify extracted data. */
export const getRollSample = (constituencyId: number, roll: 'pre' | 'post', limit: number = 50) =>
    api.get(API_ENDPOINTS.SIR_DASHBOARD_ROLL_SAMPLE, {
        params: { constituency_id: constituencyId, roll, limit }
    });

export const getBulkVoterData = (params: {
    page?: number;
    page_size?: number;
    q?: string;
    pdf_name?: string;
}) => api.get<VoterDataPage>(API_ENDPOINTS.SIR_BULK_ELECTORAL_ROLL_DATA, { params });

export const getBulkVoterDataQuality = (limit: number = 500) =>
    api.get<{ count: number; items: VoterDataQualityRow[] }>(
        API_ENDPOINTS.SIR_BULK_ELECTORAL_ROLL_QUALITY,
        { params: { limit } }
    );

/** List server folder paths that contain PDFs (for bulk upload dropdown). */
export const getBulkFolderPaths = () =>
    api.get<{ paths: string[]; count: number }>(API_ENDPOINTS.SIR_BULK_FOLDER_PATHS);

/** Bulk Textract Extract: process all PDFs in a folder or uploaded files. Extracts via AWS Textract, inserts to voter_data, moves to extracted/. */
export const bulkTextractExtract = (formData: FormData) =>
    api.post(API_ENDPOINTS.SIR_BULK_TEXTTRACT_EXTRACT, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60 * 60 * 1000, // 1 hour for bulk processing
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
