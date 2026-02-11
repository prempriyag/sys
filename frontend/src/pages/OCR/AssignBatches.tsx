import { useState, useEffect } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageContainer, { PageWrapper } from "../../components/common/PageContainer";
import DataTable from "../../components/ui/DataTable";
import Button from "../../components/ui/button/Button";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Select from "../../components/form/Select";
import { api, API_ENDPOINTS, API_BASE_URL } from "../../config/api";
import { useToast } from "../../context/ToastContext";
import { RefreshIcon, TrashBinIcon } from "../../icons";
import ConfirmationModal from "../../components/common/ConfirmationModal";

interface Verifier {
  id: number;
  name: string;
  email: string;
}

export default function AssignBatches() {
  const { alertsuccess, alerterror } = useToast();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [verifiers, setVerifiers] = useState<Verifier[]>([]);
  const [sourceTypes, setSourceTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [selectedVerifier, setSelectedVerifier] = useState("");
  const [fromBatch, setFromBatch] = useState("");
  const [toBatch, setToBatch] = useState("");
  const [verificationSource, setVerificationSource] = useState("PORTAL");
  const [institutionType, setInstitutionType] = useState("college");
  const [sourceType, setSourceType] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Delete state
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Verifier filter for the table
  const [filterVerifier, setFilterVerifier] = useState("");

  // Fetch verifiers + source types on mount
  useEffect(() => {
    const fetchPageData = async () => {
      try {
        const response = await api.get(API_ENDPOINTS.OCR_ASSIGN_BATCHES);
        const data = response.data || response;
        setVerifiers(data.verifiers || []);
        setSourceTypes(data.source_types || []);
        if (data.source_types?.length > 0) {
          setSourceType(data.source_types[0]);
        }
      } catch (err) {
        console.error("Failed to load assign batches page data:", err);
      }
    };
    fetchPageData();
  }, []);

  // Handle form submit
  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedVerifier) {
      alerterror("Please select a verifier");
      return;
    }
    if (!fromBatch || isNaN(Number(fromBatch))) {
      alerterror("Please enter a valid From Batch ID");
      return;
    }
    if (!toBatch || isNaN(Number(toBatch))) {
      alerterror("Please enter a valid To Batch ID");
      return;
    }
    if (!sourceType) {
      alerterror("Please select a Source Type");
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post(API_ENDPOINTS.OCR_ASSIGN_BATCHES_SAVE, {
        user_name: selectedVerifier,
        from_batch_id: Number(fromBatch),
        to_batch_id: Number(toBatch),
        verification_source: verificationSource,
        INSTITUTION_TYPE: institutionType,
        SOURCE_TYPE: sourceType,
      });
      const data = response.data || response;
      if (data.success) {
        alertsuccess(data.message || "Batch assignment saved successfully");
        // Reset form
        setFromBatch("");
        setToBatch("");
        setRefreshTrigger((prev) => prev + 1);
      } else {
        alerterror(data.message || "Failed to save batch assignment");
      }
    } catch (err: any) {
      alerterror(
        err.response?.data?.detail ||
          err.response?.data?.message ||
          err.message ||
          "Failed to save batch assignment"
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setSelectedVerifier("");
    setFromBatch("");
    setToBatch("");
    setVerificationSource("PORTAL");
    setInstitutionType("college");
    if (sourceTypes.length > 0) {
      setSourceType(sourceTypes[0]);
    }
  };

  // Handle delete
  const handleDeleteClick = (id: number) => {
    setDeleteId(id);
    setShowDeleteConfirmModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const response = await api.post(API_ENDPOINTS.OCR_ASSIGN_BATCHES_DELETE, {
        id: deleteId,
      });
      const data = response.data || response;
      if (data.success) {
        alertsuccess(data.message || "Batch assignment deleted successfully");
        setRefreshTrigger((prev) => prev + 1);
      } else {
        alerterror(data.message || "Failed to delete batch assignment");
      }
    } catch (err: any) {
      alerterror(
        err.response?.data?.detail || err.message || "Failed to delete"
      );
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirmModal(false);
      setDeleteId(null);
    }
  };

  // When verifier dropdown changes, also filter the table
  const handleVerifierChange = (value: string) => {
    setSelectedVerifier(value);
    setFilterVerifier(value);
    setRefreshTrigger((prev) => prev + 1);
  };

  // Build verifier options for Select
  const verifierOptions = [
    { value: "", label: "Select Verifier" },
    ...verifiers.map((v) => ({ value: String(v.id), label: v.name })),
  ];

  const verificationSourceOptions = [
    { value: "PORTAL", label: "PORTAL" },
    { value: "ABBYY", label: "ABBYY" },
  ];

  const institutionTypeOptions = [
    { value: "college", label: "College" },
    { value: "high_school", label: "High School" },
  ];

  const sourceTypeOptions = sourceTypes.map((s) => ({
    value: s,
    label: s.toUpperCase(),
  }));

  return (
    <PageWrapper>
      <PageMeta
        title="Assign Batches | OCR"
        description="From-To Assign Batches to Verifiers"
      />
      <PageBreadcrumb pageTitle="Assign Batches to Verifier" />

      <PageContainer>
        {/* Assign Form */}
        <form onSubmit={handleAssign}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-2">
            {/* Verifiers */}
            <div>
              <Label htmlFor="verifier">
                Verifiers<span className="text-red-500">*</span>
              </Label>
              <Select
                options={verifierOptions}
                onChange={handleVerifierChange}
                defaultValue={selectedVerifier}
                className="mt-1"
              />
            </div>

            {/* From Batch */}
            <div>
              <Label htmlFor="from_batch">
                From Batch<span className="text-red-500">*</span>
              </Label>
              <Input
                type="text"
                id="from_batch"
                placeholder="Enter From Batch Id"
                value={fromBatch}
                onChange={(e) => setFromBatch(e.target.value)}
              />
            </div>

            {/* To Batch */}
            <div>
              <Label htmlFor="to_batch">
                To Batch<span className="text-red-500">*</span>
              </Label>
              <Input
                type="text"
                id="to_batch"
                placeholder="Enter To Batch Id"
                value={toBatch}
                onChange={(e) => setToBatch(e.target.value)}
              />
            </div>

            {/* Verification Source */}
            <div>
              <Label htmlFor="verification_source">Verification Source</Label>
              <Select
                options={verificationSourceOptions}
                onChange={setVerificationSource}
                defaultValue={verificationSource}
                className="mt-1"
              />
            </div>

            {/* Institution Type */}
            <div>
              <Label htmlFor="institution_type">Institution Type</Label>
              <Select
                options={institutionTypeOptions}
                onChange={setInstitutionType}
                defaultValue={institutionType}
                className="mt-1"
              />
            </div>

            {/* Source Type */}
            <div>
              <Label htmlFor="source_type">Source Type</Label>
              {sourceTypeOptions.length > 0 ? (
                <Select
                  options={sourceTypeOptions}
                  onChange={setSourceType}
                  defaultValue={sourceType}
                  className="mt-1"
                />
              ) : (
                <Input
                  type="text"
                  id="source_type"
                  placeholder="Source Type"
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value)}
                />
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3 mt-4 mb-6">
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Assigning..." : "Assign"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleCancel}
            >
              Cancel
            </Button>
          </div>
        </form>

        {/* Batch Assign Table */}
        <h5 className="font-semibold text-gray-800 dark:text-white/90 text-lg mb-3">
          Batch Assign
        </h5>

        <DataTable
          refreshTrigger={refreshTrigger}
          toolbarActions={
            <button
              onClick={() => setRefreshTrigger((prev) => prev + 1)}
              className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
            >
              <RefreshIcon className="w-4 h-4" /> Refresh
            </button>
          }
          columns={[
            {
              data: "from_batch_id",
              name: "From Batch",
              searchable: true,
              orderable: true,
              width: "120px",
            },
            {
              data: "to_batch_id",
              name: "To Batch",
              searchable: true,
              orderable: true,
              width: "120px",
            },
            {
              data: "username",
              name: "Verifier",
              searchable: true,
              orderable: true,
              width: "160px",
            },
            {
              data: "verification_source",
              name: "Verification Source",
              searchable: true,
              orderable: true,
              width: "150px",
            },
            {
              data: "INSTITUTION_TYPE",
              name: "Institution Type",
              searchable: true,
              orderable: true,
              width: "140px",
            },
            {
              data: "SOURCE_TYPE",
              name: "Source Type",
              searchable: true,
              orderable: true,
              width: "120px",
            },
            {
              data: "created_time",
              name: "Created on",
              searchable: false,
              orderable: true,
              width: "160px",
            },
            {
              data: "id",
              name: "Action",
              searchable: false,
              orderable: false,
              width: "80px",
              render: (data: any) => {
                const recordId = typeof data === "object" ? data?.id : data;
                if (!recordId) return null;
                return (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(Number(recordId));
                    }}
                    className="text-red-500 hover:text-red-600 dark:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <TrashBinIcon className="w-5 h-5" />
                  </button>
                );
              },
            },
          ]}
          ajaxUrl={`${API_BASE_URL}${API_ENDPOINTS.OCR_ASSIGN_BATCHES_AJAXLIST}`}
          ajaxMethod="POST"
          ajaxData={filterVerifier ? { verifierid: filterVerifier } : undefined}
          pageLength={10}
          lengthMenu={[10, 50, 100, 200]}
        />
      </PageContainer>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirmModal}
        onClose={() => {
          if (!isDeleting) {
            setShowDeleteConfirmModal(false);
            setDeleteId(null);
          }
        }}
        onConfirm={handleDeleteConfirm}
        title="Confirm Delete"
        message="Do you want to delete this batch assignment?"
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="danger"
        isLoading={isDeleting}
      />
    </PageWrapper>
  );
}
