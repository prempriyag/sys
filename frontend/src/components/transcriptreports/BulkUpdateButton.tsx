// Bulk update button component for processing all selected rows
import { useState } from "react";
import { api } from "../../config/api";
import { useToast } from "../../context/ToastContext";
import { RefreshIcon } from "../../icons";

interface BulkUpdateButtonProps {
  rows?: any[]; // Array of row data with action selections (optional, for backward compatibility)
  isVisible?: boolean; // Show/hide the button
  onClick?: () => void; // Custom onClick handler
  onSuccess?: () => void;
  disabled?: boolean;
}

export default function BulkUpdateButton({
  rows = [],
  isVisible = false,
  onClick,
  onSuccess,
  disabled = false,
}: BulkUpdateButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { alertsuccess, alerterror } = useToast();

  const handleBulkUpdate = async () => {
    // If custom onClick is provided, use it
    if (onClick) {
      onClick();
      return;
    }
    
    // Otherwise, use the default bulk update logic
    if (disabled || isProcessing || rows.length === 0) return;

    // Validate - check for institution validation errors
    const validationErrors = rows.filter((row) => {
      return row.validationError && row.validationError.length > 0;
    });

    if (validationErrors.length > 0) {
      alerterror("Please fix validation errors before updating");
      return;
    }

    setIsProcessing(true);

    try {
      let successCount = 0;
      let errorCount = 0;

      // Process each row
      for (const row of rows) {
        const {
          batchId,
          comment,
          reprocessTranscript,
          articulationProcess,
          processTranscriptArticulated,
          osuid,
          slateid,
          scenario,
          instid,
        } = row;

        // Only process if there's an action selected
        if (
          (reprocessTranscript && reprocessTranscript !== "0") ||
          (articulationProcess && articulationProcess !== "0")
        ) {
          try {
            const response = await api.post("/api/transcriptreports/updatechkstatus", {
              comment: comment || "",
              batchId,
              reprocessTranscript: reprocessTranscript || "0",
              processTranscript_articulated: processTranscriptArticulated || "",
              articulationProcess: articulationProcess || "0",
              osuid: osuid || "",
              slateid: slateid || "",
              scenario: scenario || "",
              instid: instid || "",
            });

            if (response.data?.message === "Success" || response.data === "Success") {
              successCount++;
            } else {
              errorCount++;
            }
          } catch (error) {
            console.error(`Error updating batch ${batchId}:`, error);
            errorCount++;
          }
        }
      }

      if (successCount > 0) {
        alertsuccess(
          `Transcript status updated successfully for ${successCount} record(s)`
        );
        if (onSuccess) onSuccess();
      } else if (errorCount > 0) {
        alerterror(`Error updating ${errorCount} record(s)`);
      }
    } catch (error: any) {
      console.error("Bulk update error:", error);
      alerterror("Error performing bulk update");
    } finally {
      setIsProcessing(false);
    }
  };

  // Always render the button, but control visibility with style (matching CI3 behavior)
  // CI3 uses $("#btnId").show() and $("#btnId").hide() to control visibility
  const shouldShow = isVisible || rows.length > 0;
  
  return (
    <div 
      className="fixed bottom-6 right-6 z-50"
      style={{ display: shouldShow ? "block" : "none" }}
    >
      <button
        onClick={handleBulkUpdate}
        disabled={disabled || isProcessing}
        className="flex items-center gap-2 rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:bg-brand-600 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-700"
        id="btnId"
      >
        {isProcessing ? (
          <>
            <RefreshIcon className="h-5 w-5 animate-spin" />
            <span>Processing...</span>
          </>
        ) : (
          <>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>Update Selected</span>
          </>
        )}
      </button>
    </div>
  );
}

