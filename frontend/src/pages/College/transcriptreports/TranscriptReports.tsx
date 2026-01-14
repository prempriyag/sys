import { useState } from "react";
import { useLocation, useSearchParams } from "react-router";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../../components/common/PageContainer";
import DataTable from "../../../components/ui/DataTable";
import Button from "../../../components/ui/button/Button";
import { API_ENDPOINTS, API_BASE_URL } from "../../../config/api";
import { RefreshIcon, FilterIcon } from "../../../icons";
import { useAuth } from "../../../context/AuthContext";

export default function TranscriptReports() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  // Determine type from URL path (matching CI3 route structure)
  // Routes: /college/transcriptkickouts -> "Failed"
  //         /college/transcript_articulationkickouts -> "Articulation-Kickouts"
  //         /college/transcriptprocessed -> "Processed"
  //         /college/transcriptrerun -> "Rerun"
  //         /college/transcriptequivalenthours -> "equivalenthours"
  //         /college/transcriptreports -> "" (default)
  const getTypeFromPath = () => {
    const path = location.pathname;
    if (path.includes("/transcriptkickouts") || path.includes("/studentlogkickouts")) {
      return "Failed";
    } else if (path.includes("/transcript_articulationkickouts")) {
      return "Articulation-Kickouts";
    } else if (path.includes("/transcriptprocessed") || path.includes("/studentlogprocessed")) {
      return "Processed";
    } else if (path.includes("/transcriptrerun") || path.includes("/studentlogreprocessed")) {
      return "Rerun";
    } else if (path.includes("/transcriptequivalenthours") || path.includes("/equivalentrollmismatch")) {
      return "equivalenthours";
    }
    // Fallback to search params if provided
    return searchParams.get("type") || "";
  };
  
  const type = getTypeFromPath();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const { hasPermission } = useAuth();
  
  // Filter state
  const [fieldType, setFieldType] = useState<string>("");
  const [fieldName, setFieldName] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Check if user has update permission
  const hasUpdatePermission = hasPermission("college_digiscript_reports", "UPDATE");

  // Helper function to copy text to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // You could add a toast notification here
      console.log("Copied to clipboard:", text);
    });
  };

  // Helper function to generate PDF URL
  const getPdfUrl = (filePath: string, type: "transcript" | "articulation" = "transcript") => {
    if (!filePath) return "";
    // Remove leading slash if present
    const cleanPath = filePath.startsWith("/") ? filePath.substring(1) : filePath;
    // Construct URL - adjust base path as needed
    if (type === "transcript") {
      return `${API_BASE_URL.replace("/api", "")}/transcripts/${cleanPath}`;
    } else {
      return `${API_BASE_URL.replace("/api", "")}/articulation/${cleanPath}`;
    }
  };

  // Get page title based on type (matching CI3 controller logic)
  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes("/studentlogkickouts")) {
      return "Student Log Kickouts";
    } else if (path.includes("/studentlogprocessed")) {
      return "Student Log Processed";
    } else if (path.includes("/studentlogreprocessed")) {
      return "Student Log Rerun";
    } else if (type === "Failed") {
      return "Transcript Kickouts";
    } else if (type === "Articulation-Kickouts" || type === "ArticulationKickouts") {
      return "Articulation Kickouts";
    } else if (type === "Processed") {
      return "Transcript Processed";
    } else if (type === "Rerun") {
      return "Transcript Rerun";
    } else if (type === "equivalenthours") {
      return "Equivalent Roll Mismatch";
    }
    return "Transcript Reports";
  };

  const pageTitle = getPageTitle();

  // Define columns based on type (matching CI3 view logic)
  const getColumns = () => {
    const baseColumns = [
      { data: "INSTITUTION_NAME", name: "College Name", searchable: true, orderable: true },
      { 
        data: "INSTITUTION_ID", 
        name: "Institution ID", 
        searchable: true, 
        orderable: true,
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
        render: (data: any, row: any) => {
          if (!data) return "-";
          const searchField = row._search_field || "";
          // If search_field is empty or "Processed" or "equivalenthours", show as link if has permission
          if ((!searchField || searchField === "Processed" || searchField === "equivalenthours") && hasUpdatePermission) {
            return (
              <a 
                href={`/college/transcriptreports?batch_id=${row.BATCH_ID}&student_id=${data}`}
                className="text-brand-500 hover:underline"
              >
                {data}
              </a>
            );
          }
          return <span>{data}</span>;
        }
      },
      { 
        data: "SLATE_REF_NUMBER", 
        name: "Slate ID", 
        searchable: true, 
        orderable: true,
        render: (data: any, row: any) => {
          if (!data) return "-";
          const searchField = row._search_field || "";
          // If search_field is empty or "Processed" or "equivalenthours", show as link if has permission
          if ((!searchField || searchField === "Processed" || searchField === "equivalenthours") && hasUpdatePermission) {
            return (
              <a 
                href={`/college/transcriptreports?batch_id=${row.BATCH_ID}&slate_ref_number=${data}`}
                className="text-brand-500 hover:underline"
              >
                {data}
              </a>
            );
          }
          return <span>{data}</span>;
        }
      },
      { data: "STUDENT_FULL_NAME", name: "Student Name", searchable: true, orderable: true },
      { 
        data: "BATCH_ID", 
        name: "Batch ID", 
        searchable: true, 
        orderable: true,
        render: (data: any) => {
          if (!data) return "-";
          return (
            <span>
              <a 
                href={`/college/transcriptreports?batch_id=${data}`}
                className="text-brand-500 hover:underline me-2"
              >
                {data}
              </a>
              <i 
                className="btn-copy-icon fa-duotone fa-paste cursor-pointer hover:text-brand-500" 
                onClick={() => copyToClipboard(data)}
              ></i>
            </span>
          );
        }
      },
      { data: "STATUS_SLATE", name: "Slate Status", searchable: false, orderable: false },
      { data: "STATUS_SLATE_UPLOAD", name: "Transcript Upload to Slate", searchable: false, orderable: false },
      { data: "STATUS_BANNER", name: "Banner Status", searchable: false, orderable: false },
      { data: "STATUS_BDMS", name: "BDMS Status", searchable: false, orderable: false },
      { data: "TRANSCRIPT_STATUS_FLAG", name: "Transcript Status", searchable: false, orderable: false },
    ];

    // Add Articulation Status if type is not "Failed" (matching CI3 line 150-152)
    if (type !== "Failed") {
      baseColumns.push({ data: "ARTICULATION_STATUS_FLAG", name: "Articulation Status", searchable: false, orderable: false });
    }

    // Add Error Reason and Error Screenshot if not Processed or equivalenthours (matching CI3 line 142-146)
    if (type !== "Processed" && type !== "equivalenthours") {
      baseColumns.push({ 
        data: "ERROR_REASON", 
        name: "Error Reason / Action", 
        searchable: false, 
        orderable: false,
        render: (data: any) => {
          if (!data) return "-";
          // Data already contains <br> tags from backend, render as HTML
          return <span dangerouslySetInnerHTML={{ __html: data }} />;
        }
      });
      baseColumns.push({ 
        data: "ERROR_SCREENSHOT", 
        name: "Error Screenshot", 
        searchable: false, 
        orderable: false,
        render: (data: any) => {
          if (!data) return "-";
          const imageUrl = data.startsWith("http") ? data : `${API_BASE_URL.replace("/api", "")}/screenshots/${data}`;
          return (
            <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">
              View Screenshot
            </a>
          );
        }
      });
    }

    // Add Transcript Link (always present)
      baseColumns.push({ 
        data: "TRANSCRIPT_LINK", 
        name: "Transcript", 
        searchable: false, 
        orderable: false,
        render: (data: any, _row: any) => {
          if (!data) return "-";
          const pdfUrl = getPdfUrl(data, "transcript");
          if (!pdfUrl) return "-";
          return (
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">
              View PDF
            </a>
          );
        }
      });

    // Add Action column if not Processed, equivalenthours, or empty (matching CI3 line 153-155)
    if (type !== "Processed" && type !== "equivalenthours" && type !== "") {
      baseColumns.push({ 
        data: "ACTION", 
        name: "Action", 
        searchable: false, 
        orderable: false,
        render: (_data: any, row: any) => {
          if (!hasUpdatePermission) return "-";
          const batchId = row.BATCH_ID || "";
          const searchField = row._search_field || "";
          const articulationStatus = row.ARTICULATION_STATUS_FLAG || "";
          
          // Generate action dropdown based on search_field and articulation status
          const actions = [];
          
          if (searchField === "Articulation-Kickouts" || searchField === "ArticulationKickouts") {
            if (articulationStatus !== "Processed") {
              actions.push({ label: "Process", value: "process", url: `/college/transcriptreports?action=process&batch_id=${batchId}` });
            }
          } else {
            actions.push({ label: "Rerun", value: "rerun", url: `/college/transcriptreports?action=rerun&batch_id=${batchId}` });
            actions.push({ label: "View Details", value: "view", url: `/college/transcriptreports?batch_id=${batchId}` });
          }
          
          if (actions.length === 0) return "-";
          
          return (
            <select 
              className="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              onChange={(e) => {
                if (e.target.value) {
                  window.location.href = e.target.value;
                }
              }}
            >
              <option value="">Select Action</option>
              {actions.map((action, idx) => (
                <option key={idx} value={action.url}>{action.label}</option>
              ))}
            </select>
          );
        }
      });
    }

    // Add Letter Sent Date and Transfer Letter File Link for Processed or equivalenthours (matching CI3 line 156-159)
    if (type === "Processed" || type === "equivalenthours") {
      baseColumns.push({ data: "LETTER_SENT_DATE", name: "Letter Sent Date", searchable: false, orderable: false });
      baseColumns.push({ 
        data: "TRANSFER_LETTER_FILE_LINK", 
        name: "Transfer Letter File Link", 
        searchable: false, 
        orderable: false,
        render: (data: any) => {
          if (!data) return "-";
          const pdfUrl = getPdfUrl(data, "articulation");
          if (!pdfUrl) return "-";
          return (
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">
              View PDF
            </a>
          );
        }
      });
    }

    // Common columns
    baseColumns.push({ 
      data: "USER_COMMENTS", 
      name: "User Comment", 
      searchable: false, 
      orderable: false,
      render: (data: any, row: any) => {
        const searchField = row._search_field || "";
        // If not Processed or equivalenthours, show as textarea if has permission
        if (searchField !== "Processed" && searchField !== "equivalenthours" && hasUpdatePermission) {
          return (
            <textarea 
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              rows={2}
              defaultValue={data || ""}
              onBlur={(e) => {
                // Handle save on blur - you can implement API call here
                console.log("Save comment:", e.target.value, row.BATCH_ID);
              }}
            />
          );
        }
        return <span>{data || "-"}</span>;
      }
    });
    baseColumns.push({ data: "LAST_UPDATED_DATETIME", name: "Updated On", searchable: false, orderable: true });
    baseColumns.push({ data: "UPDATED_BY", name: "Updated By", searchable: true, orderable: true });
    baseColumns.push({ data: "PROCESS_STATUS", name: "Process Status", searchable: false, orderable: false });

    return baseColumns;
  };

  // Get export file name based on type
  const getExportFileName = () => {
    if (type === "Failed") {
      return "Transcript-Kickouts-DigiScript";
    } else if (type === "Articulation-Kickouts" || type === "ArticulationKickouts") {
      return "Articulation-Kickouts-DigiScript";
    } else if (type === "Processed") {
      return "Transcript-Processed-DigiScript";
    } else if (type === "Rerun") {
      return "Transcript-Rerun-DigiScript";
    } else if (type === "equivalenthours") {
      return "Equivalent-Roll-Mismatch-DigiScript";
    }
    return "Transcript-Reports-DigiScript";
  };

  // Prepare Search_Field value (matching CI3 line 271-275)
  // CI3 sends type as Search_Field in the AJAX request
  const getSearchField = () => {
    if (type === "ArticulationKickouts") {
      return "Articulation-Kickouts"; // Convert to match CI3 format
    }
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
  const showDateInputs = fieldType === "OCR_EXTRACTED_DATE" || fieldType === "UPDATED_DATE";

  return (
    <PageWrapper>
      <PageMeta
        title={`${pageTitle} | College Module`}
        description="Transcript reports and management"
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
                    // Clear fieldName and dates when type changes
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
                  <option value="STUDENT_FULL_NAME">Student Name</option>
                  <option value="STATUS_SLATE">Slate Status</option>
                  <option value="STATUS_SLATE_UPLOAD">Transcript Upload to Slate</option>
                  <option value="STATUS_SOAPCOL">Banner Status</option>
                  <option value="STATUS_BDMS">BDMS Status</option>
                  <option value="TRANSCRIPT_STATUS_FLAG">Transcript Status</option>
                  <option value="ARTICULATION_STATUS_FLAG">Articulation Status</option>
                  {type !== "Processed" && type !== "equivalenthours" && (
                    <option value="ERROR_REASON">Error Reason</option>
                  )}
                  <option value="OCR_EXTRACTED_DATE">OCR Extracted Date</option>
                  <option value="UPDATED_DATE">Updated On</option>
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

        {/* Transcript Reports DataTable */}
        <DataTable
          refreshTrigger={refreshTrigger}
          columns={getColumns()}
          ajaxUrl={`${API_BASE_URL}${API_ENDPOINTS.TRANSCRIPT_REPORTS_LIST}`}
          ajaxMethod="POST"
          ajaxData={{
            Search_Field: getSearchField(), // Matching CI3 line 271-275
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
          exportFileName={getExportFileName()}
        />
      </PageContainer>
    </PageWrapper>
  );
}

