import { useState } from "react";
import PageBreadcrumb from "../../../../components/common/PageBreadCrumb";
import PageMeta from "../../../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../../../components/common/PageContainer";
import DataTable from "../../../../components/ui/DataTable";
import Button from "../../../../components/ui/button/Button";
import StatusBadge from "../../../../components/common/StatusBadge";
import { useNavigate } from "react-router";
import { API_ENDPOINTS, API_BASE_URL } from "../../../../config/api";
import { RefreshIcon, FilterIcon } from "../../../../icons";
import { useAuth } from "../../../../context/AuthContext";
import { alertsuccess } from "../../../../utils/toast";

export default function DigiScriptBotLog() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  
  const [fieldType, setFieldType] = useState<string>("");
  const [fieldName, setFieldName] = useState<string>("");

  const hasUpdatePermission = hasPermission("college_digiscript_reports", "UPDATE");

  const copyToClipboard = (text: string | number) => {
    const str = String(text ?? "").trim();
    if (!str) return;
    navigator.clipboard.writeText(str).then(() => {
      alertsuccess("Copied to clipboard!");
    }).catch(() => console.error("Failed to copy"));
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
      return `${API_BASE_URL.replace("/api", "")}/transcripts/${cleanPath}`;
    } else {
      return `${API_BASE_URL.replace("/api", "")}/articulation/${cleanPath}`;
    }
  };

  const clearFilters = () => {
    setFieldType("");
    setFieldName("");
  };

  const ajaxData: any = {};
  if (fieldType) ajaxData.fieldType = fieldType;
  if (fieldName) ajaxData.fieldName = fieldName;

  return (
    <PageWrapper>
      <PageMeta
        title="Transcript Log | College Module"
        description="DigiScript Bot Log"
      />
      <PageBreadcrumb pageTitle="Transcript Log" />

      <PageContainer>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">
            Transcript Log
          </h3>
          <div className="flex items-center gap-2">
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

        {showFilters && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Filter Type
                </label>
                <select
                  value={fieldType}
                  onChange={(e) => {
                    setFieldType(e.target.value);
                    setFieldName("");
                  }}
                  className="relative w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                >
                  <option value="">Select Option</option>
                  <option value="COLLEGE_NAME">College Name</option>
                  <option value="STUDENT_FULL_NAME">Student Name</option>
                  <option value="STUDENT_ID">Student ID</option>
                  <option value="SCENARIO">Applicant Type</option>
                  <option value="STATUS_BDMS_TRANSCRIPT">Status BDMS Transcript</option>
                  <option value="STATUS_BDMS">Status BDMS</option>
                  <option value="STATUS_BANNER">Status Banner</option>
                  <option value="STATUS_SLATE">Status Slate</option>
                  <option value="TRANSCRIPT_STATUS_FLAG">Transcript Status</option>
                  <option value="UPDATED_BY">Updated By</option>
                  <option value="USER_COMMENTS">User Comments</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Filter Value
                </label>
                <input
                  type="text"
                  value={fieldName}
                  onChange={(e) => setFieldName(e.target.value)}
                  placeholder="Enter filter value"
                  className="relative w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                />
              </div>
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

        <DataTable
          refreshTrigger={refreshTrigger}
          ajaxUrl={API_ENDPOINTS.DIGISCRIPT_BOT_LOG_LIST}
          ajaxData={ajaxData}
          columns={[
            { data: "INSTITUTION_ID", name: "Institution Name", searchable: true, orderable: true },
            { 
              data: "BATCH_ID", 
              name: "Batch ID", 
              searchable: true, 
              orderable: true,
              render: (data: any) => {
                if (!data) return "-";
                return (
                  <span>
                    <span 
                      className="copyinstid cursor-pointer hover:text-brand-500 me-2" 
                      onClick={() => copyToClipboard(data)}
                    >
                      <i className="btn-copy-icon fa-duotone fa-paste me-1"></i>
                    </span>
                    <a 
                      href={`/college/batchdetails/${data}`}
                      target="_blank"
                      className="text-brand-500 hover:underline"
                    >
                      {data}
                    </a>
                  </span>
                );
              }
            },
            { 
              data: "STUDENT_ID", 
              name: "Student ID", 
              searchable: true, 
              orderable: true,
              render: (data: any) => {
                if (!data) return "-";
                if (hasUpdatePermission) {
                  return (
                    <a 
                      href={`/college/studentview?student_id=${data}`}
                      target="_blank"
                      className="text-brand-500 hover:underline"
                    >
                      {data}
                    </a>
                  );
                }
                return <span>{data}</span>;
              }
            },
            { data: "STUDENT_FULL_NAME", name: "Student Name", searchable: true, orderable: true },
            { data: "AUDIT_DATE", name: "Audit Date", searchable: false, orderable: true },
            { 
              data: "STATUS_BDMS", 
              name: "Status BDMS", 
              searchable: false, 
              orderable: false,
              render: (data: any) => {
                if (!data) return "-";
                return <StatusBadge status={data} size="sm" />;
              }
            },
            { 
              data: "STATUS_SOAPCOL", 
              name: "Status SOAPCOL", 
              searchable: false, 
              orderable: false,
              render: (data: any) => {
                if (!data) return "-";
                return <StatusBadge status={data} size="sm" />;
              }
            },
            { 
              data: "STATUS_SAAADMS", 
              name: "Status SAAADMS", 
              searchable: false, 
              orderable: false,
              render: (data: any) => {
                if (!data) return "-";
                return <StatusBadge status={data} size="sm" />;
              }
            },
            { 
              data: "STATUS_SOAHOLD", 
              name: "Status SOAHOLD", 
              searchable: false, 
              orderable: false,
              render: (data: any) => {
                if (!data) return "-";
                return <StatusBadge status={data} size="sm" />;
              }
            },
            { 
              data: "STATUS_SLATE", 
              name: "Status Slate", 
              searchable: false, 
              orderable: false,
              render: (data: any) => {
                if (!data) return "-";
                return <StatusBadge status={data} size="sm" />;
              }
            },
            { 
              data: "STATUS_SLATE_UPLOAD", 
              name: "Status Slate Upload", 
              searchable: false, 
              orderable: false,
              render: (data: any) => {
                if (!data) return "-";
                return <StatusBadge status={data} size="sm" />;
              }
            },
            { data: "STATUS_SPACMNT", name: "Status SPACMNT", searchable: false, orderable: false },
            { data: "TRANSCRIPT_STATUS_FLAG", name: "Transcript Status", searchable: false, orderable: false },
            { data: "ARTICULATION_STATUS_FLAG", name: "Articulation Status", searchable: false, orderable: false },
            { data: "SCENARIO", name: "Scenario", searchable: false, orderable: false },
            { data: "COMMENTS", name: "Comments", searchable: false, orderable: false },
            { 
              data: "ERROR_REASON", 
              name: "Error Reason", 
              searchable: false, 
              orderable: false,
              render: (data: any) => {
                if (!data) return "-";
                return <span dangerouslySetInnerHTML={{ __html: data.replace(/\n/g, "<br>") }} />;
              }
            },
            { 
              data: "ERROR_SCREENSHOT", 
              name: "Error Screenshot", 
              searchable: false, 
              orderable: false,
              render: (data: any, row: any) => {
                // Check if ERROR_SCREENSHOT exists or if we have BATCH_ID to show link
                const batchId = row?.BATCH_ID || "";
                if (!batchId) return "-";
                
                // If data exists, show link; if not but batchId exists, still show link (backend will handle)
                // Navigate to error screenshot page (similar to batchdetails page)
                return (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/college/errorscreenshot/${batchId}`);
                    }}
                    className="text-brand-500 hover:underline inline-flex items-center"
                  >
                    <i className="fa fa-eye me-1"></i>
                    View
                  </button>
                );
              }
            },
            { 
              data: "TRANSCRIPT_LINK", 
              name: "Transcript", 
              searchable: false, 
              orderable: false,
              render: (data: any) => {
                if (!data || data === "" || data === null || data === undefined) return "-";
                // Backend already returns encrypted URL like: /api/viewfile/transcript_file?pdf={encrypted}
                // getPdfUrl will prepend API_BASE_URL to make it a full URL
                const pdfUrl = getPdfUrl(data, "transcript");
                if (!pdfUrl || pdfUrl === "") return "-";
                return (
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">
                    <i className="fa fa-link me-1"></i>
                    View PDF
                  </a>
                );
              }
            },
            { data: "USER_COMMENTS", name: "User Comments", searchable: false, orderable: false },
            { data: "LAST_UPDATED_DATETIME", name: "Last Updated", searchable: false, orderable: true },
            { data: "UPDATED_BY", name: "Updated By", searchable: false, orderable: false },
          ]}
        />
      </PageContainer>
    </PageWrapper>
  );
}

