import { useState } from "react";
import { useSearchParams } from "react-router";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../components/common/PageContainer";
import DataTable from "../../components/ui/DataTable";
import Button from "../../components/ui/button/Button";
import { API_ENDPOINTS, API_BASE_URL } from "../../config/api";
import { RefreshIcon, FilterIcon } from "../../icons";

export default function ArticulationReports() {
  const [searchParams] = useSearchParams();
  const type = searchParams.get("type") || "";
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const getPageTitle = () => {
    if (type === "Failed") {
      return "Articulation Kickouts";
    } else if (type === "Phase_2") {
      return "Articulation Phase-2 Kickouts";
    } else if (type) {
      return `Articulation - ${type.charAt(0).toUpperCase() + type.slice(1)}`;
    }
    return "Articulation Reports";
  };

  const pageTitle = getPageTitle();

  return (
    <PageWrapper>
      <PageMeta
        title={`${pageTitle} | College Module`}
        description="Articulation reports and management"
      />
      <PageBreadcrumb pageTitle={pageTitle} />

      <PageContainer>
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">
            {pageTitle}
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

        {/* Filters Section */}
        {showFilters && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Filter Type
                </label>
                <select
                  id="field_type"
                  className="relative w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                >
                  <option value="">Select Option</option>
                  <option value="BATCH_ID">Batch ID</option>
                  <option value="COLLEGE_ID">Institution ID</option>
                  <option value="COLLEGE_NAME">College Name</option>
                  <option value="STUDENT_ID">Student ID</option>
                  <option value="ARTICULATION_STATUS_FLAG">Articulation Status</option>
                  {type !== "Processed" && <option value="ERROR_REASON">Error Reason</option>}
                  <option value="UPDATED_DATE">Updated Date</option>
                  <option value="UPDATED_BY">Updated By</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Filter Value
                </label>
                <input
                  id="field_name"
                  type="text"
                  className="relative w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                  placeholder="Enter value"
                />
              </div>
              <div className="flex items-end gap-2">
                <Button variant="outline" onClick={() => setShowFilters(false)}>
                  Clear
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Articulation DataTable */}
        <DataTable
          refreshTrigger={refreshTrigger}
          columns={[
            { data: "INSTITUTION_NAME", name: "College Name", searchable: true, orderable: true },
            { data: "INSTITUTION_ID", name: "Institution ID", searchable: true, orderable: true },
            { data: "STUDENT_ID", name: "Student ID", searchable: true, orderable: true },
            { data: "STUDENT_FULL_NAME", name: "Student Name", searchable: true, orderable: true },
            { data: "BATCH_ID", name: "Batch ID", searchable: true, orderable: true },
            { data: "STATUS_BANNER_ARTICULATION", name: "Status Banner Articulation", searchable: false, orderable: false },
            { data: "LEVEL", name: "Level", searchable: false, orderable: false },
            { data: "ATTENDANCE_PERIOD", name: "Attendance Period", searchable: false, orderable: false },
            { data: "TERM", name: "Term", searchable: false, orderable: false },
            { data: "SUBJECT", name: "Subject", searchable: false, orderable: false },
            { data: "COURSE_ID", name: "Course ID", searchable: false, orderable: false },
            { data: "COURSE_TITLE", name: "Course Title", searchable: false, orderable: false },
            { data: "CREDIT_HOURS_EARNED", name: "Credits", searchable: false, orderable: false },
            { data: "GRADE", name: "Grade", searchable: false, orderable: false },
            { data: "ARTICULATION_INDICATOR", name: "Articulation Indicator", searchable: false, orderable: false },
            { data: "TRANSFER_DUPLICATE", name: "Transfer Duplicate", searchable: false, orderable: false },
            { data: "EQV_SUBJECT", name: "Equivalent Subject", searchable: false, orderable: false },
            { data: "EQV_COURSE_ID", name: "Equivalent Course ID", searchable: false, orderable: false },
            { data: "EQV_CREDIT_HOURS_EARNED", name: "Equivalent Credits", searchable: false, orderable: false },
            { data: "EQV_GRADE", name: "Equivalent Grade", searchable: false, orderable: false },
            { data: "INCLUDE_EXCLUDE", name: "Include/Exclude", searchable: false, orderable: false },
            { data: "EQV_REPEAT_SYSTEM", name: "Equivalent Repeat System", searchable: false, orderable: false },
            { data: "EQV_COUNT_IN_GPA", name: "Equivalent Count In GPA", searchable: false, orderable: false },
            { data: "EQV_COURSE_TITLE", name: "Equivalent Course Title", searchable: false, orderable: false },
            ...(type !== "Processed" ? [
              { data: "ERROR_REASON", name: "Error Reason / Action", searchable: false, orderable: false },
              { data: "ERROR_SCREENSHOT", name: "Error Screenshot", searchable: false, orderable: false },
              { data: "TRANSCRIPT_LINK", name: "Transcript", searchable: false, orderable: false },
            ] : []),
            { data: "ARTICULATION_STATUS_FLAG", name: type === "Failed" || type === "Phase_2" ? "Reprocess Articulation?" : "Articulation Status", searchable: false, orderable: false },
            { data: "USER_COMMENTS", name: "Comments", searchable: false, orderable: false },
            { data: "LAST_UPDATED_DATETIME", name: "Updated On", searchable: false, orderable: true },
            { data: "UPDATED_BY", name: "Updated By", searchable: true, orderable: true },
          ]}
          ajaxUrl={`${API_BASE_URL}${API_ENDPOINTS.ARTICULATION_REPORTS_LIST}`}
          ajaxMethod="POST"
          pageLength={10}
          lengthMenu={[10, 50, 100, 200]}
          exportFileName="Articulation-DigiScript"
        />
      </PageContainer>
    </PageWrapper>
  );
}

