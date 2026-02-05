/**
 * Profiler Page - Debug tool for KTech users
 * Based on CI3 MY_Profiler / Speedtest controller
 * Shows database queries, timing, and performance metrics
 */
import { useState, useEffect } from "react";
import { API_BASE_URL, API_ENDPOINTS, apiRequest } from "../../config/api";

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

export default function Profiler() {
  const [profilerEnabled, setProfilerEnabled] = useState<boolean>(false);
  const [profilerData, setProfilerData] = useState<ProfilerData | null>(null);
  const [speedtestData, setSpeedtestData] = useState<SpeedtestData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"profiler" | "speedtest">("profiler");

  useEffect(() => {
    checkProfilerStatus();
  }, []);

  const checkProfilerStatus = async () => {
    try {
      const response = await apiRequest(`${API_ENDPOINTS.PROFILER_STATUS}`);
      const data = await response.json();
      
      if (response.ok) {
        setProfilerEnabled(data.enabled);
        if (!data.enabled) {
          setError("Profiler access restricted to authorized users");
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
    try {
      const response = await apiRequest(`${API_ENDPOINTS.PROFILER_DATA}?type=${type}`);
      const data = await response.json();
      
      if (response.ok) {
        setProfilerData(data.data);
        if (!data.data) {
          setError(data.message || "No profiler data available");
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

  if (loading && !profilerEnabled) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  if (!profilerEnabled) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 dark:bg-red-900/20 dark:border-red-800">
          <h2 className="text-lg font-semibold text-red-800 dark:text-red-400">Access Restricted</h2>
          <p className="text-red-600 dark:text-red-300 mt-2">
            Profiler access is restricted to authorized KTech users only.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          System Profiler
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setActiveTab("profiler"); loadProfilerData("page"); }}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === "profiler"
                ? "bg-brand-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
            }`}
          >
            Profiler Data
          </button>
          <button
            onClick={() => { setActiveTab("speedtest"); runSpeedtest(); }}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === "speedtest"
                ? "bg-brand-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
            }`}
          >
            Database Speedtest
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 dark:bg-yellow-900/20 dark:border-yellow-800">
          <p className="text-yellow-700 dark:text-yellow-300">{error}</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
        </div>
      )}

      {/* Profiler Data Tab */}
      {activeTab === "profiler" && profilerData && !loading && (
        <div className="space-y-4">
          {Object.entries(profilerData).map(([section, items]) => (
            <div key={section} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
              <div className="bg-brand-600 text-white px-4 py-2 font-semibold">
                {section}
              </div>
              <div className="p-4">
                {items.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 italic">No data</p>
                ) : (
                  <table className="w-full">
                    <tbody>
                      {items.map((item, index) => (
                        <tr key={index} className="border-b border-gray-200 dark:border-gray-700 last:border-0">
                          <td className="py-2 pr-4 font-mono text-sm text-gray-700 dark:text-gray-300 break-all">
                            {item.label}
                          </td>
                          <td className="py-2 text-right text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {item.value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Speedtest Tab */}
      {activeTab === "speedtest" && speedtestData && !loading && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {speedtestData.summary.total_tests}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Total Tests</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {speedtestData.summary.passed}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Passed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {speedtestData.summary.failed}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {speedtestData.summary.total_time_ms} ms
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Total Time</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {speedtestData.summary.average_time_ms} ms
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Avg Time</div>
              </div>
            </div>
          </div>

          {/* Test Results */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="bg-brand-600 text-white px-4 py-2 font-semibold">
              Test Results
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Test Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Status</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">Duration</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {speedtestData.tests.map((test, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        {test.name}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          test.status === "pass"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                        }`}>
                          {test.status === "pass" ? "PASS" : "FAIL"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-400">
                        {test.duration_ms} ms
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {test.error && <span className="text-red-600">{test.error}</span>}
                        {test.result !== undefined && <span>Count: {test.result}</span>}
                        {test.rows_returned !== undefined && <span>Rows: {test.rows_returned}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Run Again Button */}
          <div className="flex justify-center">
            <button
              onClick={runSpeedtest}
              disabled={loading}
              className="px-6 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Running..." : "Run Speedtest Again"}
            </button>
          </div>
        </div>
      )}

      {/* Empty state for profiler */}
      {activeTab === "profiler" && !profilerData && !loading && !error && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            Click "Profiler Data" to load profiling information from recent requests.
          </p>
          <button
            onClick={() => loadProfilerData("page")}
            className="mt-4 px-6 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors"
          >
            Load Page Profiler
          </button>
          <button
            onClick={() => loadProfilerData("ajax")}
            className="mt-4 ml-2 px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Load AJAX Profiler
          </button>
        </div>
      )}
    </div>
  );
}
