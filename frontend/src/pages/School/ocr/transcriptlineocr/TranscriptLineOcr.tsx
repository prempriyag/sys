import { useState } from "react";
import PageBreadcrumb from "../../../../components/common/PageBreadCrumb";
import PageMeta from "../../../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../../../components/common/PageContainer";
import DataTable from "../../../../components/ui/DataTable";
import Button from "../../../../components/ui/button/Button";
import StatusBadge from "../../../../components/common/StatusBadge";
import { API_ENDPOINTS } from "../../../../config/api";
import { RefreshIcon, FilterIcon, CopyIcon } from "../../../../icons";
import { useAuth } from "../../../../context/AuthContext";
import { alertsuccess } from "../../../../utils/toast";

export default function TranscriptLineOcr() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const { hasPermission } = useAuth();
  
  const [fieldType, setFieldType] = useState<string>("");
  const [fieldName, setFieldName] = useState<string>("");

  const hasUpdatePermission = hasPermission("college_transcript_line_ocr", "UPDATE");

  const copyToClipboard = (text: string | number) => {
    const str = String(text ?? "").trim();
    if (!str) return;
    navigator.clipboard.writeText(str).then(() => {
      alertsuccess("Copied to clipboard!");
    }).catch(() => console.error("Failed to copy"));
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
        title="Transcript Line OCR | College Module"
        description="Transcript Line OCR data"
      />
      <PageBreadcrumb pageTitle="Transcript Line OCR" />

      <PageContainer>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">
            Transcript Line OCR
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
                  <option value="BATCH_ID">Batch ID</option>
                  <option value="END_TERM">End Term</option>
                  <option value="START_TERM">Start Term</option>
                  <option value="STATUS_FLAG">Status Flag</option>
                  <option value="SUBJECT">Subject</option>
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
          ajaxUrl={API_ENDPOINTS.TRANSCRIPT_LINE_OCR_LIST}
          ajaxData={ajaxData}
          columns={[
            { 
              data: "BATCH_ID", 
              name: "Batch ID", 
              searchable: true, 
              orderable: true,
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
            { data: "START_TERM", name: "Start Term", searchable: true, orderable: true },
            { data: "END_TERM", name: "End Term", searchable: true, orderable: true },
            { data: "SUBJECT", name: "Subject", searchable: true, orderable: true },
            { data: "COURSE_ID", name: "Course Id", searchable: true, orderable: true },
            { data: "COURSE_TITLE", name: "Course Title", searchable: true, orderable: true },
            { data: "CREDIT_HOURS_EARNED", name: "Credit Hours Earned", searchable: true, orderable: true },
            { data: "GRADE", name: "Grade", searchable: true, orderable: true },
            { 
              data: "STATUS_FLAG", 
              name: "Status Flag", 
              searchable: true, 
              orderable: true,
              render: (data: any) => {
                if (!data) return "-";
                return <StatusBadge status={data} size="sm" />;
              }
            },
            { data: "PAGE_NBR", name: "Page NBR", searchable: true, orderable: true },
            { data: "AUTO_SEQNO", name: "Auto SEQ No", searchable: true, orderable: true },
          ]}
        />
      </PageContainer>
    </PageWrapper>
  );
}

