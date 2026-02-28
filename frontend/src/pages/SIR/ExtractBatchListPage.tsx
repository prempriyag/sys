import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { getExtractBatchesList, startExtractFolderWatcher, processExtractFile } from '../../services/api';
import PageContainer from '../../components/common/PageContainer';
import PageMeta from '../../components/common/PageMeta';
import ThemedLoader from '../../components/common/ThemedLoader';
import { alerterror, alertsuccess } from '../../utils/toast';

interface DownloadItem {
  batch_id: string;
  original_file_name: string;
  file_created_datetime: string | null;
  total_pages: number | null;
  stored_path: string | null;
  created_at: string | null;
}

const ExtractBatchListPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<DownloadItem[]>([]);
  const [startingWatcher, setStartingWatcher] = useState(false);
  const [processingFile, setProcessingFile] = useState(false);
  const [setupRequired, setSetupRequired] = useState<string | null>(null);

  useEffect(() => {
    loadList();
  }, []);

  const loadList = async () => {
    setLoading(true);
    setSetupRequired(null);
    try {
      const res = await getExtractBatchesList({ limit: 200 });
      setBatches(Array.isArray(res?.data) ? res.data : []);
    } catch (e: any) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail || 'Failed to load batches';
      if (status === 503 && (detail.includes('extract_downloads') || detail.includes('missing'))) {
        setSetupRequired(detail);
      } else {
        alerterror(detail);
      }
      setBatches([]);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      alerterror('Only PDF files are accepted');
      return;
    }
    setProcessingFile(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const res = await processExtractFile(fd);
      const data = res?.data ?? res;
      if (data?.status === 'success') {
        alertsuccess(`Processed: Batch ${data.batch_id}, ${data.records_count ?? 0} records`);
        loadList();
      } else {
        alerterror(data?.error || 'Processing failed');
      }
    } catch (err: any) {
      alerterror(err.response?.data?.detail || 'Failed to process file');
    } finally {
      setProcessingFile(false);
      e.target.value = '';
    }
  };

  const handleStartWatcher = async () => {
    setStartingWatcher(true);
    try {
      const res = await startExtractFolderWatcher();
      const data = res?.data ?? res;
      if (data?.started) {
        alertsuccess('Folder watcher started. New PDFs in the monitored folder will be processed automatically.');
      } else {
        alerterror(data?.message || 'Could not start watcher. Set EXTRACT_OCR_FOLDER in .env (e.g. C:\\extractocr\\)');
      }
    } catch (e: any) {
      alerterror(e.response?.data?.detail || 'Failed to start watcher');
    } finally {
      setStartingWatcher(false);
    }
  };

  const formatDate = (s: string | null) => {
    if (!s) return '—';
    try {
      const d = new Date(s);
      return isNaN(d.getTime()) ? s : d.toLocaleString();
    } catch {
      return s;
    }
  };

  return (
    <PageContainer>
      <PageMeta
        title="Processed Files | Extract Batches"
        description="Master list of all processed files (automated extraction)"
      />
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Processed Files</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Files picked from the monitored folder (C:\extractocr\) and processed with data extraction.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 cursor-pointer disabled:opacity-50">
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleProcessFile}
                disabled={processingFile}
              />
              {processingFile ? 'Processing…' : 'Process PDF File'}
            </label>
            <button
              onClick={loadList}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              Refresh
            </button>
            <button
              onClick={handleStartWatcher}
              disabled={startingWatcher}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {startingWatcher ? 'Starting…' : 'Start Folder Watcher'}
            </button>
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-900 dark:text-amber-100">
          <strong>How it works:</strong> Set <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">EXTRACT_OCR_FOLDER=C:\extractocr\</code> in your backend .env.
          When a new PDF appears, the system generates a Batch ID, extracts data, stores headers and line items, and archives the file.
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <ThemedLoader size={32} label="Loading batches..." />
          </div>
        ) : setupRequired ? (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-8 text-center">
            <p className="text-amber-800 dark:text-amber-200 font-medium mb-2">Setup required</p>
            <p className="text-amber-700 dark:text-amber-300 text-sm mb-4">{setupRequired}</p>
            <code className="block bg-amber-100 dark:bg-amber-900/40 px-4 py-2 rounded text-sm">
              cd backend &amp;&amp; alembic upgrade head
            </code>
          </div>
        ) : batches.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
            No processed files yet. Add PDFs to the monitored folder and start the watcher, or run extraction manually.
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Batch ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">File Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">File Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Pages</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Processed At</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  {batches.map((b) => (
                    <tr
                      key={b.batch_id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap font-mono font-semibold text-blue-600 dark:text-blue-400">
                        {b.batch_id}
                      </td>
                      <td className="px-6 py-4 text-gray-900 dark:text-white truncate max-w-xs" title={b.original_file_name}>
                        {b.original_file_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-400 text-sm">
                        {formatDate(b.file_created_datetime)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-400">
                        {b.total_pages ?? '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-400 text-sm">
                        {formatDate(b.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => navigate(`/upload/extract-batches/${b.batch_id}`)}
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
};

export default ExtractBatchListPage;
