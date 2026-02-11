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

export default function TranscriptHdrOcr() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const { hasPermission } = useAuth();
  
  // Filter state
  const [fieldType, setFieldType] = useState<string>("");
  const [fieldName, setFieldName] = useState<string>("");

  const hasUpdatePermission = hasPermission("college_transcript_header_ocr", "UPDATE");

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

  // Build ajaxData object for DataTable
  const ajaxData: any = {};
  if (fieldType) ajaxData.fieldType = fieldType;
  if (fieldName) ajaxData.fieldName = fieldName;

  return (
    <PageWrapper>
      <PageMeta
        title="Transcript Header OCR | College Module"
        description="Transcript Header OCR data"
      />
      <PageBreadcrumb pageTitle="Transcript Header OCR" />

      <PageContainer>

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
                  <option value="CITY">City</option>
                  <option value="EXTERNAL_INSTITUTION_NAME">Institution Name</option>
                  <option value="STATE">State</option>
                  <option value="EXTERNAL_STUDENT_ID">Student ID</option>
                  <option value="STUDENT_FULL_NAME">Student Name</option>
                  <option value="STATUS_FLAG">Status Flag</option>
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
          toolbarActions={<><button onClick={() => setRefreshTrigger((prev) => prev + 1)} className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"><RefreshIcon className="w-4 h-4" /> Refresh</button><button onClick={() => setShowFilters(!showFilters)} className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"><FilterIcon className="w-4 h-4" /> Filter</button></>}
          ajaxUrl={API_ENDPOINTS.TRANSCRIPT_HDR_OCR_LIST}
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
            { data: "EXTERNAL_INSTITUTION_NAME", name: "Institution Name", searchable: true, orderable: true },
            { data: "STUDENT_FULL_NAME", name: "Student Name", searchable: true, orderable: true },
            { data: "DATE_OF_BIRTH", name: "Date of Birth", searchable: false, orderable: false },
            { data: "SSN", name: "SSN", searchable: false, orderable: false },
            { data: "ADDRESS_LINE1", name: "Address Line 1", searchable: false, orderable: false },
            { data: "ADDRESS_LINE2", name: "Address Line 2", searchable: false, orderable: false },
            { data: "CITY", name: "City", searchable: false, orderable: false },
            { data: "STATE", name: "State", searchable: false, orderable: false },
            { data: "ZIPCODE", name: "Zipcode", searchable: false, orderable: false },
            { data: "FILE_PATH", name: "Formatted TRSC Filename", searchable: false, orderable: false },
            { data: "OCR_EXTRACTED_DATE", name: "OCR Extracted Date", searchable: false, orderable: true },
            { data: "CGPA", name: "CGPA", searchable: false, orderable: false },
            { data: "DEGREE", name: "Degree", searchable: false, orderable: false },
            { data: "DEGREE_RECEIVED_DATE", name: "Degree Received Date", searchable: false, orderable: false },
            { data: "TOTAL_CREDITS_EARNED", name: "Total Credits Earned", searchable: false, orderable: false },
            { data: "TOTAL_CREDITS_ATTENDED", name: "Total Credits Attended", searchable: false, orderable: false },
            { 
              data: "STATUS_FLAG", 
              name: "Status Flag", 
              searchable: false, 
              orderable: false,
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

