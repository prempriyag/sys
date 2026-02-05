import { useState } from "react";
import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageContainer, { PageWrapper } from "../../components/common/PageContainer";
import DataTable from "../../components/ui/DataTable";
import Button from "../../components/ui/button/Button";
import { API_ENDPOINTS, api } from "../../config/api";
import { RefreshIcon, CopyIcon } from "../../icons";
import { useAuth } from "../../context/AuthContext";
import StatusBadge from "../../components/common/StatusBadge";
import { alertsuccess } from "../../utils/toast";

const STATUS_OPTIONS = [
  { value: "", label: "Select Option" },
  { value: "All", label: "All" },
  { value: "VERIFIED", label: "VERIFIED" },
  { value: "TOBEVERIFIED", label: "TOBEVERIFIED" },
  { value: "RECONFIRM", label: "RECONFIRM" },
  { value: "TOBEREVIEWEDBYOSUOKC", label: "To Be Reviewed By OSU-OKC" },
];

export default function SchoolAssignedBatches() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [fieldType, setFieldType] = useState("");
  const [username, setUsername] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [fromdate, setFromdate] = useState("");
  const [todate, setTodate] = useState("");
  const [reassignUser, setReassignUser] = useState("");
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(new Set());
  const { hasPermission } = useAuth();
  const canReassign = hasPermission("school_ocr_data", "update");

  // Helper function to copy text to clipboard
  const copyToClipboard = (text: string | number) => {
    const str = String(text ?? "").trim();
    if (!str) return;
    navigator.clipboard.writeText(str).then(() => {
      alertsuccess("Copied to clipboard!");
    }).catch(() => console.error("Failed to copy"));
  };

  const ajaxData: Record<string, string> = {};
  if (fieldType) ajaxData.fieldType = fieldType;
  if (username) ajaxData.username = username;
  if (institutionName) ajaxData.institution_name = institutionName;
  if (fromdate) ajaxData.fromdate = fromdate;
  if (todate) ajaxData.todate = todate;

  const handleClearFilters = () => {
    setFieldType("");
    setUsername("");
    setInstitutionName("");
    setFromdate("");
    setTodate("");
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleReassign = async () => {
    if (!reassignUser || selectedBatchIds.size === 0) {
      alert("Please select a verifier and at least one Batch ID.");
      return;
    }
    try {
      await api.post(API_ENDPOINTS.OCR_SCHOOL_OCR_REASSIGN_VERIFIER, {
        reassign_user: reassignUser,
        batchs_list: Array.from(selectedBatchIds),
      });
      setSelectedBatchIds(new Set());
      setRefreshTrigger((prev) => prev + 1);
    } catch {
      alert("Failed to reassign.");
    }
  };

  return (
    <PageWrapper>
      <PageMeta title="School Assigned Batches | OCR" description="School OCR batches assigned to verifiers" />
      <PageBreadcrumb pageTitle="School Assigned Batches" />

      <PageContainer>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">
            School Assigned Batches
          </h3>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setRefreshTrigger((prev) => prev + 1)}
              variant="outline"
              startIcon={<RefreshIcon className="w-5 h-5" />}
            >
              Refresh Data
            </Button>
            <Button onClick={() => setShowFilters(!showFilters)} variant="outline">
              {showFilters ? "Hide Filters" : "Filters"}
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Verifiers</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Verifier"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Institution Type</label>
                <input
                  type="text"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  placeholder="Institution"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Status Flag</label>
                <select
                  value={fieldType}
                  onChange={(e) => setFieldType(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value || "empty"} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">From Date</label>
                <input
                  type="date"
                  value={fromdate}
                  onChange={(e) => setFromdate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">To Date</label>
                <input
                  type="date"
                  value={todate}
                  onChange={(e) => setTodate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </div>
              <div className="flex items-end gap-2">
                <Button variant="outline" onClick={() => setRefreshTrigger((prev) => prev + 1)}>Apply</Button>
                <Button variant="outline" onClick={handleClearFilters}>Clear</Button>
              </div>
            </div>
          </div>
        )}

        {canReassign && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Re-Assign to verifier</label>
            <input
              type="text"
              value={reassignUser}
              onChange={(e) => setReassignUser(e.target.value)}
              placeholder="Verifier email"
              className="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white w-48"
            />
            <Button onClick={handleReassign} variant="primary" className="!py-2">
              Re-Assign
            </Button>
            {selectedBatchIds.size > 0 && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {selectedBatchIds.size} batch(es) selected
              </span>
            )}
          </div>
        )}

        <DataTable
          refreshTrigger={refreshTrigger}
          ajaxUrl={API_ENDPOINTS.OCR_SCHOOL_OCR_AJAX_VERIFIER_BATCH_LIST}
          ajaxData={ajaxData}
          columns={[
            ...(canReassign
              ? [{
                  data: "BATCH_ID",
                  name: "",
                  searchable: false,
                  orderable: false,
                  render: (_data: string, row: { BATCH_ID?: string }) => (
                    <input
                      type="checkbox"
                      className="reassign_user_check"
                      checked={selectedBatchIds.has(row?.BATCH_ID ?? "")}
                      onChange={(e) => {
                        const id = row?.BATCH_ID ?? "";
                        setSelectedBatchIds((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(id);
                          else next.delete(id);
                          return next;
                        });
                      }}
                    />
                  ),
                }]
              : []),
            {
              data: "BATCH_ID",
              name: "Batch ID",
              searchable: true,
              orderable: true,
              render: (data: string) =>
                data ? (
                  <span className="inline-flex items-center whitespace-nowrap">
                    <span 
                      className="cursor-pointer hover:text-brand-500 flex-shrink-0 me-1" 
                      onClick={() => copyToClipboard(data)}
                      title="Click to copy"
                    >
                      <CopyIcon className="w-4 h-4" />
                    </span>
                    <Link
                      to={`/ocrverify/schoolocrbatch?batch_id=${encodeURIComponent(data)}&verify=no`}
                      className="text-brand-500 hover:underline"
                    >
                      {data}
                    </Link>
                  </span>
                ) : (
                  "-"
                ),
            },
            { data: "VERIFIER_NAME", name: "Assigned By", searchable: true, orderable: true },
            { data: "USERNAME", name: "Verifier", searchable: true, orderable: true },
            {
              data: "STATUS_FLAG",
              name: "Status Flag",
              searchable: false,
              orderable: true,
              render: (data: string) => (data ? <StatusBadge status={data} size="sm" /> : "-"),
            },
            { data: "INSTITUTION_TYPE", name: "Institution", searchable: true, orderable: true },
            { data: "OCR_EXTRACTED_DATE", name: "Created On", searchable: false, orderable: true },
          ]}
        />
      </PageContainer>
    </PageWrapper>
  );
}
