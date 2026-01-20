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

interface TranscriptReportsProps {
  studentId?: string;
  batchId?: string;
  institutionId?: string;
  type?: string;
}

export default function TranscriptReports(props?: TranscriptReportsProps) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Determine type from props, URL path, or search params (matching CI3 route structure)
  // Routes: /college/transcriptkickouts -> "Failed"
  //         /college/transcript_articulationkickouts -> "Articulation-Kickouts"
  //         /college/transcriptprocessed -> "Processed"
  //         /college/transcriptrerun -> "Rerun"
  //         /college/transcriptequivalenthours -> "equivalenthours"
  //         /college/transcriptreports -> "" (default)
  const getTypeFromPath = () => {
    // Use prop type if provided (from StudentView)
    if (props?.type) {
      return props.type;
    }
    const path = location.pathname;
    if (path.includes("/school/transcriptkickouts") || path.includes("/school/studentlogkickouts")) {
      return "Failed";
    } else if (path.includes("/school/transcriptprocessed") || path.includes("/school/studentlogprocessed")) {
      return "Processed";
    } else if (path.includes("/school/transcriptrerun") || path.includes("/school/studentlogreprocessed")) {
      return "Rerun";
    } else if (path.includes("/school/transcriptequivalenthours") || path.includes("/school/equivalentrollmismatch")) {
      return "equivalenthours";
    }
    // Fallback to search params if provided
    return searchParams.get("type") || "";
  };
  
  const type = getTypeFromPath();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const { hasPermission } = useAuth();
  
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
    if (!text || text.trim() === "") return;
    navigator.clipboard.writeText(text).then(() => {
      alertsuccess("Copied to clipboard!");
    }).catch((err) => {
      console.error("Failed to copy to clipboard:", err);
      alerterror("Failed to copy to clipboard");
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
      return `${API_BASE_URL.replace("/api", "")}school/transcripts/${cleanPath}`;
    } else {
      return `${API_BASE_URL.replace("/api", "")}/articulation/${cleanPath}`;
    }
  };

  // Get page title based on type (matching CI3 controller logic)
  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes("/school/studentlogkickouts")) {
      return "Student Log Kickouts";
    } else if (path.includes("/school/studentlogprocessed")) {
      return "Student Log Processed";
    } else if (path.includes("/school/studentlogreprocessed")) {
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
  
  // Clear rowChanges when pathname changes (when navigating between different report types)
  // This ensures state is reset when switching between pages like Articulation Kickouts -> Transcript Kickouts
  React.useEffect(() => {
    console.log('Clearing rowChanges due to navigation:', { pathname: location.pathname, type });
    setRowChanges(new Map());
  }, [location.pathname]);
  
  // Validate institution ID
  const validateInstitution = async (value: string, batchId: string): Promise<{ valid: boolean; message?: string }> => {
    if (!value || !batchId) {
      return { valid: false, message: "Institution ID and Batch ID are required" };
    }
    
    try {
      const response = await api.post("/api/school/transcriptreports/chckinstid", {
        instid: value,
        batchId: batchId,
      });
      
      const result = response.result;
      console.log("Extracted result:", result);
    console.log("Extracted message:", response.message);
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
  
  // Handle inline edit (for Student ID, Institution ID)
  const handleInlineEdit = (batchId: string, field: string, value: string) => {
    setRowChanges((prevChanges) => {
      const newChanges = new Map(prevChanges);
      const changes = { ...(newChanges.get(batchId) || {}) };
      if (field === "STUDENT_ID") {
        changes.osuid = value;
      } else if (field === "INSTITUTION_ID") {
        changes.instid = value;
      }
      // Always update rowChanges to track the field changes
      // They will be included in bulk update if there's an action selected
      newChanges.set(batchId, changes);
      return newChanges;
    });
  };
  
  // Handle action change (transcriptreprocess, articulationreprocess)
  // Matching CI3 logic: show button when action is Processed, Rerun, or Noaction
  // Hide button when action is "0" or empty
  const handleActionChange = (batchId: string, action: string, data: any) => {
    setRowChanges((prevChanges) => {
      const newChanges = new Map(prevChanges);
      const existingChanges = newChanges.get(batchId) || {};
      const changes = { ...existingChanges };
      
      // Check if action is valid (not "0" or empty) - matching CI3 lines 563, 682, 776, 824, 829, 839
      const actionStr = String(action || "").trim();
      const isActionSelected = actionStr && actionStr !== "0";
      
      if (isActionSelected) {
        // Action is valid - set it
        if (data.type === "transcript") {
          changes.reprocessTranscript = action;
          if (data.dataType) {
            changes.processTranscript_articulated = data.dataType;
          }
        } else if (data.type === "articulation") {
          changes.articulationProcess = action;
        }
        // Add or update the row in rowChanges - button will show
        newChanges.set(batchId, changes);
      } else {
        // Action is "0" - remove the action from changes
        // Build a new changes object without the action being removed
        const cleanedChanges: any = {};
        
        // Keep only non-action changes (osuid, instid, scenario)
        if (changes.osuid !== undefined && changes.osuid !== "") {
          cleanedChanges.osuid = changes.osuid;
        }
        if (changes.instid !== undefined && changes.instid !== "") {
          cleanedChanges.instid = changes.instid;
        }
        if (changes.scenario !== undefined && changes.scenario !== "" && changes.scenario !== "0") {
          cleanedChanges.scenario = changes.scenario;
        }
        
        // Check if the OTHER action type is still selected (not the one being cleared)
        if (data.type === "transcript" && changes.articulationProcess !== undefined) {
          const articulationAction = String(changes.articulationProcess).trim();
          if (articulationAction !== "" && articulationAction !== "0") {
            cleanedChanges.articulationProcess = changes.articulationProcess;
          }
        } else if (data.type === "articulation" && changes.reprocessTranscript !== undefined) {
          const transcriptAction = String(changes.reprocessTranscript).trim();
          if (transcriptAction !== "" && transcriptAction !== "0") {
            cleanedChanges.reprocessTranscript = changes.reprocessTranscript;
            if (changes.processTranscript_articulated) {
              cleanedChanges.processTranscript_articulated = changes.processTranscript_articulated;
            }
          }
        }
        
        // Check if any action is still selected after clearing this one
        const hasAnyAction = (
          (cleanedChanges.reprocessTranscript !== undefined) ||
          (cleanedChanges.articulationProcess !== undefined)
        );
        
        const hasOtherChanges = Object.keys(cleanedChanges).length > 0;
        
        if (!hasOtherChanges && !hasAnyAction) {
          // No other changes and no actions - remove the row completely so button hides
          newChanges.delete(batchId);
        } else {
          // Keep the row but with cleaned changes (no cleared action/comment)
          newChanges.set(batchId, cleanedChanges);
        }
      }
      
      return newChanges;
    });
  };
  
  // Handle comment change
  const handleCommentChange = (batchId: string, comment: string) => {
    setRowChanges((prevChanges) => {
      const newChanges = new Map(prevChanges);
      const changes = { ...(newChanges.get(batchId) || {}) };
      
      // If comment is empty string and no actions are selected, remove comment from changes
      if (!comment || comment.trim() === "") {
        const hasAction = (changes.reprocessTranscript && changes.reprocessTranscript !== "0") ||
                         (changes.articulationProcess && changes.articulationProcess !== "0");
        
        if (!hasAction) {
          // No action and empty comment - remove comment field
          delete changes.comment;
          // If no other changes, remove the entire row
          const hasOtherChanges = changes.osuid || changes.instid || changes.scenario;
          if (!hasOtherChanges) {
            newChanges.delete(batchId);
            return newChanges;
          }
        } else {
          // Action exists, keep empty comment
          changes.comment = comment;
        }
      } else {
        // Comment has value, set it
        changes.comment = comment;
      }
      
      newChanges.set(batchId, changes);
      return newChanges;
    });
  };
  
  // Handle scenario change
  const handleScenarioChange = (batchId: string, scenario: string) => {
    setRowChanges((prevChanges) => {
      const newChanges = new Map(prevChanges);
      const changes = { ...(newChanges.get(batchId) || {}) };
      changes.scenario = scenario;
      // Only add to rowChanges if there's an action selected
      if (changes.reprocessTranscript || changes.articulationProcess) {
        newChanges.set(batchId, changes);
      }
      return newChanges;
    });
  };
  
  // Handle bulk update
  const handleBulkUpdate = async () => {
    console.log('=== handleBulkUpdate START ===');
    console.log('rowChanges size:', rowChanges.size);
    console.log('rowChanges entries:', Array.from(rowChanges.entries()));
    
    if (rowChanges.size === 0) {
      console.log('No row changes, returning early');
      return;
    }
    
    // Filter to only rows with actions selected (matching CI3 logic)
    const rowsToUpdate = Array.from(rowChanges.entries()).filter(([_batchId, changes]) => {
      const hasTranscriptAction = changes.reprocessTranscript && changes.reprocessTranscript !== "0";
      const hasArticulationAction = changes.articulationProcess && changes.articulationProcess !== "0";
      // Also include if instid/osuid is changed (for immediate updates)
      const hasFieldChange = changes.instid || changes.osuid;
      return hasTranscriptAction || hasArticulationAction || hasFieldChange;
    });
    
    console.log('Rows to update:', rowsToUpdate.length);
    console.log('Rows to update details:', rowsToUpdate.map(([batchId, changes]) => ({ batchId, changes })));
    
    if (rowsToUpdate.length === 0) {
      console.log('No rows with actions or field changes, returning early');
      return;
    }
    
    try {
      let successCount = 0;
      let errorCount = 0;
      const errors: Array<{ batchId: string; error: string }> = [];
      
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
            scenario: changes.scenario || "",
            instid: changes.instid || "",
          };
          
          console.log(`=== Updating batch ${batchId} ===`);
          console.log('Update data:', JSON.stringify(updateData, null, 2));
          
          const response = await api.post("/api/school/transcriptreports/updatechkstatus", updateData);
          
          console.log(`=== Response for batch ${batchId} ===`);
          console.log('Response status:', response.status);
          console.log('Response data:', JSON.stringify(response.data, null, 2));
          
          if (response.data?.message === "Success" || response.data === "Success" || response.data?.success === true) {
            console.log(`✓ Successfully updated batch ${batchId}`);
            successCount++;
          } else {
            const errorMsg = response.data?.message || response.data?.detail || "Unknown error";
            console.error(`✗ Failed to update batch ${batchId}:`, errorMsg);
            errors.push({ batchId, error: errorMsg });
            errorCount++;
          }
        } catch (error: any) {
          console.error(`=== Error updating batch ${batchId} ===`);
          console.error('Error object:', error);
          console.error('Error message:', error?.message);
          console.error('Error response:', error?.response);
          console.error('Error response data:', error?.response?.data);
          console.error('Error response status:', error?.response?.status);
          console.error('Error stack:', error?.stack);
          
          const errorMsg = error.response?.data?.detail || error.response?.data?.message || error.message || "Unknown error";
          errors.push({ batchId, error: errorMsg });
          errorCount++;
        }
      }
      
      console.log('=== Bulk Update Summary ===');
      console.log('Success count:', successCount);
      console.log('Error count:', errorCount);
      console.log('Errors:', errors);
      
      // Show success/error messages
      if (successCount > 0) {
        alertsuccess(`Transcript status updated successfully for ${successCount} record(s)`);
      }
      if (errorCount > 0) {
        const errorDetails = errors.map(e => `Batch ${e.batchId}: ${e.error}`).join('; ');
        console.error('Bulk update errors:', errorDetails);
        alerterror(`Error updating ${errorCount} record(s). ${errorDetails}`);
      }
      
      // Clear changes and refresh table
      setRowChanges(new Map());
      if (tableRef.current) {
        tableRef.current.refresh();
      } else {
        setRefreshTrigger((prev) => prev + 1);
      }
    } catch (error: any) {
      console.error("=== handleBulkUpdate: General Error ===");
      console.error("Error:", error);
      console.error("Error stack:", error.stack);
      console.error("Error response:", error.response);
      alerterror(error.response?.data?.detail || error.message || "Error updating records. Please try again.");
    }
    
    console.log('=== handleBulkUpdate END ===');
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
        handleActionChange: handleActionChange, // Explicitly pass the function
        handleCommentChange: handleCommentChange,
        handleScenarioChange: handleScenarioChange,
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
        title={`${pageTitle} | High School Module`}
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
              isVisible={(() => {
                // Only show button if rowChanges has entries AND at least one has an action selected
                if (rowChanges.size === 0) {
                  return false;
                }
                
                const hasAction = Array.from(rowChanges.values()).some((changes: any) => {
                  // Show button if any row has an action selected (not "0" or empty or undefined) - matching CI3 logic
                  // CI3 shows button when: Processed, Rerun, or Noaction is selected (lines 563, 682, 776, 824, 829, 839)
                  const transcriptAction = changes.reprocessTranscript !== undefined 
                    ? String(changes.reprocessTranscript).trim() 
                    : "";
                  const articulationAction = changes.articulationProcess !== undefined 
                    ? String(changes.articulationProcess).trim() 
                    : "";
                  
                  const hasTranscriptAction = transcriptAction !== "" && transcriptAction !== "0";
                  const hasArticulationAction = articulationAction !== "" && articulationAction !== "0";
                  
                  return hasTranscriptAction || hasArticulationAction;
                });
                
                return hasAction;
              })()}
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
                  <option value="COLLEGE_NAME">High School Name</option>
                  <option value="STUDENT_ID">Student ID</option>
                  <option value="STUDENT_FULL_NAME">Student Name</option>
                  <option value="STATUS_SOAPCOL">Banner Status</option>
                  <option value="STATUS_BDMS">BDMS Status</option>
                  <option value="TRANSCRIPT_STATUS_FLAG">Transcript Status</option>
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
          ajaxUrl={`${API_BASE_URL}${API_ENDPOINTS.SCHOOL_TRANSCRIPT_REPORTS_LIST}`}
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

