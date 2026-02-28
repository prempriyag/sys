import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { getExtractBatchDetail } from '../../services/api';
import PageContainer from '../../components/common/PageContainer';
import PageMeta from '../../components/common/PageMeta';
import ThemedLoader from '../../components/common/ThemedLoader';
import { alerterror } from '../../utils/toast';

interface HeaderItem {
  header_key: string;
  header_value: string | null;
}

interface LineItem {
  id: number;
  line_number: number | null;
  page_number: number | null;
  epic_number: string | null;
  name: string | null;
  relative_name: string | null;
  age: number | null;
  gender: string | null;
  house_no: string | null;
  address: string | null;
  booth_number: string | null;
  constituency_name: string | null;
  confidence_score: number | null;
}

interface BatchDetail {
  download: {
    batch_id: string;
    original_file_name: string;
    file_created_datetime: string | null;
    total_pages: number | null;
    stored_path: string | null;
    created_at: string | null;
  };
  headers: HeaderItem[];
  lines: LineItem[];
}

const ExtractBatchDetailPage: React.FC = () => {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<BatchDetail | null>(null);

  useEffect(() => {
    if (batchId) loadDetail();
  }, [batchId]);

  const loadDetail = async () => {
    if (!batchId) return;
    setLoading(true);
    try {
      const res = await getExtractBatchDetail(batchId);
      const data = res?.data ?? res;
      setDetail(data);
    } catch (e: any) {
      alerterror(e.response?.data?.detail || 'Failed to load batch detail');
      setDetail(null);
    } finally {
      setLoading(false);
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

  const formatHeaderKey = (k: string) =>
    k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  if (!batchId) return null;

  return (
    <PageContainer>
      <PageMeta
        title={`Batch ${batchId} | Extract Batches`}
        description={`Detail view for batch ${batchId}`}
      />
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/upload/extract-batches')}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            ← Back to list
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Batch {batchId}</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <ThemedLoader size={32} label="Loading batch detail..." />
          </div>
        ) : !detail ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
            Batch not found.
          </div>
        ) : (
          <>
            {/* Download info */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">File info</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Original file</dt>
                  <dd className="font-medium text-gray-900 dark:text-white truncate" title={detail.download.original_file_name}>
                    {detail.download.original_file_name}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">File created</dt>
                  <dd className="text-gray-900 dark:text-white">{formatDate(detail.download.file_created_datetime)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Total pages</dt>
                  <dd className="text-gray-900 dark:text-white">{detail.download.total_pages ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Processed at</dt>
                  <dd className="text-gray-900 dark:text-white">{formatDate(detail.download.created_at)}</dd>
                </div>
              </dl>
            </div>

            {/* Headers */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Header data</h2>
              {detail.headers.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">No header data extracted.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {detail.headers.map((h) => (
                    <div key={h.header_key} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                      <dt className="text-xs text-gray-500 dark:text-gray-400 uppercase">{formatHeaderKey(h.header_key)}</dt>
                      <dd className="text-gray-900 dark:text-white mt-1 truncate" title={h.header_value ?? ''}>
                        {h.header_value ?? '—'}
                      </dd>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Lines */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                Line data ({detail.lines.length} records)
              </h2>
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                  <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">#</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Page</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">EPIC</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Relative</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Age</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Gender</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">House No</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                    {detail.lines.map((ln) => (
                      <tr key={ln.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{ln.line_number ?? '—'}</td>
                        <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{ln.page_number ?? '—'}</td>
                        <td className="px-4 py-2 text-sm font-mono text-gray-900 dark:text-white">{ln.epic_number ?? '—'}</td>
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-white truncate max-w-[180px]" title={ln.name ?? ''}>
                          {ln.name ?? '—'}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 truncate max-w-[150px]" title={ln.relative_name ?? ''}>
                          {ln.relative_name ?? '—'}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{ln.age ?? '—'}</td>
                        <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{ln.gender ?? '—'}</td>
                        <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{ln.house_no ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </PageContainer>
  );
};

export default ExtractBatchDetailPage;
