import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "react-router";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../components/common/PageContainer";
import SchoolTranscriptReports from "./transcriptreports/TranscriptReports";
import { API_ENDPOINTS } from "../../config/api";
import { api } from "../../config/api";
import { useToast } from "../../context/ToastContext";

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
 * Student View page (HS) - Student to Transcripts Action Center
 * Matches: CI3 school/Studentview (application/controllers/school/Studentview.php)
 *          CI3 view (application/views/school/studentview/student_page.php)
 * HS shows only: Failed, Processed, Rerun (no Articulation-Kickouts or articulation_* rows).
 */
export default function StudentView() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Initialize from URL params (matching CI3 line 3-4: $type = $_GET['type'])
  const [studentId, setStudentId] = useState<string>(searchParams.get("student_id") || "");
  const [students, setStudents] = useState<Student[]>([]);
  const [studentData, setStudentData] = useState<StudentViewData | null>(null);
  const [loading, setLoading] = useState(false);
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
  const { alerterror } = useToast();
  const selectRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter students based on search query (matching CI3 Select2 behavior)
  const filteredStudents = useMemo(() => {
    if (!students || students.length === 0) return [];
    if (!searchQuery || searchQuery.trim() === '') {
      // Show first 50 students when input is focused but no search query (matching CI3 Select2 behavior)
      return students.slice(0, 50);
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

  // Fetch students list (all students on load, matching CI3 behavior)
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        // Fetch all students (no query parameter = get all students)
        const response = await api.get(API_ENDPOINTS.SCHOOL_STUDENTVIEW_GET_STUDENTS);
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
        const url = `${API_ENDPOINTS.SCHOOL_STUDENTVIEW}?${queryParams.toString()}`;
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
          // HS view: expand when Failed or Rerun (no Articulation-Kickouts/articulation_* in PHP)
          const hasKickouts =
            (menuWithBatch["Failed"] > 0 || menuWithBatch["Rerun"] > 0) ||
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

  return (
    <PageWrapper>
      <PageMeta
        title="Student to Transcripts | High School Module"
        description="Student to Transcripts Action Center"
      />
      <PageBreadcrumb pageTitle="Student to Transcripts" />

      <PageContainer>
        <div className="mb-6">
          <h3 className="font-semibold text-gray-800 text-xl dark:text-white/90 mb-4">
            Student to Transcripts Action Center
          </h3>
          
          {/* Student Information Accordion */}
          <div className="mb-6 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
            <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <button
                className="w-full px-4 py-3 text-left font-semibold text-gray-800 dark:text-white flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={() => setIsAccordionOpen(!isAccordionOpen)}
              >
                <span id="Student_info">{getStudentDisplayName()}</span>
                <svg
                  className={`w-5 h-5 transition-transform ${isAccordionOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {isAccordionOpen && (
              <div className="p-4">
                {/* Student Selector with Search */}
                <div className="mb-4 relative">
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Select Student
                  </label>
                  <div className="relative" ref={dropdownRef}>
                    <input
                      ref={selectRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => setIsInputFocused(true)}
                      placeholder={studentId ? getStudentDisplayName() : "Search by Student Name or ID..."}
                      className="w-full rounded-lg border border-blue-500 bg-white px-4 py-2.5 pr-10 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                    />
                    {studentData && studentData.total_transcripts > 0 && (
                      <span className="absolute right-12 top-1/2 -translate-y-1/2 inline-flex items-center justify-center rounded-full bg-red-500 h-6 w-6 text-xs font-medium text-white">
                        {studentData.total_transcripts}
                      </span>
                    )}
                    <svg
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>

                    {/* Dropdown Results - Show when input is focused and has students to display */}
                    {isInputFocused && filteredStudents.length > 0 && (
                      <div 
                        className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg max-h-80 overflow-auto"
                      >
                        {filteredStudents.map((student, index) => {
                          const displayText = student.STUDENT_FULL_NAME
                            ? `${student.STUDENT_FULL_NAME}${student.STUDENT_ID ? ` - ${student.STUDENT_ID}` : ""}`
                            : student.STUDENT_ID || "";
                          // Create unique key by combining ID, name, and index
                          const uniqueKey = `${student.STUDENT_ID || ""}_${student.STUDENT_FULL_NAME || ""}_${index}`;
                          return (
                            <button
                              key={uniqueKey}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log("[StudentView] Button clicked for student:", student);
                                handleStudentSelect(student);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors"
                            >
                              {displayText}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Tree View Structure - matching CI3 horizontal tree layout */}
                {loading ? (
                  <div className="mt-4 flex items-center justify-center py-8">
                    <div className="text-center">
                      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-brand-500 border-r-transparent"></div>
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading...</p>
                    </div>
                  </div>
                ) : studentData && studentData.institution_name.length > 0 ? (
                  <div className="mt-4 overflow-x-auto">
                    {studentData.institution_name.map((institution) => {
                      const batches = studentData.batch_details[institution.INSTITUTION_ID] || [];
                      
                      return batches.map((batchId, batchIndex) => {
                        const menuWithBatch = getMenuItems(institution.INSTITUTION_ID, batchId);
                        const batchMeta = studentData.batch_metadata?.[institution.INSTITUTION_ID]?.[batchId];
                        const ocrDate = formatDate(batchMeta?.OCR_EXTRACTED_DATE);
                        const batchTitle = ocrDate 
                          ? `${institution.INSTITUTION_NAME} - ${institution.INSTITUTION_ID} - ${batchId} - ${ocrDate}`
                          : `${institution.INSTITUTION_NAME} - ${institution.INSTITUTION_ID} - ${batchId}`;
                        const uniqueBatchKey = `${institution.INSTITUTION_ID}-${batchId}-${batchIndex}`;

                        // Collect status items (HS: only transcript statuses, no articulation)
                        const statusItems: Array<{
                          key: string;
                          label: string;
                          count: number;
                          type: string;
                          pageType: "transcript" | "articulation";
                        }> = [];

                        if (menuWithBatch["Failed"] > 0) {
                          statusItems.push({ key: "Failed-t", label: "Transcript Kickouts", count: menuWithBatch["Failed"], type: "Failed", pageType: "transcript" });
                        }
                        if (menuWithBatch["Processed"] > 0) {
                          const processedLabel = `Transcript Processed${batchMeta?.LAST_UPDATED_DATETIME ? ` - ${formatDate(batchMeta.LAST_UPDATED_DATETIME)}` : ""}${batchMeta?.OCR_EXTRACTED_DATE && batchMeta?.LAST_UPDATED_DATETIME ? `  (${calculateDays(batchMeta.OCR_EXTRACTED_DATE, batchMeta.LAST_UPDATED_DATETIME)} Days)` : ""}`;
                          statusItems.push({ key: "Processed-t", label: processedLabel, count: menuWithBatch["Processed"], type: "Processed", pageType: "transcript" });
                        }
                        if (menuWithBatch["Rerun"] > 0) {
                          statusItems.push({ key: "Rerun-t", label: "Transcript Rerun", count: menuWithBatch["Rerun"], type: "Rerun", pageType: "transcript" });
                        }

                        return (
                          <div key={uniqueBatchKey} className="htree-wrapper mb-6" style={{ animation: `fadeInUp 0.4s ease-out ${batchIndex * 30}ms both` }}>
                            <div className="htree">
                              <div className="htree-parent">
                                <div className="htree-node htree-node-parent">
                                  <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                                  </svg>
                                  <span className="htree-node-text">{batchTitle}</span>
                                </div>
                              </div>
                              {statusItems.length > 0 && (
                                <div className="htree-children">
                                  <div className="htree-connector"></div>
                                  <div className="htree-children-list">
                                    {statusItems.map((item) => {
                                      const isActiveItem = isActive(item.type, institution.INSTITUTION_ID, batchId, item.pageType);
                                      return (
                                        <div key={item.key} className="htree-child">
                                          <div className="htree-child-connector"></div>
                                          <button
                                            className={`htree-node htree-node-child ${isActiveItem ? 'htree-node-active' : ''}`}
                                            onClick={(e) => {
                                              e.preventDefault();
                                              handleViewPageLoad(studentId, item.type, institution.INSTITUTION_ID, batchId, item.pageType);
                                            }}
                                          >
                                            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <span className="htree-node-text">{item.label}</span>
                                            {item.count > 0 && (
                                              <span className="htree-badge">
                                                {item.count}
                                              </span>
                                            )}
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })}
                  </div>
                ) : studentData ? (
                  <div className="mt-4 text-center text-gray-500 dark:text-gray-400">
                    No institution data available for this student
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* ============================================= */}
          {/* TRANSCRIPT VIEW SECTION - Matching CI3 lines 163-205 */}
          {/* ============================================= */}
          <div className="row mx-0 align-items-center mt-6" id="transcript_view">
            <div className="col-md-12">
              {/* Check if type is selected (matching CI3 line 166: if ($type)) */}
              {/* HS: only transcript view (CI3 school view loads school/hdrreports/list only) */}
              {selectedType && studentData && studentId ? (
                <>
                  <div className="mb-4">
                    <h4 className="text-lg font-bold text-gray-800 dark:text-white">
                      {selectedType === "Failed"
                        ? "Transcript Kickouts"
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
                  <SchoolTranscriptReports
                    key={`transcript-${studentId}-${selectedBatch}-${selectedInstitution}-${selectedType}`}
                    studentId={studentId}
                    batchId={selectedBatch}
                    institutionId={selectedInstitution}
                    type={selectedType}
                  />
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
          background: #94a3b8;
          flex-shrink: 0;
        }
        .dark .htree-connector {
          background: #64748b;
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
          background: #94a3b8;
        }
        .dark .htree-child::before {
          background: #64748b;
        }

        /* Bottom half of vertical line (connects to sibling below) */
        .htree-child::after {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          bottom: 0;
          width: 2px;
          background: #94a3b8;
        }
        .dark .htree-child::after {
          background: #64748b;
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
          background: #94a3b8;
          flex-shrink: 0;
          margin-left: 2px;
        }
        .dark .htree-child-connector {
          background: #64748b;
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