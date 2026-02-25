import React, { useMemo, useState } from "react";
import PageContainer from "../../components/common/PageContainer";
import PageMeta from "../../components/common/PageMeta";
import ThemedLoader from "../../components/common/ThemedLoader";
import { alerterror, alertsuccess } from "../../utils/toast";
import { debugPdfRoll, extractVotersV1, extractorHealth, getDbInfo } from "../../services/api";

type ExtractedRecord = Record<string, any> & {
  epic_number?: string | null;
  name?: string | null;
  relative_name?: string | null;
  age?: number | null;
  gender?: string | null;
  house_no?: string | null;
  address?: string | null;
  booth_number?: string | null;
  constituency_name?: string | null;
  page_number?: number;
  confidence?: number | null;
};

type ExtractResponse = {
  total_records?: number;
  high_confidence_records?: number;
  average_confidence?: number;
  extraction_mode?: string;
  data?: ExtractedRecord[];
  metadata?: Record<string, any>;
  errors?: any[];
  warnings?: any[];
};

type DbInfo = {
  status?: string;
  connection?: string;
  error?: string;
  database?: {
    host?: string;
    name?: string;
    user?: string;
    driver?: string;
    version?: string;
  };
};

type PdfDebugInfo = {
  table_count?: number;
  table_count_text_strategy?: number;
  table_preview?: Array<{
    table_index: number;
    strategy?: string;
    row_count: number;
    first_3_rows: any[];
  }>;
};

function normalizeConfidence(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  if (n >= 0 && n <= 1) return n;
  // Some OCR engines return 0-100
  if (n > 1 && n <= 100) return n / 100;
  return null;
}

function downloadBlob(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(records: ExtractedRecord[]): string {
  const headers = [
    "epic_number",
    "name",
    "relative_name",
    "age",
    "gender",
    "house_no",
    "address",
    "booth_number",
    "constituency_name",
    "page_number",
    "confidence",
  ];

  const escape = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    const needsQuotes = /[",\n]/.test(s);
    const escaped = s.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
  };

  const lines = [
    headers.join(","),
    ...records.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ];
  return lines.join("\n");
}

const OcrPdfDetector: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<Record<string, any> | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [dbInfo, setDbInfo] = useState<DbInfo | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [pdfDebug, setPdfDebug] = useState<PdfDebugInfo | null>(null);
  const [pdfDebugLoading, setPdfDebugLoading] = useState(false);

  const [constituencyName, setConstituencyName] = useState("");
  const [boothNumber, setBoothNumber] = useState("");
  const [forceOcr, setForceOcr] = useState(false);
  const [usePreprocessing, setUsePreprocessing] = useState(true);

  const [threshold, setThreshold] = useState(0.75);
  const [showLowOnly, setShowLowOnly] = useState(false);

  const [result, setResult] = useState<ExtractResponse | null>(null);
  const [records, setRecords] = useState<ExtractedRecord[]>([]);

  const fetchHealth = async () => {
    setHealthLoading(true);
    try {
      const res = await extractorHealth();
      setHealth(res.data);
    } catch {
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  };

  const fetchDbInfo = async () => {
    setDbLoading(true);
    try {
      const res = await getDbInfo();
      setDbInfo(res.data as DbInfo);
    } catch (e: any) {
      setDbInfo(null);
      alerterror(e?.response?.data?.detail || e?.message || "Failed to load DB info");
    } finally {
      setDbLoading(false);
    }
  };

  const fetchPdfTableDetail = async () => {
    if (!file) {
      alerterror("Please choose a PDF first.");
      return;
    }
    setPdfDebugLoading(true);
    setPdfDebug(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await debugPdfRoll(formData);
      const d = res.data as PdfDebugInfo;
      setPdfDebug(d);
    } catch (e: any) {
      alerterror(e?.response?.data?.detail || e?.message || "Failed to load PDF table detail");
    } finally {
      setPdfDebugLoading(false);
    }
  };

  const filteredRecords = useMemo(() => {
    if (!showLowOnly) return records;
    return records.filter((r) => {
      const c = normalizeConfidence(r.confidence);
      return c !== null && c < threshold;
    });
  }, [records, showLowOnly, threshold]);

  const lowCount = useMemo(() => {
    return records.filter((r) => {
      const c = normalizeConfidence(r.confidence);
      return c !== null && c < threshold;
    }).length;
  }, [records, threshold]);

  const onExtract = async () => {
    if (!file) {
      alerterror("Please choose a PDF first.");
      return;
    }
    setLoading(true);
    setResult(null);
    setRecords([]);
    setPdfDebug(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (constituencyName.trim()) formData.append("constituency_name", constituencyName.trim());
      if (boothNumber.trim()) formData.append("booth_number", boothNumber.trim());
      formData.append("force_ocr", forceOcr ? "true" : "false");
      formData.append("use_preprocessing", usePreprocessing ? "true" : "false");

      const res = await extractVotersV1(formData);
      const data = res.data as ExtractResponse;
      setResult(data);
      setRecords(Array.isArray(data.data) ? data.data : []);
      alertsuccess(`Extracted ${data.total_records ?? (data.data?.length ?? 0)} records`);
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail ||
        e?.message ||
        "Extraction failed.";
      alerterror(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  const setRowValue = (idx: number, key: string, value: any) => {
    setRecords((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  };

  return (
    <>
      <PageMeta title="OCR PDF Detector" />
      <PageContainer>
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">OCR PDF Detector</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Upload a voter-roll PDF, run card-level OCR extraction, review low-confidence rows, export clean JSON/CSV.
            </p>
          </div>
          <button
            onClick={fetchHealth}
            disabled={healthLoading}
            className="h-9 px-3 rounded border border-gray-200 dark:border-gray-800 disabled:opacity-60"
            title="Check OCR engine availability"
          >
            {healthLoading ? "Checking..." : "Check Health"}
          </button>
        </div>

        <div className="mb-4 rounded border border-gray-200 dark:border-gray-800 p-3 text-sm flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-medium mb-1">DB Detail</div>
            {dbInfo?.database ? (
              <div className="text-gray-700 dark:text-gray-300">
                {dbInfo.status} | {dbInfo.database.driver} | {dbInfo.database.user}@{dbInfo.database.host}/{dbInfo.database.name}{" "}
                {dbInfo.database.version ? `| ${dbInfo.database.version}` : ""}
              </div>
            ) : (
              <div className="text-gray-600 dark:text-gray-400">Not loaded</div>
            )}
          </div>
          <button
            onClick={fetchDbInfo}
            disabled={dbLoading}
            className="h-9 px-3 rounded border border-gray-200 dark:border-gray-800 disabled:opacity-60"
          >
            {dbLoading ? "Loading..." : "Load DB Info"}
          </button>
        </div>

        {health ? (
          <div className="mb-4 rounded border border-gray-200 dark:border-gray-800 p-3 text-sm">
            <div className="font-medium mb-1">Extractor Health</div>
            <div className="text-gray-700 dark:text-gray-300">
              status: {String(health.status)} | tesseract: {String(health.tesseract_available)} | easyocr:{" "}
              {String(health.easyocr_available)} | opencv: {String(health.opencv_available)}
            </div>
          </div>
        ) : null}

        <div className="rounded border border-gray-200 dark:border-gray-800 p-4 mb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-sm mb-1">PDF</label>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Constituency (optional)</label>
              <input
                className="h-10 px-3 rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
                value={constituencyName}
                onChange={(e) => setConstituencyName(e.target.value)}
                placeholder="Assembly Constituency"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Booth/Part No (optional)</label>
              <input
                className="h-10 px-3 rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
                value={boothNumber}
                onChange={(e) => setBoothNumber(e.target.value)}
                placeholder="Part No"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="forceOcr"
                type="checkbox"
                checked={forceOcr}
                onChange={(e) => setForceOcr(e.target.checked)}
              />
              <label htmlFor="forceOcr" className="text-sm">Force OCR</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="usePre"
                type="checkbox"
                checked={usePreprocessing}
                onChange={(e) => setUsePreprocessing(e.target.checked)}
              />
              <label htmlFor="usePre" className="text-sm">Use preprocessing</label>
            </div>
            <button
              onClick={onExtract}
              disabled={loading}
              className="h-10 px-4 rounded bg-brand-600 text-white disabled:opacity-60"
            >
              {loading ? "Processing..." : "Upload & Extract"}
            </button>
          </div>

          {loading ? (
            <div className="mt-3">
              <ThemedLoader />
            </div>
          ) : null}
        </div>

        {result ? (
          <div className="rounded border border-gray-200 dark:border-gray-800 p-4 mb-4 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <div>Total records: {String(result.total_records ?? records.length)}</div>
              <div>Low confidence (&lt; {threshold}): {String(lowCount)}</div>
              <div>Avg confidence: {String(result.average_confidence ?? "-")}</div>
              <div>Mode: {String(result.extraction_mode ?? "-")}</div>
            </div>
            {(result.errors?.length || result.warnings?.length) ? (
              <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                errors: {result.errors?.length ?? 0} | warnings: {result.warnings?.length ?? 0}
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2">
                <input
                  id="showLowOnly"
                  type="checkbox"
                  checked={showLowOnly}
                  onChange={(e) => setShowLowOnly(e.target.checked)}
                />
                <label htmlFor="showLowOnly">Show only low confidence</label>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm">Threshold</label>
                <input
                  className="h-9 w-24 px-2 rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                />
              </div>
              <button
                className="h-9 px-3 rounded border border-gray-200 dark:border-gray-800"
                onClick={() => downloadBlob("extracted_records.json", "application/json", JSON.stringify(filteredRecords, null, 2))}
              >
                Download JSON
              </button>
              <button
                className="h-9 px-3 rounded border border-gray-200 dark:border-gray-800"
                onClick={() => downloadBlob("extracted_records.csv", "text/csv", toCsv(filteredRecords))}
              >
                Download CSV
              </button>
              <button
                className="h-9 px-3 rounded border border-gray-200 dark:border-gray-800 disabled:opacity-60"
                onClick={fetchPdfTableDetail}
                disabled={pdfDebugLoading}
                title="Uses /api/upload/debug-pdf to show table structure preview"
              >
                {pdfDebugLoading ? "Loading..." : "Load PDF Table Detail"}
              </button>
            </div>
          </div>
        ) : null}

        {pdfDebug ? (
          <div className="rounded border border-gray-200 dark:border-gray-800 p-4 mb-4 text-sm">
            <div className="font-medium mb-2">PDF Table Detail (first page)</div>
            <div className="text-gray-700 dark:text-gray-300">
              tables: {String(pdfDebug.table_count ?? 0)} | tables (text strategy):{" "}
              {String(pdfDebug.table_count_text_strategy ?? 0)}
            </div>
            {pdfDebug.table_preview?.length ? (
              <div className="mt-3 space-y-2">
                {pdfDebug.table_preview.slice(0, 2).map((t) => (
                  <div key={t.table_index} className="rounded border border-gray-200 dark:border-gray-800 p-2">
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                      table {t.table_index} {t.strategy ? `(${t.strategy})` : ""} | rows: {t.row_count}
                    </div>
                    <pre className="text-xs whitespace-pre-wrap break-words font-mono bg-gray-50 dark:bg-gray-900 p-2 rounded">
                      {JSON.stringify(t.first_3_rows, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-gray-600 dark:text-gray-400">No table preview detected.</div>
            )}
          </div>
        ) : null}

        {records.length ? (
          <div className="rounded border border-gray-200 dark:border-gray-800 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="p-2 text-left">EPIC</th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Relative</th>
                  <th className="p-2 text-left">Age</th>
                  <th className="p-2 text-left">Gender</th>
                  <th className="p-2 text-left">House</th>
                  <th className="p-2 text-left">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((row, idx) => {
                  const c = normalizeConfidence(row.confidence);
                  const isLow = c !== null && c < threshold;
                  return (
                    <tr key={idx} className={isLow ? "bg-red-50 dark:bg-red-950/20" : ""}>
                      <td className="p-2">
                        <input
                          className="w-40 h-9 px-2 rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
                          value={row.epic_number ?? ""}
                          onChange={(e) => setRowValue(idx, "epic_number", e.target.value)}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          className="w-56 h-9 px-2 rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
                          value={row.name ?? ""}
                          onChange={(e) => setRowValue(idx, "name", e.target.value)}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          className="w-56 h-9 px-2 rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
                          value={row.relative_name ?? ""}
                          onChange={(e) => setRowValue(idx, "relative_name", e.target.value)}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          className="w-20 h-9 px-2 rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
                          value={row.age ?? ""}
                          onChange={(e) => setRowValue(idx, "age", e.target.value === "" ? null : Number(e.target.value))}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          className="w-24 h-9 px-2 rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
                          value={row.gender ?? ""}
                          onChange={(e) => setRowValue(idx, "gender", e.target.value)}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          className="w-24 h-9 px-2 rounded border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
                          value={row.house_no ?? ""}
                          onChange={(e) => setRowValue(idx, "house_no", e.target.value)}
                        />
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        {c === null ? "-" : c.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </PageContainer>
    </>
  );
};

export default OcrPdfDetector;

