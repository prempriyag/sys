import { useState } from "react";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../components/common/PageContainer";
import DataTable from "../../components/ui/DataTable";
import Button from "../../components/ui/button/Button";
import { API_ENDPOINTS } from "../../config/api";
import { RefreshIcon, FilterIcon } from "../../icons";
import { useAuth } from "../../context/AuthContext";

export default function TranscriptHdrData() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const { hasPermission } = useAuth();
  
  const [fieldType, setFieldType] = useState<string>("");
  const [fieldName, setFieldName] = useState<string>("");

  const hasUpdatePermission = hasPermission("college_transcript_header_data", "UPDATE");

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      console.log("Copied to clipboard:", text);
    });
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
        title="Transcript Header DATA | College Module"
        description="Transcript Header DATA"
      />
      <PageBreadcrumb pageTitle="Transcript Header DATA" />

      <PageContainer>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">
            Transcript Header DATA
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
          ajaxUrl={API_ENDPOINTS.TRANSCRIPT_HDR_DATA_LIST}
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
            { data: "INSTITUTION_NAME", name: "Institution Name", searchable: true, orderable: true },
            { data: "STUDENT_FULL_NAME", name: "Student Name", searchable: true, orderable: true },
            { data: "STUDENT_FIRST_NAME", name: "First Name", searchable: true, orderable: true },
            { data: "STUDENT_MIDDLE_NAME", name: "Middle Name", searchable: true, orderable: true },
            { data: "STUDENT_LAST_NAME", name: "Last Name", searchable: true, orderable: true },
            { data: "DATE_OF_BIRTH", name: "Date of Birth", searchable: false, orderable: false },
            { data: "SSN", name: "SSN", searchable: false, orderable: false },
            { data: "ADDRESS_LINE1", name: "Address Line 1", searchable: false, orderable: false },
            { data: "ADDRESS_LINE2", name: "Address Line 2", searchable: false, orderable: false },
            { data: "CITY", name: "City", searchable: false, orderable: false },
            { data: "STATE", name: "State", searchable: false, orderable: false },
            { data: "ZIPCODE", name: "Zipcode", searchable: false, orderable: false },
            { data: "DEGREE_CD", name: "Degree Code", searchable: false, orderable: false },
            { data: "DEGREE_RECEIVED_DATE", name: "Degree Received Date", searchable: false, orderable: false },
            { data: "CGPA", name: "CGPA", searchable: false, orderable: false },
            { data: "TOTAL_CREDITS_EARNED", name: "Total Credits Earned", searchable: false, orderable: false },
            { data: "TOTAL_CREDITS_ATTENDED", name: "Total Credits Attended", searchable: false, orderable: false },
            { data: "FOUND_IN_SLATE_YN", name: "Found in Slate", searchable: false, orderable: false },
            { data: "FOUND_IN_BANNER_YN", name: "Found in Banner", searchable: false, orderable: false },
            { data: "STD_SLATE_TERM", name: "STD Slate Term", searchable: false, orderable: false },
            { data: "OCR_MIN_START_TERM", name: "OCR Min Start Term", searchable: false, orderable: false },
            { data: "OCR_MAX_END_TERM", name: "OCR Max End Term", searchable: false, orderable: false },
            { data: "EFFECTIVE_TERM", name: "Effective Term", searchable: false, orderable: false },
            { data: "LEVEL", name: "Level", searchable: false, orderable: false },
            { data: "COMMENTS", name: "Comments", searchable: false, orderable: false },
            { data: "STATUS_FLAG", name: "Status Flag", searchable: false, orderable: false },
            { data: "FILE_PATH", name: "Formatted TRSC Filename", searchable: false, orderable: false },
            { data: "OCR_EXTRACTED_DATE", name: "OCR Extracted Date", searchable: false, orderable: true },
            { data: "OCR_START_TERM_DT", name: "OCR Start Term", searchable: false, orderable: false },
            { data: "OCR_END_TERM_DT", name: "OCR End Term", searchable: false, orderable: false },
          ]}
        />
      </PageContainer>
    </PageWrapper>
  );
}

