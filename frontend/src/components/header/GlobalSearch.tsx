import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { api, API_BASE_URL } from "../../config/api";
import { SearchIcon, CloseIcon } from "../../icons";

interface SearchResult {
  id: string;
  label: string;
  type: "student" | "batch";
  STUDENT_ID?: string;
  BATCH_ID?: string;
  PROJECT_ID?: string;
  STUDENT_FULL_NAME?: string;
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentPlaceholderIndex, setCurrentPlaceholderIndex] = useState(0);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const placeholders = [
    "Search Student ID / Student Name",
    "Search Batch ID",
  ];

  // Rotate placeholder text
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setCurrentPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest("#GlobalSearchButton")
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onClose]);

  // Perform search with debounce
  const performSearch = async (searchQuery: string) => {
    if (searchQuery.length < 4) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);
    setShowSuggestions(false);
    try {
      console.log("[GlobalSearch] Performing search for:", searchQuery);
      // Build query string manually since api.get doesn't handle params
      const queryString = new URLSearchParams({ query: searchQuery }).toString();
      const response = await api.get(`/api/viewfile/global_search?${queryString}`);

      console.log("[GlobalSearch] API Response:", response);
      // API.get already returns parsed JSON, so response is the data object
      const data = response;
      console.log("[GlobalSearch] Processed data:", data);
      
      const results: SearchResult[] = [];

      // Process students
      if (data.students && Array.isArray(data.students)) {
        data.students.forEach((item: any) => {
          const studentId = item.STUDENT_ID || "";
          const fullName = item.STUDENT_FULL_NAME || "Unknown";
          const projectId = item.PROJECT_ID || "2";

          results.push({
            id: `/college/studentview?student_id=${studentId}`,
            label: `${fullName}${studentId ? ` - ${studentId}` : ""}${item.BATCH_ID ? ` - Batch: ${item.BATCH_ID}` : ""}`,
            type: "student",
            STUDENT_ID: studentId,
            BATCH_ID: item.BATCH_ID || "",
            PROJECT_ID: projectId,
            STUDENT_FULL_NAME: fullName,
          });
        });
      }

      // Process batches
      if (data.batches && Array.isArray(data.batches)) {
        data.batches.forEach((item: any) => {
          const batchId = item.BATCH_ID || "";
          const projectId = item.PROJECT_ID || "2";

          // Legacy projects (school/college/grad) were removed in SIR-only app.
          // Keep global search usable by routing to dashboard.
          const url = "/dashboard";

          results.push({
            id: url,
            label: `Batch ID: ${batchId}`,
            type: "batch",
            BATCH_ID: batchId,
            PROJECT_ID: projectId,
          });
        });
      }

      console.log("[GlobalSearch] Processed results:", results);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch (error: any) {
      console.error("[GlobalSearch] Search error:", error);
      console.error("[GlobalSearch] Error details:", {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status,
      });
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setLoading(false);
    }
  };

  // Handle input change with debounce
  const handleInputChange = (value: string) => {
    setQuery(value);
    setShowSuggestions(false);

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (value.trim().length >= 4) {
      debounceTimeoutRef.current = setTimeout(() => {
        performSearch(value.trim());
      }, 300);
    } else if (value.trim().length > 0) {
      setShowSuggestions(true);
    }
  };

  // Clear search
  const handleClear = () => {
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Handle result click
  const handleResultClick = (result: SearchResult) => {
    navigate(result.id);
    onClose();
    setQuery("");
    setSuggestions([]);
  };

  // Group suggestions by project
  const groupedSuggestions = suggestions.reduce((acc, item) => {
    const projectId = item.PROJECT_ID || "2";
    const groupName = "Results";

    if (!acc[groupName]) {
      acc[groupName] = [];
    }
    acc[groupName].push(item);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="fixed top-14 left-1/2 transform -translate-x-1/2 w-full max-w-2xl z-50 animate-in slide-in-from-top-2 duration-200"
      style={{ maxHeight: "80vh" }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-800 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (query.trim().length >= 4) {
              performSearch(query.trim());
            }
          }}
        >
          <div className="relative flex items-center">
            <SearchIcon className="absolute left-3 w-5 h-5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={placeholders[currentPlaceholderIndex]}
              className="w-full h-12 pl-10 pr-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            )}
          </div>

          {loading && (
            <div className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
              <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-brand-500 border-t-transparent"></div>
              <span className="ml-2">Searching...</span>
            </div>
          )}

          {query.trim().length > 0 && query.trim().length < 4 && (
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400 p-2">
              Please enter at least 4 characters to search.
            </div>
          )}

          {showSuggestions && suggestions.length > 0 && (
            <div className="mt-2 max-h-96 overflow-y-auto border-t border-gray-200 dark:border-gray-700">
              <ul className="py-2">
                {Object.entries(groupedSuggestions).map(([groupName, items]) => (
                  <li key={groupName} className="mb-2">
                    <div className="px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {groupName}
                    </div>
                    <ul>
                      {items.map((item, index) => (
                        <li key={`${item.type}-${index}`}>
                          <button
                            type="button"
                            onClick={() => handleResultClick(item)}
                            className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm"
                          >
                            {item.type === "student" ? (
                              <span>
                                Student: <span className="font-medium">{item.STUDENT_FULL_NAME}</span>
                                {item.STUDENT_ID && ` - ${item.STUDENT_ID}`}
                              </span>
                            ) : (
                              <span className="font-medium">{item.label}</span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {showSuggestions && query.trim().length >= 4 && suggestions.length === 0 && !loading && (
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400 p-2 text-center">
              No results found for "{query}"
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

