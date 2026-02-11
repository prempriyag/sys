import { useState } from "react";
import PageBreadcrumb from "../../../../components/common/PageBreadCrumb";
import PageMeta from "../../../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../../../components/common/PageContainer";
import DataTable from "../../../../components/ui/DataTable";
import Button from "../../../../components/ui/button/Button";
import { Modal } from "../../../../components/ui/modal";
import Input from "../../../../components/form/input/InputField";
import Label from "../../../../components/form/Label";
import { api } from "../../../../config/api";
import { RefreshIcon, PlusIcon, PencilIcon, TrashBinIcon, CopyIcon } from "../../../../icons";
import { useAuth } from "../../../../context/AuthContext";
import ConfirmationModal from "../../../../components/common/ConfirmationModal";
import { alertsuccess, alerterror } from "../../../../utils/toast";

export default function AccreditedInstitution() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { hasPermission } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [institutionToDelete, setInstitutionToDelete] = useState<number | null>(null);
  const [formData, setFormData] = useState({ INSTITUTION_ID: "", EFFECTIVE_START_TERM: "", EFFECTIVE_END_TERM: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const hasAddPermission = hasPermission("accredited_institution", "ADD");
  const hasUpdatePermission = hasPermission("accredited_institution", "UPDATE");
  const hasDeletePermission = hasPermission("accredited_institution", "DELETE");

  // Helper function to copy text to clipboard
  const copyToClipboard = (text: string | number) => {
    const str = String(text ?? "").trim();
    if (!str) return;
    navigator.clipboard.writeText(str).then(() => {
      alertsuccess("Copied to clipboard!");
    }).catch(() => console.error("Failed to copy"));
  };

  const handleAdd = () => {
    setFormData({ INSTITUTION_ID: "", EFFECTIVE_START_TERM: "", EFFECTIVE_END_TERM: "" });
    setErrors({});
    setShowAddModal(true);
  };

  const handleEdit = async (id: number) => {
    try {
      const response = await api.post("/api/accreditedinstitution/get", { id });
      const data = response;
      if (data.Id) {
        setFormData({
          INSTITUTION_ID: data.INSTITUTION_ID || "",
          EFFECTIVE_START_TERM: data.EFFECTIVE_START_TERM || "",
          EFFECTIVE_END_TERM: data.EFFECTIVE_END_TERM || ""
        });
        setErrors({});
        setEditingId(data.Id);
        setShowEditModal(true);
      }
    } catch (error: any) {
      alerterror(error.response?.data?.detail || error.message || "Error loading accredited institution data");
    }
  };

  const handleDeleteClick = (id: number) => {
    setInstitutionToDelete(id);
    setShowDeleteConfirmModal(true);
  };

  const handleDelete = async () => {
    if (!institutionToDelete) return;

    setIsDeleting(true);
    try {
      const response = await api.post("/api/accreditedinstitution/delete", { id: institutionToDelete });
      
      const success = response.status === 1 || response.success || response.status === "Success" || response.message?.toLowerCase().includes("success");
      const messageText = response.message || "Accredited institution deleted successfully";

      if (success) {
        alertsuccess(messageText);
        setRefreshTrigger((prev) => prev + 1);
        setShowDeleteConfirmModal(false);
        setInstitutionToDelete(null);
      } else {
        alerterror(messageText);
        setShowDeleteConfirmModal(false);
        setInstitutionToDelete(null);
      }
    } catch (error: any) {
      console.error("Delete accredited institution error:", error);
      alerterror(error.response?.data?.detail || error.message || "Error deleting accredited institution");
      setShowDeleteConfirmModal(false);
      setInstitutionToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Field validation
  const validateField = (name: string, value: string): string => {
    switch (name) {
      case "INSTITUTION_ID":
        if (!value || value.trim() === "") {
          return "Institution ID is required";
        }
        return "";
      case "EFFECTIVE_START_TERM":
        if (!value || value.trim() === "") {
          return "Effective Start Term is required";
        }
        return "";
      case "EFFECTIVE_END_TERM":
        if (!value || value.trim() === "") {
          return "Effective End Term is required";
        }
        return "";
      default:
        return "";
    }
  };

  const handleFieldChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleBlur = (name: string, value: string) => {
    const error = validateField(name, value);
    if (error) {
      setErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  const handleSubmit = async (e: React.FormEvent, isEdit: boolean) => {
    e.preventDefault();
    setErrors({});

    // Validate all fields
    const newErrors: Record<string, string> = {};
    newErrors.INSTITUTION_ID = validateField("INSTITUTION_ID", formData.INSTITUTION_ID);
    newErrors.EFFECTIVE_START_TERM = validateField("EFFECTIVE_START_TERM", formData.EFFECTIVE_START_TERM);
    newErrors.EFFECTIVE_END_TERM = validateField("EFFECTIVE_END_TERM", formData.EFFECTIVE_END_TERM);

    // If there are errors, set them and return
    const hasErrors = Object.values(newErrors).some((error) => error !== "");
    if (hasErrors) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      const endpoint = isEdit ? "/api/accreditedinstitution/update" : "/api/accreditedinstitution/insert";
      const body = isEdit
        ? { Id: editingId, ...formData }
        : formData;

      const response = await api.post(endpoint, body);

      const success = response.status === 1 || response.success || response.message?.toLowerCase().includes("success");
      const messageText = response.message || (isEdit ? "Accredited institution updated successfully" : "Accredited institution added successfully");

      if (success) {
        alertsuccess(messageText);
        setShowAddModal(false);
        setShowEditModal(false);
        setFormData({ INSTITUTION_ID: "", EFFECTIVE_START_TERM: "", EFFECTIVE_END_TERM: "" });
        setEditingId(null);
        setRefreshTrigger((prev) => prev + 1);
      } else {
        alerterror(messageText || "Error saving accredited institution");
      }
    } catch (error: any) {
      console.error("Save accredited institution error:", error);
      alerterror(error.response?.data?.detail || error.message || "Error saving accredited institution");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageWrapper>
      <PageMeta title="Accredited Institution | College Module" description="Manage accredited institutions" />
      <PageBreadcrumb pageTitle="Accredited Institution" />
      <PageContainer>

        <DataTable
          refreshTrigger={refreshTrigger}
          toolbarActions={<>{hasAddPermission && <Button size="sm" onClick={handleAdd}>Add Accredited Institution</Button>}<button onClick={() => setRefreshTrigger((prev) => prev + 1)} className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"><RefreshIcon className="w-4 h-4" /> Refresh</button></>}
          ajaxUrl="/api/accreditedinstitution/ajaxlist"
          columns={[
            { 
              data: "INSTITUTION_ID", 
              name: "Institution ID", 
              searchable: true, 
              orderable: true,
              render: (data: any) => {
                if (!data) return "-";
                return (
                  <span 
                    className="cursor-pointer hover:text-brand-500" 
                    onClick={() => copyToClipboard(data)}
                    title="Click to copy"
                  >
                    <CopyIcon className="w-4 h-4 me-1" />
                    {data}
                  </span>
                );
              }
            },
            { data: "INSTITUTION_NAME", name: "Institution Name", searchable: true, orderable: true },
            { data: "EFFECTIVE_START_TERM", name: "Effective Start Term", searchable: true, orderable: true },
            { data: "EFFECTIVE_END_TERM", name: "Effective End Term", searchable: true, orderable: true },
            { data: "UPDATED_BY", name: "Updated By", searchable: true, orderable: true },
            { data: "UPDATED_ON", name: "Updated On", searchable: false, orderable: true },
            ...(hasUpdatePermission || hasDeletePermission ? [{
              data: "actions", name: "Action", searchable: false, orderable: false,
              render: (data: any, row: any) => (
                <div className="flex items-center gap-2">
                  {hasUpdatePermission && <button onClick={() => handleEdit(row.Id)} className="text-brand-500 hover:text-brand-700" title="Edit"><PencilIcon className="w-5 h-5" /></button>}
                  {hasDeletePermission && <button onClick={() => handleDeleteClick(row.Id)} className="text-red-500 hover:text-red-700" title="Delete"><TrashBinIcon className="w-5 h-5" /></button>}
                </div>
              ),
            }] : []),
          ]}
        />

        {/* Add Modal */}
        <Modal isOpen={showAddModal} onClose={() => {
          setShowAddModal(false);
          setErrors({});
        }} className="max-w-md">
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
              Add Accredited Institution
            </h3>
          </div>

          {/* Modal Body */}
          <div className="p-6">
            <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
              <div>
                <Label>Institution ID *</Label>
                <Input
                  value={formData.INSTITUTION_ID}
                  onChange={(e) => handleFieldChange("INSTITUTION_ID", e.target.value)}
                  onBlur={(e) => handleBlur("INSTITUTION_ID", e.target.value)}
                  placeholder="Enter Institution ID"
                  error={!!errors.INSTITUTION_ID}
                />
                {errors.INSTITUTION_ID && (
                  <p className="mt-1 text-xs text-red-500">{errors.INSTITUTION_ID}</p>
                )}
              </div>
              <div>
                <Label>Effective Start Term *</Label>
                <Input
                  value={formData.EFFECTIVE_START_TERM}
                  onChange={(e) => handleFieldChange("EFFECTIVE_START_TERM", e.target.value)}
                  onBlur={(e) => handleBlur("EFFECTIVE_START_TERM", e.target.value)}
                  placeholder="Enter Effective Start Term"
                  error={!!errors.EFFECTIVE_START_TERM}
                />
                {errors.EFFECTIVE_START_TERM && (
                  <p className="mt-1 text-xs text-red-500">{errors.EFFECTIVE_START_TERM}</p>
                )}
              </div>
              <div>
                <Label>Effective End Term *</Label>
                <Input
                  value={formData.EFFECTIVE_END_TERM}
                  onChange={(e) => handleFieldChange("EFFECTIVE_END_TERM", e.target.value)}
                  onBlur={(e) => handleBlur("EFFECTIVE_END_TERM", e.target.value)}
                  placeholder="Enter Effective End Term"
                  error={!!errors.EFFECTIVE_END_TERM}
                />
                {errors.EFFECTIVE_END_TERM && (
                  <p className="mt-1 text-xs text-red-500">{errors.EFFECTIVE_END_TERM}</p>
                )}
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg transition px-5 py-3.5 text-sm bg-brand-500 text-white shadow-theme-xs hover:bg-brand-600 disabled:bg-brand-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                      Adding...
                    </>
                  ) : (
                    "Submit"
                  )}
                </button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddModal(false);
                    setErrors({});
                  }}
                  className="flex-1"
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </Modal>

        {/* Edit Modal */}
        <Modal isOpen={showEditModal} onClose={() => {
          setShowEditModal(false);
          setEditingId(null);
          setErrors({});
        }} className="max-w-md">
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
              Edit Accredited Institution
            </h3>
          </div>

          {/* Modal Body */}
          <div className="p-6">
            <form onSubmit={(e) => handleSubmit(e, true)} className="space-y-4">
              <div>
                <Label>Institution ID *</Label>
                <Input
                  value={formData.INSTITUTION_ID}
                  onChange={(e) => handleFieldChange("INSTITUTION_ID", e.target.value)}
                  onBlur={(e) => handleBlur("INSTITUTION_ID", e.target.value)}
                  placeholder="Enter Institution ID"
                  error={!!errors.INSTITUTION_ID}
                />
                {errors.INSTITUTION_ID && (
                  <p className="mt-1 text-xs text-red-500">{errors.INSTITUTION_ID}</p>
                )}
              </div>
              <div>
                <Label>Effective Start Term *</Label>
                <Input
                  value={formData.EFFECTIVE_START_TERM}
                  onChange={(e) => handleFieldChange("EFFECTIVE_START_TERM", e.target.value)}
                  onBlur={(e) => handleBlur("EFFECTIVE_START_TERM", e.target.value)}
                  placeholder="Enter Effective Start Term"
                  error={!!errors.EFFECTIVE_START_TERM}
                />
                {errors.EFFECTIVE_START_TERM && (
                  <p className="mt-1 text-xs text-red-500">{errors.EFFECTIVE_START_TERM}</p>
                )}
              </div>
              <div>
                <Label>Effective End Term *</Label>
                <Input
                  value={formData.EFFECTIVE_END_TERM}
                  onChange={(e) => handleFieldChange("EFFECTIVE_END_TERM", e.target.value)}
                  onBlur={(e) => handleBlur("EFFECTIVE_END_TERM", e.target.value)}
                  placeholder="Enter Effective End Term"
                  error={!!errors.EFFECTIVE_END_TERM}
                />
                {errors.EFFECTIVE_END_TERM && (
                  <p className="mt-1 text-xs text-red-500">{errors.EFFECTIVE_END_TERM}</p>
                )}
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg transition px-5 py-3.5 text-sm bg-brand-500 text-white shadow-theme-xs hover:bg-brand-600 disabled:bg-brand-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                      Updating...
                    </>
                  ) : (
                    "Update"
                  )}
                </button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingId(null);
                    setErrors({});
                  }}
                  className="flex-1"
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </Modal>

        {/* Delete Confirmation Modal */}
        <ConfirmationModal
          isOpen={showDeleteConfirmModal}
          onClose={() => {
            if (!isDeleting) {
              setShowDeleteConfirmModal(false);
              setInstitutionToDelete(null);
            }
          }}
          onConfirm={handleDelete}
          title="Confirm Delete"
          message="Are you sure you want to delete this accredited institution? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          confirmVariant="danger"
          isLoading={isDeleting}
        />
      </PageContainer>
    </PageWrapper>
  );
}
