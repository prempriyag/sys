import { useState } from "react";
import { Link } from "react-router";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../components/common/PageContainer";
import DataTable from "../../components/ui/DataTable";
import Button from "../../components/ui/button/Button";
import StatusBadge from "../../components/common/StatusBadge";
import { API_ENDPOINTS } from "../../config/api";
import { RefreshIcon, FilterIcon, CopyIcon } from "../../icons";
import { alertsuccess } from "../../utils/toast";

export default function SchoolHeaderData() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const [fieldType, setFieldType] = useState<string>("");
  const [fieldName, setFieldName] = useState<string>("");

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

  const ajaxData: Record<string, string> = {};
  if (fieldType) ajaxData.fieldType = fieldType;
  if (fieldName) ajaxData.fieldName = fieldName;

  return (
    <PageWrapper>
      <PageMeta
        title="School Header Data | OCR"
        description="School transcript header data for OCR verify"
      />
      <PageBreadcrumb pageTitle="School Header Data" />

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
                  <option value="STUDENT_ID">Student ID</option>
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
          ajaxUrl={API_ENDPOINTS.OCR_SCHOOL_HDR_AJAXLIST}
          ajaxData={ajaxData}
          columns={[
            {
              data: "BATCH_ID",
              name: "Batch ID",
              searchable: true,
              orderable: true,
              render: (data: string) => {
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
                    <Link
                      to={`/ocrverify/schoolhdrbatch?batch_id=${encodeURIComponent(data)}&verify=no`}
                      className="text-brand-500 hover:underline"
                    >
                      {data}
                    </Link>
                  </span>
                );
              },
            },
            {
              data: "STUDENT_ID",
              name: "Student ID",
              searchable: true,
              orderable: true,
              render: (data: string) => {
                if (!data) return "-";
                return (
                  <a 
                    href={`/school/studentview?student_id=${data}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-500 hover:underline"
                  >
                    {data}
                  </a>
                );
              },
            },
            { data: "INSTITUTION_NAME", name: "Institution Name", searchable: true, orderable: true },
            { data: "STUDENT_FULL_NAME", name: "Student Name", searchable: true, orderable: true },
            { data: "STUDENT_FIRST_NAME", name: "First Name", searchable: true, orderable: true },
            { data: "STUDENT_MIDDLE_NAME", name: "Middle Name", searchable: true, orderable: true },
            { data: "STUDENT_LAST_NAME", name: "Last Name", searchable: true, orderable: true },
            { data: "DATE_OF_BIRTH", name: "Date of Birth", searchable: false, orderable: false },
            { data: "SSN", name: "SSN", searchable: false, orderable: false },
            { data: "CITY", name: "City", searchable: false, orderable: false },
            { data: "STATE", name: "State", searchable: false, orderable: false },
            { data: "ZIPCODE", name: "Zipcode", searchable: false, orderable: false },
            { data: "CGPA", name: "CGPA", searchable: false, orderable: false },
            { data: "TOTAL_CREDITS_EARNED", name: "Total Credits Earned", searchable: false, orderable: false },
            {
              data: "STATUS_FLAG",
              name: "Status Flag",
              searchable: false,
              orderable: false,
              render: (data: string) => {
                if (!data) return "-";
                return <StatusBadge status={data} size="sm" />;
              },
            },
            { data: "OCR_EXTRACTED_DATE", name: "OCR Extracted Date", searchable: false, orderable: true },
          ]}
        />
      </PageContainer>
    </PageWrapper>
  );
}
