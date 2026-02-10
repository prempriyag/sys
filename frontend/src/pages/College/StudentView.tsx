import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../components/common/PageContainer";
import TranscriptReports from "./transcriptreports/TranscriptReports";
import ArticulationReports from "./articulationreports/ArticulationReports";
import HorizontalTree from "../../components/common/HorizontalTree";
import { API_ENDPOINTS } from "../../config/api";
import { api } from "../../config/api";
import { useToast } from "../../context/ToastContext";
import ThemedLoader from "../../components/common/ThemedLoader";

interface Student {
  STUDENT_ID: string;
  STUDENT_FULL_NAME: string;
}

interface Institution {
  INSTITUTION_ID: string;
  INSTITUTION_NAME: string;
  STUDENT_ID?: string;
  STUDENT_FULL_NAME?: string;
}

interface StudentInfo {
  STUDENT_ID: string;
  STUDENT_FULL_NAME: string;
  ADMISSION_DECISION?: string;
}

interface BatchMetadata {
  OCR_EXTRACTED_DATE?: string;
  LAST_UPDATED_DATETIME?: string;
}

interface StudentViewData {
  student_info: StudentInfo | null;
  institution_name: Institution[];
  status_flags_list: string[];
  total_transcripts: number;
  menu_list: Record<string, Record<string, Record<string, number>>>;
  batch_details: Record<string, string[]>;
  batch_metadata?: Record<string, Record<string, BatchMetadata>>;
  institution_id: string;
  student_id: string;
  batch_id: string;
}

/**
 * Student View page - Student to Transcripts Action Center
 * Matches: CI3 Studentview controller (application/controllers/Studentview.php)
 *          CI3 view (application/views/admin/studentview/student_page.php)
 */
export default function StudentView() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Initialize from URL params (matching CI3 line 3-4: $type = $_GET['type'])
  const [studentId, setStudentId] = useState<string>(searchParams.get("student_id") || "");
  const [students, setStudents] = useState<Student[]>([]);
  const [studentData, setStudentData] = useState<StudentViewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  // Initialize selected values from URL params on mount (matching CI3 behavior)
  const [selectedType, setSelectedType] = useState<string>(searchParams.get("type") || "");
  const [selectedInstitution, setSelectedInstitution] = useState<string>(searchParams.get("institution_id") || "");
  const [selectedBatch, setSelectedBatch] = useState<string>(searchParams.get("batch_id") || "");
  const [selectedPageType, setSelectedPageType] = useState<"transcript" | "articulation">(
    (searchParams.get("page") === "articulation" ? "articulation" : "transcript") as "transcript" | "articulation"
  );
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false);
  const [isAccordionOpen, setIsAccordionOpen] = useState<boolean>(true);
  const [isRootExpanded, setIsRootExpanded] = useState<boolean>(true);
  const [treeZoom, setTreeZoom] = useState<number>(100);
  const { alerterror } = useToast();
  const selectRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter students based on search query
  const filteredStudents = useMemo(() => {
    if (!students || students.length === 0) return [];
    if (!searchQuery || searchQuery.trim() === '') {
      // Show all students when no search query
      return students;
    }
    // Filter by search query
    const query = searchQuery.toLowerCase().trim();
    return students.filter(
      (student) =>
        student.STUDENT_FULL_NAME?.toLowerCase().includes(query) ||
        student.STUDENT_ID?.toLowerCase().includes(query)
    );
  }, [students, searchQuery]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        selectRef.current && 
        !selectRef.current.contains(event.target as Node)
      ) {
        setIsInputFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle zoom with Alt+Scroll and keyboard shortcuts
  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if (event.altKey) {
        event.preventDefault();
        setTreeZoom(prev => {
          const newZoom = event.deltaY < 0 
            ? Math.min(prev + 10, 150) 
            : Math.max(prev - 10, 70);
          return newZoom;
        });
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + Plus/Equals to zoom in
      if ((event.ctrlKey || event.metaKey) && (event.key === '+' || event.key === '=')) {
        event.preventDefault();
        setTreeZoom(prev => Math.min(prev + 10, 150));
      }
      // Ctrl/Cmd + Minus to zoom out
      if ((event.ctrlKey || event.metaKey) && event.key === '-') {
        event.preventDefault();
        setTreeZoom(prev => Math.max(prev - 10, 70));
      }
      // Ctrl/Cmd + 0 to reset zoom
      if ((event.ctrlKey || event.metaKey) && event.key === '0') {
        event.preventDefault();
        setTreeZoom(100);
      }
    };

    document.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('wheel', handleWheel);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Fetch students list (all students on load, matching CI3 behavior)
  useEffect(() => {
    const fetchStudents = async () => {
      setLoadingStudents(true);
      try {
        // Fetch all students (no query parameter = get all students)
        const response = await api.get(API_ENDPOINTS.STUDENTVIEW_GET_STUDENTS);
        console.log("[StudentView] Fetched students list:", response?.length || 0, "students");
        if (response && Array.isArray(response)) {
          // Ensure we have proper student objects
          const validStudents = response.map((item: any) => ({
            STUDENT_ID: item.STUDENT_ID || '',
            STUDENT_FULL_NAME: item.STUDENT_FULL_NAME || item.FULL_NAME || '',
          })).filter((student: Student) => student.STUDENT_ID || student.STUDENT_FULL_NAME);
          
          setStudents(validStudents);
        } else {
          console.warn("[StudentView] Invalid response format:", response);
          setStudents([]);
        }
      } catch (error: any) {
        console.error("[StudentView] Error fetching students:", error);
        alerterror(error.message || "Failed to load students list");
        setStudents([]); // Set empty array on error
      } finally {
        setLoadingStudents(false);
      }
    };
    fetchStudents();
  }, [alerterror]);

  // Fetch student data when studentId changes
  useEffect(() => {
    const fetchStudentData = async () => {
      if (!studentId) {
        setStudentData(null);
        return;
      }
      
      setLoading(true);
      try {
        // Build query string manually since api.get doesn't handle params
        const queryParams = new URLSearchParams({ student_id: studentId });
        const url = `${API_ENDPOINTS.STUDENTVIEW}?${queryParams.toString()}`;
        console.log("[StudentView] Fetching student data from:", url);
        const response = await api.get(url);
        console.log("[StudentView] Student data response:", response);
        
        // Validate response structure
        if (response && typeof response === 'object') {
          // Transform the response to match StudentViewData interface
          const transformedData: StudentViewData = {
            student_info: response.student_info || null,
            institution_name: response.institution_name || [],
            status_flags_list: response.status_flags_list || [],
            total_transcripts: response.total_transcripts || 0,
            menu_list: response.menu_list || {},
            batch_details: response.batch_details || {},
            batch_metadata: response.batch_metadata || {},
            institution_id: response.institution_id || "",
            student_id: response.student_id || studentId,
            batch_id: response.batch_id || "",
          };
          
          setStudentData(transformedData);
          
          // Log the data structure for debugging
          console.log("[StudentView] Menu list structure:", response.menu_list);
          console.log("[StudentView] Batch details:", response.batch_details);
          console.log("[StudentView] Institution name:", response.institution_name);
        } else {
          console.error("[StudentView] Invalid response structure:", response);
          alerterror("Invalid response from server");
        }
      } catch (error: any) {
        console.error("[StudentView] Error fetching student data:", error);
        console.error("[StudentView] Error details:", {
          message: error.message,
          stack: error.stack,
          response: (error as any).response
        });
        alerterror(error.message || "Failed to load student data");
        setStudentData(null);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStudentData();
  }, [studentId, alerterror]);

  // Auto-expand batches with kickouts or selected batch (matching CI3 line 78-80)
  useEffect(() => {
    if (studentData) {
      const newExpanded = new Set<string>();

      Object.entries(studentData.batch_details).forEach(([instId, batches]) => {
        batches.forEach((batch) => {
          const menuWithBatch = studentData.menu_list[instId]?.[batch] || {};
          const hasKickouts =
            (menuWithBatch["Failed"] > 0 ||
              menuWithBatch["Articulation-Kickouts"] > 0 ||
              menuWithBatch["Rerun"] > 0 ||
              menuWithBatch["articulation_Failed"] > 0 ||
              menuWithBatch["articulation_Rerun"] > 0) ||
            (batch === selectedBatch && instId === selectedInstitution);

          if (hasKickouts) {
            newExpanded.add(`${instId}-${batch}`);
          }
        });
      });

      // If no kickouts found, expand the first batch automatically for better UX
      if (newExpanded.size === 0 && studentData.batch_details && Object.keys(studentData.batch_details).length > 0) {
        const firstInstId = Object.keys(studentData.batch_details)[0];
        const firstBatch = studentData.batch_details[firstInstId]?.[0];
        if (firstBatch) {
          newExpanded.add(`${firstInstId}-${firstBatch}`);
        }
      }

      setExpandedBatches(newExpanded);
    }
  }, [studentData, selectedBatch, selectedInstitution]);

  const handleStudentSelect = (student: Student) => {
    console.log("[StudentView] Student selected:", student);
    const selectedId = student.STUDENT_ID || student.STUDENT_FULL_NAME;
    console.log("[StudentView] Setting student ID to:", selectedId);
    setStudentId(selectedId);
    // Reset previous selection so the old table disappears
    setSelectedType("");
    setSelectedInstitution("");
    setSelectedBatch("");
    setSelectedPageType("transcript");
    
    setSearchParams({ student_id: selectedId });
    setSearchQuery("");
    setIsInputFocused(false); // Close dropdown after selection
  };

  const toggleBatch = (institutionId: string, batchId: string) => {
    const key = `${institutionId}-${batchId}`;
    const newExpanded = new Set(expandedBatches);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedBatches(newExpanded);
  };

  const handleViewPageLoad = (
    studentId: string,
    type: string,
    institutionId: string,
    batchId: string,
    pageType: "transcript" | "articulation" = "transcript"
  ) => {
    setSelectedType(type);
    setSelectedInstitution(institutionId);
    setSelectedBatch(batchId);
    setSelectedPageType(pageType);

    // Expand the batch
    const key = `${institutionId}-${batchId}`;
    setExpandedBatches(new Set([...expandedBatches, key]));

    // Update URL
    setSearchParams({
      student_id: studentId,
      batch_id: batchId,
      institution_id: institutionId,
      type: type,
      page: pageType,
    });

    // Scroll to transcript view after a short delay
    setTimeout(() => {
      const element = document.getElementById("transcript_view");
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  };

  const getStudentDisplayName = () => {
    if (!studentData?.student_info) return "Student Information";
    const info = studentData.student_info;
    if (info.STUDENT_ID && info.STUDENT_FULL_NAME) {
      return `${info.STUDENT_FULL_NAME} - ${info.STUDENT_ID}`;
    }
    return info.STUDENT_FULL_NAME || "Student Information";
  };

  const calculateDays = (date1: string, date2: string) => {
    if (!date1 || !date2) return "";
    try {
      // Handle MM/DD/YYYY format from backend (matching CI3 date format)
      const parseDate = (dateStr: string) => {
        if (dateStr.includes('/')) {
          const [month, day, year] = dateStr.split('/');
          return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        }
        return new Date(dateStr);
      };
      const d1 = parseDate(date1);
      const d2 = parseDate(date2);
      const diffTime = Math.abs(d2.getTime() - d1.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch {
      return "";
    }
  };

  const isActive = (type: string, instId: string, batchId: string, pageType: "transcript" | "articulation") => {
    return (
      selectedType === type &&
      selectedBatch === batchId &&
      selectedInstitution === instId &&
      selectedPageType === pageType
    );
  };

  // Function to format date from backend
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      // If date is already in MM/DD/YYYY format, return as is
      if (dateStr.includes('/')) return dateStr;
      
      // Otherwise try to parse and format
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  // Helper function to get menu items for a specific batch
  const getMenuItems = (institutionId: string, batchId: string) => {
    if (!studentData?.menu_list) return {};
    const menuWithBatch = studentData.menu_list[institutionId]?.[batchId] || {};
    console.log(`[StudentView] Menu items for ${institutionId}-${batchId}:`, menuWithBatch);
    return menuWithBatch;
  };

  // Document icon component
  const DocumentIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
  );

  // Convert student data to tree structure for HorizontalTree
  const convertToTreeStructure = () => {
    if (!studentData || !studentData.institution_name.length) return null;

    // Get student display name
    const studentName = getStudentDisplayName();
    
    // Count total batches for badge
    const totalBatches = Object.values(studentData.batch_details).reduce((sum, batches) => sum + batches.length, 0);

    // Process all institutions and batches
    const batchChildren = studentData.institution_name.flatMap((institution) => {
      const batches = studentData.batch_details[institution.INSTITUTION_ID] || [];
      
      return batches.map((batchId) => {
        const menuWithBatch = getMenuItems(institution.INSTITUTION_ID, batchId);
        const batchMeta = studentData.batch_metadata?.[institution.INSTITUTION_ID]?.[batchId];
        const ocrDate = formatDate(batchMeta?.OCR_EXTRACTED_DATE);
        const batchTitle = ocrDate 
          ? `${institution.INSTITUTION_NAME} - ${institution.INSTITUTION_ID} - ${batchId} - ${ocrDate}`
          : `${institution.INSTITUTION_NAME} - ${institution.INSTITUTION_ID} - ${batchId}`;
        
        const key = `${institution.INSTITUTION_ID}-${batchId}`;
        const isExpanded = expandedBatches.has(key);

        // Build level 3 children (action items)
        const actionChildren = [];

        // Transcript Status Items
        if (menuWithBatch["Failed"] > 0) {
          actionChildren.push({
            id: `failed-${key}`,
            label: "Transcript Kickouts",
            icon: <DocumentIcon />,
            badge: menuWithBatch["Failed"] > 1 ? menuWithBatch["Failed"] : undefined,
            onClick: () => handleViewPageLoad(studentId, "Failed", institution.INSTITUTION_ID, batchId, "transcript"),
          });
        }

        if (menuWithBatch["Articulation-Kickouts"] > 0 && !menuWithBatch["articulation_Failed"]) {
          actionChildren.push({
            id: `articulation-kickouts-${key}`,
            label: "Articulation-Kickouts",
            icon: <DocumentIcon />,
            badge: menuWithBatch["Articulation-Kickouts"] > 1 ? menuWithBatch["Articulation-Kickouts"] : undefined,
            onClick: () => handleViewPageLoad(studentId, "Articulation-Kickouts", institution.INSTITUTION_ID, batchId, "transcript"),
          });
        }

        if (menuWithBatch["Articulation-Kickouts"] === 0 && menuWithBatch["Processed"] > 0) {
          const processedLabel = batchMeta?.LAST_UPDATED_DATETIME 
            ? `Transcript Processed - ${formatDate(batchMeta.LAST_UPDATED_DATETIME)}${batchMeta?.OCR_EXTRACTED_DATE && batchMeta?.LAST_UPDATED_DATETIME ? ` (${calculateDays(batchMeta.OCR_EXTRACTED_DATE, batchMeta.LAST_UPDATED_DATETIME)} days)` : ''}`
            : "Transcript Processed";
          actionChildren.push({
            id: `processed-${key}`,
            label: processedLabel,
            icon: <DocumentIcon />,
            badge: menuWithBatch["Processed"] > 1 ? menuWithBatch["Processed"] : undefined,
            onClick: () => handleViewPageLoad(studentId, "Processed", institution.INSTITUTION_ID, batchId, "transcript"),
          });
        }

        if (menuWithBatch["Rerun"] > 0) {
          actionChildren.push({
            id: `rerun-${key}`,
            label: "Transcript Rerun",
            icon: <DocumentIcon />,
            badge: menuWithBatch["Rerun"] > 1 ? menuWithBatch["Rerun"] : undefined,
            onClick: () => handleViewPageLoad(studentId, "Rerun", institution.INSTITUTION_ID, batchId, "transcript"),
          });
        }

        // Articulation Status Items
        if (menuWithBatch["articulation_Failed"] > 0) {
          actionChildren.push({
            id: `articulation-failed-${key}`,
            label: "Articulation Course Kickouts",
            icon: <DocumentIcon />,
            badge: menuWithBatch["articulation_Failed"],
            onClick: () => handleViewPageLoad(studentId, "Failed", institution.INSTITUTION_ID, batchId, "articulation"),
          });
        }

        if (menuWithBatch["articulation_Processed"] > 0) {
          actionChildren.push({
            id: `articulation-processed-${key}`,
            label: "Articulation Course Processed",
            icon: <DocumentIcon />,
            badge: menuWithBatch["articulation_Processed"],
            onClick: () => handleViewPageLoad(studentId, "Processed", institution.INSTITUTION_ID, batchId, "articulation"),
          });
        }

        if (menuWithBatch["articulation_Rerun"] > 0) {
          actionChildren.push({
            id: `articulation-rerun-${key}`,
            label: "Articulation Course Rerun",
            icon: <DocumentIcon />,
            badge: menuWithBatch["articulation_Rerun"],
            onClick: () => handleViewPageLoad(studentId, "Rerun", institution.INSTITUTION_ID, batchId, "articulation"),
          });
        }

        return {
          id: key,
          label: batchTitle,
          icon: undefined, // Will use default folder icon
          badge: undefined,
          children: actionChildren.length > 0 ? actionChildren : undefined,
          onClick: () => toggleBatch(institution.INSTITUTION_ID, batchId),
          isExpanded: isExpanded,
        };
      });
    });

    return {
      id: "student-root",
      label: studentName,
      badge: totalBatches > 0 ? totalBatches : undefined,
      children: batchChildren.length > 0 ? batchChildren : undefined,
      onClick: () => setIsRootExpanded(!isRootExpanded), // Root node click handler
      isExpanded: isRootExpanded,
    };
  };

  return (
    <PageWrapper>
      <PageMeta
        title="Student to Transcripts | College Module"
        description="Student to Transcripts Action Center"
      />
      <PageBreadcrumb pageTitle="Student to Transcripts" />

      <PageContainer>
        <div className="mb-6">
          {/* Header with Zoom Controls */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 text-xl dark:text-white/90">
              Student to Transcripts Action Center
            </h3>
            {/* Zoom Controls - Top Right */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTreeZoom(prev => Math.max(prev - 10, 70))}
                className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-sm"
                title="Zoom Out (Ctrl+Minus or Alt+Scroll)"
              >
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <span 
                className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[50px] text-center shadow-sm cursor-help"
                title="Zoom level: Alt+Scroll or Ctrl+Plus/Minus to zoom | Ctrl+0 to reset"
              >
                {treeZoom}%
              </span>
              <button
                onClick={() => setTreeZoom(prev => Math.min(prev + 10, 150))}
                className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-sm"
                title="Zoom In (Ctrl+Plus or Alt+Scroll)"
              >
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button
                onClick={() => setTreeZoom(100)}
                className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-sm"
                title="Reset Zoom (Ctrl+0)"
              >
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Information Note */}
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-semibold mb-1">How to use this view:</p>
                <ul className="list-disc list-inside space-y-1 text-xs leading-relaxed">
                  <li>Search and select a student from the dropdown above</li>
                  <li>View their transcript hierarchy by institution and batch</li>
                  <li>Click on status items (Failed, Processed, Rerun) to view details</li>
                  <li><strong>Zoom Controls:</strong> Use the buttons above or press <code className="bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded text-xs">Alt+Scroll</code>, <code className="bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded text-xs">Ctrl++/−</code>, or <code className="bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded text-xs">Ctrl+0</code> to zoom</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mb-6 relative">
            <div className="flex flex-wrap items-start gap-6" style={{ transform: `scale(${treeZoom / 100})`, transformOrigin: 'top left', transition: 'transform 0.2s ease' }}>
              <div className="student-tree">
                {(() => {
                  // Define the Search Input Component to be used as the Root Node Label
                  const SearchInputNode = (
                    <div 
                      className="w-full relative" 
                      ref={dropdownRef}
                      onClick={(e) => e.stopPropagation()} 
                      onMouseDown={(e) => e.stopPropagation()}
                      style={{ outline: 'none', userSelect: 'none' }}
                    >
                      <div className="relative flex flex-col gap-2 flex-shrink-0">
                        <div className="flex items-center gap-2">
                          <div className="relative flex-shrink-0">
                            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                              ref={selectRef}
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              onFocus={() => setIsInputFocused(true)}
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsInputFocused(true);
                              }}
                              placeholder={studentId ? getStudentDisplayName() : "Search by Student Name or ID..."}
                              disabled={loadingStudents}
                              className="w-[260px] flex-shrink-0 rounded-lg border border-gray-200 bg-gradient-to-b from-white to-gray-50 px-3 py-1.5 pl-9 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                            />
                          </div>
                          {loadingStudents && (
                            <div className="flex-shrink-0 h-4 w-4 animate-spin rounded-full border-2 border-solid border-brand-500 border-r-transparent"></div>
                          )}
                        </div>
                        {studentId && !searchQuery && (
                          <div className="flex items-center gap-2">
                            <div className="text-sm text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 font-medium">
                              ✓ {getStudentDisplayName()}
                            </div>
                            {!loadingStudents && studentData && studentData.total_transcripts > 0 && (
                              <span className="flex-shrink-0 inline-flex items-center justify-center rounded-full bg-red-500 h-6 w-6 text-xs font-medium text-white">
                                {studentData.total_transcripts}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Dropdown Results - Beautiful Modern Design */}
                      {isInputFocused && createPortal(
                        <div 
                          className="fixed z-[9999] w-[320px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                          style={{
                            top: selectRef.current ? `${selectRef.current.getBoundingClientRect().bottom + 8}px` : '0px',
                            left: selectRef.current ? `${selectRef.current.getBoundingClientRect().left}px` : '0px',
                          }}
                        >
                          {loadingStudents ? (
                            <div className="px-4 py-4 text-center">
                              <div className="inline-flex items-center justify-center gap-2">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-brand-500 border-r-transparent"></div>
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Loading...</span>
                              </div>
                            </div>
                          ) : filteredStudents.length > 0 ? (
                            <>
                              {/* Header with count */}
                              <div className="px-3 py-2 bg-gradient-to-r from-brand-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-brand-700 dark:text-brand-400 uppercase tracking-wide">
                                    {searchQuery ? 'Results' : 'Students'}
                                  </span>
                                  <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-brand-500 text-white text-xs font-bold">
                                    {filteredStudents.length}
                                  </span>
                                </div>
                              </div>
                              
                              {/* Student List */}
                              <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                                {filteredStudents.map((student, index) => {
                                  const displayText = student.STUDENT_FULL_NAME
                                    ? `${student.STUDENT_FULL_NAME}${student.STUDENT_ID ? ` - ${student.STUDENT_ID}` : ""}`
                                    : student.STUDENT_ID || "";
                                  const uniqueKey = `${student.STUDENT_ID || ""}_${student.STUDENT_FULL_NAME || ""}_${index}`;
                                  
                                  return (
                                    <button
                                      key={uniqueKey}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleStudentSelect(student);
                                      }}
                                      className="w-full px-3 py-2 text-left transition-all duration-150 hover:bg-gradient-to-r hover:from-brand-50 hover:to-blue-50 dark:hover:from-gray-700 dark:hover:to-gray-600 border-b border-gray-100 dark:border-gray-700 last:border-0 group"
                                    >
                                      <div className="flex items-center gap-2">
                                        {/* Avatar Circle */}
                                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-brand-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold shadow-sm group-hover:shadow-md transition-shadow">
                                          {student.STUDENT_FULL_NAME ? student.STUDENT_FULL_NAME.charAt(0).toUpperCase() : student.STUDENT_ID?.charAt(0) || '?'}
                                        </div>
                                        
                                        {/* Student Info */}
                                        <div className="flex-1 min-w-0">
                                          <div className="text-xs font-medium text-gray-900 dark:text-white truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                                            {student.STUDENT_FULL_NAME || 'Unknown'}
                                          </div>
                                          {student.STUDENT_ID && (
                                            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
                                              {student.STUDENT_ID}
                                            </div>
                                          )}
                                        </div>
                                        
                                        {/* Arrow Icon */}
                                        <svg className="w-4 h-4 text-gray-400 group-hover:text-brand-500 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </>
                          ) : (
                            <div className="px-6 py-12 text-center">
                              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                              </div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                                {searchQuery ? 'No students found' : 'No students available'}
                              </p>
                              {searchQuery && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  Try adjusting your search terms
                                </p>
                              )}
                            </div>
                          )}
                        </div>,
                        document.body
                      )}
                    </div>
                  );

                  // Helper to inject our custom label into the tree data
                  const getTreeDataWithSearch = () => {
                    const baseTree = convertToTreeStructure();
                    
                    // Spinner icon for loading
                    const LoadingSpinner = (
                      <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-solid border-brand-500 border-r-transparent"></span>
                    );
                    
                    // If no student data, create a minimal tree with just the search input
                    if (!baseTree) {
                      return {
                        id: "student-root-empty",
                        label: SearchInputNode,
                        badge: undefined,
                        children: undefined,
                        onClick: () => {}, // No-op when no data
                        isExpanded: false
                      };
                    }
                    
                    // If loading after student selection, show loader at level-2 position and hide actual level-2/3
                    if (loading && studentId) {
                      return {
                        ...baseTree,
                        label: SearchInputNode,
                        onClick: () => setIsRootExpanded(!isRootExpanded),
                        isExpanded: true, // Always expand when loading
                        children: [
                          {
                            id: "loading-batch",
                            label: "Loading batches...",
                            icon: LoadingSpinner,
                            onClick: () => {},
                            isExpanded: false,
                            children: undefined,
                          },
                        ],
                      };
                    }
                    
                    return {
                      ...baseTree,
                      label: SearchInputNode,
                      onClick: () => setIsRootExpanded(!isRootExpanded),
                      isExpanded: isRootExpanded
                    };
                  };

                  const treeData = getTreeDataWithSearch();
                  
                  return (
                    <HorizontalTree
                      rootNode={treeData}
                      headerTitle={null}
                      className="mb-4"
                    />
                  );
                })()}
              </div>
            </div>
          </div>

          {/* ============================================= */}
          {/* TRANSCRIPT VIEW SECTION - Matching CI3 lines 163-205 */}
          {/* ============================================= */}
          <div className="row mx-0 align-items-center mt-6" id="transcript_view">
            <div className="col-md-12">
              {/* Check if type is selected (matching CI3 line 166: if ($type)) */}
              {selectedType && studentData && studentId ? (
                <>
                  {/* Check page type (matching CI3 line 167: if ($page_type == 'articulation')) */}
                  {selectedPageType === "articulation" ? (
                    <>
                      {/* Determine page title based on type (matching CI3 lines 168-176) */}
                      <div className="mb-4">
                        <h4 className="text-lg font-bold text-gray-800 dark:text-white">
                          {selectedType === "Failed"
                            ? "Articulation Kickouts"
                            : selectedType === "Processed"
                            ? "Articulation Processed"
                            : selectedType === "Rerun"
                            ? "Articulation Rerun"
                            : "Articulation Reports"}
                        </h4>
                        {studentData.student_info && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Student: {studentData.student_info.STUDENT_FULL_NAME}
                            {studentData.student_info.STUDENT_ID && ` - ${studentData.student_info.STUDENT_ID}`}
                          </p>
                        )}
                      </div>
                      
                      {/* Load Articulation Reports (matching CI3 line 177: $this->load->view('admin/articulation/list', $data)) */}
                      <ArticulationReports
                        key={`articulation-${studentId}-${selectedBatch}-${selectedInstitution}-${selectedType}`}
                        studentId={studentId}
                        batchId={selectedBatch}
                        institutionId={selectedInstitution}
                        type={selectedType}
                      />
                    </>
                  ) : (
                    <>
                      {/* Transcript Reports (matching CI3 lines 184-200) */}
                      <div className="mb-4">
                        <h4 className="text-lg font-bold text-gray-800 dark:text-white">
                          {selectedType === "Failed"
                            ? "Transcript Kickouts"
                            : selectedType === "Articulation-Kickouts"
                            ? "Articulation Kickouts"
                            : selectedType === "Processed"
                            ? "Transcript Processed"
                            : selectedType === "Rerun"
                            ? "Transcript Rerun"
                            : "Transcript Reports"}
                        </h4>
                        {studentData.student_info && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Student: {studentData.student_info.STUDENT_FULL_NAME}
                            {studentData.student_info.STUDENT_ID && ` - ${studentData.student_info.STUDENT_ID}`}
                          </p>
                        )}
                      </div>
                      
                      {/* Load Transcript Reports (matching CI3 line 201: $this->load->view('admin/transcriptreports/list', $data)) */}
                      <TranscriptReports
                        key={`transcript-${studentId}-${selectedBatch}-${selectedInstitution}-${selectedType}`}
                        studentId={studentId}
                        batchId={selectedBatch}
                        institutionId={selectedInstitution}
                        type={selectedType}
                      />
                    </>
                  )}
                </>
              ) : loading ? (
                // Loading state
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-brand-500 border-r-transparent"></div>
                    <p className="mt-4 text-lg text-gray-500 dark:text-gray-400">Loading student data...</p>
                  </div>
                </div>
              ) : !studentId ? (
                // No student selected - show empty state
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 48 48"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 20l-5 5-5-5m0 0h10m-10 0V8m0 0H5a2 2 0 00-2 2v10a2 2 0 002 2h3m0 0h3m-3 0v3m0-3v3m0 0h3m-3 0H5m0 0v3m0-3v3m0 0h3m-3 0H5"
                    />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No student selected</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Please select a student from the dropdown above to view their transcripts.
                  </p>
                </div>
              ) : studentData && !selectedType ? (
                // Student selected but no report type chosen
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No report type selected</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Select a status item (Kickouts, Processed, Rerun) from the tree above to view transcripts.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </PageContainer>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ===== Horizontal Tree View ===== */
        .htree {
          display: flex;
          align-items: center;
        }

        .htree-parent {
          flex-shrink: 0;
        }

        /* Shared node styles */
        .htree-node {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 9px 18px;
          border-radius: 8px;
          border: 2px solid #cbd5e1;
          background: #fff;
          white-space: nowrap;
          font-size: 13px;
          font-weight: 600;
          color: #334155;
          box-shadow: 0 1px 3px rgba(0,0,0,0.06);
          transition: all 0.2s ease;
        }
        .dark .htree-node {
          background: #1e293b;
          border-color: #475569;
          color: #e2e8f0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }

        /* Parent node - institution */
        .htree-node-parent {
          border-color: #f59e0b;
          background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
          box-shadow: 0 2px 8px rgba(245, 158, 11, 0.15);
        }
        .dark .htree-node-parent {
          background: linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(245,158,11,0.06) 100%);
          border-color: #d97706;
        }

        /* Child node - status items */
        .htree-node-child {
          cursor: pointer;
          border-color: #93c5fd;
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          box-shadow: 0 1px 4px rgba(59, 130, 246, 0.1);
          font-weight: 500;
        }
        .htree-node-child:hover {
          border-color: #3b82f6;
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
          box-shadow: 0 3px 12px rgba(59, 130, 246, 0.2);
          transform: translateX(2px);
        }
        .dark .htree-node-child {
          background: linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(59,130,246,0.05) 100%);
          border-color: #1d4ed8;
        }
        .dark .htree-node-child:hover {
          background: linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(59,130,246,0.1) 100%);
          border-color: #3b82f6;
        }

        .htree-node-active {
          border-color: #2563eb !important;
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%) !important;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15), 0 2px 8px rgba(37, 99, 235, 0.2) !important;
        }
        .dark .htree-node-active {
          background: linear-gradient(135deg, rgba(37,99,235,0.3) 0%, rgba(37,99,235,0.15) 100%) !important;
          border-color: #60a5fa !important;
        }

        /* Children wrapper */
        .htree-children {
          display: flex;
          align-items: center;
        }

        /* Horizontal line from parent to the vertical rail */
        .htree-connector {
          width: 40px;
          height: 2px;
          background: linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%);
          flex-shrink: 0;
          box-shadow: 0 0 6px rgba(59, 130, 246, 0.4);
        }
        .dark .htree-connector {
          background: linear-gradient(90deg, #60a5fa 0%, #22d3ee 100%);
          box-shadow: 0 0 6px rgba(34, 211, 238, 0.3);
        }

        /* Vertical list of children */
        .htree-children-list {
          display: flex;
          flex-direction: column;
          position: relative;
        }

        /* Each child row */
        .htree-child {
          display: flex;
          align-items: center;
          padding: 5px 0;
          position: relative;
        }

        /* Vertical line segments drawn per-child for perfect alignment */
        /* Top half of vertical line (connects to sibling above) */
        .htree-child::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 50%;
          width: 2px;
          background: linear-gradient(180deg, #10b981 0%, #06b6d4 100%);
          box-shadow: 0 0 6px rgba(16, 185, 129, 0.4);
        }
        .dark .htree-child::before {
          background: linear-gradient(180deg, #34d399 0%, #22d3ee 100%);
          box-shadow: 0 0 6px rgba(34, 211, 238, 0.3);
        }

        /* Bottom half of vertical line (connects to sibling below) */
        .htree-child::after {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          bottom: 0;
          width: 2px;
          background: linear-gradient(180deg, #06b6d4 0%, #10b981 100%);
          box-shadow: 0 0 6px rgba(16, 185, 129, 0.4);
        }
        .dark .htree-child::after {
          background: linear-gradient(180deg, #22d3ee 0%, #34d399 100%);
          box-shadow: 0 0 6px rgba(34, 211, 238, 0.3);
        }

        /* First child: no line going up */
        .htree-child:first-child::before {
          display: none;
        }

        /* Last child: no line going down */
        .htree-child:last-child::after {
          display: none;
        }

        /* Only child: no vertical line at all */
        .htree-child:only-child::before,
        .htree-child:only-child::after {
          display: none;
        }

        /* Horizontal connector from vertical rail to child node */
        .htree-child-connector {
          width: 28px;
          height: 2px;
          background: linear-gradient(90deg, #8b5cf6 0%, #ec4899 100%);
          flex-shrink: 0;
          margin-left: 2px;
          box-shadow: 0 0 6px rgba(139, 92, 246, 0.4);
        }
        .dark .htree-child-connector {
          background: linear-gradient(90deg, #a78bfa 0%, #f472b6 100%);
          box-shadow: 0 0 6px rgba(244, 114, 182, 0.3);
        }

        /* Node text */
        .htree-node-text {
          line-height: 1.4;
        }

        /* Badge count */
        .htree-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 22px;
          height: 22px;
          padding: 0 6px;
          border-radius: 9999px;
          background: #dc2626;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          margin-left: 8px;
          flex-shrink: 0;
        }
      `}</style>
    </PageWrapper>
  );
}