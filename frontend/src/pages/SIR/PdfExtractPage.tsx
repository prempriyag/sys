import React, { useState, useEffect, useCallback } from 'react';
import { extractPdfRoll, extractPdfByPath, listPdfFiles, getPdfBlobUrl, debugPdfRoll } from '../../services/api';
import PageContainer from '../../components/common/PageContainer';
import PageMeta from '../../components/common/PageMeta';
import ThemedLoader from '../../components/common/ThemedLoader';
import { alerterror } from '../../utils/toast';
import PdfZoneEditor, { ZoneConfig } from '../../components/SIR/PdfZoneEditor';

/** Extracted voter record (matches backend electoral_roll_pdf_extractor schema). */
interface ExtractedRecord {
  epic_number: string | null;
  name: string | null;
  relative_name: string | null;
  age: number | null;
  gender: string | null;
  house_no: string | null;
  address: string | null;
  booth_number: string | null;
  constituency_name: string | null;
  page_number?: number;
}

interface ExtractMetadata {
  constituency_name?: string;
  booth_number?: string;
  part_name?: string;
  pages_processed?: number;
  raw_headers?: string[];
  /** TN ECI first-page metadata */
  revision_year?: string;
  qualifying_date?: string;
  type_of_revision?: string;
  date_of_publication?: string;
  polling_station?: string;
  address_of_polling_station?: string;
  type_of_polling_station?: string;
  parliamentary_constituency?: string;
  roll_identification?: string;
  main_town_or_village?: string;
  ward_no?: string;
  district?: string;
  sections_in_part?: string[];
  starting_serial_no?: string;
  ending_serial_no?: string;
  net_electors_male?: string;
  net_electors_female?: string;
  net_electors_third_gender?: string;
  net_electors_total?: string;
}

/** Extraction config for ABBYY-like coordinate tuning (3 sections × 3 cards = 9 per row). */
interface ExtractionConfig {
  cards_per_row?: number;
  header_top?: number;
  data_bottom?: number;
  margin_left?: number;
  margin_right?: number;
}

const DEFAULT_CONFIG: ExtractionConfig = {
  cards_per_row: 9,
  header_top: 120,
  data_bottom: 750,
  margin_left: 20,
  margin_right: 20,
};

function toZoneConfig(c: ExtractionConfig): ZoneConfig {
  return {
    cards_per_row: c.cards_per_row ?? 9,
    header_top: c.header_top ?? 120,
    data_bottom: c.data_bottom ?? 750,
    margin_left: c.margin_left ?? 20,
    margin_right: c.margin_right ?? 20,
  };
}

const PdfExtractPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [constituencyName, setConstituencyName] = useState('');
  const [boothNumber, setBoothNumber] = useState('');
  const [useOcr, setUseOcr] = useState(false);
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<ExtractedRecord[]>([]);
  const [metadata, setMetadata] = useState<ExtractMetadata | null>(null);
  const [rawPageTexts, setRawPageTexts] = useState<{ page: number; length: number; text: string }[]>([]);
  const [debugInfo, setDebugInfo] = useState<{ page_texts_full?: { page: number; length: number; text: string }[] } | null>(null);
  const [selectedFilename, setSelectedFilename] = useState<string>('');
  const [pdfFiles, setPdfFiles] = useState<string[]>([]);
  const [pdfFolder, setPdfFolder] = useState<string>('');
  const [pdfListLoading, setPdfListLoading] = useState(true);
  const [pdfListError, setPdfListError] = useState<string | null>(null);
  const [extractionConfig, setExtractionConfig] = useState<ExtractionConfig>({ ...DEFAULT_CONFIG });
  const [showConfig, setShowConfig] = useState(false);
  const [previewPage, setPreviewPage] = useState(3);

  const blobUrlRef = React.useRef<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    if (selectedFilename) {
      let cancelled = false;
      getPdfBlobUrl(selectedFilename).then((url) => {
        if (!cancelled) {
          blobUrlRef.current = url;
          setPdfUrl(url);
        }
      }).catch(() => setPdfUrl(null));
      return () => { cancelled = true; };
    }
    if (file) {
      const url = URL.createObjectURL(file);
      blobUrlRef.current = url;
      setPdfUrl(url);
    } else {
      setPdfUrl(null);
    }
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [selectedFilename, file]);

  const loadPdfList = useCallback(async () => {
    setPdfListLoading(true);
    setPdfListError(null);
    try {
      const res = await listPdfFiles();
      const data = res.data as { files?: string[]; folder?: string };
      setPdfFiles(data.files ?? []);
      setPdfFolder(data.folder ?? '');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load PDF list';
      setPdfListError(msg);
      setPdfFiles([]);
    } finally {
      setPdfListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPdfList();
  }, [loadPdfList]);

  const handleSubmit = async () => {
    const useFolder = selectedFilename && !file;
    if (!file && !selectedFilename) {
      alerterror('Please select a PDF from the folder dropdown or upload a file');
      return;
    }

    const cfg = Object.fromEntries(
      Object.entries(extractionConfig).filter(([, v]) => v !== '' && v !== undefined)
    ) as Record<string, number>;
    const hasConfig = Object.keys(cfg).length > 0;

    setLoading(true);
    setRecords([]);
    setMetadata(null);
    setRawPageTexts([]);
    setDebugInfo(null);
    try {
      if (useFolder) {
        const res = await extractPdfByPath({
          filename: selectedFilename,
          constituency_name: constituencyName.trim() || undefined,
          booth_number: boothNumber.trim() || undefined,
          use_ocr: useOcr,
          extraction_config: hasConfig ? cfg : undefined,
        });
        const data = res.data as { records?: ExtractedRecord[]; metadata?: ExtractMetadata; raw_page_texts?: { page: number; length: number; text: string }[] };
        setRecords(data.records ?? []);
        setMetadata(data.metadata ?? null);
        setRawPageTexts(data.raw_page_texts ?? []);
      } else {
        const formData = new FormData();
        formData.append('file', file!);
        if (constituencyName.trim()) formData.append('constituency_name', constituencyName.trim());
        if (boothNumber.trim()) formData.append('booth_number', boothNumber.trim());
        formData.append('use_ocr', useOcr ? 'true' : 'false');
        if (hasConfig) formData.append('extraction_config_json', JSON.stringify(cfg));

        const res = await extractPdfRoll(formData);
        const data = res.data as { records?: ExtractedRecord[]; metadata?: ExtractMetadata; raw_page_texts?: { page: number; length: number; text: string }[] };
        setRecords(data.records ?? []);
        setMetadata(data.metadata ?? null);
        setRawPageTexts(data.raw_page_texts ?? []);
      }
    } catch (e: any) {
      const msg = e.response?.data?.detail || e.message || 'Extraction failed';
      alerterror(Array.isArray(msg) ? msg.map((x: any) => x?.msg ?? x).join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDebug = async () => {
    if (!file) {
      alerterror('Debug requires an uploaded file (select from folder does not support debug)');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    setDebugInfo(null);
    try {
      const res = await debugPdfRoll(formData);
      setDebugInfo(res.data as { page_texts_full?: { page: number; length: number; text: string }[] });
    } catch (e: any) {
      alerterror(e.response?.data?.detail || e.message || 'Debug failed');
    }
  };

  const pageTextsToShow = (rawPageTexts.length > 0 ? rawPageTexts : debugInfo?.page_texts_full ?? []);

  return (
    <PageContainer>
      <PageMeta
        title="Extract PDF Roll | SIR"
        description="Upload an ECI-style electoral roll PDF and preview extracted voter data"
      />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Extract PDF Roll</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Upload an electoral roll PDF (e.g. SIR Draft Roll). Click Submit to extract and view data below. Data is not saved to the database.
          </p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm text-blue-900 dark:text-blue-100">
          <p className="font-semibold mb-2">Supported format: Tamil Nadu ECI electoral roll (e.g. ELECTORAL ROLL 2026 S22)</p>
          <p className="mb-2">Data extracted — easy reference:</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="font-medium mb-1">From first page (cover)</p>
              <ul className="list-disc list-inside space-y-0.5 text-blue-800 dark:text-blue-200">
                <li>Assembly Constituency</li>
                <li>Part No. (booth)</li>
                <li>Parliamentary Constituency</li>
                <li>Year of revision, Qualifying date</li>
                <li>Type of revision, Date of publication</li>
                <li>Roll identification</li>
                <li>Sections in the part</li>
                <li>Main town/village, Ward no., District</li>
                <li>Polling station name & address</li>
                <li>Type of polling station</li>
                <li>Starting/Ending serial no.</li>
                <li>Net electors (Male, Female, Third, Total)</li>
              </ul>
            </div>
            <div>
              <p className="font-medium mb-1">From data pages (per voter)</p>
              <ul className="list-disc list-inside space-y-0.5 text-blue-800 dark:text-blue-200">
                <li>EPIC number</li>
                <li>Name</li>
                <li>Father / Husband / Mother name</li>
                <li>House number</li>
                <li>Age</li>
                <li>Gender</li>
                <li>Booth number & Constituency (from first page)</li>
              </ul>
            </div>
          </div>
          <p className="mt-2 text-blue-800 dark:text-blue-200">Layout: 3 sections per row × 3 cards per section = 9 voters per row. Move PDF to backend/pdf folder to select from dropdown.</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 max-w-4xl">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Select or Upload PDF</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select from folder (backend/pdf)</label>
              <div className="flex gap-2">
                <select
                  value={selectedFilename}
                  onChange={(e) => {
                    setSelectedFilename(e.target.value);
                    if (e.target.value) setFile(null);
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  disabled={loading || pdfListLoading}
                >
                  <option value="">
                    {pdfListLoading ? 'Loading...' : pdfFiles.length === 0 ? '— No PDFs found —' : '— Choose PDF —'}
                  </option>
                  {pdfFiles.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={loadPdfList}
                  disabled={pdfListLoading}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                  title="Refresh list"
                >
                  {pdfListLoading ? '...' : '↻'}
                </button>
              </div>
              {pdfListError && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{pdfListError}</p>
              )}
              {pdfFolder && !pdfListError && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Folder: {pdfFolder} — Copy your PDF here, then click ↻ to refresh.
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Or upload PDF file</label>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  if (e.target.files?.[0]) setSelectedFilename('');
                }}
                className="block w-full text-sm text-gray-500 dark:text-gray-400
                  file:mr-4 file:py-2 file:px-4 file:rounded-lg
                  file:border-0 file:text-sm file:font-semibold
                  file:bg-indigo-50 file:text-indigo-700 dark:file:bg-indigo-900/20 dark:file:text-indigo-400
                  hover:file:bg-indigo-100 dark:hover:file:bg-indigo-900/30
                  cursor-pointer"
                disabled={loading}
              />
              {file && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Constituency name (optional)</label>
                <input
                  type="text"
                  value={constituencyName}
                  onChange={(e) => setConstituencyName(e.target.value)}
                  placeholder="e.g. Chennai North"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Booth / Part number (optional)</label>
                <input
                  type="text"
                  value={boothNumber}
                  onChange={(e) => setBoothNumber(e.target.value)}
                  placeholder="e.g. 20"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="use-ocr"
                  checked={useOcr}
                  onChange={(e) => setUseOcr(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                <label htmlFor="use-ocr" className="text-sm text-gray-700 dark:text-gray-300">
                  Use OCR (for scanned/image-only PDFs — slower, requires Tesseract/PyMuPDF)
                </label>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
              <button
                type="button"
                onClick={() => setShowConfig(!showConfig)}
                className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {showConfig ? '▼' : '▶'} Extraction format (ABBYY-like coordinates)
              </button>
              {showConfig && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Cards/row</label>
                    <input
                      type="number"
                      min={3}
                      max={12}
                      value={extractionConfig.cards_per_row ?? ''}
                      onChange={(e) => setExtractionConfig((c) => ({ ...c, cards_per_row: e.target.value ? parseInt(e.target.value, 10) : undefined }))}
                      placeholder="9"
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Header top (y)</label>
                    <input
                      type="number"
                      value={extractionConfig.header_top ?? ''}
                      onChange={(e) => setExtractionConfig((c) => ({ ...c, header_top: e.target.value ? parseFloat(e.target.value) : undefined }))}
                      placeholder="120"
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Data bottom (y)</label>
                    <input
                      type="number"
                      value={extractionConfig.data_bottom ?? ''}
                      onChange={(e) => setExtractionConfig((c) => ({ ...c, data_bottom: e.target.value ? parseFloat(e.target.value) : undefined }))}
                      placeholder="750"
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Margin left</label>
                    <input
                      type="number"
                      value={extractionConfig.margin_left ?? ''}
                      onChange={(e) => setExtractionConfig((c) => ({ ...c, margin_left: e.target.value ? parseFloat(e.target.value) : undefined }))}
                      placeholder="20"
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Margin right</label>
                    <input
                      type="number"
                      value={extractionConfig.margin_right ?? ''}
                      onChange={(e) => setExtractionConfig((c) => ({ ...c, margin_right: e.target.value ? parseFloat(e.target.value) : undefined }))}
                      placeholder="20"
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={(!file && !selectedFilename) || loading}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <ThemedLoader size={16} />
                  Extracting...
                </span>
              ) : (
                'Submit'
              )}
            </button>
          </div>
        </div>

        {/* ABBYY-style: PDF + zones (left) | Extracted data (right) */}
        {pdfUrl && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Document — extraction zones</h3>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 dark:text-gray-400">Page</label>
                  <input
                    type="number"
                    min={1}
                    value={previewPage}
                    onChange={(e) => setPreviewPage(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-14 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                  />
                </div>
              </div>
              <div className="p-4">
                <PdfZoneEditor
                  pdfUrl={pdfUrl}
                  config={toZoneConfig(extractionConfig)}
                  onConfigChange={(c) => setExtractionConfig((prev) => ({ ...prev, ...c }))}
                  page={previewPage}
                  editable={true}
                />
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Extracted data</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Click Submit above to extract. Records appear here.
                </p>
              </div>
              <div className="flex-1 overflow-auto p-4 min-h-[300px]">
                {records.length === 0 && !loading && (
                  <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-8">
                    No records yet. Adjust zones if needed, then click Submit.
                  </p>
                )}
                {records.length > 0 && (
                  <div className="overflow-x-auto max-h-[60vh]">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200">Page</th>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200">EPIC</th>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200">Name</th>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200">Relative</th>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200">Age</th>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200">Gender</th>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-700 dark:text-gray-200">House</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                        {records.slice(0, 100).map((r, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-2 py-1.5 text-gray-900 dark:text-white">{r.page_number ?? '—'}</td>
                            <td className="px-2 py-1.5 text-gray-900 dark:text-white">{r.epic_number ?? '—'}</td>
                            <td className="px-2 py-1.5 text-gray-900 dark:text-white">{r.name ?? '—'}</td>
                            <td className="px-2 py-1.5 text-gray-600 dark:text-gray-300">{r.relative_name ?? '—'}</td>
                            <td className="px-2 py-1.5">{r.age ?? '—'}</td>
                            <td className="px-2 py-1.5">{r.gender ?? '—'}</td>
                            <td className="px-2 py-1.5">{r.house_no ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {records.length > 100 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 py-2">Showing first 100 of {records.length}</p>
                    )}
                  </div>
                )}
                {loading && (
                  <div className="flex items-center justify-center py-12">
                    <ThemedLoader size={24} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Extracted data below (full view) */}
        {(metadata !== null || records.length > 0 || rawPageTexts.length > 0 || (debugInfo?.page_texts_full?.length ?? 0) > 0) && (
          <div className="space-y-4">
            {/* 1. Entire raw extracted text (show first so user sees what was read from PDF) */}
            {pageTextsToShow.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    1. Raw extracted text (entire) — what was read from the PDF
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Full text per page. Used for parsing constituency, Part No., and voter cards.
                  </p>
                </div>
                <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                  {pageTextsToShow.map((p) => (
                    <div key={p.page} className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200">
                        Page {p.page} — {p.length} characters
                      </div>
                      <pre className="p-4 text-xs whitespace-pre-wrap break-words font-mono bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 min-h-[80px]">
                        {p.text || '(empty — image-only PDF: OCR runs automatically; if still empty, enable "Use OCR" above and install: pip install pymupdf pytesseract + Tesseract from https://github.com/UB-Mannheim/tesseract/wiki)'}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Metadata */}
            {metadata && (
              <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">2. Extraction metadata</h3>
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  {metadata.constituency_name != null && (
                    <>
                      <dt className="text-gray-500 dark:text-gray-400">Assembly Constituency</dt>
                      <dd className="text-gray-900 dark:text-white">{metadata.constituency_name || '—'}</dd>
                    </>
                  )}
                  {metadata.booth_number != null && (
                    <>
                      <dt className="text-gray-500 dark:text-gray-400">Part No.</dt>
                      <dd className="text-gray-900 dark:text-white">{metadata.booth_number || '—'}</dd>
                    </>
                  )}
                  {metadata.part_name != null && (
                    <>
                      <dt className="text-gray-500 dark:text-gray-400">Part name</dt>
                      <dd className="text-gray-900 dark:text-white">{metadata.part_name || '—'}</dd>
                    </>
                  )}
                  {metadata.pages_processed != null && (
                    <>
                      <dt className="text-gray-500 dark:text-gray-400">Pages processed</dt>
                      <dd className="text-gray-900 dark:text-white">{metadata.pages_processed}</dd>
                    </>
                  )}
                  {metadata.revision_year != null && (
                    <>
                      <dt className="text-gray-500 dark:text-gray-400">Year of revision</dt>
                      <dd className="text-gray-900 dark:text-white">{metadata.revision_year}</dd>
                    </>
                  )}
                  {metadata.qualifying_date != null && (
                    <>
                      <dt className="text-gray-500 dark:text-gray-400">Qualifying date</dt>
                      <dd className="text-gray-900 dark:text-white">{metadata.qualifying_date}</dd>
                    </>
                  )}
                  {metadata.date_of_publication != null && (
                    <>
                      <dt className="text-gray-500 dark:text-gray-400">Date of publication</dt>
                      <dd className="text-gray-900 dark:text-white">{metadata.date_of_publication}</dd>
                    </>
                  )}
                  {metadata.type_of_revision != null && (
                    <>
                      <dt className="text-gray-500 dark:text-gray-400">Type of revision</dt>
                      <dd className="text-gray-900 dark:text-white">{metadata.type_of_revision}</dd>
                    </>
                  )}
                  {metadata.parliamentary_constituency != null && metadata.parliamentary_constituency !== '' && (
                    <>
                      <dt className="text-gray-500 dark:text-gray-400">Parliamentary Constituency</dt>
                      <dd className="text-gray-900 dark:text-white">{metadata.parliamentary_constituency}</dd>
                    </>
                  )}
                  {metadata.roll_identification != null && metadata.roll_identification !== '' && (
                    <>
                      <dt className="text-gray-500 dark:text-gray-400">Roll Identification</dt>
                      <dd className="text-gray-900 dark:text-white">{metadata.roll_identification}</dd>
                    </>
                  )}
                  {metadata.main_town_or_village != null && metadata.main_town_or_village !== '' && (
                    <>
                      <dt className="text-gray-500 dark:text-gray-400">Main Town / Village</dt>
                      <dd className="text-gray-900 dark:text-white">{metadata.main_town_or_village}</dd>
                    </>
                  )}
                  {metadata.ward_no != null && metadata.ward_no !== '' && (
                    <>
                      <dt className="text-gray-500 dark:text-gray-400">Ward no.</dt>
                      <dd className="text-gray-900 dark:text-white">{metadata.ward_no}</dd>
                    </>
                  )}
                  {metadata.district != null && metadata.district !== '' && (
                    <>
                      <dt className="text-gray-500 dark:text-gray-400">District</dt>
                      <dd className="text-gray-900 dark:text-white">{metadata.district}</dd>
                    </>
                  )}
                  {metadata.type_of_polling_station != null && metadata.type_of_polling_station !== '' && (
                    <>
                      <dt className="text-gray-500 dark:text-gray-400">Type of Polling Station</dt>
                      <dd className="text-gray-900 dark:text-white">{metadata.type_of_polling_station}</dd>
                    </>
                  )}
                  {metadata.starting_serial_no != null && (
                    <>
                      <dt className="text-gray-500 dark:text-gray-400">Starting Serial No.</dt>
                      <dd className="text-gray-900 dark:text-white">{metadata.starting_serial_no}</dd>
                    </>
                  )}
                  {metadata.ending_serial_no != null && (
                    <>
                      <dt className="text-gray-500 dark:text-gray-400">Ending Serial No.</dt>
                      <dd className="text-gray-900 dark:text-white">{metadata.ending_serial_no}</dd>
                    </>
                  )}
                  {(metadata.net_electors_male != null || metadata.net_electors_total != null) && (
                    <>
                      <dt className="text-gray-500 dark:text-gray-400">Net Electors</dt>
                      <dd className="text-gray-900 dark:text-white">
                        {[metadata.net_electors_male != null && `Male: ${metadata.net_electors_male}`, metadata.net_electors_female != null && `Female: ${metadata.net_electors_female}`, metadata.net_electors_third_gender != null && `Third: ${metadata.net_electors_third_gender}`, metadata.net_electors_total != null && `Total: ${metadata.net_electors_total}`].filter(Boolean).join(' · ')}
                      </dd>
                    </>
                  )}
                </dl>
                {metadata.polling_station != null && metadata.polling_station !== '' && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium">Polling station:</span> {metadata.polling_station}
                  </p>
                )}
                {metadata.address_of_polling_station != null && metadata.address_of_polling_station !== '' && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium">Address of Polling Station:</span> {metadata.address_of_polling_station}
                  </p>
                )}
                {metadata.sections_in_part != null && metadata.sections_in_part.length > 0 && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium">Sections in part:</span> {metadata.sections_in_part.join('; ')}
                  </p>
                )}
                {metadata.raw_headers && metadata.raw_headers.length > 0 && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Detected columns: {metadata.raw_headers.filter(Boolean).join(', ') || '—'}
                  </p>
                )}
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  3. Extracted records ({records.length})
                </h3>
              </div>
              {records.length === 0 ? (
                <div className="p-6">
                  <p className="text-gray-500 dark:text-gray-400 text-sm text-center mb-4">
                    No voter records were extracted. Check the raw text above — it should contain EPIC, Name, Father/Husband/Mother Name, House No, Age, Gender. If raw text is empty, the PDF may be image-only.
                  </p>
                  {file && !debugInfo && (
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={handleDebug}
                        className="text-sm px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        Load full raw text (debug)
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-200">Page</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-200">EPIC No</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-200">Name</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-200">Relative</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-200">Age</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-200">Gender</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-200">House No</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-200">Address</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-200">Booth</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-200">Constituency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                      {records.map((r, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-3 py-2 text-gray-900 dark:text-white">{r.page_number ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-900 dark:text-white">{r.epic_number ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-900 dark:text-white">{r.name ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{r.relative_name ?? '—'}</td>
                          <td className="px-3 py-2">{r.age ?? '—'}</td>
                          <td className="px-3 py-2">{r.gender ?? '—'}</td>
                          <td className="px-3 py-2">{r.house_no ?? '—'}</td>
                          <td className="px-3 py-2 max-w-[200px] truncate text-gray-600 dark:text-gray-300" title={r.address ?? ''}>{r.address ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{r.booth_number ?? '—'}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{r.constituency_name ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
};

export default PdfExtractPage;
