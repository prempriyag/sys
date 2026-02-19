import React, { useState, useEffect } from 'react';
import { getRollSummary, getRollSample, getConstituencies } from '../../services/api';
import PageContainer from '../../components/common/PageContainer';
import PageMeta from '../../components/common/PageMeta';
import ThemedLoader from '../../components/common/ThemedLoader';
import { alerterror } from '../../utils/toast';

interface BoothSummary {
  booth_id: number;
  booth_number: string;
  location_name: string;
  pre_sir_count: number;
  post_sir_count: number;
}

interface ConstituencySummary {
  constituency_id: number;
  constituency_name: string;
  district: string;
  state: string;
  total_pre_sir: number;
  total_post_sir: number;
  booths: BoothSummary[];
}

interface VoterSampleRow {
  id: number;
  epic_number: string | null;
  name: string | null;
  relative_name: string | null;
  age: number | null;
  gender: string | null;
  house_no: string | null;
  address: string;
}

const RollDataPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ConstituencySummary[]>([]);
  const [expandedConstituency, setExpandedConstituency] = useState<number | null>(null);
  const [sampleConstituency, setSampleConstituency] = useState<number | null>(null);
  const [sampleRoll, setSampleRoll] = useState<'pre' | 'post'>('pre');
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sampleData, setSampleData] = useState<VoterSampleRow[]>([]);
  const [constituencies, setConstituencies] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    loadSummary();
    loadConstituencies();
  }, []);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const res = await getRollSummary();
      setSummary(res.data || []);
    } catch (e: any) {
      alerterror(e.response?.data?.detail || 'Failed to load roll summary');
      setSummary([]);
    } finally {
      setLoading(false);
    }
  };

  const loadConstituencies = async () => {
    try {
      const res = await getConstituencies();
      setConstituencies((res.data || []).map((c: any) => ({ id: c.id, name: c.name })));
    } catch {
      setConstituencies([]);
    }
  };

  const loadSample = async () => {
    if (!sampleConstituency) return;
    setSampleLoading(true);
    setSampleData([]);
    try {
      const res = await getRollSample(sampleConstituency, sampleRoll, 50);
      setSampleData(res.data || []);
    } catch (e: any) {
      alerterror(e.response?.data?.detail || 'Failed to load sample');
      setSampleData([]);
    } finally {
      setSampleLoading(false);
    }
  };

  return (
    <PageContainer>
      <PageMeta
        title="View uploaded roll data | SIR"
        description="See where your uploaded Pre-SIR and Post-SIR data is stored"
      />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Uploaded roll data</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Summary of extracted/stored data after upload. Use this to verify that your CSV or PDF uploads were saved correctly.
          </p>
        </div>

        {/* How extraction works (short) */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm text-blue-900 dark:text-blue-100">
          <strong>How it works:</strong> CSV rows are read and saved to the database. For PDFs, the system extracts tables from each page (EPIC No, Name, Relative, Age, Sex, House No, Address), maps them to the same schema, then saves to the same tables. Data is stored per <strong>constituency</strong> and <strong>booth</strong>. You see totals below; use &quot;View sample&quot; to see actual voter rows.
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <ThemedLoader size={32} label="Loading roll summary..." />
          </div>
        ) : summary.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
            No uploaded data yet. Upload Pre-SIR and/or Post-SIR rolls from <strong>Data Upload</strong> to see data here.
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Summary by constituency</h2>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {summary.map((c) => (
                  <div key={c.constituency_id} className="px-6 py-4">
                    <button
                      type="button"
                      onClick={() => setExpandedConstituency(expandedConstituency === c.constituency_id ? null : c.constituency_id)}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <span className="font-medium text-gray-900 dark:text-white">
                        {c.constituency_name}
                        {c.district && ` · ${c.district}`}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Pre-SIR: <strong>{c.total_pre_sir.toLocaleString()}</strong>
                        {' · '}
                        Post-SIR: <strong>{c.total_post_sir.toLocaleString()}</strong>
                      </span>
                      <span className="text-gray-400">{expandedConstituency === c.constituency_id ? '▼' : '▶'}</span>
                    </button>
                    {expandedConstituency === c.constituency_id && c.booths.length > 0 && (
                      <div className="mt-4 ml-4 overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
                              <th className="pb-2 pr-4">Booth</th>
                              <th className="pb-2 pr-4">Location</th>
                              <th className="pb-2 pr-4">Pre-SIR</th>
                              <th className="pb-2">Post-SIR</th>
                            </tr>
                          </thead>
                          <tbody>
                            {c.booths.map((b) => (
                              <tr key={b.booth_id} className="border-b border-gray-100 dark:border-gray-700">
                                <td className="py-1 pr-4 text-gray-900 dark:text-white">{b.booth_number}</td>
                                <td className="py-1 pr-4 text-gray-600 dark:text-gray-300">{b.location_name || '—'}</td>
                                <td className="py-1 pr-4">{b.pre_sir_count.toLocaleString()}</td>
                                <td className="py-1">{b.post_sir_count.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* View sample */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">View sample of voter records</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                See actual extracted rows (first 50) for a constituency to verify names, EPIC, age, etc.
              </p>
              <div className="flex flex-wrap items-end gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Constituency</label>
                  <select
                    value={sampleConstituency ?? ''}
                    onChange={(e) => setSampleConstituency(Number(e.target.value) || null)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="">Select</option>
                    {constituencies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Roll</label>
                  <select
                    value={sampleRoll}
                    onChange={(e) => setSampleRoll(e.target.value as 'pre' | 'post')}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="pre">Pre-SIR</option>
                    <option value="post">Post-SIR</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={loadSample}
                  disabled={!sampleConstituency || sampleLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sampleLoading ? 'Loading...' : 'View sample'}
                </button>
              </div>
              {sampleData.length > 0 && (
                <div className="overflow-x-auto border border-gray-200 dark:border-gray-600 rounded-lg">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-3 py-2 text-left">EPIC</th>
                        <th className="px-3 py-2 text-left">Name</th>
                        <th className="px-3 py-2 text-left">Relative</th>
                        <th className="px-3 py-2 text-left">Age</th>
                        <th className="px-3 py-2 text-left">Gender</th>
                        <th className="px-3 py-2 text-left">House No</th>
                        <th className="px-3 py-2 text-left">Address</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sampleData.map((r) => (
                        <tr key={r.id} className="border-t border-gray-200 dark:border-gray-600">
                          <td className="px-3 py-2">{r.epic_number ?? '—'}</td>
                          <td className="px-3 py-2">{r.name ?? '—'}</td>
                          <td className="px-3 py-2">{r.relative_name ?? '—'}</td>
                          <td className="px-3 py-2">{r.age ?? '—'}</td>
                          <td className="px-3 py-2">{r.gender ?? '—'}</td>
                          <td className="px-3 py-2">{r.house_no ?? '—'}</td>
                          <td className="px-3 py-2 max-w-[200px] truncate" title={r.address}>{r.address || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </PageContainer>
  );
};

export default RollDataPage;
