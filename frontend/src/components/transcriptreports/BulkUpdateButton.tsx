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

  if (!isVisible && rows.length === 0) {
    return null;
  }

  return (
    <button
      onClick={handleBulkUpdate}
      disabled={disabled || isProcessing}
      className="btn btn-primary submitId submitId_float"
      id="btnId"
      style={{ display: (isVisible || rows.length > 0) ? "block" : "none" }}
    >
      {isProcessing ? (
        <>
          <RefreshIcon className="w-4 h-4 me-1 animate-spin" />
          Processing...
        </>
      ) : (
        <>
          <span className="submitId_svg">
            <img src="/img/update.svg" alt="Update" />
          </span>
          Update Selected
        </>
      )}
    </button>
  );
}

