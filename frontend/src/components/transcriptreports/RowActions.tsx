// Row actions component for transcript reports
// Handles action dropdowns, scenario dropdown, and user comments
import { useState, useEffect } from "react";
import ActionDropdown from "./ActionDropdown";

interface RowActionsProps {
  row: any;
  type: string;
  hasUpdatePermission: boolean;
  onActionChange: (action: string, batchId: string, data: any) => void;
  onCommentChange: (batchId: string, comment: string) => void;
  onScenarioChange: (batchId: string, scenario: string) => void;
}

export default function RowActions({
  row,
  type,
  hasUpdatePermission,
  onActionChange,
  onCommentChange,
  onScenarioChange,
}: RowActionsProps) {
  const [transcriptAction, setTranscriptAction] = useState<string>("0");
  const [articulationAction, setArticulationAction] = useState<string>("0");
  const [scenario, setScenario] = useState<string>(row.SCENARIO || "");

  const batchId = row.BATCH_ID || "";
  const searchField = row._search_field || "";
  const articulationStatus = row.ARTICULATION_STATUS_FLAG || "";

  // Auto-update comment when actions change (matching CI3 logic)
  useEffect(() => {
    if (transcriptAction === "0" && articulationAction === "0") return;

           let comment = "";

    if (transcriptAction === "Processed") {
      const selectedOption = document.querySelector(
        `.transcriptreprocess[data-batch-id="${batchId}"]`
      ) as HTMLSelectElement;
      const dataType = selectedOption?.selectedOptions[0]?.getAttribute("data-type") || "";

      if (dataType === "Articulated") {
        comment = "Processed and Articulated manually by OSU-OKC";
      } else {
        comment = "Processed manually by OSU-OKC";
      }
    } else if (transcriptAction === "Rerun") {
      comment = "Reprocess this Transcript";
    } else if (transcriptAction === "Noaction") {
      comment = "No Action Needed";
    } else if (articulationAction === "Processed") {
      comment = "Processed manually by OSU-OKC";
    } else if (articulationAction === "Rerun") {
      comment = "Reprocess this Transcript";
    } else if (articulationAction === "Noaction") {
      comment = "No Action Needed";
    }

    if (comment) {
      onCommentChange(batchId, comment);
    }
  }, [transcriptAction, articulationAction, batchId]);

  const handleTranscriptActionChange = (action: string, batchId: string, data: any) => {
    console.log('RowActions handleTranscriptActionChange:', { action, batchId, data });
    console.log('RowActions onActionChange type:', typeof onActionChange, onActionChange);
    setTranscriptAction(action);
    // Always call onActionChange to properly track state (including "0" to remove)
    console.log('RowActions calling onActionChange with:', { action, batchId, data: { ...data, type: "transcript" } });
    if (typeof onActionChange === 'function') {
      onActionChange(action, batchId, { ...data, type: "transcript" });
      console.log('RowActions onActionChange called successfully');
    } else {
      console.error('RowActions ERROR: onActionChange is not a function!', { onActionChange });
    }
  };

  const handleArticulationActionChange = (action: string, batchId: string, data: any) => {
    console.log('RowActions handleArticulationActionChange:', { action, batchId, data });
    console.log('RowActions onActionChange type:', typeof onActionChange, onActionChange);
    setArticulationAction(action);
    // Always call onActionChange to properly track state (including "0" to remove)
    console.log('RowActions calling onActionChange with:', { action, batchId, data: { ...data, type: "articulation" } });
    if (typeof onActionChange === 'function') {
      onActionChange(action, batchId, { ...data, type: "articulation" });
      console.log('RowActions onActionChange called successfully');
    } else {
      console.error('RowActions ERROR: onActionChange is not a function!', { onActionChange });
    }
  };

  const handleScenarioChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newScenario = e.target.value;
    setScenario(newScenario);
    onScenarioChange(batchId, newScenario);
  };


  // Only show action dropdowns if not Processed, equivalenthours, or empty
  const showActions = type !== "Processed" && type !== "equivalenthours" && type !== "";

  return (
    <div className="flex flex-col gap-2">
      {showActions && hasUpdatePermission && (
        <div className="flex gap-2">
          {searchField === "Articulation-Kickouts" || searchField === "ArticulationKickouts" ? (
            // For Articulation-Kickouts, show articulation dropdown only if not Processed
            articulationStatus !== "Processed" && (
              <ActionDropdown
                batchId={batchId}
                type="articulation"
                currentStatus={articulationStatus}
                searchField={searchField}
                articulationStatus={articulationStatus}
                onActionChange={handleArticulationActionChange}
              />
            )
          ) : (
            // For other types, show transcript dropdown
            <ActionDropdown
              batchId={batchId}
              type="transcript"
              currentStatus={row.TRANSCRIPT_STATUS_FLAG}
              searchField={searchField}
              onActionChange={handleTranscriptActionChange}
            />
          )}
        </div>
      )}

      {/* Scenario dropdown - shown when Processed action is selected */}
      {transcriptAction === "Processed" && hasUpdatePermission && (
        <select
          className="form-select SCENARIO rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          value={scenario}
          onChange={handleScenarioChange}
        >
          <option value="0">Select Option</option>
          <option value="Applicant">Applicant</option>
          <option value="Continuing Student">Continuing Student</option>
        </select>
      )}
    </div>
  );
}

