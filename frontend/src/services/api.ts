import axios, { AxiosRequestConfig } from 'axios';
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

/** Bulk Electoral Roll: folder_path (server path) or multiple PDF files. Returns total_found, inserted, duplicates_skipped, invalid_epic_count, invalid_epics. */
export const bulkElectoralRoll = (formData: FormData, config?: AxiosRequestConfig) =>
    api.post(API_ENDPOINTS.SIR_BULK_ELECTORAL_ROLL, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 600000,
        ...(config || {}),
    });

export type BulkProgress = { current: number; total: number; pdf_name: string; records_so_far: number };
export type BulkResult = {
    total_found?: number;
    inserted?: number;
    duplicates_skipped?: number;
    invalid_epic_count?: number;
    invalid_epics?: string[];
    pdf_count?: number;
    moved_count?: number;
    extracted_folder?: string;
    message?: string;
    errors?: string[];
};

/** Bulk with progress: POST to stream endpoint, call onProgress for each event, resolve with result on 'done'. */
export async function bulkElectoralRollWithProgress(
    formData: FormData,
    onProgress: (p: BulkProgress) => void,
): Promise<BulkResult> {
    const token = getAuthToken();
    const url = `${API_BASE_URL}${API_ENDPOINTS.SIR_BULK_ELECTORAL_ROLL_STREAM}`;
    const res = await fetch(url, {
        method: 'POST',
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: AbortSignal.timeout(600000),
    });
    if (!res.ok) {
        const t = await res.text();
        throw new Error(t || res.statusText);
    }
    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');
    const dec = new TextDecoder();
    let buffer = '';
    let result: BulkResult = {};
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += dec.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                try {
                    const data = JSON.parse(line.slice(6));
                    if (data.type === 'progress') {
                        onProgress({
                            current: data.current,
                            total: data.total,
                            pdf_name: data.pdf_name ?? '',
                            records_so_far: data.records_so_far ?? 0,
                        });
                    } else if (data.type === 'done' && data.result) {
                        result = data.result;
                    } else if (data.type === 'error') {
                        throw new Error(data.detail ?? 'Stream error');
                    }
                } catch (e) {
                    if (e instanceof SyntaxError) continue;
                    throw e;
                }
            }
        }
    }
    return result;
}

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


/** ECI dropdown options: states (all), districts (by state), assembly constituencies (by state + district). */
export const getEciStates = () =>
  api.get<{ states: string[] }>(API_ENDPOINTS.SIR_ECI_STATES);
export const getEciDistricts = (state: string) =>
  api.get<{ districts: string[] }>(API_ENDPOINTS.SIR_ECI_DISTRICTS, { params: { state } });
export const getEciAssemblyConstituencies = (state: string, district: string) =>
  api.get<{ assembly_constituencies: string[] }>(API_ENDPOINTS.SIR_ECI_ASSEMBLY_CONSTITUENCIES, { params: { state, district } });

/** Production v1: Extract voters (auto-detect text vs scanned). Returns { data, metadata, extraction_mode, errors, warnings }. Use max_pages in form to limit OCR and avoid timeout. */
export const extractVotersV1 = (formData: FormData, config?: AxiosRequestConfig) =>
    api.post(API_ENDPOINTS.EXTRACTOR_V1_EXTRACT, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 15 * 60 * 1000,
        ...(config || {}),
    });

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

/** Production v1: Upload extracted OCR records to sys DB (table ocr_voter_uploads). */
export const uploadOcrRecords = (payload: {
  records: Array<Record<string, any>>;
  constituency_name?: string;
  booth_number?: string;
}) => api.post(API_ENDPOINTS.EXTRACTOR_V1_OCR_UPLOAD, payload);

/** Production v1: Extractor health (OCR engines, OpenCV, PyMuPDF availability). */
export const extractorHealth = () => api.get(API_ENDPOINTS.EXTRACTOR_V1_HEALTH);

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
