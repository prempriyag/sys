/**
 * Profiler Modal - Debug tool for KTech users
 * Based on CI3 MY_Profiler / Speedtest controller
 * Shows database queries, timing, and performance metrics in a modal popup
 */
import { useState, useEffect } from "react";
import { API_ENDPOINTS, apiRequest } from "../../config/api";

interface ProfilerSection {
  label: string;
  value: string;
}

interface ProfilerData {
  [key: string]: ProfilerSection[];
}

interface SpeedtestResult {
  name: string;
  duration_ms: number;
  status: "pass" | "fail";
  error?: string;
  result?: number;
  rows_returned?: number;
}

interface SpeedtestData {
  tests: SpeedtestResult[];
  summary: {
    total_tests: number;
    passed: number;
    failed: number;
    total_time_ms: number;
    average_time_ms: number;
  };
}

interface ProfilerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfilerModal({ isOpen, onClose }: ProfilerModalProps) {
  const [profilerEnabled, setProfilerEnabled] = useState<boolean>(false);
  const [profilerData, setProfilerData] = useState<ProfilerData | null>(null);
  const [speedtestData, setSpeedtestData] = useState<SpeedtestData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"profiler" | "speedtest">("profiler");
  const [profilerType, setProfilerType] = useState<"page" | "ajax">("page");
  const [hasPageData, setHasPageData] = useState(false);
  const [hasAjaxData, setHasAjaxData] = useState(false);

  useEffect(() => {
    if (isOpen) {
      checkProfilerStatus();
    }
  }, [isOpen]);

  const checkProfilerStatus = async () => {
    setLoading(true);
    try {
      const response = await apiRequest(`${API_ENDPOINTS.PROFILER_STATUS}`);
      const data = await response.json();
      
      if (response.ok) {
        setProfilerEnabled(data.enabled);
        if (!data.enabled) {
          setError("Profiler access restricted to authorized users");
        } else {
          // Auto-load profiler data when modal opens
          loadProfilerData("page");
        }
      } else {
        setError(data.detail || "Failed to check profiler status");
      }
    } catch (err) {
      setError("Failed to connect to profiler service");
    } finally {
      setLoading(false);
    }
  };

  const loadProfilerData = async (type: "page" | "ajax" = "page") => {
    setLoading(true);
    setError(null);
    setProfilerType(type);
    try {
      const response = await apiRequest(`${API_ENDPOINTS.PROFILER_DATA}?type=${type}`);
      const data = await response.json();
      
      if (response.ok) {
        setProfilerData(data.data);
        setHasPageData(data.has_page_data || false);
        setHasAjaxData(data.has_ajax_data || false);
        if (!data.data) {
          setError(data.message || "No profiler data available. Navigate to a page first, then check the profiler.");
        } else {
          setError(null);
        }
      } else {
        setError(data.detail || "Failed to load profiler data");
      }
    } catch (err) {
      setError("Failed to load profiler data");
    } finally {
      setLoading(false);
    }
  };

  const runSpeedtest = async () => {
    setLoading(true);
    setSpeedtestData(null);
    setError(null);
    try {
      const response = await apiRequest(`${API_ENDPOINTS.PROFILER_SPEEDTEST}`);
      const data = await response.json();
      
      if (response.ok) {
        setSpeedtestData(data);
        setError(null);
      } else {
        setError(data.detail || "Failed to run speedtest");
      }
    } catch (err) {
      setError("Failed to run speedtest");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-[90vw] max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-600 to-blue-700">
          <div className="flex items-center gap-3">
            <svg 
              className="w-6 h-6 text-white" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M13 10V3L4 14h7v7l9-11h-7z" 
              />
            </svg>
            <h2 className="text-xl font-bold text-white">System Profiler</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Loading state */}
        {loading && !profilerEnabled && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
          </div>
        )}

        {/* Access Restricted */}
        {!loading && !profilerEnabled && (
          <div className="p-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 dark:bg-red-900/20 dark:border-red-800">
              <h3 className="text-lg font-semibold text-red-800 dark:text-red-400">Access Restricted</h3>
              <p className="text-red-600 dark:text-red-300 mt-2">
                Profiler access is restricted to authorized KTech users only.
              </p>
            </div>
          </div>
        )}

        {/* Main Content */}
        {profilerEnabled && (
          <>
            {/* Tabs */}
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6">
              <div className="flex">
                <button
                  onClick={() => { setActiveTab("profiler"); loadProfilerData(profilerType); }}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "profiler"
                      ? "border-blue-500 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  }`}
                >
                  Request Profiler
                </button>
                <button
                  onClick={() => { setActiveTab("speedtest"); if (!speedtestData) runSpeedtest(); }}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "speedtest"
                      ? "border-blue-500 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  }`}
                >
                  DB Speedtest
                </button>
              </div>
              
              {/* Page/AJAX toggle for profiler tab */}
              {activeTab === "profiler" && (
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                  <button
                    onClick={() => loadProfilerData("page")}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                      profilerType === "page"
                        ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                        : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                    }`}
                  >
                    Page {hasPageData && <span className="ml-1 w-1.5 h-1.5 bg-green-500 rounded-full inline-block"></span>}
                  </button>
                  <button
                    onClick={() => loadProfilerData("ajax")}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                      profilerType === "ajax"
                        ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                        : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                    }`}
                  >
                    AJAX {hasAjaxData && <span className="ml-1 w-1.5 h-1.5 bg-green-500 rounded-full inline-block"></span>}
                  </button>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {error && (
                <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 dark:bg-yellow-900/20 dark:border-yellow-800">
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">{error}</p>
                </div>
              )}

              {loading && (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              )}

              {/* Speedtest Tab */}
              {activeTab === "speedtest" && speedtestData && !loading && (
                <div className="space-y-4">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {speedtestData.summary.total_tests}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Total Tests</div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {speedtestData.summary.passed}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Passed</div>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {speedtestData.summary.failed}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Failed</div>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {speedtestData.summary.total_time_ms}ms
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Total Time</div>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {speedtestData.summary.average_time_ms}ms
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Avg Time</div>
                    </div>
                  </div>

                  {/* Test Results Table */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Test</th>
                          <th className="px-4 py-2 text-center font-semibold text-gray-700 dark:text-gray-300">Status</th>
                          <th className="px-4 py-2 text-right font-semibold text-gray-700 dark:text-gray-300">Time</th>
                          <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {speedtestData.tests.map((test, index) => (
                          <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                            <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">
                              {test.name}
                            </td>
                            <td className="px-4 py-2 text-center">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                test.status === "pass"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                  : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                              }`}>
                                {test.status === "pass" ? "PASS" : "FAIL"}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">
                              {test.duration_ms}ms
                            </td>
                            <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                              {test.error && <span className="text-red-600">{test.error}</span>}
                              {test.result !== undefined && <span>Count: {test.result}</span>}
                              {test.rows_returned !== undefined && <span>Rows: {test.rows_returned}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Run Again Button */}
                  <div className="flex justify-center pt-2">
                    <button
                      onClick={runSpeedtest}
                      disabled={loading}
                      className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {loading ? "Running..." : "Run Again"}
                    </button>
                  </div>
                </div>
              )}

              {/* Profiler Data Tab */}
              {activeTab === "profiler" && profilerData && !loading && (
                <div className="space-y-4">
                  {Object.entries(profilerData).map(([section, items]) => {
                    const isDatabase = section.toLowerCase().includes("database");
                    const sectionColor = isDatabase 
                      ? "bg-purple-600" 
                      : section.includes("BENCHMARKS") 
                        ? "bg-green-600" 
                        : "bg-blue-600";
                    
                    return (
                      <div key={section} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className={`${sectionColor} text-white px-4 py-2 text-sm font-semibold flex items-center justify-between`}>
                          <span>{section}</span>
                          {isDatabase && (
                            <span className="text-xs bg-white/20 px-2 py-0.5 rounded">
                              {items.length} {items.length === 1 ? 'query' : 'queries'}
                            </span>
                          )}
                        </div>
                        <div className="p-3 max-h-64 overflow-y-auto">
                          {items.length === 0 ? (
                            <p className="text-gray-500 dark:text-gray-400 text-sm italic">No data</p>
                          ) : (
                            <table className="w-full text-sm">
                              <tbody>
                                {items.map((item, index) => (
                                  <tr key={index} className="border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                    <td className={`py-2 pr-4 text-xs text-gray-700 dark:text-gray-300 ${isDatabase ? 'font-mono break-all' : ''}`}>
                                      {isDatabase ? (
                                        <code className="text-purple-700 dark:text-purple-400">{item.label}</code>
                                      ) : (
                                        item.label
                                      )}
                                    </td>
                                    <td className={`py-2 text-right text-xs whitespace-nowrap font-medium ${
                                      item.value.includes('ms') 
                                        ? parseFloat(item.value) > 100 
                                          ? 'text-red-600 dark:text-red-400' 
                                          : parseFloat(item.value) > 50 
                                            ? 'text-yellow-600 dark:text-yellow-400'
                                            : 'text-green-600 dark:text-green-400'
                                        : 'text-gray-600 dark:text-gray-400'
                                    }`}>
                                      {item.value}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Refresh button */}
                  <div className="flex justify-center pt-2">
                    <button
                      onClick={() => loadProfilerData(profilerType)}
                      disabled={loading}
                      className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
                    >
                      Refresh Data
                    </button>
                  </div>
                </div>
              )}

              {/* Empty state for profiler */}
              {activeTab === "profiler" && !profilerData && !loading && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 text-center">
                  <div className="mb-4">
                    <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No Profiler Data Yet
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                    {error || "Navigate to any page in the app, then come back here to see the queries and timing for that request."}
                  </p>
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => loadProfilerData("page")}
                      className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      Check Page Data
                    </button>
                    <button
                      onClick={() => loadProfilerData("ajax")}
                      className="px-4 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      Check AJAX Data
                    </button>
                  </div>
                </div>
              )}

              {/* Empty state for speedtest */}
              {activeTab === "speedtest" && !speedtestData && !loading && !error && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 text-center">
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                    Run database speedtest to check performance.
                  </p>
                  <button
                    onClick={runSpeedtest}
                    className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Run Speedtest
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
