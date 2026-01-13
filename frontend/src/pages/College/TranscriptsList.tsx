import { useState } from "react";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../components/common/PageContainer";
import DataTable from "../../components/ui/DataTable";
import Button from "../../components/ui/button/Button";
import { API_ENDPOINTS, API_BASE_URL } from "../../config/api";
import { RefreshIcon, FilterIcon } from "../../icons";

export default function TranscriptsList() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  return (
    <PageWrapper>
      <PageMeta
        title="Uploaded Transcripts | College Module"
        description="View and manage uploaded transcripts"
      />
      <PageBreadcrumb pageTitle="Uploaded Transcripts" />

      <PageContainer>
        {/* Header */}
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
                  <option value="SOURCE_TYPE">Source Type</option>
                  <option value="STATUS">Transcript Status</option>
                  <option value="ARTICULATION_STATUS_FLAG">Articulation Status</option>
                  <option value="UPLOADED_BY">Uploaded By</option>
                  <option value="UPLOADED_DATETIME">Uploaded Date</option>
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

        {/* Transcripts DataTable */}
        <DataTable
          refreshTrigger={refreshTrigger}
          columns={[
            { data: "SOURCE_TYPE", name: "Source Type", searchable: true, orderable: true },
            { data: "FILENAME", name: "File Name", searchable: true, orderable: true },
            { data: "FORMATTED_FILENAME", name: "Formatted Filename", searchable: true, orderable: true },
            { data: "STUDENT_FULL_NAME", name: "Student Name", searchable: true, orderable: true },
            { data: "STUDENT_ID", name: "Student ID", searchable: true, orderable: true },
            { data: "INSTITUTION_NAME", name: "College Name", searchable: true, orderable: true },
            { data: "STATUS", name: "Transcript Status", searchable: true, orderable: true },
            { data: "ARTICULATION_STATUS_FLAG", name: "Articulation Status", searchable: true, orderable: true },
            { data: "UPLOADED_DATETIME", name: "Uploaded Date", searchable: false, orderable: true },
            { data: "UPLOADED_BY", name: "Uploaded By", searchable: true, orderable: true },
            { data: "BATCH_ID", name: "Batch ID", searchable: true, orderable: true },
          ]}
          ajaxUrl={`${API_BASE_URL}${API_ENDPOINTS.TRANSCRIPTS_LIST}`}
          ajaxMethod="POST"
          pageLength={10}
          lengthMenu={[10, 50, 100, 200]}
          exportFileName="Uploaded-Transcripts"
        />
      </PageContainer>
    </PageWrapper>
  );
}

