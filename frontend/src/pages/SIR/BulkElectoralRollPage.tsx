import React, { useState, useRef } from 'react';
import PageContainer from '../../components/common/PageContainer';
import PageMeta from '../../components/common/PageMeta';
import ThemedLoader from '../../components/common/ThemedLoader';
import { alerterror, alertsuccess } from '../../utils/toast';
import { bulkElectoralRollWithProgress } from '../../services/api';

const BulkElectoralRollPage: React.FC = () => {
  const [folderPath, setFolderPath] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [constituencyName, setConstituencyName] = useState('');
  const [year, setYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; pdf_name: string; records_so_far: number } | null>(null);
  const [result, setResult] = useState<{
    total_found: number;
    inserted: number;
    duplicates_skipped: number;
    invalid_epic_count: number;
    invalid_epics: string[];
    pdf_count?: number;
    moved_count?: number;
    extracted_folder?: string;
    message?: string;
    errors?: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedFolderName, setSelectedFolderName] = useState<string>('');

  const useServerFolder = folderPath.trim() !== '';
  const canSubmit = useServerFolder || selectedFiles.length > 0;

  async function collectPdfsFromDir(handle: FileSystemDirectoryHandle): Promise<File[]> {
    const pdfs: File[] = [];
    for await (const entry of handle.values()) {
      if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.pdf')) {
        pdfs.push(await (entry as FileSystemFileHandle).getFile());
      }
      if (entry.kind === 'directory') {
        pdfs.push(...(await collectPdfsFromDir(entry as FileSystemDirectoryHandle)));
      }
    }
    return pdfs;
  }

  const handleSelectFolder = async () => {
    if (typeof (window as any).showDirectoryPicker !== 'function') {
      alerterror('Select folder is not supported in this browser. Use "Pick PDF files" below.');
      return;
    }
    try {
      const dirHandle = await (window as any).showDirectoryPicker();
      const pdfs = await collectPdfsFromDir(dirHandle);
      setSelectedFiles(pdfs);
      setSelectedFolderName(dirHandle.name || '');
      if (pdfs.length === 0) {
        alerterror('No PDF files found in the selected folder.');
      } else {
        alertsuccess(`${pdfs.length} PDF(s) loaded from folder "${dirHandle.name}".`);
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        alerterror(e?.message ?? 'Could not read folder.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    const pdfs = files.filter((f) => f.name.toLowerCase().endsWith('.pdf'));
    setSelectedFiles(pdfs);
    setSelectedFolderName('');
    if (files.length !== pdfs.length) {
      alerterror('Only PDF files are used. Non-PDF files were ignored.');
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      alerterror('Enter server folder path or select folder / pick PDF files.');
      return;
    }
    setLoading(true);
    setResult(null);
    setProgress(null);
    try {
      const formData = new FormData();
      if (useServerFolder) {
        formData.append('folder_path', folderPath.trim());
      }
      if (selectedFiles.length > 0) {
        selectedFiles.forEach((f) => formData.append('files', f));
      }
      if (constituencyName.trim()) {
        formData.append('constituency_name', constituencyName.trim());
      }
      if (year.trim()) {
        formData.append('year', year.trim());
      }
      if (state.trim()) {
        formData.append('state', state.trim());
      }
      if (district.trim()) {
        formData.append('district', district.trim());
      }
      const data = await bulkElectoralRollWithProgress(formData, (p) => setProgress(p));
      setResult({
        total_found: data.total_found ?? 0,
        inserted: data.inserted ?? 0,
        duplicates_skipped: data.duplicates_skipped ?? 0,
        invalid_epic_count: data.invalid_epic_count ?? 0,
        invalid_epics: data.invalid_epics ?? [],
        pdf_count: data.pdf_count,
        moved_count: data.moved_count,
        extracted_folder: data.extracted_folder,
        message: data.message,
        errors: data.errors ?? [],
      });
      setProgress(null);
      alertsuccess(
        `Done: ${data.inserted ?? 0} inserted, ${data.duplicates_skipped ?? 0} duplicates skipped, ${data.invalid_epic_count ?? 0} invalid EPICs.`
      );
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? e?.message ?? 'Bulk processing failed.';
      alerterror(typeof msg === 'string' ? msg : JSON.stringify(msg));
      setProgress(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <PageMeta
        title="Bulk Electoral Roll"
        description="Process multiple Electoral Roll PDFs: text or scanned, EPIC validation, bulk insert (UNIQUE)."
      />
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Bulk Electoral Roll Import
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Server folder path, or choose folder / pick PDF files. One box = one insert.
        </p>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Server folder path
            </label>
            <input
              type="text"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              placeholder="e.g. C:\...\download\Tamil_Nadu\2026\Erode\Constituency"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              disabled={loading}
            />
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <button
              type="button"
              onClick={handleSelectFolder}
              disabled={loading}
              className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition font-medium"
            >
              Choose folder
            </button>
            <label className="cursor-pointer px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition font-medium inline-block">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                multiple
                onChange={handleFileChange}
                className="hidden"
                disabled={loading}
              />
              Pick PDF files
            </label>
            {(selectedFolderName || selectedFiles.length > 0) && (
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {selectedFolderName ? `${selectedFolderName} — ` : ''}{selectedFiles.length} PDF(s)
              </span>
            )}
          </div>

          <details className="text-sm text-gray-600 dark:text-gray-400">
            <summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-300">Optional: State, Year, District, Constituency</summary>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">State</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="Tamil Nadu"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Year</label>
                <input
                  type="text"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="2026"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">District</label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="Erode"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Constituency</label>
                <input
                  type="text"
                  value={constituencyName}
                  onChange={(e) => setConstituencyName(e.target.value)}
                  placeholder="Constituency name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                  disabled={loading}
                />
              </div>
            </div>
          </details>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !canSubmit}
          className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <ThemedLoader size={16} />
              Processing…
            </span>
          ) : (
            'Start Processing'
          )}
        </button>

        {loading && progress && (
          <div className="mt-6 p-4 border border-emerald-200 dark:border-emerald-800 rounded-lg bg-emerald-50/50 dark:bg-gray-900">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">Progress</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                <span>PDF {progress.current} of {progress.total}</span>
                <span>{progress.records_so_far.toLocaleString()} records inserted</span>
              </div>
              <div className="h-2.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all duration-300"
                  style={{ width: progress.total ? `${(100 * progress.current) / progress.total}%` : '0%' }}
                />
              </div>
              {progress.pdf_name && (
                <p className="text-xs font-mono text-gray-600 dark:text-gray-400 truncate" title={progress.pdf_name}>
                  Current: {progress.pdf_name}
                </p>
              )}
            </div>
          </div>
        )}

        {result && (
          <div className="mt-6 p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">Result</h3>
            <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
              <li>
                <strong>Total found:</strong> {result.total_found}
              </li>
              <li>
                <strong>Inserted:</strong> {result.inserted}
              </li>
              <li>
                <strong>Duplicates skipped:</strong> {result.duplicates_skipped}
              </li>
              <li>
                <strong>Invalid EPIC count:</strong> {result.invalid_epic_count}
              </li>
              {result.pdf_count != null && (
                <li>
                  <strong>PDFs processed:</strong> {result.pdf_count}
                </li>
              )}
              {result.moved_count != null && (
                <li>
                  <strong>PDFs moved to extracted:</strong> {result.moved_count}
                </li>
              )}
              {result.extracted_folder && (
                <li>
                  <strong>Extracted folder:</strong>{' '}
                  <span className="font-mono text-xs break-all">{result.extracted_folder}</span>
                </li>
              )}
              {result.message && <li>{result.message}</li>}
            </ul>
            {result.errors && result.errors.length > 0 && (
              <div className="mt-3 p-3 border border-red-300 dark:border-red-700 rounded-lg bg-red-50 dark:bg-red-900/20">
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  Insert failed for some PDFs (data not saved to database):
                </p>
                <ul className="mt-1 text-xs text-red-700 dark:text-red-300 font-mono space-y-1">
                  {result.errors.slice(0, 10).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
                {result.errors.length > 10 && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">… and {result.errors.length - 10} more</p>
                )}
                {(result.inserted === 0 && result.errors.some((e) => /column|does not exist|relation|pdf_name|box_id/i.test(e))) && (
                  <p className="mt-2 text-sm font-medium text-red-800 dark:text-red-200">
                    Fix: Run migration so voter_data has required columns. In backend folder run: <code className="bg-red-100 dark:bg-red-900/40 px-1 rounded">alembic upgrade head</code> or run <code className="bg-red-100 dark:bg-red-900/40 px-1 rounded">scripts/sql/add_voter_data_pdf_box_columns.sql</code>
                  </p>
                )}
              </div>
            )}
            {result.invalid_epics && result.invalid_epics.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Invalid EPICs (sample, max 100):
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-mono mt-1 break-all">
                  {result.invalid_epics.join(', ')}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
};

export default BulkElectoralRollPage;
