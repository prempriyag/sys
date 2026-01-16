// Editable Student ID component matching CI3 studentid_edit behavior
import { useState } from "react";
import { api } from "../../config/api";
import { useToast } from "../../context/ToastContext";
import { PencilIcon, PaperPlaneIcon, CloseIcon, CopyIcon } from "../../icons";

interface EditableStudentIdProps {
  value: string;
  batchId: string;
  studentName: string;
  searchField: string;
  hasUpdatePermission: boolean;
  onSuccess?: () => void;
}

export default function EditableStudentId({
  value,
  batchId,
  studentName,
  searchField,
  hasUpdatePermission,
  onSuccess,
}: EditableStudentIdProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const { alertsuccess, alerterror } = useToast();

  // Only show edit icon for Failed/Rerun types (matching CI3)
  const showEditIcon = hasUpdatePermission && (searchField === "Failed" || searchField === "Rerun");

  const handleEditClick = () => {
    if (!showEditIcon) return;
    setIsEditing(true);
    setEditValue(value);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(value);
  };

  const handleSave = async () => {
    if (isSaving || !editValue || editValue === value) {
      setIsEditing(false);
      return;
    }

    // Show confirmation dialog (matching CI3 bootbox.confirm)
    const confirmed = window.confirm(
      `Student ID - ${editValue} is being updated for Student '${studentName}'. Please Confirm`
    );

    if (!confirmed) {
      setIsEditing(false);
      setEditValue(value);
      return;
    }

    setIsSaving(true);

    try {
      const response = await api.post("/api/transcriptreports/updatestudentid", {
        batchId,
        studentid: editValue,
      });

      if (response.data?.message === "Success" || response.data === "Success") {
        alertsuccess(`Student ID - ${editValue} for Student '${studentName}' updated successfully.`);
        setIsEditing(false);
        if (onSuccess) onSuccess();
      } else {
        alerterror("Error! Please try again");
      }
    } catch (error: any) {
      console.error("Update error:", error);
      alerterror(error.response?.data?.detail || "Error updating. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!value) {
    return <span>-</span>;
  }

  // For Processed/equivalenthours/Articulation-Kickouts - show as link only
  if (searchField === "Processed" || searchField === "equivalenthours" || 
      searchField === "Articulation-Kickouts" || searchField === "ArticulationKickouts" || 
      searchField === "") {
    return (
      <div className="inline-flex items-center gap-2">
        <button
          type="button"
          className="btn-copy-icon cursor-pointer hover:text-brand-500"
          onClick={() => navigator.clipboard.writeText(value)}
          title="Copy to clipboard"
        >
          <CopyIcon className="w-4 h-4" />
        </button>
        <a 
          href={`/college/studentview?student_id=${value}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-500 hover:underline"
        >
          {value}
        </a>
      </div>
    );
  }

  // For Failed/Rerun - show with edit icon
  if (isEditing) {
    return (
      <div className="inline-flex items-center gap-2">
        <button
          type="button"
          className="btn-copy-icon cursor-pointer hover:text-brand-500"
          onClick={() => navigator.clipboard.writeText(value)}
          title="Copy to clipboard"
        >
          <CopyIcon className="w-4 h-4" />
        </button>
        <input
          type="text"
          className="OSUID px-2 py-1 border border-gray-300 rounded text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          autoFocus
        />
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="EDIT_OSUID text-green-500 hover:text-green-700 cursor-pointer disabled:opacity-50"
          title="Save"
        >
          <PaperPlaneIcon className="w-4 h-4" />
        </button>
        <button
          onClick={handleCancel}
          disabled={isSaving}
          className="CLOSE_STUID text-red-500 hover:text-red-700 cursor-pointer disabled:opacity-50"
          title="Cancel"
        >
          <CloseIcon className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        className="btn-copy-icon cursor-pointer hover:text-brand-500"
        onClick={() => navigator.clipboard.writeText(value)}
        title="Copy to clipboard"
      >
        <CopyIcon className="w-4 h-4" />
      </button>
      {showEditIcon && (
        <span
          className="studentid_edit inline-flex items-center cursor-pointer text-blue-500 hover:text-blue-700"
          onClick={handleEditClick}
          title="Edit Student ID"
        >
          <PencilIcon className="w-4 h-4 me-1" />
        </span>
      )}
      <a 
        href={`/college/studentview?student_id=${value}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand-500 hover:underline"
        title="View Student Details"
      >
        <span className="student-id-text" id={`student-id-${value}`}>{value}</span>
      </a>
    </div>
  );
}

