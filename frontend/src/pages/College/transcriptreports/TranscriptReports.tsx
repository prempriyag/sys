import { useState } from "react";
import { useLocation, useSearchParams } from "react-router";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../../components/common/PageContainer";
import DataTable from "../../../components/ui/DataTable";
import Button from "../../../components/ui/button/Button";
import { API_ENDPOINTS, API_BASE_URL } from "../../../config/api";
import { RefreshIcon, FilterIcon } from "../../../icons";

export default function TranscriptReports() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  // Determine type from URL path (matching CI3 route structure)
  // Routes: /college/transcriptkickouts -> "Failed"
  //         /college/transcript_articulationkickouts -> "Articulation-Kickouts"
  //         /college/transcriptprocessed -> "Processed"
  //         /college/reprocessed -> "Rerun"
  //         /college/transcriptequivalenthours -> "equivalenthours"
  //         /college/transcriptreports -> "" (default)
  const getTypeFromPath = () => {
    const path = location.pathname;
    if (path.includes("/transcriptkickouts")) {
      return "Failed";
    } else if (path.includes("/transcript_articulationkickouts")) {
      return "Articulation-Kickouts";
    } else if (path.includes("/transcriptprocessed")) {
      return "Processed";
    } else if (path.includes("/reprocessed")) {
      return "Rerun";
    } else if (path.includes("/transcriptequivalenthours")) {
      return "equivalenthours";
    }
    // Fallback to search params if provided
    return searchParams.get("type") || "";
  };
  
  const type = getTypeFromPath();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  // Get page title based on type (matching CI3 controller logic)
  const getPageTitle = () => {
    if (type === "Failed") {
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
      { data: "INSTITUTION_ID", name: "Institution ID", searchable: true, orderable: true },
      { data: "STUDENT_ID", name: "Student ID", searchable: true, orderable: true },
      { data: "SLATE_REF_NUMBER", name: "Slate ID", searchable: true, orderable: true },
      { data: "STUDENT_FULL_NAME", name: "Student Name", searchable: true, orderable: true },
      { data: "BATCH_ID", name: "Batch ID", searchable: true, orderable: true },
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
      baseColumns.push({ data: "ERROR_REASON", name: "Error Reason / Action", searchable: false, orderable: false });
      baseColumns.push({ data: "ERROR_SCREENSHOT", name: "Error Screenshot", searchable: false, orderable: false });
    }

    // Add Transcript Link (always present)
    baseColumns.push({ data: "TRANSCRIPT_LINK", name: "Transcript", searchable: false, orderable: false });

    // Add Action column if not Processed, equivalenthours, or empty (matching CI3 line 153-155)
    if (type !== "Processed" && type !== "equivalenthours" && type !== "") {
      baseColumns.push({ data: "ACTION", name: "Action", searchable: false, orderable: false });
    }

    // Add Letter Sent Date and Transfer Letter File Link for Processed or equivalenthours (matching CI3 line 156-159)
    if (type === "Processed" || type === "equivalenthours") {
      baseColumns.push({ data: "LETTER_SENT_DATE", name: "Letter Sent Date", searchable: false, orderable: false });
      baseColumns.push({ data: "TRANSFER_LETTER_FILE_LINK", name: "Transfer Letter File Link", searchable: false, orderable: false });
    }

    // Common columns
    baseColumns.push({ data: "USER_COMMENTS", name: "User Comment", searchable: false, orderable: false });
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Filter Type
                </label>
                <select
                  id="field_type"
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
                  <option value="UPDATED_DATE">Updated On</option>
                  <option value="UPDATED_BY">Updated By</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Filter Value
                </label>
                <input
                  id="field_name"
                  type="text"
                  className="relative w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                  placeholder="Enter value"
                />
              </div>
              <div className="flex items-end gap-2">
                <Button variant="outline" onClick={() => setShowFilters(false)}>
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
          }}
          pageLength={10}
          lengthMenu={[10, 50, 100, 200]}
          exportFileName={getExportFileName()}
        />
      </PageContainer>
    </PageWrapper>
  );
}

