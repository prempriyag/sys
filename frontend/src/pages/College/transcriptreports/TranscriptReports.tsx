import React, { useState } from "react";
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
import { useToast } from "../../../context/ToastContext";
import { createTranscriptReportColumns } from "./columnConfig";
import BulkUpdateButton from "../../../components/transcriptreports/BulkUpdateButton";
import { api } from "../../../config/api";

export default function TranscriptReports() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
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

  // Table ref for refreshing
  const tableRef = React.useRef<any>(null);
  
  // Toast notifications
  const { alertsuccess, alerterror } = useToast();
  
  // State for tracking row changes (for bulk update)
  const [rowChanges, setRowChanges] = React.useState<Map<string, any>>(new Map());
  
  // Validate institution ID
  const validateInstitution = async (value: string, batchId: string): Promise<{ valid: boolean; message?: string }> => {
    if (!value || !batchId) {
      return { valid: false, message: "Institution ID and Batch ID are required" };
    }
    
    try {
      const response = await api.post("/api/transcriptreports/chckinstid", {
        instid: value,
        batchId: batchId,
      });
      
      const result = response.data?.result;
      if (result === 1) {
        return { valid: true };
      } else if (result === 2) {
        return { valid: false, message: "Institution ID does not exist in the Institution Mapping." };
      } else if (result === 3) {
        return { valid: false, message: "Transcript Institution Name and External Institution Name must be same." };
      }
      return { valid: false, message: "Validation failed" };
    } catch (error: any) {
      console.error("Institution validation error:", error);
      return { valid: false, message: error.response?.data?.detail || "Validation error occurred" };
    }
  };
  
  // Handle inline edit (for Student ID, Slate ID, Institution ID)
  const handleInlineEdit = (batchId: string, field: string, value: string) => {
    // Track changes for bulk update
    const changes = rowChanges.get(batchId) || {};
    if (field === "STUDENT_ID") {
      changes.osuid = value;
    } else if (field === "SLATE_REF_NUMBER") {
      changes.slateid = value;
    } else if (field === "INSTITUTION_ID") {
      changes.instid = value;
    }
    // Always update rowChanges to track the field changes
    // They will be included in bulk update if there's an action selected
    setRowChanges(new Map(rowChanges.set(batchId, changes)));
  };
  
  // Handle action change (transcriptreprocess, articulationreprocess)
  const handleActionChange = (batchId: string, action: string, data: any) => {
    const changes = rowChanges.get(batchId) || {};
    if (data.type === "transcript") {
      changes.reprocessTranscript = action;
      changes.processTranscript_articulated = data.dataType || "";
    } else if (data.type === "articulation") {
      changes.articulationProcess = action;
    }
    // Only add to rowChanges if action is not "0"
    if (action && action !== "0" && String(action) !== "0") {
      setRowChanges(new Map(rowChanges.set(batchId, changes)));
    } else {
      // Remove from rowChanges if action is reset to "0"
      const newChanges = new Map(rowChanges);
      newChanges.delete(batchId);
      setRowChanges(newChanges);
    }
  };
  
  // Handle comment change
  const handleCommentChange = (batchId: string, comment: string) => {
    const changes = rowChanges.get(batchId) || {};
    changes.comment = comment;
    setRowChanges(new Map(rowChanges.set(batchId, changes)));
  };
  
  // Handle scenario change
  const handleScenarioChange = (batchId: string, scenario: string) => {
    const changes = rowChanges.get(batchId) || {};
    changes.scenario = scenario;
    // Only add to rowChanges if there's an action selected
    if (changes.reprocessTranscript || changes.articulationProcess) {
      setRowChanges(new Map(rowChanges.set(batchId, changes)));
    }
  };
  
  // Handle bulk update
  const handleBulkUpdate = async () => {
    if (rowChanges.size === 0) {
      return;
    }
    
    // Filter to only rows with actions selected (matching CI3 logic)
    const rowsToUpdate = Array.from(rowChanges.entries()).filter(([_batchId, changes]) => {
      return (changes.reprocessTranscript && changes.reprocessTranscript !== "0") ||
             (changes.articulationProcess && changes.articulationProcess !== "0");
    });
    
    if (rowsToUpdate.length === 0) {
      return;
    }
    
    try {
      let successCount = 0;
      let errorCount = 0;
      
      // Process each row's changes sequentially (matching CI3 behavior)
      for (const [batchId, changes] of rowsToUpdate) {
        try {
          const updateData = {
            batchId,
            comment: changes.comment || "",
            reprocessTranscript: changes.reprocessTranscript || "0",
            articulationProcess: changes.articulationProcess || "0",
            processTranscript_articulated: changes.processTranscript_articulated || "",
            osuid: changes.osuid || "",
            slateid: changes.slateid || "",
            scenario: changes.scenario || "",
            instid: changes.instid || "",
          };
          
          const response = await api.post("/api/transcriptreports/updatechkstatus", updateData);
          
          if (response.data?.message === "Success" || response.data === "Success") {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error: any) {
          console.error(`Error updating batch ${batchId}:`, error);
          errorCount++;
        }
      }
      
      // Show success/error messages
      if (successCount > 0) {
        alertsuccess(`Transcript status updated successfully for ${successCount} record(s)`);
      }
      if (errorCount > 0) {
        alerterror(`Error updating ${errorCount} record(s)`);
      }
      
      // Clear changes and refresh table
      setRowChanges(new Map());
      if (tableRef.current) {
        tableRef.current.refresh();
      } else {
        setRefreshTrigger((prev) => prev + 1);
      }
    } catch (error: any) {
      console.error("Bulk update error:", error);
      alerterror(error.response?.data?.detail || "Error updating records. Please try again.");
    }
  };
  
  // Define columns based on type (matching CI3 view logic)
  // Using columnConfig.ts for complete column definitions matching CI3 list.php
  const getColumns = () => {
    return createTranscriptReportColumns(
      type,
      hasUpdatePermission,
      {
        copyToClipboard,
        getPdfUrl,
        navigate,
        refreshTable: () => {
          if (tableRef.current) {
            tableRef.current.refresh();
          } else {
            setRefreshTrigger((prev) => prev + 1);
          }
        },
        handleInlineEdit,
        validateInstitution: (value: string, batchId: string) => validateInstitution(value, batchId),
        handleActionChange,
        handleCommentChange,
        handleScenarioChange,
        rowChanges, // Pass rowChanges so columns can check if actions are selected
      }
    );
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
            <BulkUpdateButton
              isVisible={Array.from(rowChanges.values()).some((changes: any) => {
                const hasTranscriptAction = changes.reprocessTranscript && 
                  changes.reprocessTranscript !== "0" && 
                  changes.reprocessTranscript !== 0;
                const hasArticulationAction = changes.articulationProcess && 
                  changes.articulationProcess !== "0" && 
                  changes.articulationProcess !== 0;
                return hasTranscriptAction || hasArticulationAction;
              })}
              onClick={handleBulkUpdate}
            />
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

