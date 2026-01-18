// Inline editing component for Student ID, Slate ID, Institution ID
import { useState, useRef, useEffect } from "react";
import { api } from "../../config/api";
import { PencilIcon, PaperPlaneIcon, CloseIcon } from "../../icons";

interface InlineEditProps {
  value: string;
  batchId: string;
  type: "student" | "slate" | "institution";
  onSuccess?: () => void;
  onCancel?: () => void;
  onSave?: (value: string) => void; // Callback to track changes
  validateInstitution?: (value: string, batchId: string) => Promise<{ valid: boolean; message?: string }>;
  studentName?: string;
  disabled?: boolean;
}

export default function InlineEdit({
  value,
  batchId,
  type,
  onSuccess,
  onCancel,
  onSave,
  validateInstitution,
  studentName,
  disabled = false,
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleEdit = () => {
    if (disabled) return;
    setIsEditing(true);
    setEditValue(value);
    setValidationError("");
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(value);
    setValidationError("");
    if (onCancel) onCancel();
  };

  const handleSave = async () => {
    if (disabled || isSaving) return;

    // Validate institution ID if needed
    if (type === "institution" && validateInstitution) {
      if (editValue && editValue !== "NONE") {
        setIsSaving(true);
        try {
          const validation = await validateInstitution(editValue, batchId);
          if (!validation.valid) {
            setValidationError(validation.message || "Validation failed");
            setIsSaving(false);
            return;
          }
        } catch (error) {
          setValidationError("Validation error occurred");
          setIsSaving(false);
          return;
        }
      }
    }

    setIsSaving(true);
    setValidationError("");

    try {
      let endpoint = "";
      let payload: any = { batchId };

      if (type === "student") {
        endpoint = "/api/transcriptreports/updatestudentid";
        payload.studentid = editValue;
      } else if (type === "slate") {
        endpoint = "/api/transcriptreports/updateslateid";
        payload.slateid = editValue;
      } else if (type === "institution") {
        // Institution ID is updated via updatechkstatus endpoint
        endpoint = "/api/transcriptreports/updatechkstatus";
        payload.instid = editValue || "";
        payload.comment = ""; // Empty comment for immediate institution ID update
        payload.reprocessTranscript = "0";
        payload.articulationProcess = "0";
        payload.processTranscript_articulated = "";
      }

      // Debug logging
      console.log('=== InlineEdit: Saving ===');
      console.log('Type:', type);
      console.log('Endpoint:', endpoint);
      console.log('Payload:', JSON.stringify(payload, null, 2));
      console.log('BatchId:', batchId);
      console.log('EditValue:', editValue);

      try {
        const response = await api.post(endpoint, payload);
        
        console.log('=== InlineEdit: API Response ===');
        console.log('Response status:', response.status);
        console.log('Response data:', JSON.stringify(response.data, null, 2));

        if (response.data?.message === "Success" || response.data === "Success") {
          console.log('=== InlineEdit: Update Success ===');
          setIsEditing(false);
          // Track the change for bulk update tracking (if onSave callback is provided)
          if (onSave && type === "institution") {
            onSave(editValue);
          }
          if (onSuccess) onSuccess();
        } else {
          console.error('=== InlineEdit: Update Failed - Invalid Response ===');
          console.error('Response:', response.data);
          setValidationError(`Update failed: ${response.data?.message || "Invalid response from server"}`);
        }
      } catch (apiError: any) {
        console.error('=== InlineEdit: API Error ===');
        console.error('Error object:', apiError);
        console.error('Error message:', apiError?.message);
        console.error('Error response:', apiError?.response);
        console.error('Error response data:', apiError?.response?.data);
        console.error('Error response status:', apiError?.response?.status);
        setValidationError(apiError.response?.data?.detail || apiError.message || "Error updating. Please try again.");
      }
    } catch (error: any) {
      console.error("=== InlineEdit: General Error ===");
      console.error("Error:", error);
      console.error("Error stack:", error.stack);
      setValidationError(error.message || "Error updating. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (disabled) {
    return <span>{value || "-"}</span>;
  }

  if (!isEditing) {
    return (
      <div className="inline-flex items-center gap-2">
        <span>{value || "-"}</span>
        <button
          onClick={handleEdit}
          className="text-blue-500 hover:text-blue-700 cursor-pointer"
          title="Edit"
        >
          <PencilIcon className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="px-2 py-1 border border-gray-300 rounded text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        disabled={isSaving}
      />
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="text-green-500 hover:text-green-700 cursor-pointer disabled:opacity-50"
        title="Save"
      >
        <PaperPlaneIcon className="w-4 h-4" />
      </button>
      <button
        onClick={handleCancel}
        disabled={isSaving}
        className="text-red-500 hover:text-red-700 cursor-pointer disabled:opacity-50"
        title="Cancel"
      >
        <CloseIcon className="w-4 h-4" />
      </button>
      {validationError && (
        <span className="text-red-500 text-xs">{validationError}</span>
      )}
    </div>
  );
}

