import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { Table, TableHeader, TableBody, TableRow, TableCell } from "./table";
import Input from "../form/input/InputField";
import { getAuthToken, removeAuthToken, API_BASE_URL } from "../../config/api";

interface Column {
  data: string;
  name?: string;
  searchable?: boolean;
  orderable?: boolean;
  render?: (data: any, row: any) => React.ReactNode;
  visible?: boolean; // Initial visibility (default: true, false for notvisible columns)
  exportable?: boolean; // Whether column should be exported (default: true, false for notexport columns)
  className?: string; // CSS classes for the column
  defaultOrder?: boolean; // Whether this column should be used for default ordering
  textCenter?: boolean; // Whether text should be center-aligned
  width?: string; // Column width (e.g., "200px") - if provided, enables fixed table layout
  wrapText?: boolean; // Whether text should wrap instead of using ellipsis
}

interface DataTableProps {
  columns: Column[];
  ajaxUrl: string;
  ajaxMethod?: "GET" | "POST";
  /** @deprecated Use ajaxMethod instead */
  method?: "GET" | "POST";
  ajaxData?: Record<string, any>; // Additional data to send with AJAX request
  onRowClick?: (row: any) => void;
  pageLength?: number;
  lengthMenu?: number[];
  refreshTrigger?: number; // External trigger to refresh table
  showExport?: boolean; // Show export buttons
  showColumnVisibility?: boolean; // Show column visibility toggle
  exportFileName?: string; // Default export file name
}

export interface DataTableRef {
  refresh: () => void;
}

interface DataTableResponse {
  draw: number;
  recordsTotal?: number;
  recordsFiltered?: number;
  data?: any[];
}

const DataTableComponent = (props: DataTableProps, ref: React.ForwardedRef<DataTableRef>): React.ReactElement => {
  // Destructure props
  const columns = props.columns;
  const ajaxUrl = props.ajaxUrl;
  const ajaxMethod = props.ajaxMethod;
  const ajaxData = props.ajaxData;
  const onRowClick = props.onRowClick;
  const pageLength = props.pageLength;
  const lengthMenu = props.lengthMenu;
  const refreshTrigger = props.refreshTrigger;
  const showExport = props.showExport !== false;
  const showColumnVisibility = props.showColumnVisibility !== false;
  const exportFileName = props.exportFileName || "export";
  
  // Apply default values (support both ajaxMethod and deprecated method prop)
  const method = ajaxMethod ?? props.method ?? "POST";
  const pageLen = pageLength || 10;
  const menu = lengthMenu || [10, 25, 50, 100];
  
  // Column visibility state - initialize based on visible property
  // Columns with visible: false (notvisible) are hidden by default
  const [visibleColumns, setVisibleColumns] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    columns.forEach((col, idx) => {
      // If visible is explicitly false, don't include it
      // Otherwise, include it (default behavior)
      if (col.visible !== false) {
        initial.add(idx);
      }
    });
    return initial;
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  
  // Calculate visible columns array - must be early so it's available everywhere
  const visibleColumnsArray = columns.filter((_, idx) => visibleColumns.has(idx));
  
  // Check if any columns have explicit widths (for conditional fixed layout)
  const hasExplicitWidths = visibleColumnsArray.some(col => col.width);
  
  // Calculate total table width from column widths (only if widths are defined)
  const totalTableWidth = hasExplicitWidths ? visibleColumnsArray.reduce((sum, col) => {
    if (col.width) {
      const widthValue = parseInt(col.width);
      return sum + (isNaN(widthValue) ? 0 : widthValue);
    }
    return sum + 150; // Default width for columns without specified width
  }, 0) : 0;


  // Close column menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(event.target as Node)) {
        setShowColumnMenu(false);
      }
    };

    if (showColumnMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showColumnMenu]);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [start, setStart] = useState(0);
  const [length, setLength] = useState(pageLen);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [recordsFiltered, setRecordsFiltered] = useState(0);

  // Find default order column (defaultOrderby) or use first column
  const defaultOrderColumn = columns.findIndex(col => col.defaultOrder === true);
  const initialOrderColumn = defaultOrderColumn >= 0 ? defaultOrderColumn : 0;
  
  const [order, setOrder] = useState<{ column: number; dir: "asc" | "desc" }>({
    column: initialOrderColumn,
    dir: "desc",
  });
  const [globalSearch, setGlobalSearch] = useState("");
  const [columnSearch, setColumnSearch] = useState<Record<number, string>>({});
  const [columnSearchInput, setColumnSearchInput] = useState<Record<number, string>>({}); // Input values (not yet applied)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const callCountRef = useRef(0);

  const drawRef = useRef(1);

  const fetchData = useCallback(async () => {
    const startTime = performance.now();
    callCountRef.current += 1;
    const currentDraw = drawRef.current;
    
    // Check token before making request
    const token = getAuthToken();
    if (!token) {
      // No token found - will be handled by API
      removeAuthToken();
      window.location.href = "/login";
      return;
    }
    
    // Starting AJAX call

    setLoading(true);
    try {
      const requestData = {
        draw: currentDraw,
        start,
        length,
        order: [order],
        columns: columns.map((col, idx) => {
          const searchValue = columnSearch[idx] || "";
          if (searchValue) {
            // Sending column search
          }
          return {
            data: col.data,
            name: col.name || col.data,
            searchable: col.searchable !== false,
            orderable: col.orderable !== false,
            search: {
              value: searchValue,
              regex: false,
            },
          };
        }),
        search: {
          value: globalSearch,
          regex: false,
        },
        // Merge additional ajaxData if provided
        ...(ajaxData || {}),
      };

      // Construct full URL - if ajaxUrl is relative, prepend API_BASE_URL
      const fullUrl = ajaxUrl.startsWith("http") ? ajaxUrl : `${API_BASE_URL}${ajaxUrl}`;
      
      const response = await fetch(fullUrl, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: method === "POST" ? JSON.stringify(requestData) : undefined,
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      if (!response.ok) {
        // Handle 401 Unauthorized
        if (response.status === 401) {
          removeAuthToken();
          window.location.href = "/login";
          throw new Error("Session expired. Please login again.");
        }
        // Try to get error message from response
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.clone().json();
          if (errorData.detail) {
            errorMessage = errorData.detail;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // If JSON parsing fails, use default message
        }
        throw new Error(errorMessage);
      }

      const result: DataTableResponse = await response.json();
      setData(result.data || []);
      setRecordsTotal(result.recordsTotal || 0);
      setRecordsFiltered(result.recordsFiltered || 0);
      drawRef.current += 1;

      // AJAX call completed
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      // AJAX call failed
      console.error(`[DataTable] Error fetching data from ${ajaxUrl}:`, error);
      
      // If it's an authentication error, the redirect should have already happened
      // But we still need to clear the data
      if (errorMessage.includes("Session expired") || errorMessage.includes("No authentication token")) {
        setData([]);
        return; // Don't set loading to false yet, redirect is happening
      }
      
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [start, length, order, globalSearch, columnSearch, columns, ajaxUrl, method, ajaxData]);

  // Track previous values to detect actual changes
  const prevValuesRef = useRef({
    start,
    length,
    orderColumn: order.column,
    orderDir: order.dir,
    globalSearch,
    columnSearch: JSON.stringify(columnSearch),
    ajaxData: JSON.stringify(ajaxData || {}),
    refreshTrigger,
    isInitialMount: true,
  });

  // Single effect to handle all data fetching
  useEffect(() => {
    const currentValues = {
      start,
      length,
      orderColumn: order.column,
      orderDir: order.dir,
      globalSearch,
      columnSearch: JSON.stringify(columnSearch),
      ajaxData: JSON.stringify(ajaxData || {}),
      refreshTrigger,
    };

    const prev = prevValuesRef.current;
    const isGlobalSearchChange = prev.globalSearch !== currentValues.globalSearch;
    const isColumnSearchChange = prev.columnSearch !== currentValues.columnSearch;
    const isAjaxDataChange = prev.ajaxData !== currentValues.ajaxData;
    const isPaginationChange = prev.start !== currentValues.start || 
                              prev.length !== currentValues.length;
    const isSortChange = prev.orderColumn !== currentValues.orderColumn || 
                        prev.orderDir !== currentValues.orderDir;
    const isRefreshTrigger = refreshTrigger !== undefined && 
                            refreshTrigger > 0 && 
                            prev.refreshTrigger !== currentValues.refreshTrigger;
    const isInitialMount = prev.isInitialMount;

    // Clear any existing search timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = undefined;
    }

    // Handle global search changes with debounce (typing in global search box)
    if (isGlobalSearchChange && !isInitialMount) {
      searchTimeoutRef.current = setTimeout(() => {
        prevValuesRef.current = { ...currentValues, isInitialMount: false };
        setStart(0);
        drawRef.current = 1;
        fetchData();
      }, 500);
      return;
    }

    // Handle column search changes immediately (Enter/blur from column inputs)
    if (isColumnSearchChange && !isInitialMount) {
      prevValuesRef.current = { ...currentValues, isInitialMount: false };
      setStart(0); // Reset to first page when search changes
      drawRef.current = 1;
      fetchData();
      return;
    }

    // Handle ajaxData changes (filter changes from parent)
    if (isAjaxDataChange && !isInitialMount) {
      prevValuesRef.current = { ...currentValues, isInitialMount: false };
      setStart(0); // Reset to first page when filters change
      drawRef.current = 1;
      fetchData();
      return;
    }

    // Handle other changes immediately (but skip initial mount for pagination/sort)
    if (isInitialMount) {
      // Initial mount - fetch once
      prevValuesRef.current = { ...currentValues, isInitialMount: false };
      drawRef.current = 1;
      fetchData();
    } else if (isRefreshTrigger) {
      // External refresh trigger
      prevValuesRef.current = { ...currentValues, isInitialMount: false };
      setStart(0);
      drawRef.current = 1;
      fetchData();
    } else if (isPaginationChange || isSortChange) {
      // Pagination or sorting change
      prevValuesRef.current = { ...currentValues, isInitialMount: false };
      drawRef.current = 1;
      fetchData();
    } else {
      // Update ref even if no fetch needed
      prevValuesRef.current = { ...currentValues, isInitialMount: false };
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, length, order.column, order.dir, globalSearch, columnSearch, refreshTrigger, ajaxData]);

  // Sync input values with applied search values when search is cleared externally
  useEffect(() => {
    setColumnSearchInput((prev) => {
      const synced: Record<number, string> = { ...prev };
      // Sync with applied search values
      Object.keys(columnSearch).forEach((key) => {
        const idx = Number(key);
        synced[idx] = columnSearch[idx];
      });
      // Clear inputs that don't have applied search
      Object.keys(synced).forEach((key) => {
        const idx = Number(key);
        if (!(idx in columnSearch)) {
          delete synced[idx];
        }
      });
      return synced;
    });
  }, [columnSearch]);

  // Expose refresh method via ref
  useImperativeHandle(ref, () => ({
    refresh: () => {
      drawRef.current = 1;
      setStart(0);
      fetchData();
    },
  }));

  const handleSort = (columnIndex: number) => {
    setOrder({
      column: columnIndex,
      dir: order.column === columnIndex && order.dir === "asc" ? "desc" : "asc",
    });
    setStart(0);
  };

  const handlePageChange = (newStart: number) => {
    setStart(newStart);
  };

  const handleLengthChange = (newLength: number) => {
    setLength(newLength);
    setStart(0);
  };

  const handleColumnSearch = (columnIndex: number, value: string) => {
    // Update input value (what user is typing)
    setColumnSearchInput((prev) => {
      const newInput = { ...prev, [columnIndex]: value };
      
      // If input is cleared (empty), automatically apply the search to refresh data
      if (!value.trim()) {
        // Check if there was a previous search value for this column
        setColumnSearch((prevSearch) => {
          const hadPreviousSearch = prevSearch[columnIndex] && prevSearch[columnIndex].trim();
          if (hadPreviousSearch) {
            // Clear the search immediately when input is cleared
            const newSearch = { ...prevSearch };
            delete newSearch[columnIndex];
            // Trigger API call by updating columnSearch state
            return newSearch;
          }
          return prevSearch;
        });
      }
      
      return newInput;
    });
  };

  const applyColumnSearch = (columnIndex: number, value: string) => {
    const trimmedValue = value.trim();
    // Applying column search
    
    // Apply the search value (triggers API call via useEffect)
    setColumnSearch((prev) => {
      const newSearch = { ...prev };
      if (trimmedValue) {
        newSearch[columnIndex] = trimmedValue;
      } else {
        // Remove key if value is empty
        delete newSearch[columnIndex];
      }
      // Updated column search
      return newSearch;
    });
    // Update input value to match applied value
    setColumnSearchInput((prev) => {
      const newInput = { ...prev };
      if (trimmedValue) {
        newInput[columnIndex] = trimmedValue;
      } else {
        delete newInput[columnIndex];
      }
      return newInput;
    });
    // Note: setStart(0) will be handled by the useEffect when it detects columnSearch change
  };

  const handleColumnSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, columnIndex: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const value = columnSearchInput[columnIndex] || "";
      applyColumnSearch(columnIndex, value);
    }
  };

  const handleColumnSearchBlur = (columnIndex: number) => {
    const value = columnSearchInput[columnIndex] || "";
    // Only apply if value changed or if clearing (empty string)
    const currentApplied = columnSearch[columnIndex] || "";
    if (value.trim() !== currentApplied.trim()) {
      applyColumnSearch(columnIndex, value);
    }
  };

  const totalPages = Math.ceil(recordsFiltered / length) || 1;
  const currentPage = Math.floor(start / length) + 1;

  // Export functions
  const exportToExcel = (exportAll: boolean = false) => {
    const dataToExport = data; // For now, same data. In future, fetch all data for exportAll
    // Filter to only exportable columns (exportable !== false) and visible columns
    const exportableCols = visibleColumnsArray.filter(col => col.exportable !== false);
    const headers = exportableCols.map(col => col.name || col.data);
    const rows = dataToExport.map(row => 
      exportableCols.map(col => {
        const value = row[col.data];
        // Strip HTML tags and decode entities
        const textValue = value ? String(value).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() : '';
        return textValue;
      })
    );
    
    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    // Create blob and download
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${exportFileName}_${exportAll ? 'all' : 'page'}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleColumnVisibility = (columnIndex: number) => {
    setVisibleColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(columnIndex)) {
        // Don't allow hiding all columns
        if (newSet.size > 1) {
          newSet.delete(columnIndex);
        }
      } else {
        newSet.add(columnIndex);
      }
      return newSet;
    });
  };

  return (
    <div className="w-full" style={{ width: '100%', overflow: 'hidden', maxWidth: '100%' }}>
      {/* Toolbar: Page Limit, Search, Export, Column Visibility */}
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Page Limit - Moved to top */}
        <div className="flex items-center">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Show
            <select
              value={length}
              onChange={(e) => handleLengthChange(Number(e.target.value))}
              className="mx-2 rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              {menu.map((len) => (
                <option key={len} value={len}>
                  {len}
                </option>
              ))}
            </select>
            entries
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Search box beside export buttons */}
          <Input
            placeholder="Search all columns..."
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            className="max-w-md"
          />
          {showExport && (
            <>
              <button
                onClick={() => exportToExcel(false)}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
                title="Export current page"
              >
                📥 Export Page
              </button>
              <button
                onClick={() => exportToExcel(true)}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
                title="Export all data"
              >
                📥 Export All
              </button>
            </>
          )}
          {showColumnVisibility && (
            <div className="relative" ref={columnMenuRef}>
              <button
                onClick={() => setShowColumnMenu(!showColumnMenu)}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
                title="Column visibility"
              >
                👁️ Columns
              </button>
              {showColumnMenu && (
                <div className="absolute right-0 z-[9999] mt-1 w-48 rounded border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  {columns.map((col, idx) => (
                    <label key={idx} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={visibleColumns.has(idx)}
                        onChange={() => toggleColumnVisibility(idx)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{col.name || col.data}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div 
        ref={tableContainerRef}
        className="border border-gray-200 rounded-lg dark:border-gray-700" 
        style={{ 
          overflowX: 'auto', 
          overflowY: 'visible',
          width: '100%',
          maxWidth: '100%',
          display: 'block',
          position: 'relative',
          scrollBehavior: 'smooth'
        }}
      >
        <div style={{ width: '100%' }}>
          <Table className="border-collapse" style={hasExplicitWidths ? { tableLayout: 'fixed', width: totalTableWidth > 0 ? `${totalTableWidth}px` : '100%' } : { width: '100%' }}>
          {hasExplicitWidths && (
            <colgroup>
              {visibleColumnsArray.map((column) => {
                return (
                  <col key={column.data} style={{ width: column.width || '150px' }} />
                );
              })}
            </colgroup>
          )}
          <TableHeader className="bg-gray-100 dark:bg-gray-800" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <TableRow>
              {visibleColumnsArray.map((column) => {
                const originalIndex = columns.indexOf(column);
                const isActionColumn = column.data === "ACTION";
                const headerStyle: React.CSSProperties = hasExplicitWidths ? (isActionColumn ? {
                  overflow: 'hidden',
                  maxWidth: column.width || '160px',
                  width: column.width || '160px',
                  minWidth: column.width || '160px',
                } : {
                  overflow: 'visible',
                  wordWrap: 'break-word',
                  whiteSpace: 'normal',
                  maxWidth: column.width || '150px',
                }) : {};
                return (
                <TableCell
                  key={originalIndex}
                  isHeader
                  className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300"
                  style={headerStyle}
                >
                  <div className="flex flex-col gap-2" style={{ minWidth: 0, width: '100%', maxWidth: '100%' }}>
                    <div 
                      className={`flex items-center justify-between ${
                        column.orderable !== false ? "cursor-pointer" : ""
                      }`}
                      onClick={() => column.orderable !== false && handleSort(originalIndex)}
                    >
                      <p className={`font-medium text-gray-700 text-theme-xs dark:text-gray-400 ${
                        order.column === originalIndex ? "text-brand-500" : ""
                      }`}>
                        {column.name || column.data}
                      </p>
                      {column.orderable !== false && (
                        <button className="flex flex-col gap-0.5" type="button">
                          <svg 
                            className={`${
                              order.column === originalIndex && order.dir === "asc" 
                                ? "text-brand-500" 
                                : "text-gray-300 dark:text-gray-700"
                            }`}
                            width="8" 
                            height="5" 
                            viewBox="0 0 8 5" 
                            fill="none" 
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path 
                              d="M4.40962 0.585167C4.21057 0.300808 3.78943 0.300807 3.59038 0.585166L1.05071 4.21327C0.81874 4.54466 1.05582 5 1.46033 5H6.53967C6.94418 5 7.18126 4.54466 6.94929 4.21327L4.40962 0.585167Z" 
                              fill="currentColor"
                            />
                          </svg>
                          <svg 
                            className={`${
                              order.column === originalIndex && order.dir === "desc" 
                                ? "text-brand-500" 
                                : "text-gray-300 dark:text-gray-700"
                            }`}
                            width="8" 
                            height="5" 
                            viewBox="0 0 8 5" 
                            fill="none" 
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path 
                              d="M4.40962 4.41483C4.21057 4.69919 3.78943 4.69919 3.59038 4.41483L1.05071 0.786732C0.81874 0.455343 1.05582 0 1.46033 0H6.53967C6.94418 0 7.18126 0.455342 6.94929 0.786731L4.40962 4.41483Z" 
                              fill="currentColor"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                    {column.searchable !== false ? (
                      <Input
                        placeholder={`Search ${column.name || column.data}...`}
                        value={columnSearchInput[originalIndex] || ""}
                        onChange={(e) => handleColumnSearch(originalIndex, e.target.value)}
                        onKeyDown={(e) => handleColumnSearchKeyDown(e, originalIndex)}
                        onBlur={() => handleColumnSearchBlur(originalIndex)}
                        className="w-full text-xs"
                        size="sm"
                      />
                    ) : (
                      <div className="text-xs text-gray-400 dark:text-gray-500 h-8 flex items-center">
                        #
                      </div>
                    )}
                  </div>
                </TableCell>
              );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={visibleColumnsArray.length}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : data.length > 0 ? (
              data.map((row, rowIndex) => (
                <TableRow
                  key={rowIndex}
                  className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  onClick={() => onRowClick && onRowClick(row)}
                >
                  {visibleColumnsArray.map((column) => {
                    const originalIndex = columns.indexOf(column);
                    // Apply text-center class if textCenter is true
                    const cellClassName = `px-4 py-3 text-sm text-gray-800 dark:text-gray-200 ${column.textCenter ? 'text-center' : ''}`;
                    // For all text columns, default to wrapping unless it's the Action column
                    const isActionColumn = column.data === "ACTION";
                    const shouldWrap = !isActionColumn;
                    const cellStyle: React.CSSProperties = hasExplicitWidths ? (shouldWrap ? {
                      wordWrap: 'break-word',
                      whiteSpace: 'normal',
                      overflow: 'visible',
                      maxWidth: column.width || '150px',
                      width: column.width || '150px',
                    } : {
                      // Action column or explicitly truncated columns
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: column.width || '150px',
                      width: column.width || '150px',
                      minWidth: column.width || '150px',
                    }) : {};
                    return (
                      <TableCell
                        key={originalIndex}
                        className={cellClassName}
                        style={cellStyle}
                      >
                        <div style={hasExplicitWidths ? { width: '100%', maxWidth: '100%', minWidth: 0, overflow: shouldWrap ? 'visible' : 'hidden' } : {}}>
                          {column.render
                            ? column.render(row[column.data], row)
                            : (() => {
                                const value = row[column.data];
                                // Check if value contains HTML tags
                                if (value && typeof value === 'string' && /<[^>]+>/.test(value)) {
                                  return <span dangerouslySetInnerHTML={{ __html: value }} />;
                                }
                                return String(value || "-");
                              })()}
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={visibleColumnsArray.length}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  No data available
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      {/* Pagination - Always show */}
      {recordsFiltered > 0 && (
        <div className="mt-4 flex flex-col gap-4 border-t border-gray-200 pt-4 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Showing {start + 1} to {Math.min(start + length, recordsFiltered)} of{" "}
            {recordsFiltered} entries
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePageChange(0)}
            disabled={start === 0 || loading}
            className="rounded border border-gray-300 bg-white px-3 py-1 text-sm disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          >
            First
          </button>
          <button
            onClick={() => handlePageChange(Math.max(0, start - length))}
            disabled={start === 0 || loading}
            className="rounded border border-gray-300 bg-white px-3 py-1 text-sm disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          >
            Previous
          </button>
          {totalPages > 1 && (
            <>
              <span className="px-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(Math.min(start + length, (totalPages - 1) * length))}
                disabled={start + length >= recordsFiltered || loading}
                className="rounded border border-gray-300 bg-white px-3 py-1 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
              >
                Next
              </button>
              <button
                onClick={() => handlePageChange(Math.max(0, (totalPages - 1) * length))}
                disabled={start + length >= recordsFiltered || loading}
                className="rounded border border-gray-300 bg-white px-3 py-1 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
              >
                Last
              </button>
            </>
          )}
        </div>
        </div>
      )}
    </div>
  );
};

const DataTable = forwardRef<DataTableRef, DataTableProps>(DataTableComponent);

DataTable.displayName = "DataTable";

export default DataTable;

