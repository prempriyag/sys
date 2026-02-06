// Action dropdown component for transcript reports
// Handles transcriptreprocess and articulationreprocess dropdowns
import { useState, useEffect } from "react";

interface ActionOption {
  // uniqueValue is used for React state and select value (must be unique)
  uniqueValue: string;
  // action is what gets sent to the backend (Rerun, Processed, Noaction, 0)
  action: string;
  label: string;
  dataType: string;
}

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
  // uniqueValue must be unique for React select to work correctly
  const transcriptOptions: ActionOption[] = [
    { uniqueValue: "0", action: "0", label: "Action Needed", dataType: "" },
    { uniqueValue: "Noaction", action: "Noaction", label: "No Action Needed", dataType: "" },
    { uniqueValue: "Rerun", action: "Rerun", label: "Reprocess this Transcript", dataType: "Rerun" },
    { uniqueValue: "Rerun15", action: "Rerun", label: "Reprocess for 30 days", dataType: "Rerun15" },
    { uniqueValue: "Processed", action: "Processed", label: "Processed Manually by CSC", dataType: "Processed" },
    { uniqueValue: "Processed_Articulated", action: "Processed", label: "Processed and Articulated manually by CSC", dataType: "Articulated" },
  ];

  // Articulation reprocess options (matching CI3 lines 519-524)
  const articulationOptions: ActionOption[] = [
    { uniqueValue: "0", action: "0", label: "Action Needed", dataType: "" },
    { uniqueValue: "Noaction", action: "Noaction", label: "No Action Needed", dataType: "" },
    { uniqueValue: "Rerun", action: "Rerun", label: "Reprocess this Transcript", dataType: "" },
    { uniqueValue: "Processed", action: "Processed", label: "Processed Manually by CSC", dataType: "" },
  ];

  const options = type === "transcript" ? transcriptOptions : articulationOptions;
  const className = type === "transcript" 
    ? "form-select transcriptreprocess slddrb rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
    : "form-select articulationreprocess slddrb rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white";

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const uniqueValue = e.target.value;
    
    // Find the selected option to get action and dataType
    const selectedOption = options.find(opt => opt.uniqueValue === uniqueValue);
    const action = selectedOption?.action || "0";
    const dataType = selectedOption?.dataType || "";
    
    setSelectedValue(uniqueValue);
    
    // Always call onActionChange, even for "0" to properly track state and hide button
    // Pass the actual action value (not uniqueValue) to the parent
    onActionChange(action, batchId, {
      type,
      searchField,
      articulationStatus,
      dataType, // Pass dataType for Processed/Rerun options
    });
  };

  return (
    <select
      className={className}
      value={selectedValue}
      onChange={handleChange}
      disabled={disabled}
      data-batch-id={batchId}
      style={{
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      {options.map((option) => (
        <option
          key={option.uniqueValue}
          value={option.uniqueValue}
          data-type={option.dataType || ""}
          data-action={option.action}
        >
          {option.label}
        </option>
      ))}
    </select>
  );
}

