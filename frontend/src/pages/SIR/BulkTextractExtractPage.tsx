import React, { useState, useEffect } from 'react';
import PageContainer from '../../components/common/PageContainer';
import PageMeta from '../../components/common/PageMeta';
import ThemedLoader from '../../components/common/ThemedLoader';
import { alerterror, alertsuccess } from '../../utils/toast';
import { bulkTextractExtract, getDbInfo, getBulkFolderPaths } from '../../services/api';

type Mode = 'folder' | 'upload';

interface BulkResult {
  total_found: number;
  inserted: number;
  duplicates_skipped: number;
  pdf_count: number;
  moved_count: number;
  extracted_folder: string;
  message?: string;
}

const BulkTextractExtractPage: React.FC = () => {
  const [mode, setMode] = useState<Mode>('folder');
  const [folderPath, setFolderPath] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [dbInfo, setDbInfo] = useState<Record<string, unknown> | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [folderPaths, setFolderPaths] = useState<string[]>([]);
  const [folderPathsLoading, setFolderPathsLoading] = useState(false);

  useEffect(() => {
    if (mode === 'folder') loadFolderPaths();
  }, [mode]);

  const loadFolderPaths = async () => {
    setFolderPathsLoading(true);
    try {
      const res = await getBulkFolderPaths();
      setFolderPaths((res.data as { paths?: string[] })?.paths ?? []);
    } catch {
      setFolderPaths([]);
    } finally {
      setFolderPathsLoading(false);
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

  const handleSubmit = async () => {
    if (mode === 'folder' && !folderPath.trim()) {
      alerterror('Please enter a server folder path (e.g. download/Tamil_Nadu/2026/Erode/83_-_Gobichettipalayam)');
      return;
    }
    if (mode === 'upload' && (!files || files.length === 0)) {
      alerterror('Please select one or more PDF files to upload');
      return;
    }

    setLoading(true);
    setResult(null);
    const formData = new FormData();

    if (mode === 'folder') {
      formData.append('folder_path', folderPath.trim());
    } else if (files) {
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }
    }

    try {
      const res = await bulkTextractExtract(formData);
      const data = res.data as BulkResult;
      setResult(data);
      if (data.inserted > 0 || data.moved_count > 0) {
        alertsuccess(
          `Bulk Textract: ${data.inserted} records inserted, ${data.moved_count} PDFs moved to extracted folder`
        );
      } else if (data.pdf_count === 0) {
        alerterror(data.message ?? 'No PDF files found.');
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string | string[] } }; message?: string };
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((x: unknown) => (typeof x === 'object' && x && 'msg' in x ? (x as { msg?: string }).msg : String(x))).join(', ')
        : typeof detail === 'string'
          ? detail
          : err.message ?? 'Bulk Textract failed';
      alerterror(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <PageMeta
        title="Bulk Upload | SIR"
        description="Process assembly PDFs in bulk via AWS Textract. Extract → insert to DB → move to extracted folder."
      />

      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow border border-gray-200 dark:border-gray-700 max-w-4xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">DB Detail</h2>
              {dbInfo && typeof dbInfo === 'object' && 'database' in dbInfo ? (
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                  {(dbInfo as { status?: string }).status} |{' '}
                  {((dbInfo as { database?: { user?: string; host?: string; name?: string } }).database?.user ?? '')}@
                  {((dbInfo as { database?: { host?: string } }).database?.host ?? '')}/
                  {((dbInfo as { database?: { name?: string } }).database?.name ?? '')}
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Bulk Textract Extract</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Process all PDFs in an assembly folder (e.g. 100 PDFs). For each: AWS Textract extract → insert to voter_data → move to extracted/state/year/district/constituency. Same structure as ECI download. Runs one PDF at a time.
          </p>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-900 dark:text-amber-100">
          <p className="font-semibold mb-2">Requirements</p>
          <ul className="list-disc list-inside space-y-1">
            <li>AWS credentials on server (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)</li>
            <li>AWS_BUCKET set in backend .env</li>
            <li>Folder path must exist on the server (e.g. download/Tamil_Nadu/2026/Erode/83_-_Gobichettipalayam)</li>
            <li>Metadata (state, year, district, constituency) inferred from folder path if omitted</li>
          </ul>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 max-w-4xl">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Input</h2>

          <div className="flex gap-4 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="mode"
                checked={mode === 'folder'}
                onChange={() => setMode('folder')}
                className="text-indigo-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Server folder path</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="mode"
                checked={mode === 'upload'}
                onChange={() => setMode('upload')}
                className="text-indigo-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Upload PDFs</span>
            </label>
          </div>

          {mode === 'folder' && (
            <div className="mb-4 space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Folder path on server (required)
              </label>
              <div className="flex gap-2">
                <select
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  disabled={loading || folderPathsLoading}
                >
                  <option value="">Select a folder or type below...</option>
                  {folderPaths.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={loadFolderPaths}
                  disabled={folderPathsLoading}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  {folderPathsLoading ? 'Loading...' : 'Refresh'}
                </button>
              </div>
              <input
                type="text"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                placeholder="Or type path: e.g. download/Tamil_Nadu/2026/Erode/83_-_Gobichettipalayam"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                disabled={loading}
              />
            </div>
          )}

          {mode === 'upload' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Select PDF files
              </label>
              <input
                type="file"
                accept=".pdf"
                multiple
                onChange={(e) => setFiles(e.target.files)}
                className="block w-full text-sm text-gray-500 dark:text-gray-400
                  file:mr-4 file:py-2 file:px-4 file:rounded-lg
                  file:border-0 file:text-sm file:font-semibold
                  file:bg-indigo-50 file:text-indigo-700 dark:file:bg-indigo-900/20 dark:file:text-indigo-400
                  hover:file:bg-indigo-100 dark:hover:file:bg-indigo-900/30
                  cursor-pointer"
                disabled={loading}
              />
              {files && files.length > 0 && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  Selected: {files.length} PDF(s)
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              loading ||
              (mode === 'folder' && !folderPath.trim()) ||
              (mode === 'upload' && (!files || files.length === 0))
            }
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <ThemedLoader size={16} />
                Processing (Textract → insert → move)...
              </span>
            ) : (
              'Run Bulk Upload'
            )}
          </button>
        </div>

        {result && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Result</h3>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <dt className="text-gray-500 dark:text-gray-400">PDFs processed</dt>
              <dd className="text-gray-900 dark:text-white font-medium">{result.pdf_count}</dd>
              <dt className="text-gray-500 dark:text-gray-400">Records inserted</dt>
              <dd className="text-gray-900 dark:text-white font-medium">{result.inserted}</dd>
              <dt className="text-gray-500 dark:text-gray-400">Duplicates skipped</dt>
              <dd className="text-gray-900 dark:text-white">{result.duplicates_skipped}</dd>
              <dt className="text-gray-500 dark:text-gray-400">PDFs moved</dt>
              <dd className="text-gray-900 dark:text-white">{result.moved_count}</dd>
              <dt className="text-gray-500 dark:text-gray-400">Total records found</dt>
              <dd className="text-gray-900 dark:text-white">{result.total_found}</dd>
              <dt className="text-gray-500 dark:text-gray-400 col-span-2">Extracted folder</dt>
              <dd className="text-gray-900 dark:text-white col-span-2 break-all">{result.extracted_folder}</dd>
            </dl>
            {result.message && (
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{result.message}</p>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
};

export default BulkTextractExtractPage;
