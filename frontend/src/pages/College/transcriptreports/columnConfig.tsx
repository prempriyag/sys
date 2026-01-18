// Column configuration for TranscriptReports matching CI3 list.php structure
// This file contains the complete column definitions with all properties

import React from "react";
import StatusBadge from "../../../components/common/StatusBadge";
import InlineEdit from "../../../components/common/InlineEdit";
import EditableStudentId from "../../../components/transcriptreports/EditableStudentId";
import EditableSlateId from "../../../components/transcriptreports/EditableSlateId";
import RowActions from "../../../components/transcriptreports/RowActions";
import { EyeIcon, FileIcon } from "../../../icons";

export interface ColumnConfig {
  data: string;
  name: string;
  searchable?: boolean;
  orderable?: boolean;
  visible?: boolean; // false for notvisible columns
  exportable?: boolean; // false for notexport columns
  textCenter?: boolean; // true for text-center columns
  defaultOrder?: boolean; // true for defaultOrderby column
  render?: (data: any, row: any, helpers?: any) => React.ReactNode;
}

// Helper function to create column configurations
export const createTranscriptReportColumns = (
  type: string,
  hasUpdatePermission: boolean,
  helpers: {
    copyToClipboard: (text: string) => void;
    getPdfUrl: (filePath: string, type: "transcript" | "articulation") => string;
    navigate: (path: string) => void;
    refreshTable?: () => void;
    handleInlineEdit?: (batchId: string, field: string, value: string) => void;
    validateInstitution?: (value: string, batchId: string) => Promise<{ valid: boolean; message?: string }>;
    handleActionChange?: (batchId: string, action: string, data: any) => void;
    handleCommentChange?: (batchId: string, comment: string) => void;
    handleScenarioChange?: (batchId: string, scenario: string) => void;
    rowChanges?: Map<string, any>; // Track pending changes per row
  }
): ColumnConfig[] => {
  const { copyToClipboard, getPdfUrl, navigate, handleInlineEdit, validateInstitution, handleActionChange, handleCommentChange, handleScenarioChange, rowChanges } = helpers || {};
  
  const columns: ColumnConfig[] = [
    // Column 0: INSTITUTION_NAME
    {
      data: "INSTITUTION_NAME",
      name: "College Name",
      searchable: true,
      orderable: true,
    },
    
    // Column 1: INSTITUTION_ID - with inline editing support
    {
      data: "INSTITUTION_ID",
      name: "Institution ID",
      searchable: true,
      orderable: true,
      render: (data: any, row: any) => {
        const batchId = row.BATCH_ID || "";
        const searchField = row._search_field || "";
        
        // Check if this row has pending changes (action selected)
        const hasPendingChanges = rowChanges?.get?.(batchId);
        const hasActionSelected = hasPendingChanges && (
          (hasPendingChanges.reprocessTranscript && hasPendingChanges.reprocessTranscript !== "0") ||
          (hasPendingChanges.articulationProcess && hasPendingChanges.articulationProcess !== "0")
        );
        
        // Show editable if: has permission AND (Failed/Rerun type OR action is selected)
        const isEditable = hasUpdatePermission && batchId && (
          searchField === "Failed" || 
          searchField === "Rerun" || 
          hasActionSelected
        );
        
        if (!data || data === "NONE") {
          // Show editable input if empty and editable
          if (isEditable) {
            return (
              <InlineEdit
                value=""
                batchId={batchId}
                type="institution"
                validateInstitution={validateInstitution}
                onSave={(newValue) => {
                  if (handleInlineEdit) {
                    handleInlineEdit(batchId, "INSTITUTION_ID", newValue);
                  }
                }}
                onSuccess={() => {
                  if (helpers?.refreshTable) helpers.refreshTable();
                }}
              />
            );
          }
          return "-";
        }
        
        // Show with copy icon and inline edit if editable
        return (
          <span className="flex items-center">
            <i
              className="btn-copy-icon fa-duotone fa-paste me-1 cursor-pointer hover:text-brand-500"
              onClick={() => copyToClipboard(data)}
              title="Copy to clipboard"
            ></i>
            {isEditable ? (
              <InlineEdit
                value={data}
                batchId={batchId}
                type="institution"
                validateInstitution={validateInstitution}
                onSave={(newValue) => {
                  if (handleInlineEdit) {
                    handleInlineEdit(batchId, "INSTITUTION_ID", newValue);
                  }
                }}
                onSuccess={() => {
                  if (helpers?.refreshTable) helpers.refreshTable();
                }}
              />
            ) : (
              <span>{data}</span>
            )}
          </span>
        );
      },
    },
    
    // Column 2: EXTERNAL_INSTITUTION_ZIPCODE (notvisible)
    {
      data: "EXTERNAL_INSTITUTION_ZIPCODE",
      name: "EXTERNAL INSTITUTION ZIPCODE",
      searchable: false,
      orderable: true,
      visible: false, // notvisible
    },
    
    // Column 3: STUDENT_ID (text-center) - with inline editing support
    // Matching CI3: Shows edit icon for Failed/Rerun types, link for Processed/equivalenthours
    {
      data: "STUDENT_ID",
      name: "Student ID",
      searchable: true,
      orderable: true,
      textCenter: true,
      render: (data: any, row: any) => {
        const batchId = row.BATCH_ID || "";
        const studentName = row.STUDENT_FULL_NAME || "";
        const searchField = row._search_field || "";
        const refreshTable = helpers?.refreshTable;
        
        if (!data) {
          return <span>-</span>;
        }
        
        return (
          <EditableStudentId
            value={data}
            batchId={batchId}
            studentName={studentName}
            searchField={searchField}
            hasUpdatePermission={hasUpdatePermission}
            onSuccess={() => {
              if (refreshTable) refreshTable();
            }}
          />
        );
      },
    },
    
    // Column 4: SLATE_REF_NUMBER (text-center) - with inline editing support
    // Matching CI3: Shows edit icon for Failed/Rerun types
    {
      data: "SLATE_REF_NUMBER",
      name: "Slate ID",
      searchable: true,
      orderable: true,
      textCenter: true,
      render: (data: any, row: any) => {
        const batchId = row.BATCH_ID || "";
        const studentName = row.STUDENT_FULL_NAME || "";
        const searchField = row._search_field || "";
        const refreshTable = helpers?.refreshTable;
        
        if (!data) {
          return <span>-</span>;
        }
        
        return (
          <EditableSlateId
            value={data}
            batchId={batchId}
            studentName={studentName}
            searchField={searchField}
            hasUpdatePermission={hasUpdatePermission}
            onSuccess={() => {
              if (refreshTable) refreshTable();
            }}
          />
        );
      },
    },
    
    // Column 5: STUDENT_FULL_NAME (text-center)
    {
      data: "STUDENT_FULL_NAME",
      name: "Student Name",
      searchable: true,
      orderable: true,
      textCenter: true,
    },
    
    // Column 6: STUDENT_FIRST_NAME (notvisible)
    {
      data: "STUDENT_FIRST_NAME",
      name: "Student First Name",
      searchable: false,
      orderable: true,
      visible: false, // notvisible
    },
    
    // Column 7: STUDENT_LAST_NAME (notvisible)
    {
      data: "STUDENT_LAST_NAME",
      name: "Student Last Name",
      searchable: false,
      orderable: true,
      visible: false, // notvisible
    },
    
    // Column 8: DATE_OF_BIRTH (notvisible)
    {
      data: "DATE_OF_BIRTH",
      name: "Date Of Birth",
      searchable: false,
      orderable: true,
      visible: false, // notvisible
    },
    
    // Column 9: SSN (notvisible, text-center)
    {
      data: "SSN",
      name: "SSN",
      searchable: false,
      orderable: true,
      visible: false, // notvisible
      textCenter: true,
    },
    
    // Column 10: BATCH_ID (text-center)
    {
      data: "BATCH_ID",
      name: "Batch ID",
      searchable: true,
      orderable: true,
      textCenter: true,
      render: (data: any) => {
        if (!data) return "-";
        return (
          <span className="copyinstid" id={data}>
            <i 
              className="btn-copy-icon fa-duotone fa-paste me-1 cursor-pointer hover:text-brand-500" 
              onClick={() => copyToClipboard(data)}
              style={{ cursor: "pointer" }}
              title="Copy to clipboard"
            ></i>
            <a 
              href={`/college/batchdetails/${data}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-500 hover:underline"
            >
              {data}
            </a>
            <input type="hidden" className="record_batch_id" value={data} />
          </span>
        );
      },
    },
    
    // Column 11: CGPA (notvisible)
    {
      data: "CGPA",
      name: "CGPA",
      searchable: false,
      orderable: true,
      visible: false, // notvisible
    },
    
    // Column 12: TOTAL_CREDITS_EARNED (notvisible, text-center)
    {
      data: "TOTAL_CREDITS_EARNED",
      name: "Total Credits Earned",
      searchable: false,
      orderable: true,
      visible: false, // notvisible
      textCenter: true,
    },
    
    // Column 13: TOTAL_CREDITS_ATTENDED (notvisible, text-center)
    {
      data: "TOTAL_CREDITS_ATTENDED",
      name: "Total Credits Attended",
      searchable: false,
      orderable: true,
      visible: false, // notvisible
      textCenter: true,
    },
    
    // Column 14: DEGREE_CD (notvisible)
    {
      data: "DEGREE_CD",
      name: "Degree CD",
      searchable: false,
      orderable: true,
      visible: false, // notvisible
    },
    
    // Column 15: DEGREE_RECEIVED_DATE (notvisible)
    {
      data: "DEGREE_RECEIVED_DATE",
      name: "Degree Received Date",
      searchable: false,
      orderable: true,
      visible: false, // notvisible
    },
    
    // Column 16: SECOND_DEGREE_CD (notvisible)
    {
      data: "SECOND_DEGREE_CD",
      name: "Second Degree",
      searchable: false,
      orderable: true,
      visible: false, // notvisible
    },
    
    // Column 17: SECOND_DEGREE_RECEIVED_DATE (notvisible)
    {
      data: "SECOND_DEGREE_RECEIVED_DATE",
      name: "Second Degree Received Date",
      searchable: false,
      orderable: true,
      visible: false, // notvisible
    },
    
    // Column 18: STATUS_SLATE
    {
      data: "STATUS_SLATE",
      name: "Slate Status",
      searchable: false,
      orderable: false,
      render: (data: any) => {
        if (!data) return "-";
        return <StatusBadge status={data} size="sm" />;
      },
    },
    
    // Column 19: STATUS_SLATE_UPLOAD
    {
      data: "STATUS_SLATE_UPLOAD",
      name: "Transcript uploaded to Slate",
      searchable: false,
      orderable: false,
      render: (data: any) => {
        if (!data) return "-";
        return <StatusBadge status={data} size="sm" />;
      },
    },
    
    // Column 20: STATUS_BANNER (noorder)
    {
      data: "STATUS_BANNER",
      name: "Banner Status",
      searchable: false,
      orderable: false, // noorder
      render: (data: any) => {
        if (!data) return "-";
        return <StatusBadge status={data} size="sm" />;
      },
    },
    
    // Column 21: STATUS_BDMS
    {
      data: "STATUS_BDMS",
      name: "Transcript uploaded to BDMS",
      searchable: false,
      orderable: false,
      render: (data: any) => {
        if (!data) return "-";
        return <StatusBadge status={data} size="sm" />;
      },
    },
    
    // Column 22: SCENARIO (notvisible)
    {
      data: "SCENARIO",
      name: "Scenario",
      searchable: false,
      orderable: true,
      visible: false, // notvisible
    },
    
    // Column 23: COMMENTS (notvisible)
    {
      data: "COMMENTS",
      name: "Comment",
      searchable: false,
      orderable: true,
      visible: false, // notvisible
    },
    
    // Column 24: ERROR_REASON
    {
      data: "ERROR_REASON",
      name: "Error Reason / Action",
      searchable: false,
      orderable: false,
      render: (data: any) => {
        if (!data) return "-";
        return <span dangerouslySetInnerHTML={{ __html: data }} />;
      },
    },
  ];
  
  // Column 25: ERROR_SCREENSHOT (notexport) - only if not Processed or equivalenthours
  if (type !== "Processed" && type !== "equivalenthours") {
    columns.push({
      data: "ERROR_SCREENSHOT",
      name: "Error Screenshot",
      searchable: false,
      orderable: false,
      exportable: false, // notexport
      render: (data: any, row: any) => {
        if (!data || data === "" || data === null || data === undefined) {
          return "-";
        }
        const batchId = row?.BATCH_ID || "";
        if (!batchId) {
          return "-";
        }
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/college/errorscreenshot/${batchId}`);
            }}
            className="text-brand-500 hover:text-brand-700 inline-flex items-center"
            title="View Error Screenshot"
          >
            <EyeIcon className="w-4 h-4 fill-current" />
          </button>
        );
      },
    });
  }
  
  // Column 26: TRANSCRIPT_LINK (notexport)
  columns.push({
    data: "TRANSCRIPT_LINK",
    name: "Transcript",
    searchable: false,
    orderable: false,
    exportable: false, // notexport
    render: (data: any) => {
      if (!data || data === "" || data === null || data === undefined) {
        return "-";
      }
      const pdfUrl = getPdfUrl(data, "transcript");
      if (!pdfUrl || pdfUrl === "") {
        return "-";
      }
      return (
        <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:text-brand-700 inline-flex items-center gap-1" title="View PDF">
          <FileIcon className="w-4 h-4" />
        </a>
      );
    },
  });
  
  // Column 27: SOURCE_TYPE (notvisible)
  columns.push({
    data: "SOURCE_TYPE",
    name: "Source Type",
    searchable: false,
    orderable: true,
    visible: false, // notvisible
  });
  
  // Column 28: TRANSCRIPT_STATUS_FLAG
  columns.push({
    data: "TRANSCRIPT_STATUS_FLAG",
    name: "Transcript Status",
    searchable: false,
    orderable: false,
    render: (data: any) => {
      if (!data) return "-";
      return <StatusBadge status={data} size="sm" />;
    },
  });
  
  // Column 29: ARTICULATION_STATUS_FLAG - only if type is not "Failed"
  if (type !== "Failed") {
    columns.push({
      data: "ARTICULATION_STATUS_FLAG",
      name: "Articulation Status",
      searchable: false,
      orderable: false,
      render: (data: any) => {
        if (!data) return "-";
        return <StatusBadge status={data} size="sm" />;
      },
    });
  }
  
  // Column 30: ACTION (notexport, noorder) - only if not Processed, equivalenthours, or empty
  if (type !== "Processed" && type !== "equivalenthours" && type !== "") {
    // Debug: Check if handlers are provided (helpers are already captured in closure from line 41)
    if (!handleActionChange) {
      console.error('columnConfig: handleActionChange is missing in helpers!', { 
        helpersKeys: helpers ? Object.keys(helpers) : 'helpers is undefined',
        helpers 
      });
    }
    
    columns.push({
      data: "ACTION",
      name: "Action",
      searchable: false,
      orderable: false, // noorder
      exportable: false, // notexport
      render: (_data: any, row: any) => {
        if (!hasUpdatePermission) return "-";
        
        return (
          <RowActions
            row={row}
            type={type}
            hasUpdatePermission={hasUpdatePermission}
            onActionChange={handleActionChange || ((action: string, batchId: string, data: any) => {
              console.error('RowActions: Using fallback empty handler!', { action, batchId, data });
            })}
            onCommentChange={handleCommentChange || (() => {})}
            onScenarioChange={handleScenarioChange || (() => {})}
          />
        );
      },
    });
  }
  
  // Column 31-32: LETTER_SENT_DATE and TRANSFER_LETTER_FILE_LINK - only for Processed or equivalenthours
  if (type === "Processed" || type === "equivalenthours") {
    columns.push({
      data: "LETTER_SENT_DATE",
      name: "Letter Sent Date",
      searchable: false,
      orderable: false,
    });
    columns.push({
      data: "TRANSFER_LETTER_FILE_LINK",
      name: "Transfer Letter File Link",
      searchable: false,
      orderable: false,
      render: (data: any) => {
        if (!data || data === "" || data === null || data === undefined) {
          return "-";
        }
        const pdfUrl = getPdfUrl(data, "articulation");
        if (!pdfUrl || pdfUrl === "") {
          return "-";
        }
        return (
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">
            <span className="fa fa-link"></span>
          </a>
        );
      },
    });
  }
  
  // Column 33: USER_COMMENTS (noorder) - editable textarea when actions are selected
  columns.push({
    data: "USER_COMMENTS",
    name: "User Comment",
    searchable: false,
    orderable: false, // noorder
      render: (data: any, row: any) => {
        const searchField = row._search_field || "";
        const batchId = row.BATCH_ID || "";
      
      // For Processed/equivalenthours, show plain text
      if (searchField === "Processed" || searchField === "equivalenthours") {
        return <span>{data || "-"}</span>;
      }
      
      // For other types, show editable textarea if user has permission
      if (hasUpdatePermission && batchId) {
        // Get the current comment value from rowChanges if it exists, otherwise use data
        // If comment is explicitly undefined in rowChanges, it means it was cleared, so use data
        const rowChange = rowChanges?.get?.(batchId);
        let currentComment: string;
        
        if (rowChange && 'comment' in rowChange) {
          // Comment exists in rowChanges - use it (even if empty string, which means cleared)
          currentComment = rowChange.comment !== undefined ? (rowChange.comment || "") : (data || "");
        } else {
          // No comment in rowChanges, use original data
          currentComment = data || "";
        }
        
        return (
          <textarea
            className="usercomment w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            rows={2}
            value={currentComment}
            onChange={(e) => {
              if (handleCommentChange) {
                handleCommentChange(batchId, e.target.value);
              }
            }}
            placeholder="User comment..."
          />
        );
      }
      
      return <span className="text-sm">{data || "-"}</span>;
    },
  });
  
  // Column 34: LAST_UPDATED_DATETIME (defaultOrderby)
  columns.push({
    data: "LAST_UPDATED_DATETIME",
    name: "Updated On",
    searchable: false,
    orderable: true,
    defaultOrder: true, // defaultOrderby
  });
  
  // Column 35: UPDATED_BY
  columns.push({
    data: "UPDATED_BY",
    name: "Updated By",
    searchable: true,
    orderable: true,
  });
  
  // Column 36: PROCESS_STATUS
  columns.push({
    data: "PROCESS_STATUS",
    name: "Process Status",
    searchable: false,
    orderable: false,
    render: (data: any) => {
      if (!data) return "-";
      return <StatusBadge status={data} size="sm" />;
    },
  });
  
  return columns;
};

