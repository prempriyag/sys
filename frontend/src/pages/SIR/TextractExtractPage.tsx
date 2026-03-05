import React, { useState } from 'react';
import { extractPdfRoll, getDbInfo } from '../../services/api';
import PageContainer from '../../components/common/PageContainer';
import PageMeta from '../../components/common/PageMeta';
import ThemedLoader from '../../components/common/ThemedLoader';
import { alerterror, alertsuccess } from '../../utils/toast';
import { CopyIcon } from '../../icons';

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
  engine?: string;
  total_pages?: number;
  total_blocks?: number;
  year?: string;
  raw_tables?: Array<{
    table_index: number;
    page_number?: number;
    rows: string[][];
  }>;
}

interface RawTable {
  table_index: number;
  page_number?: number;
  rows: string[][];
}

const RawTablesPreview: React.FC<{ tables: RawTable[] }> = ({ tables }) => {
  const [expandedTables, setExpandedTables] = useState<Set<number>>(new Set());
  const toggleTable = (idx: number) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Raw tables from Textract ({tables.length} tables)
        </h3>
      </div>
      <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[50vh] overflow-y-auto">
        {tables.map((t) => {
          const isExpanded = expandedTables.has(t.table_index);
          const maxCols = Math.max(0, ...t.rows.map((r) => r.length));
          return (
            <div key={t.table_index} className="border-b border-gray-200 dark:border-gray-700 last:border-0">
              <button
                type="button"
                onClick={() => toggleTable(t.table_index)}
                className="w-full px-4 py-2 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
              >
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  Table {t.table_index} {t.page_number != null && `(page ${t.page_number})`} — {t.rows.length} rows × {maxCols} cols
                </span>
                <span className="text-gray-500">{isExpanded ? '▼' : '▶'}</span>
              </button>
              {isExpanded && (
                <div className="px-2 pb-2 overflow-x-auto">
                  <table className="min-w-full text-xs border border-gray-200 dark:border-gray-600">
                    <tbody>
                      {t.rows.map((row, rowIdx) => (
                        <tr key={rowIdx} className="border-b border-gray-100 dark:border-gray-600 last:border-0">
                          {Array.from({ length: maxCols }, (_, colIdx) => (
                            <td
                              key={colIdx}
                              className="px-2 py-1 border-r border-gray-100 dark:border-gray-600 last:border-r-0 align-top max-w-[200px] break-words"
                            >
                              {(row[colIdx] ?? '').trim() || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TextractExtractPage: React.FC = () => {
  const copyToClipboard = (text: string | number | null | undefined) => {
    const str = String(text ?? '').trim();
    if (!str) return;
    navigator.clipboard.writeText(str).then(() => {
      alertsuccess('Copied to clipboard!');
    }).catch(() => {});
  };

  const [file, setFile] = useState<File | null>(null);
  const [constituencyName, setConstituencyName] = useState('');
  const [boothNumber, setBoothNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<ExtractedRecord[]>([]);
  const [metadata, setMetadata] = useState<ExtractMetadata | null>(null);
  const [dbInfo, setDbInfo] = useState<any | null>(null);
  const [dbLoading, setDbLoading] = useState(false);

  const handleSubmit = async () => {
    if (!file) {
      alerterror('Please select a PDF file to upload');
      return;
    }

    setLoading(true);
    setRecords([]);
    setMetadata(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (constituencyName.trim()) formData.append('constituency_name', constituencyName.trim());
      if (boothNumber.trim()) formData.append('booth_number', boothNumber.trim());
      formData.append('use_textract', 'true');
      formData.append('save_to_db', 'true');

      const res = await extractPdfRoll(formData);
      const data = res.data as { records?: ExtractedRecord[]; metadata?: ExtractMetadata };
      setRecords(data.records ?? []);
      setMetadata(data.metadata ?? null);
      if ((data.records ?? []).length > 0) {
        alertsuccess(`Extracted ${data.records!.length} voter records via AWS Textract`);
      }
    } catch (e: any) {
      const msg = e.response?.data?.detail || e.message || 'Extraction failed';
      alerterror(Array.isArray(msg) ? msg.map((x: any) => x?.msg ?? x).join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  const loadDbInfo = async () => {
    setDbLoading(true);
    try {
      const res = await getDbInfo();
      setDbInfo(res.data);
    } catch {
      setDbInfo(null);
    } finally {
      setDbLoading(false);
    }
  };

  return (
    <PageContainer>
      <PageMeta
        title="AWS Textract Extract | SIR"
        description="Extract voter records from electoral roll PDF using AWS Textract"
      />
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow border border-gray-200 dark:border-gray-700 max-w-4xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">DB Detail</h2>
              {dbInfo?.database ? (
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                  {dbInfo.status} | {dbInfo.database.user}@{dbInfo.database.host}/{dbInfo.database.name}
                </p>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">DB info not available</p>
              )}
            </div>
            <button
              type="button"
              onClick={loadDbInfo}
              disabled={dbLoading}
              className="text-sm px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              {dbLoading ? 'Loading...' : 'Refresh DB Info'}
            </button>
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">AWS Textract Extract</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Cloud-based extraction for electoral roll PDFs. Upload a PDF — it will be sent to AWS Textract, processed, and extracted records saved to the database. Best for scanned PDFs and multi-page rolls (50+ pages).
          </p>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-900 dark:text-amber-100">
          <p className="font-semibold mb-2">Requirements</p>
          <ul className="list-disc list-inside space-y-1">
            <li>AWS credentials configured on the server (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)</li>
            <li>AWS_BUCKET set in backend .env</li>
            <li>PDFs are uploaded to S3, then processed by Textract async job</li>
          </ul>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 max-w-4xl">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Upload PDF</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select PDF file</label>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
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
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!file || loading}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <ThemedLoader size={16} />
                  Extracting via Textract...
                </span>
              ) : (
                'Extract & Save to DB'
              )}
            </button>
          </div>
        </div>

        {(metadata !== null || records.length > 0) && (
          <div className="space-y-4">
            {metadata && (
              <>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow border border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Document metadata (Textract)</h3>
                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <dt className="text-gray-500 dark:text-gray-400">Engine</dt>
                    <dd className="text-gray-900 dark:text-white">{metadata.engine ?? 'textract'}</dd>
                    <dt className="text-gray-500 dark:text-gray-400">Assembly Constituency</dt>
                    <dd className="text-gray-900 dark:text-white">{metadata.constituency_name || '—'}</dd>
                    <dt className="text-gray-500 dark:text-gray-400">Part No.</dt>
                    <dd className="text-gray-900 dark:text-white">{metadata.booth_number || '—'}</dd>
                    <dt className="text-gray-500 dark:text-gray-400">Pages processed</dt>
                    <dd className="text-gray-900 dark:text-white">{metadata.pages_processed ?? metadata.total_pages ?? '—'}</dd>
                    {metadata.year != null && (
                      <>
                        <dt className="text-gray-500 dark:text-gray-400">Year</dt>
                        <dd className="text-gray-900 dark:text-white">{metadata.year}</dd>
                      </>
                    )}
                  </dl>
                </div>
                {metadata.raw_tables && metadata.raw_tables.length > 0 && (
                  <RawTablesPreview tables={metadata.raw_tables} />
                )}
              </>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Extracted voter records ({records.length}) — click copy icon to copy
                </h3>
              </div>
              {records.length === 0 ? (
                <div className="p-6">
                  <p className="text-gray-500 dark:text-gray-400 text-sm text-center">
                    No voter records were extracted. Ensure the PDF contains ECI-style electoral roll with EPIC, Name, Father/Husband/Mother Name, House No, Age, Gender.
                  </p>
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
                        <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-200">Booth</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-200">Constituency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                      {records.map((r, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-3 py-2">{r.page_number ?? '—'}</td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center gap-1">
                              {r.epic_number ?? '—'}
                              {(r.epic_number ?? '').trim() && (
                                <button type="button" onClick={() => copyToClipboard(r.epic_number)} className="text-gray-400 hover:text-indigo-600" title="Copy"><CopyIcon className="w-3.5 h-3.5" /></button>
                              )}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center gap-1">
                              {r.name ?? '—'}
                              {(r.name ?? '').trim() && (
                                <button type="button" onClick={() => copyToClipboard(r.name)} className="text-gray-400 hover:text-indigo-600" title="Copy"><CopyIcon className="w-3.5 h-3.5" /></button>
                              )}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{r.relative_name ?? '—'}</td>
                          <td className="px-3 py-2">{r.age ?? '—'}</td>
                          <td className="px-3 py-2">{r.gender ?? '—'}</td>
                          <td className="px-3 py-2">{r.house_no ?? '—'}</td>
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

export default TextractExtractPage;
