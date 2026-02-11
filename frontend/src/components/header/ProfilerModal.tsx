/**
 * Profiler Modal - Debug tool for KTech users
 * Shows API request profiles with SQL queries and timing in a modal popup
 */
import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { API_ENDPOINTS, apiRequest } from "../../config/api";

interface QueryProfile {
  index: number;
  sql: string;
  parameters: string | null;
  duration_ms: number;
}

interface FunctionProfile {
  name: string;
  duration_ms: number;
}

interface RequestProfile {
  uri: string;
  method: string;
  status_code: number;
  timestamp: number;
  total_time_ms: number;
  total_query_time_ms: number;
  python_time_ms: number;
  query_count: number;
  queries: QueryProfile[];
  functions?: FunctionProfile[];
}

interface ProfilerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfilerModal({ isOpen, onClose }: ProfilerModalProps) {
  const [profilerEnabled, setProfilerEnabled] = useState<boolean>(false);
  const [requestProfiles, setRequestProfiles] = useState<RequestProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRequest, setExpandedRequest] = useState<number | null>(null);
  const [showAllRequests, setShowAllRequests] = useState<boolean>(false);
  const [profilingActive, setProfilingActive] = useState<boolean>(true);

  // Track route changes - record timestamp so we only show APIs for the current page
  const location = useLocation();
  const prevPathnameRef = useRef(location.pathname);
  const routeChangeTimestampRef = useRef<number>(Date.now() / 1000); // Unix seconds (matches backend timestamps)

  useEffect(() => {
    if (prevPathnameRef.current !== location.pathname) {
      prevPathnameRef.current = location.pathname;
      // Record the route change time - we'll filter request profiles to only show data after this
      routeChangeTimestampRef.current = Date.now() / 1000;
      // Reset local state so stale data from previous page isn't visible
      setRequestProfiles([]);
      setExpandedRequest(null);
      setError(null);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (isOpen) {
      checkProfilerStatus();
    }
  }, [isOpen]);

  // Reload request profiles when the filter toggle changes
  useEffect(() => {
    if (isOpen && profilerEnabled) {
      loadRequestProfiles();
    }
  }, [showAllRequests]);

  const checkProfilerStatus = async () => {
    setLoading(true);
    try {
      const response = await apiRequest(`${API_ENDPOINTS.PROFILER_STATUS}`);
      const data = await response.json();
      
      if (response.ok) {
        setProfilerEnabled(data.enabled);
        setProfilingActive(data.profiling_active !== false);
        if (!data.enabled) {
          setError("Profiler access restricted to authorized users");
        } else {
          // Auto-load request profiles when modal opens
          loadRequestProfiles();
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

  const loadRequestProfiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiRequest(`${API_ENDPOINTS.PROFILER_REQUESTS}`);
      const data = await response.json();
      
      if (response.ok) {
        const allRequests: RequestProfile[] = data.requests || [];
        if (showAllRequests) {
          // Show all accumulated requests across pages
          setRequestProfiles(allRequests);
        } else {
          // Filter to only show requests that occurred after the last route change
          // This ensures we only see API calls for the current page, not previous pages
          const filteredRequests = allRequests.filter(
            (req) => req.timestamp >= routeChangeTimestampRef.current
          );
          setRequestProfiles(filteredRequests);
        }
        if ((!showAllRequests && allRequests.filter(r => r.timestamp >= routeChangeTimestampRef.current).length === 0) ||
            (showAllRequests && allRequests.length === 0)) {
          setError("No request profiles captured yet. Navigate or interact with the page, then check again.");
        }
      } else {
        setError(data.detail || "Failed to load request profiles");
      }
    } catch (err) {
      setError("Failed to load request profiles");
    } finally {
      setLoading(false);
    }
  };

  const clearRequestProfiles = async () => {
    try {
      const response = await apiRequest(`${API_ENDPOINTS.PROFILER_CLEAR}`, { method: "POST" });
      if (response.ok) {
        setRequestProfiles([]);
        setExpandedRequest(null);
      }
    } catch (err) {
      // silent
    }
  };

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts * 1000);
    return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const getStatusColor = (code: number) => {
    if (code >= 200 && code < 300) return "text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400";
    if (code >= 300 && code < 400) return "text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400";
    if (code >= 400 && code < 500) return "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400";
    return "text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400";
  };

  const getTimeColor = (ms: number) => {
    if (ms > 1000) return "text-red-600 dark:text-red-400";
    if (ms > 500) return "text-orange-600 dark:text-orange-400";
    if (ms > 100) return "text-yellow-600 dark:text-yellow-400";
    return "text-green-600 dark:text-green-400";
  };

  const getQueryTimeBar = (ms: number, maxMs: number) => {
    const pct = maxMs > 0 ? Math.min((ms / maxMs) * 100, 100) : 0;
    const color = ms > 500 ? "bg-red-500" : ms > 100 ? "bg-yellow-500" : "bg-green-500";
    return { pct, color };
  };

  if (!isOpen) return null;

  // Calculate totals for request profiles
  const totalRequests = requestProfiles.length;
  const totalTime = requestProfiles.reduce((sum, r) => sum + r.total_time_ms, 0);
  const totalQueries = requestProfiles.reduce((sum, r) => sum + r.query_count, 0);
  const totalQueryTime = requestProfiles.reduce((sum, r) => sum + r.total_query_time_ms, 0);

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-[95vw] max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
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
            {/* Toolbar */}
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Request Profiles
                {totalRequests > 0 && (
                  <span className="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                    {totalRequests}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Current Page / All Pages toggle */}
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                  <button
                    onClick={() => { setShowAllRequests(false); }}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                      !showAllRequests
                        ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                        : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                    }`}
                  >
                    Current Page
                  </button>
                  <button
                    onClick={() => { setShowAllRequests(true); }}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                      showAllRequests
                        ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                        : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                    }`}
                  >
                    All Pages
                  </button>
                </div>
                {requestProfiles.length > 0 && (
                  <button
                    onClick={clearRequestProfiles}
                    className="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {!profilingActive && (
                <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg p-3 dark:bg-orange-900/20 dark:border-orange-800">
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
                    Profiling is disabled on the server (ENABLE_PROFILING=False in .env). Request data and query timing will not be captured.
                  </p>
                </div>
              )}
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

              {/* Request Profiles */}
              {!loading && (
                <div className="space-y-4">
                  {requestProfiles.length > 0 && (
                    <>
                      {/* Summary Cards */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalRequests}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">API Requests</div>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
                          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{totalQueries}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Total Queries</div>
                        </div>
                        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-center">
                          <div className={`text-2xl font-bold ${getTimeColor(totalTime)}`}>
                            {totalTime.toFixed(0)}ms
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Total Time</div>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                          <div className={`text-2xl font-bold ${getTimeColor(totalQueryTime)}`}>
                            {totalQueryTime.toFixed(0)}ms
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">DB Time</div>
                        </div>
                      </div>

                      {/* Request List */}
                      <div className="space-y-2">
                        {requestProfiles.map((req, idx) => {
                          const isExpanded = expandedRequest === idx;
                          const maxQueryTime = req.queries.length > 0 
                            ? Math.max(...req.queries.map(q => q.duration_ms)) 
                            : 0;

                          return (
                            <div key={idx} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                              {/* Request Header - Clickable */}
                              <button
                                onClick={() => setExpandedRequest(isExpanded ? null : idx)}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors text-left"
                              >
                                {/* Expand/Collapse Arrow */}
                                <svg 
                                  className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>

                                {/* Method Badge */}
                                <span className={`px-2 py-0.5 text-xs font-bold rounded flex-shrink-0 ${
                                  req.method === "GET" 
                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                }`}>
                                  {req.method}
                                </span>

                                {/* Status Code */}
                                <span className={`px-1.5 py-0.5 text-xs font-medium rounded flex-shrink-0 ${getStatusColor(req.status_code)}`}>
                                  {req.status_code}
                                </span>

                                {/* URI */}
                                <span className="text-sm font-mono text-gray-800 dark:text-gray-200 truncate flex-1">
                                  {req.uri}
                                </span>

                                {/* Metrics */}
                                <div className="flex items-center gap-4 flex-shrink-0 text-xs">
                                  <span className="text-gray-400">{req.query_count}q</span>
                                  <span className={`font-medium ${getTimeColor(req.total_query_time_ms)}`}>
                                    {req.total_query_time_ms.toFixed(0)}ms db
                                  </span>
                                  <span className={`font-bold ${getTimeColor(req.total_time_ms)}`}>
                                    {req.total_time_ms.toFixed(0)}ms
                                  </span>
                                  <span className="text-gray-400">{formatTimestamp(req.timestamp)}</span>
                                </div>
                              </button>

                              {/* Expanded: Query Details */}
                              {isExpanded && (
                                <div className="border-t border-gray-200 dark:border-gray-700">
                                  {/* Request Summary Bar */}
                                  <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
                                    <span className="text-gray-500">Backend Total: <strong className={getTimeColor(req.total_time_ms)}>{req.total_time_ms.toFixed(2)}ms</strong></span>
                                    <span className="text-gray-500">DB: <strong className={getTimeColor(req.total_query_time_ms)}>{req.total_query_time_ms.toFixed(2)}ms</strong></span>
                                    <span className="text-gray-500">Python: <strong>{req.python_time_ms.toFixed(2)}ms</strong></span>
                                    <span className="text-gray-500">Queries: <strong>{req.query_count}</strong></span>
                                  </div>

                                  {/* Function Profiles (if any) */}
                                  {req.functions && req.functions.length > 0 && (
                                    <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700/50">
                                      <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1">Function Profiles</div>
                                      <div className="space-y-1">
                                        {req.functions.map((fn, fnIdx) => (
                                          <div key={fnIdx} className="flex items-center justify-between text-xs">
                                            <code className="text-indigo-700 dark:text-indigo-400 font-mono">{fn.name}</code>
                                            <span className={`font-medium ${getTimeColor(fn.duration_ms)}`}>{fn.duration_ms.toFixed(1)}ms</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Query List */}
                                  {req.queries.length > 0 ? (
                                    <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                      {req.queries.map((query) => {
                                        const bar = getQueryTimeBar(query.duration_ms, maxQueryTime);
                                        return (
                                          <div key={query.index} className="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/20">
                                            <div className="flex items-start gap-3">
                                              {/* Query Index */}
                                              <span className="text-xs text-gray-400 font-mono mt-0.5 flex-shrink-0 w-6 text-right">
                                                #{query.index}
                                              </span>

                                              {/* SQL */}
                                              <div className="flex-1 min-w-0">
                                                <code className="text-xs font-mono text-purple-700 dark:text-purple-400 break-all leading-relaxed block">
                                                  {query.sql}
                                                </code>
                                                {query.parameters && (
                                                  <div className="mt-1 text-xs text-gray-400 font-mono truncate">
                                                    Params: {query.parameters}
                                                  </div>
                                                )}
                                              </div>

                                              {/* Duration + Bar */}
                                              <div className="flex-shrink-0 w-28 flex items-center gap-2">
                                                <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                  <div className={`h-full ${bar.color} rounded-full`} style={{ width: `${bar.pct}%` }}></div>
                                                </div>
                                                <span className={`text-xs font-medium ${getTimeColor(query.duration_ms)} w-16 text-right`}>
                                                  {query.duration_ms.toFixed(1)}ms
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="px-4 py-3 text-xs text-gray-400 italic">
                                      No database queries in this request
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Refresh button */}
                      <div className="flex justify-center pt-2">
                        <button
                          onClick={loadRequestProfiles}
                          disabled={loading}
                          className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
                        >
                          Refresh
                        </button>
                      </div>
                    </>
                  )}

                  {/* Empty state */}
                  {requestProfiles.length === 0 && !loading && (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 text-center">
                      <div className="mb-4">
                        <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        No Request Profiles Yet
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                        Navigate to any page in the app, then come back here to see all API requests and SQL queries with timing.
                      </p>
                      <button
                        onClick={loadRequestProfiles}
                        className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        Check Now
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
