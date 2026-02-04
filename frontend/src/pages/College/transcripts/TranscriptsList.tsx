import { useState } from "react";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../../components/common/PageContainer";
import DataTable from "../../../components/ui/DataTable";
import Button from "../../../components/ui/button/Button";
import StatusBadge from "../../../components/common/StatusBadge";
import { API_ENDPOINTS, API_BASE_URL } from "../../../config/api";
import { RefreshIcon, FilterIcon, FileIcon } from "../../../icons";
import { useAuth } from "../../../context/AuthContext";
import { alertsuccess } from "../../../utils/toast";

export default function TranscriptsList() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const { hasPermission } = useAuth();
  
  const [fieldType, setFieldType] = useState<string>("");
  const [fieldName, setFieldName] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const hasUpdatePermission = hasPermission("college_downloaded_transcripts", "UPDATE");

  const copyToClipboard = (text: string | number) => {
    const str = String(text ?? "").trim();
    if (!str) return;
    navigator.clipboard.writeText(str).then(() => {
      alertsuccess("Copied to clipboard!");
    }).catch(() => console.error("Failed to copy"));
  };

  // Helper function to generate PDF URL (matches reports format)
  // Backend now returns encrypted URLs in format: /api/viewfile/transcript_file?pdf={encrypted}
  const getPdfUrl = (filePath: string, type: "transcript" | "articulation" = "transcript") => {
    if (!filePath || filePath === "" || filePath === null || filePath === undefined) {
      return "";
    }
    
    // If backend already returns a full URL (starts with http), use it as-is
    if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
      return filePath;
    }
    
    // Backend now returns encrypted URL in format: /api/viewfile/transcript_file?pdf={encrypted}
    // Just prepend API_BASE_URL (same as batchdetails and reports)
    if (filePath.startsWith("/api/viewfile")) {
      return `${API_BASE_URL}${filePath}`;
    }
    
    // For backward compatibility: if we get a raw file path (shouldn't happen now)
    const cleanPath = filePath.startsWith("/") ? filePath.substring(1) : filePath;
    if (type === "transcript") {
      return `${API_BASE_URL.replace("/api", "")}/transcripts/${cleanPath}`;
    } else {
      return `${API_BASE_URL.replace("/api", "")}/articulation/${cleanPath}`;
    }
  };

  const clearFilters = () => {
    setFieldType("");
    setFieldName("");
    setFromDate("");
    setToDate("");
  };

  const ajaxData: any = {};
  if (fieldType) ajaxData.fieldType = fieldType;
  if (fieldName) ajaxData.fieldName = fieldName;
  if (fromDate) ajaxData.fromDate = fromDate;
  if (toDate) ajaxData.toDate = toDate;

  return (
    <PageWrapper>
      <PageMeta
        title="Uploaded Transcripts | College Module"
        description="Uploaded transcripts list"
      />
      <PageBreadcrumb pageTitle="Uploaded Transcripts" />

      <PageContainer>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">
            Uploaded Transcripts
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Filter Type
                </label>
                <select
                  value={fieldType}
                  onChange={(e) => {
                    setFieldType(e.target.value);
                    setFieldName("");
                    setFromDate("");
                    setToDate("");
                  }}
                  className="relative w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                >
                  <option value="">Select Option</option>
                  <option value="BATCH_ID">Batch ID</option>
                  <option value="SOURCE_TYPE">Source Type</option>
                  <option value="STATUS">Status</option>
                  <option value="ARTICULATION_STATUS_FLAG">Articulation Status</option>
                  <option value="UPLOADED_DATETIME">Uploaded Date</option>
                  <option value="LAST_UPDATED_DATETIME">Last Updated Date</option>
                  <option value="UPDATED_BY">Updated By</option>
                </select>
              </div>
              {(fieldType === "UPLOADED_DATETIME" || fieldType === "LAST_UPDATED_DATETIME") ? (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      From Date
                    </label>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="relative w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      To Date
                    </label>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="relative w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                    />
                  </div>
                </>
              ) : (
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
              )}
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
          ajaxUrl={API_ENDPOINTS.TRANSCRIPTS_LIST}
          ajaxData={ajaxData}
          columns={[
            { data: "SOURCE_TYPE", name: "Source Type", searchable: true, orderable: true },
            { data: "FILENAME", name: "Filename", searchable: true, orderable: true },
            { 
              data: "FORMATTED_FILENAME", 
              name: "Formatted Filename", 
              searchable: true, 
              orderable: true,
              render: (data: any, _type: any, row: any) => {
                // Display filename with optional link (matches CI3 line 146: '<a href="pdfpath">FORMATTED_FILENAME</a>')
                const filename = data || "-";
                const url = row?.FORMATTED_FILENAME_URL;
                
                // If we have a URL, show filename as clickable link
                if (url && url.startsWith("/api/viewfile")) {
                  const pdfUrl = getPdfUrl(url, "transcript");
                  if (pdfUrl) {
                    return (
                      <a 
                        href={pdfUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-brand-500 hover:text-brand-700 hover:underline inline-flex items-center gap-1" 
                        title="View PDF"
                      >
                        <FileIcon className="w-4 h-4" />
                        <span>{filename}</span>
                      </a>
                    );
                  }
                }
                // No link available - just show filename
                return <span>{filename}</span>;
              }
            },
            { data: "STUDENT_FULL_NAME", name: "Student Name", searchable: true, orderable: true },
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
            { data: "INSTITUTION_NAME", name: "Institution Name", searchable: true, orderable: true },
            { 
              data: "STATUS", 
              name: "Status", 
              searchable: true, 
              orderable: true,
              render: (data: any) => {
                if (!data) return "-";
                return <StatusBadge status={data} size="sm" />;
              }
            },
            { 
              data: "ARTICULATION_STATUS_FLAG", 
              name: "Articulation Status", 
              searchable: true, 
              orderable: true,
              render: (data: any) => {
                if (!data) return "-";
                return <StatusBadge status={data} size="sm" />;
              }
            },
            { data: "UPLOADED_BY", name: "Uploaded By", searchable: true, orderable: true },
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
            { data: "UPLOADED_DATETIME", name: "Uploaded Date", searchable: false, orderable: true },
            { data: "LAST_UPDATED_DATETIME", name: "Last Updated", searchable: false, orderable: true },
          ]}
        />
      </PageContainer>
    </PageWrapper>
  );
}



