import { useState } from "react";
import { useLocation, useSearchParams } from "react-router";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../../components/common/PageContainer";
import DataTable from "../../../components/ui/DataTable";
import Button from "../../../components/ui/button/Button";
import { useNavigate } from "react-router";
import { API_ENDPOINTS, API_BASE_URL } from "../../../config/api";
import { RefreshIcon, FilterIcon } from "../../../icons";
import { useAuth } from "../../../context/AuthContext";

interface ArticulationReportsProps {
  studentId?: string;
  batchId?: string;
  institutionId?: string;
  type?: string;
}

export default function ArticulationReports(props?: ArticulationReportsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  // Determine type from props, URL path, or search params (matching CI3 route structure)
  // Routes: /college/articulationkickouts -> "Failed"
  //         /college/articulationphase2kickouts -> "Phase_2"
  //         /college/articulationprocessed -> "Processed"
  //         /college/articulationrerun -> "Rerun"
  const getTypeFromPath = () => {
    // Use prop type if provided (from StudentView)
    if (props?.type) {
      return props.type;
    }
    const path = location.pathname;
    if (path.includes("/articulationkickouts")) {
      return "Failed";
    } else if (path.includes("/articulationphase2kickouts")) {
      return "Phase_2";
    } else if (path.includes("/articulationprocessed")) {
      return "Processed";
    } else if (path.includes("/articulationrerun")) {
      return "Rerun";
    }
    // Fallback to search params if provided
    return searchParams.get("type") || "";
  };
  
  const type = getTypeFromPath();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const { hasPermission } = useAuth();
  
  // Filter state
  // Filter state - initialize from props if provided (from StudentView)
  const [fieldType, setFieldType] = useState<string>(() => {
    if (props?.batchId) return "BATCH_ID";
    if (props?.institutionId) return "COLLEGE_ID";
    if (props?.studentId) return "STUDENT_ID";
    return "";
  });
  const [fieldName, setFieldName] = useState<string>(() => {
    if (props?.batchId) return props.batchId;
    if (props?.institutionId) return props.institutionId;
    if (props?.studentId) return props.studentId;
    return "";
  });
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Check if user has update permission
  const hasUpdatePermission = hasPermission("college_digiscript_reports", "UPDATE");

  // Helper function to copy text to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      console.log("Copied to clipboard:", text);
    });
  };

  // Helper function to generate PDF URL
  // Backend now returns encrypted URLs in format: /api/viewfile/transcript_file?pdf={encrypted}
  // Same as batchdetails - just prepend API_BASE_URL
  const getPdfUrl = (filePath: string, type: "transcript" | "articulation" = "transcript") => {
    if (!filePath || filePath === "" || filePath === null || filePath === undefined) {
      return "";
    }
    
    // If backend already returns a full URL (starts with http), use it as-is
    if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
      return filePath;
    }
    
    // Backend now returns encrypted URL in format: /api/viewfile/transcript_file?pdf={encrypted}
    // Just prepend API_BASE_URL (same as batchdetails)
    if (filePath.startsWith("/api/viewfile")) {
      return `${API_BASE_URL}${filePath}`;
    }
    
    // For backward compatibility: if we get a raw file path (shouldn't happen now)
    // Remove leading slash if present
    const cleanPath = filePath.startsWith("/") ? filePath.substring(1) : filePath;
    // Construct URL - adjust base path as needed
    if (type === "transcript") {
      return `${API_BASE_URL.replace("/api", "")}/transcripts/${cleanPath}`;
    } else {
      return `${API_BASE_URL.replace("/api", "")}/articulation/${cleanPath}`;
    }
  };

  const getPageTitle = () => {
    if (type === "Failed") {
      return "Articulation Kickouts";
    } else if (type === "Phase_2") {
      return "To be Processed Manually";
    } else if (type === "Processed") {
      return "Articulation Processed";
    } else if (type === "Rerun") {
      return "Articulation Rerun";
    }
    return "Articulation Reports";
  };

  const pageTitle = getPageTitle();
  
  // Prepare Search_Field value (matching CI3 controller logic)
  const getSearchField = () => {
    return type || "";
  };

  // Clear all filters
  const clearFilters = () => {
    setFieldType("");
    setFieldName("");
    setFromDate("");
    setToDate("");
  };

  // Check if date inputs should be shown
  const showDateInputs = fieldType === "UPDATED_DATE";

  return (
    <PageWrapper>
      <PageMeta
        title={`${pageTitle} | College Module`}
        description="Articulation reports and management"
      />
      <PageBreadcrumb pageTitle={pageTitle} />

      <PageContainer>
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">
            {pageTitle}
          </h3>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setRefreshTrigger((prev) => prev + 1)}
              variant="outline"
              startIcon={<RefreshIcon className="w-5 h-5" />}
            >
              Refresh Data
            </Button>
            <Button
              onClick={() => setShowFilters(!showFilters)}
              variant="outline"
              startIcon={<FilterIcon className="w-5 h-5" />}
            >
              Filter
            </Button>
          </div>
        </div>

        {/* Filters Section */}
        {showFilters && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
            <div className={`grid grid-cols-1 gap-4 ${showDateInputs ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Filter Type
                </label>
                <select
                  id="field_type"
                  value={fieldType}
                  onChange={(e) => {
                    setFieldType(e.target.value);
                    setFieldName("");
                    setFromDate("");
                    setToDate("");
                  }}
                  className="relative w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                >
                  <option value="">Select Option</option>
                  <option value="BATCH_ID">Batch ID</option>
                  <option value="COLLEGE_ID">Institution ID</option>
                  <option value="COLLEGE_NAME">College Name</option>
                  <option value="STUDENT_ID">Student ID</option>
                  <option value="ARTICULATION_STATUS_FLAG">Articulation Status</option>
                  {type !== "Processed" && <option value="ERROR_REASON">Error Reason</option>}
                  <option value="UPDATED_DATE">Updated Date</option>
                  <option value="UPDATED_BY">Updated By</option>
                </select>
              </div>
              
              {!showDateInputs ? (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Filter Value
                  </label>
                  <input
                    id="field_name"
                    type="text"
                    value={fieldName}
                    onChange={(e) => setFieldName(e.target.value)}
                    className="relative w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                    placeholder="Enter value"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      From Date
                    </label>
                    <input
                      id="from_date"
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="relative w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      To Date
                    </label>
                    <input
                      id="to_date"
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="relative w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                    />
                  </div>
                </>
              )}
              
              <div className="flex items-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    clearFilters();
                    setShowFilters(false);
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Articulation DataTable */}
        <DataTable
          refreshTrigger={refreshTrigger}
          columns={[
            { data: "INSTITUTION_NAME", name: "College Name", searchable: true, orderable: true, width: "200px" },
            { 
              data: "INSTITUTION_ID", 
              name: "Institution ID", 
              searchable: true, 
              orderable: true,
              width: "120px",
              render: (data: any) => {
                if (!data) return "-";
                return (
                  <span 
                    className="copyinstid cursor-pointer hover:text-brand-500" 
                    onClick={() => copyToClipboard(data)}
                  >
                    <i className="btn-copy-icon fa-duotone fa-paste me-1"></i>
                    {data}
                  </span>
                );
              }
            },
            { 
              data: "STUDENT_ID", 
              name: "Student ID", 
              searchable: true, 
              orderable: true,
              width: "150px",
              render: (data: any) => {
                if (!data) return "-";
                if (hasUpdatePermission) {
                  return (
                    <span 
                      className="copyinstid cursor-pointer hover:text-brand-500" 
                      onClick={() => copyToClipboard(data)}
                    >
                      <i className="btn-copy-icon fa-duotone fa-paste me-1"></i>
                      {data}
                    </span>
                  );
                }
                return <span>{data}</span>;
              }
            },
            { data: "STUDENT_FULL_NAME", name: "Student Name", searchable: true, orderable: true, width: "220px" },
            { 
              data: "BATCH_ID", 
              name: "Batch ID", 
              searchable: true, 
              orderable: true,
              width: "120px",
              render: (data: any) => {
                if (!data) return "-";
                return (
                  <span>
                    <span 
                      className="copyinstid cursor-pointer hover:text-brand-500 me-2" 
                      onClick={() => copyToClipboard(data)}
                    >
                      <i className="btn-copy-icon fa-duotone fa-paste me-1"></i>
                    </span>
                    <a 
                      href={`/college/batchdetails/${data}`}
                      target="_blank"
                      className="text-brand-500 hover:underline"
                    >
                      {data}
                    </a>
                  </span>
                );
              }
            },
            { data: "STATUS_BANNER_ARTICULATION", name: "Status Banner Articulation", searchable: false, orderable: false, width: "220px" },
            { data: "SUBJECT", name: "Subject", searchable: false, orderable: false, width: "100px" },
            { data: "COURSE_ID", name: "Course ID", searchable: false, orderable: false, width: "120px" },
            { data: "COURSE_TITLE", name: "Course Title", searchable: false, orderable: false, width: "200px" },
            { 
              data: "ARTICULATION_INDICATOR", 
              name: "Articulation Indicator", 
              searchable: false, 
              orderable: false,
              width: "160px",
              render: (data: any, row: any) => {
                const searchField = row._search_field || "";
                if ((searchField === "Failed" || searchField === "Phase_2") && hasUpdatePermission) {
                  return (
                    <select 
                      className="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      defaultValue={data || " "}
                    >
                      <option value=" ">Select Indicator</option>
                      <option value="Override">Override</option>
                      <option value="Equivalency">Equivalency</option>
                    </select>
                  );
                }
                return <span>{data || "-"}</span>;
              }
            },
            { 
              data: "TRANSFER_DUPLICATE", 
              name: "Transfer Duplicate", 
              searchable: false, 
              orderable: false,
              width: "140px",
              render: (data: any, row: any) => {
                const searchField = row._search_field || "";
                if ((searchField === "Failed" || searchField === "Phase_2") && hasUpdatePermission) {
                  return (
                    <div>
                      <input 
                        type="number" 
                        className="transfer_duplicate rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        style={{ width: "64px" }}
                        min="0" 
                        max="99" 
                        defaultValue={data || "0"}
                        disabled
                        onKeyUp={(e: any) => {
                          if (e.target.value > 99) e.target.value = null;
                        }}
                      />
                      <span className="transfer_duplicate_span hidden">{data || "0"}</span>
                    </div>
                  );
                }
                return <span>{data || "-"}</span>;
              }
            },
            { 
              data: "EQV_SUBJECT", 
              name: "Equivalent Subject", 
              searchable: false, 
              orderable: false,
              width: "140px",
              render: (data: any, row: any) => {
                const searchField = row._search_field || "";
                if ((searchField === "Failed" || searchField === "Phase_2") && hasUpdatePermission) {
                  return (
                    <div>
                      <input 
                        type="text" 
                        className="eqv_sub rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        maxLength={5}
                        defaultValue={data || ""}
                        disabled
                      />
                      <span className="eqv_sub_span hidden">{data || ""}</span>
                    </div>
                  );
                }
                return <span>{data || "-"}</span>;
              }
            },
            { 
              data: "EQV_COURSE_ID", 
              name: "Equivalent Course ID", 
              searchable: false, 
              orderable: false,
              width: "150px",
              render: (data: any, row: any) => {
                const searchField = row._search_field || "";
                if ((searchField === "Failed" || searchField === "Phase_2") && hasUpdatePermission) {
                  return (
                    <div>
                      <input 
                        type="text" 
                        className="eqv_courseId rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        maxLength={5}
                        defaultValue={data || ""}
                        disabled
                      />
                      <span className="eqv_courseId_span hidden">{data || ""}</span>
                    </div>
                  );
                }
                return <span>{data || "-"}</span>;
              }
            },
            // EQV_COURSE_TITLE column removed - doesn't exist in database
            { 
              data: "EQV_CREDIT_HOURS_EARNED", 
              name: "Equivalent Credits", 
              searchable: false, 
              orderable: false,
              width: "140px",
              render: (data: any, row: any) => {
                const searchField = row._search_field || "";
                if ((searchField === "Failed" || searchField === "Phase_2") && hasUpdatePermission) {
                  return (
                    <div>
                      <input 
                        type="text" 
                        className="eqvCreditParhourse rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        maxLength={5}
                        defaultValue={data || ""}
                        disabled
                      />
                      <span className="eqvCreditParhourse_span hidden">{data || ""}</span>
                    </div>
                  );
                }
                return <span>{data || "-"}</span>;
              }
            },
            { 
              data: "EQV_GRADE", 
              name: "Equivalent Grade", 
              searchable: false, 
              orderable: false,
              width: "130px",
              render: (data: any, row: any) => {
                const searchField = row._search_field || "";
                if ((searchField === "Failed" || searchField === "Phase_2") && hasUpdatePermission) {
                  return (
                    <div>
                      <input 
                        type="text" 
                        className="eqvGrade rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        maxLength={4}
                        defaultValue={data || ""}
                        disabled
                      />
                      <span className="eqvGrade_span hidden">{data || ""}</span>
                    </div>
                  );
                }
                return <span>{data || "-"}</span>;
              }
            },
            { 
              data: "INCLUDE_EXCLUDE", 
              name: "Include/Exclude", 
              searchable: false, 
              orderable: false,
              width: "120px",
              render: (data: any, row: any) => {
                const searchField = row._search_field || "";
                if ((searchField === "Failed" || searchField === "Phase_2") && hasUpdatePermission) {
                  const isExclude = data === "Exclude";
                  return (
                    <div>
                      <select 
                        className="includeex rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        defaultValue={isExclude ? "Exclude" : "Include"}
                        disabled
                      >
                        <option value="Include">Include</option>
                        <option value="Exclude">Exclude</option>
                      </select>
                      <span className="includeex_span hidden">{isExclude ? "Exclude" : "Include"}</span>
                    </div>
                  );
                }
                return <span>{data || "-"}</span>;
              }
            },
            { 
              data: "EQV_REPEAT_SYSTEM", 
              name: "Equivalent Repeat System", 
              searchable: false, 
              orderable: false,
              width: "180px",
              render: (data: any, row: any) => {
                const searchField = row._search_field || "";
                if ((searchField === "Failed" || searchField === "Phase_2") && hasUpdatePermission) {
                  const isSystem = data === "System";
                  return (
                    <div>
                      <select 
                        className="eqvRepeatSystem rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        defaultValue={isSystem ? "System" : "Manual"}
                        disabled
                      >
                        <option value="Manual">Manual</option>
                        <option value="System">System</option>
                      </select>
                      <span className="eqvRepeatSystem_span hidden">{isSystem ? "System" : "Manual"}</span>
                    </div>
                  );
                }
                return <span>{data || "-"}</span>;
              }
            },
            { 
              data: "EQV_COUNT_IN_GPA", 
              name: "Equivalent Count In GPA", 
              searchable: false, 
              orderable: false,
              width: "160px",
              render: (data: any, row: any) => {
                const searchField = row._search_field || "";
                if ((searchField === "Failed" || searchField === "Phase_2") && hasUpdatePermission) {
                  const isNo = data === "N" || data === "No";
                  return (
                    <div>
                      <select 
                        className="eqvcountGPa rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        defaultValue={isNo ? "N" : "Y"}
                        disabled
                      >
                        <option value="Y">Yes</option>
                        <option value="N">No</option>
                      </select>
                      <span className="eqvcountGPa_span hidden">{isNo ? "N" : "Y"}</span>
                    </div>
                  );
                }
                // For other types, format as Yes/No
                if (data === "Y") return "Yes";
                if (data === "N" || data === "No") return "No";
                return <span>{data || "-"}</span>;
              }
            },
            { 
              data: "COURSE_ATTRIBUTE", 
              name: "Course Attribute", 
              searchable: false, 
              orderable: false,
              width: "130px",
              render: (data: any, row: any) => {
                const searchField = row._search_field || "";
                if ((searchField === "Failed" || searchField === "Phase_2") && hasUpdatePermission) {
                  return (
                    <input 
                      type="text" 
                      className="courseAttribute rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      maxLength={9}
                      defaultValue={data || ""}
                      disabled
                    />
                  );
                }
                return <span>{data || "-"}</span>;
              }
            },
            { data: "LEVEL", name: "Level", searchable: false, orderable: false, width: "80px" },
            { data: "ATTENDANCE_PERIOD", name: "Attendance Period", searchable: false, orderable: false, width: "140px" },
            { data: "TERM", name: "Term", searchable: false, orderable: false, width: "100px" },
            ...(type !== "Processed" ? [
              { 
                data: "ERROR_REASON", 
                name: "Error Reason / Action", 
                searchable: false, 
                orderable: false,
                width: "400px",
                render: (data: any) => {
                  if (!data) return "-";
                  // Split on numbering pattern and render with <br>
                  const parts = data.split(/(?=\d+\)\.\s)/).filter((p: string) => p.trim());
                  return <span dangerouslySetInnerHTML={{ __html: parts.join("<br>") }} />;
                }
              },
              { 
                data: "ERROR_SCREENSHOT", 
                name: "Error Screenshot", 
                searchable: false, 
                orderable: false,
                width: "120px",
                render: (data: any, row: any) => {
                  // Show link if ERROR_SCREENSHOT exists (matches CI3 line 237-239)
                  if (!data || data === "" || data === null || data === undefined) return "-";
                  const batchId = row.BATCH_ID || "";
                  if (!batchId) return "-";
                  // Navigate to error screenshot page (similar to batchdetails page)
                  return (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/college/errorscreenshot/${batchId}`);
                      }}
                      className="text-brand-500 hover:underline inline-flex items-center"
                    >
                      <i className="fa fa-eye me-1"></i>
                      View
                    </button>
                  );
                }
              },
              { 
                data: "TRANSCRIPT_LINK", 
                name: "Transcript", 
                searchable: false, 
                orderable: false,
                width: "100px",
                render: (data: any) => {
                  if (!data || data === "" || data === null || data === undefined) return "-";
                  // Backend already returns encrypted URL like: /api/viewfile/transcript_file?pdf={encrypted}
                  // getPdfUrl will prepend API_BASE_URL to make it a full URL
                  const pdfUrl = getPdfUrl(data, "transcript");
                  if (!pdfUrl || pdfUrl === "") return "-";
                  return (
                    <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">
                      <i className="fa fa-link me-1"></i>
                      View PDF
                    </a>
                  );
                }
              },
            ] : []),
            { 
              data: "ARTICULATION_STATUS_FLAG", 
              name: type === "Failed" || type === "Phase_2" ? "Reprocess Articulation?" : "Articulation Status", 
              searchable: false, 
              orderable: false,
              width: "240px",
              render: (_data: any, row: any) => {
                const searchField = row._search_field || "";
                if ((searchField === "Failed" || searchField === "Phase_2") && hasUpdatePermission) {
                  const batchId = row.BATCH_ID || "";
                  const currentValue = row.ARTICULATION_STATUS_FLAG || "0";
                  return (
                    <select 
                      className="articulationreprocess rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      id={batchId}
                      name="articulationreprocess"
                      defaultValue={currentValue === "0" || !currentValue ? "0" : currentValue}
                    >
                      <option value="0">Action Needed</option>
                      <option value="Rerun">Reprocess this course</option>
                      <option value="Processed">Processed Manually by OSU-OKC</option>
                      <option value="Skip/Exclude">Processed Manually and Skip/Exclude course</option>
                    </select>
                  );
                }
                return <span>{row.ARTICULATION_STATUS_FLAG || "-"}</span>;
              }
            },
            { 
              data: "USER_COMMENTS", 
              name: "Comments", 
              searchable: false, 
              orderable: false,
              width: "350px",
              render: (data: any, row: any) => {
                const searchField = row._search_field || "";
                const isCommentEdited = row._is_comment_edited || false;
                
                // For Processed type with edited comments, show plain text
                if (searchField === "Processed" && isCommentEdited && data) {
                  return <span>{data}</span>;
                }
                
                // For Failed, Phase_2, or Rerun, show textarea if has permission
                if ((searchField === "Failed" || searchField === "Phase_2" || searchField === "Rerun") && hasUpdatePermission) {
                  const batchId = row.BATCH_ID || row.Id || "";
                  return (
                    <textarea 
                      name="usercomment"
                      className="usercomment w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      rows={2}
                      id={batchId}
                      defaultValue={data || ""}
                      disabled
                    />
                  );
                }
                
                // For Processed with editable comments
                if (searchField === "Processed" && !isCommentEdited && hasUpdatePermission) {
                  return (
                    <span 
                      className="comment_edit cursor-pointer text-brand-500 hover:underline"
                      title="Edit User Comments"
                    >
                      {data || ""}
                    </span>
                  );
                }
                
                return <span>{data || "-"}</span>;
              }
            },
            { data: "CREDIT_HOURS_EARNED", name: "Credits", searchable: false, orderable: false, width: "100px" },
            { data: "GRADE", name: "Grade", searchable: false, orderable: false, width: "80px" },
            { data: "LAST_UPDATED_DATETIME", name: "Updated On", searchable: false, orderable: true, width: "200px" },
            { data: "UPDATED_BY", name: "Updated By", searchable: true, orderable: true, width: "120px" },
          ]}
          ajaxUrl={`${API_BASE_URL}${API_ENDPOINTS.ARTICULATION_REPORTS_LIST}`}
          ajaxMethod="POST"
          ajaxData={{
            Search_Field: getSearchField(), // Matching CI3 controller logic
            ...(fieldType && {
              fieldType: fieldType,
              ...(showDateInputs
                ? {
                    ...(fromDate && { fromDate }),
                    ...(toDate && { toDate }),
                  }
                : {
                    ...(fieldName && { fieldName }),
                  }),
            }),
          }}
          pageLength={10}
          lengthMenu={[10, 50, 100, 200]}
          exportFileName="Articulation-DigiScript"
        />
      </PageContainer>
    </PageWrapper>
  );
}



