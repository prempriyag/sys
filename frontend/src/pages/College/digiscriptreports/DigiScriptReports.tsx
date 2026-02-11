import { useState } from "react";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../../components/common/PageContainer";
import DataTable from "../../../components/ui/DataTable";
import Button from "../../../components/ui/button/Button";
import StatusBadge from "../../../components/common/StatusBadge";
import { API_ENDPOINTS, API_BASE_URL } from "../../../config/api";
import { RefreshIcon, FilterIcon, CopyIcon } from "../../../icons";
import { useAuth } from "../../../context/AuthContext";
import { alertsuccess } from "../../../utils/toast";

export default function DigiScriptReports() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const { hasPermission } = useAuth();
  
  // Filter state
  const [studentId, setStudentId] = useState<string>("");
  const [studentName, setStudentName] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Check if user has update permission
  const hasUpdatePermission = hasPermission("college_digiscript_reports", "UPDATE");

  // Helper function to copy text to clipboard (handles string, number, Batch ID, Institution ID, etc.)
  const copyToClipboard = (text: string | number) => {
    const str = String(text ?? "").trim();
    if (!str) return;
    navigator.clipboard.writeText(str).then(() => {
      alertsuccess("Copied to clipboard!");
    }).catch(() => console.error("Failed to copy"));
  };

  // Helper function to generate PDF URL
  const getPdfUrl = (filePath: string) => {
    if (!filePath) return "";
    const cleanPath = filePath.startsWith("/") ? filePath.substring(1) : filePath;
    return `${API_BASE_URL.replace("/api", "")}/transcripts/${cleanPath}`;
  };

  // Clear all filters
  const clearFilters = () => {
    setStudentId("");
    setStudentName("");
    setFromDate("");
    setToDate("");
  };

  // Build ajaxData object for DataTable
  const ajaxData: any = {};
  if (studentId) ajaxData.STUDENT_ID = studentId;
  if (studentName) ajaxData.STUDENT_FULL_NAME = studentName;
  if (fromDate) ajaxData.fromDate = fromDate;
  if (toDate) ajaxData.toDate = toDate;

  return (
    <PageWrapper>
      <PageMeta
        title="DigiScript Reports | College Module"
        description="DigiScript reports and management"
      />
      <PageBreadcrumb pageTitle="DigiScript Reports" />

      <PageContainer>

        {/* Filters Section */}
        {showFilters && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Student ID
                </label>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="Enter Student ID"
                  className="relative w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Student Name
                </label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Enter Student Name"
                  className="relative w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                />
              </div>
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

        {/* DigiScript DataTable */}
        <DataTable
          refreshTrigger={refreshTrigger}
          toolbarActions={<><button onClick={() => setRefreshTrigger((prev) => prev + 1)} className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"><RefreshIcon className="w-4 h-4" /> Refresh</button><button onClick={() => setShowFilters(!showFilters)} className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"><FilterIcon className="w-4 h-4" /> Filter</button></>}
          ajaxUrl={API_ENDPOINTS.DIGISCRIPT_REPORTS_LIST}
          ajaxData={ajaxData}
          columns={[
            { data: "INSTITUTION_NAME", name: "College Name", searchable: true, orderable: true, width: "180px" },
            { 
              data: "INSTITUTION_ID", 
              name: "Institution ID", 
              searchable: true, 
              orderable: true,
              width: "120px",
              render: (data: any) => {
                if (!data) return "-";
                return (
                  <span 
                    className="cursor-pointer hover:text-brand-500 inline-flex items-center" 
                    onClick={() => copyToClipboard(data)}
                    title="Click to copy"
                  >
                    <CopyIcon className="w-4 h-4 me-1" />
                    {data}
                  </span>
                );
              }
            },
            { 
              data: "STUDENT_ID", 
              name: "Student ID", 
              searchable: true, 
              orderable: true,
              width: "120px",
              render: (data: any) => {
                if (!data) return "-";
                if (hasUpdatePermission) {
                  return (
                    <span 
                      className="cursor-pointer hover:text-brand-500 inline-flex items-center" 
                      onClick={() => copyToClipboard(data)}
                      title="Click to copy"
                    >
                      <CopyIcon className="w-4 h-4 me-1" />
                      {data}
                    </span>
                  );
                }
                return <span>{data}</span>;
              }
            },
            { data: "STUDENT_FULL_NAME", name: "Student Name", searchable: true, orderable: true, width: "180px" },
            { 
              data: "BATCH_ID", 
              name: "Batch ID", 
              searchable: true, 
              orderable: true,
              width: "120px",
              render: (data: any) => {
                if (!data) return "-";
                return (
                  <span className="inline-flex items-center whitespace-nowrap">
                    <span 
                      className="cursor-pointer hover:text-brand-500 flex-shrink-0 me-1" 
                      onClick={() => copyToClipboard(data)}
                      title="Click to copy"
                    >
                      <CopyIcon className="w-4 h-4" />
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
              data: "FILE_PATH", 
              name: "Transcript", 
              searchable: false, 
              orderable: false,
              width: "100px",
              render: (data: any) => {
                if (!data) return "-";
                const pdfUrl = getPdfUrl(data);
                if (!pdfUrl) return "-";
                return (
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">
                    View PDF
                  </a>
                );
              }
            },
            { 
              data: "TRANSFER_LETTER_FILE_LINK", 
              name: "Transfer Letter", 
              searchable: false, 
              orderable: false,
              width: "120px",
              render: (data: any) => {
                if (!data) return "-";
                const pdfUrl = data && getPdfUrl(data);
                if (!pdfUrl) return "-";
                return (
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">
                    Link
                  </a>
                );
              }
            },
            { data: "LETTER_SENT_DATE", name: "Letter Sent Date", searchable: false, orderable: false, width: "120px", render: (data: any) => data || "-" },
            { 
              data: "FOUND_IN_BANNER_YN", 
              name: "Banner Status", 
              searchable: false, 
              orderable: false,
              width: "100px",
              render: (data: any) => {
                if (!data) return "-";
                return <StatusBadge status={data} size="sm" />;
              }
            },
            { data: "DEGREE_CD", name: "Degree", searchable: false, orderable: false, width: "80px", render: (data: any) => data || "-" },
            { data: "DEGREE_RECEIVED_DATE", name: "Degree Date", searchable: false, orderable: false, width: "110px", render: (data: any) => data || "-" },
            { data: "SECOND_DEGREE_CD", name: "Second Degree", searchable: false, orderable: false, width: "110px", render: (data: any) => data || "-" },
            { data: "SECOND_DEGREE_RECEIVED_DATE", name: "Second Degree Date", searchable: false, orderable: false, width: "130px", render: (data: any) => data || "-" },
            { data: "EFFECTIVE_TERM", name: "Effective Term", searchable: false, orderable: false, width: "110px", render: (data: any) => data || "-" },
            { data: "OCR_MIN_START_TERM", name: "Start Term", searchable: false, orderable: false, width: "100px", render: (data: any) => data || "-" },
            { data: "OCR_MAX_END_TERM", name: "End Term", searchable: false, orderable: false, width: "100px", render: (data: any) => data || "-" },
            { data: "LEVEL", name: "Level", searchable: false, orderable: false, width: "70px", render: (data: any) => data || "-" },
            { data: "COMMENTS", name: "Comments", searchable: false, orderable: false, width: "300px", render: (data: any) => data || "-" },
            { data: "OCR_EXTRACTED_DATE", name: "OCR Date", searchable: false, orderable: true, width: "120px", render: (data: any) => data || "-" },
            { 
              data: "STATUS_FLAG", 
              name: "Status", 
              searchable: false, 
              orderable: false,
              width: "100px",
              render: (data: any) => {
                if (!data) return "-";
                return <StatusBadge status={data} size="sm" />;
              }
            },
          ]}
        />
      </PageContainer>
    </PageWrapper>
  );
}



