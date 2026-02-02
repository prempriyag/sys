// Row actions component for transcript reports
// Handles action dropdowns, scenario dropdown, and user comments
import { useState, useEffect, useRef } from "react";
import ActionDropdown from "./ActionDropdown";

interface RowActionsProps {
  row: any;
  type: string;
  hasUpdatePermission: boolean;
  onActionChange: (action: string, batchId: string, data: any) => void;
  onCommentChange: (batchId: string, comment: string) => void;
  onScenarioChange: (batchId: string, scenario: string) => void;
  rowChanges?: Map<string, any>;
}

export default function RowActions({
  row,
  type,
  hasUpdatePermission,
  onActionChange,
  onCommentChange,
  onScenarioChange,
  rowChanges,
}: RowActionsProps) {
  const [transcriptAction, setTranscriptAction] = useState<string>("0");
  const [articulationAction, setArticulationAction] = useState<string>("0");
  const [scenario, setScenario] = useState<string>(row.SCENARIO || "");

  const batchId = row.BATCH_ID || "";
  const searchField = row._search_field || "";
  const articulationStatus = row.ARTICULATION_STATUS_FLAG || "";

  // Track previous action values to prevent unnecessary updates
  const prevActionsRef = useRef<{ transcriptAction: string; articulationAction: string } | null>(null);
  
  // Auto-update comment when actions change (matching CI3 logic)
  useEffect(() => {
    // Only update if actions actually changed (skip first render)
    if (prevActionsRef.current !== null) {
      const actionsChanged = 
        prevActionsRef.current.transcriptAction !== transcriptAction ||
        prevActionsRef.current.articulationAction !== articulationAction;
      
      if (!actionsChanged) {
        return;
      }
    }
    
    // Update ref to current values
    prevActionsRef.current = { transcriptAction, articulationAction };
    
    // If both actions are "0", clear the comment
    if (transcriptAction === "0" && articulationAction === "0") {
      // Only clear if we had a previous state (not initial render)
      if (prevActionsRef.current !== null) {
        onCommentChange(batchId, "");
      }
      return;
    }

    let comment = "";

    if (transcriptAction === "Processed") {
      const changes = rowChanges?.get(batchId);
      const dataType = changes?.processTranscript_articulated || "";

      if (dataType === "Articulated") {
        comment = "Processed and Articulated manually by OSU-OKC";
      } else {
        comment = "Processed manually by OSU-OKC";
      }
    } else if (transcriptAction === "Rerun") {
      const changes = rowChanges?.get(batchId);
      const dataType = changes?.processTranscript_articulated || "";
      comment = dataType === "Rerun15" ? "Reprocess for 30 days" : "Reprocess this Transcript";
    } else if (transcriptAction === "Noaction") {
      comment = "No Action Needed";
    } else if (articulationAction === "Processed") {
      comment = "Processed manually by OSU-OKC";
    } else if (articulationAction === "Rerun") {
      comment = "Reprocess this Transcript";
    } else if (articulationAction === "Noaction") {
      comment = "No Action Needed";
    }

    // Only call onCommentChange if we have a comment to set
    if (comment) {
      onCommentChange(batchId, comment);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcriptAction, articulationAction, batchId, rowChanges]);

  const handleTranscriptActionChange = (action: string, batchId: string, data: any) => {
    setTranscriptAction(action);
    // Set comment immediately (don't wait for rowChanges) so User Comments updates correctly
    if (action === "Processed") {
      const dataType = data?.dataType || "";
      const comment = dataType === "Articulated" 
        ? "Processed and Articulated manually by OSU-OKC" 
        : "Processed manually by OSU-OKC";
      onCommentChange(batchId, comment);
    } else if (action === "Rerun") {
      const dataType = data?.dataType || "";
      onCommentChange(batchId, dataType === "Rerun15" ? "Reprocess for 30 days" : "Reprocess this Transcript");
    } else if (action === "Noaction") {
      onCommentChange(batchId, "No Action Needed");
    }
    // "0" case handled by useEffect when both actions are cleared
    if (typeof onActionChange === 'function') {
      onActionChange(action, batchId, { ...data, type: "transcript" });
    }
  };

  const handleArticulationActionChange = (action: string, batchId: string, data: any) => {
    setArticulationAction(action);
    // Set comment immediately so User Comments updates correctly
    if (action === "Processed") {
      onCommentChange(batchId, "Processed manually by OSU-OKC");
    } else if (action === "Rerun") {
      onCommentChange(batchId, "Reprocess this Transcript");
    } else if (action === "Noaction") {
      onCommentChange(batchId, "No Action Needed");
    }
    if (typeof onActionChange === 'function') {
      onActionChange(action, batchId, { ...data, type: "articulation" });
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
    <div className="flex flex-col gap-2" style={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
      {showActions && hasUpdatePermission && (
        <div className="flex gap-2" style={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
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

      {/* Scenario dropdown - shown when Processed action is selected (transcript or articulation) */}
      {(transcriptAction === "Processed" || articulationAction === "Processed") && hasUpdatePermission && (
        <select
          className="form-select SCENARIO rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          value={scenario}
          onChange={handleScenarioChange}
          style={{
            width: '100%',
            maxWidth: '100%',
            boxSizing: 'border-box',
          }}
        >
          <option value="0">Select Option</option>
          <option value="Applicant">Applicant</option>
          <option value="Continuing Student">Continuing Student</option>
        </select>
      )}
    </div>
  );
}

