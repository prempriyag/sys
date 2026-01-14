import { useState } from "react";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../components/common/PageContainer";
import DataTable from "../../components/ui/DataTable";
import Button from "../../components/ui/button/Button";
import { API_ENDPOINTS, API_BASE_URL } from "../../config/api";
import { RefreshIcon, FilterIcon } from "../../icons";
import { useAuth } from "../../context/AuthContext";

export default function DigiScriptBotLog() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const { hasPermission } = useAuth();
  
  const [fieldType, setFieldType] = useState<string>("");
  const [fieldName, setFieldName] = useState<string>("");

  const hasUpdatePermission = hasPermission("college_digiscript_reports", "UPDATE");

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      console.log("Copied to clipboard:", text);
    });
  };

  const getPdfUrl = (filePath: string) => {
    if (!filePath) return "";
    const cleanPath = filePath.startsWith("/") ? filePath.substring(1) : filePath;
    return `${API_BASE_URL.replace("/api", "")}/transcripts/${cleanPath}`;
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
            { data: "STATUS_BDMS", name: "Status BDMS", searchable: false, orderable: false },
            { data: "STATUS_SOAPCOL", name: "Status SOAPCOL", searchable: false, orderable: false },
            { data: "STATUS_SAAADMS", name: "Status SAAADMS", searchable: false, orderable: false },
            { data: "STATUS_SOAHOLD", name: "Status SOAHOLD", searchable: false, orderable: false },
            { data: "STATUS_SLATE", name: "Status Slate", searchable: false, orderable: false },
            { data: "STATUS_SLATE_UPLOAD", name: "Status Slate Upload", searchable: false, orderable: false },
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
                if (!data && !row.BATCH_ID) return "-";
                const imageUrl = `/errorscreenshot/${row.BATCH_ID}`;
                return (
                  <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">
                    <i className="fa fa-eye me-1"></i>
                    View
                  </a>
                );
              }
            },
            { 
              data: "TRANSCRIPT_LINK", 
              name: "Transcript", 
              searchable: false, 
              orderable: false,
              render: (data: any) => {
                if (!data) return "-";
                const pdfUrl = getPdfUrl(data);
                if (!pdfUrl) return "-";
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

