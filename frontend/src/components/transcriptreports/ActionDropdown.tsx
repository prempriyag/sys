// Action dropdown component for transcript reports
// Handles transcriptreprocess and articulationreprocess dropdowns
import { useState, useEffect } from "react";

interface ActionDropdownProps {
  batchId: string;
  type: "transcript" | "articulation";
  currentStatus?: string;
  searchField?: string;
  articulationStatus?: string;
  onActionChange: (action: string, batchId: string, data: any) => void;
  disabled?: boolean;
}

export default function ActionDropdown({
  batchId,
  type,
  currentStatus,
  searchField,
  articulationStatus,
  onActionChange,
  disabled = false,
}: ActionDropdownProps) {
  const [selectedValue, setSelectedValue] = useState<string>("0");

  useEffect(() => {
    // Reset to default when status changes
    setSelectedValue("0");
  }, [currentStatus]);

  // Transcript reprocess options (matching CI3 lines 528-535)
  const transcriptOptions = [
    { value: "0", label: "Action Needed", dataType: "" },
    { value: "Noaction", label: "No Action Needed", dataType: "" },
    { value: "Rerun", label: "Reprocess this Transcript", dataType: "Rerun" },
    { value: "Rerun", label: "Reprocess for 30 days", dataType: "Rerun15" },
    { value: "Processed", label: "Processed Manually by OSU-CSC", dataType: "Processed" },
    { value: "Processed", label: "Processed and Articulated manually by OSU-CSC", dataType: "Articulated" },
  ];

  // Articulation reprocess options (matching CI3 lines 519-524)
  const articulationOptions = [
    { value: "0", label: "Action Needed", dataType: "" },
    { value: "Noaction", label: "No Action Needed", dataType: "" },
    { value: "Rerun", label: "Reprocess this Transcript", dataType: "" },
    { value: "Processed", label: "Processed Manually by OSU-CSC", dataType: "" },
  ];

  const options = type === "transcript" ? transcriptOptions : articulationOptions;
  const className = type === "transcript" 
    ? "form-select transcriptreprocess slddrb rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
    : "form-select articulationreprocess slddrb rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white";

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const selectedOption = e.target.selectedOptions[0];
    const dataType = selectedOption?.getAttribute("data-type") || "";
    
    setSelectedValue(value);
    
    // Always call onActionChange, even for "0" to properly track state and hide button
    onActionChange(value, batchId, {
      type,
      searchField,
      articulationStatus,
      dataType, // Pass data-type for Processed options
    });
  };

  return (
    <select
      className={className}
      value={selectedValue}
      onChange={handleChange}
      disabled={disabled}
      data-batch-id={batchId}
    >
      {options.map((option, idx) => (
        <option
          key={idx}
          value={option.value}
          data-type={option.dataType || ""}
        >
          {option.label}
        </option>
      ))}
    </select>
  );
}

