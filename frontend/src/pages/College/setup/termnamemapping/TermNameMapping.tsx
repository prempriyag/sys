import { useState } from "react";
import PageBreadcrumb from "../../../../components/common/PageBreadCrumb";
import PageMeta from "../../../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../../../components/common/PageContainer";
import DataTable from "../../../../components/ui/DataTable";
import Button from "../../../../components/ui/button/Button";
import { api, API_BASE_URL } from "../../../../config/api";
import { RefreshIcon, PlusIcon, PencilIcon, TrashBinIcon } from "../../../../icons";
import { useAuth } from "../../../../context/AuthContext";
import { useToast } from "../../../../context/ToastContext";
import AddTermNameModal from "./AddTermNameModal";
import EditTermNameModal from "./EditTermNameModal";
import { Modal } from "../../../../components/ui/modal";
import Input from "../../../../components/form/input/InputField";
import Label from "../../../../components/form/Label";
import ConfirmationModal from "../../../../components/common/ConfirmationModal";
import { alertsuccess, alerterror } from "../../../../utils/toast";

export default function TermNameMapping() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { hasPermission } = useAuth();
  const { alertsuccess, alerterror } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [termNameToDelete, setTermNameToDelete] = useState<number | null>(null);
  const [formData, setFormData] = useState({ OCR_TERM_NAME: "", TERM_NAME: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const hasAddPermission = hasPermission("college_term_names", "ADD");
  const hasUpdatePermission = hasPermission("college_term_names", "UPDATE");
  const hasDeletePermission = hasPermission("college_term_names", "DELETE");

  const handleAdd = () => {
    setFormData({ OCR_TERM_NAME: "", TERM_NAME: "" });
    setErrors({});
    setShowAddModal(true);
  };

  const handleEdit = async (id: number) => {
    try {
      const response = await api.post("/api/termnamemapping/get", { id });
      const data = response;
      if (data.Id) {
        setFormData({ OCR_TERM_NAME: data.OCR_TERM_NAME || "", TERM_NAME: data.TERM_NAME || "" });
        setErrors({});
        setEditingId(id);
        setShowEditModal(true);
      }
    } catch (error: any) {
      alerterror(error.response?.data?.detail || error.message || "Error loading term name data");
    }
  };

  const handleDeleteClick = (id: number) => {
    setTermNameToDelete(id);
    setShowDeleteConfirmModal(true);
  };

  const handleDelete = async () => {
    if (!termNameToDelete) return;

    setIsDeleting(true);
    try {
      const response = await api.post("/api/termnamemapping/delete", { id: termNameToDelete });
      
      const success = response.status === 1 || response.success || response.status === "Success" || response.message?.toLowerCase().includes("success");
      const messageText = response.message || "Term name deleted successfully";

      if (success) {
        alertsuccess(messageText);
        setRefreshTrigger((prev) => prev + 1);
        setShowDeleteConfirmModal(false);
        setTermNameToDelete(null);
      } else {
        alerterror(messageText);
        setShowDeleteConfirmModal(false);
        setTermNameToDelete(null);
      }
    } catch (error: any) {
      console.error("Delete term name error:", error);
      alerterror(error.response?.data?.detail || error.message || "Error deleting term name");
      setShowDeleteConfirmModal(false);
      setTermNameToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Field validation
  const validateField = (name: string, value: string): string => {
    switch (name) {
      case "OCR_TERM_NAME":
        if (!value || value.trim() === "") {
          return "OCR Term Name is required";
        }
        if (value.trim().length < 2) {
          return "OCR Term Name must be at least 2 characters";
        }
        return "";
      case "TERM_NAME":
        if (!value || value.trim() === "") {
          return "Term Name is required";
        }
        if (value.trim().length < 2) {
          return "Term Name must be at least 2 characters";
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
    newErrors.OCR_TERM_NAME = validateField("OCR_TERM_NAME", formData.OCR_TERM_NAME);
    newErrors.TERM_NAME = validateField("TERM_NAME", formData.TERM_NAME);

    // If there are errors, set them and return
    const hasErrors = Object.values(newErrors).some((error) => error !== "");
    if (hasErrors) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      const endpoint = isEdit ? "/api/termnamemapping/update" : "/api/termnamemapping/insert";
      const body = isEdit
        ? { Id: editingId, ...formData }
        : formData;

      const response = await api.post(endpoint, body);

      const success = response.status === 1 || response.success || response.message?.toLowerCase().includes("success");
      const messageText = response.message || (isEdit ? "Term name updated successfully" : "Term name added successfully");

      if (success) {
        alertsuccess(messageText);
        setShowAddModal(false);
        setShowEditModal(false);
        setFormData({ OCR_TERM_NAME: "", TERM_NAME: "" });
        setEditingId(null);
        setRefreshTrigger((prev) => prev + 1);
      } else {
        alerterror(messageText || "Error saving term name");
      }
    } catch (error: any) {
      console.error("Save term name error:", error);
      alerterror(error.response?.data?.detail || error.message || "Error saving term name");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageWrapper>
      <PageMeta title="Term Name Mapping | College Module" description="Manage term name mappings" />
      <PageBreadcrumb pageTitle="Term Name Mapping" />
      <PageContainer>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">View Term Names</h3>
          <Button onClick={() => setRefreshTrigger((prev) => prev + 1)} variant="outline" startIcon={<RefreshIcon className="w-5 h-5" />}>Refresh Data</Button>
        </div>
        {hasAddPermission && (
          <div className="mb-4 flex justify-center">
            <Button onClick={() => setShowAddModal(true)}>Add Term Name</Button>
          </div>
        )}

        <DataTable
          refreshTrigger={refreshTrigger}
          ajaxUrl="/api/termnamemapping/ajaxlist"
          columns={[
            { data: "OCR_TERM_NAME", name: "OCR Term Name", searchable: true, orderable: true },
            { data: "TERM_NAME", name: "Term Name", searchable: true, orderable: true },
            { data: "Updated_by", name: "Updated By", searchable: true, orderable: true },
            { data: "Updated_on", name: "Updated On", searchable: false, orderable: true },
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
              Add Term Name
            </h3>
          </div>

          {/* Modal Body */}
          <div className="p-6">
            <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
              <div>
                <Label>OCR Term Name *</Label>
                <Input
                  value={formData.OCR_TERM_NAME}
                  onChange={(e) => handleFieldChange("OCR_TERM_NAME", e.target.value)}
                  onBlur={(e) => handleBlur("OCR_TERM_NAME", e.target.value)}
                  placeholder="Enter OCR Term Name"
                  error={!!errors.OCR_TERM_NAME}
                />
                {errors.OCR_TERM_NAME && (
                  <p className="mt-1 text-xs text-red-500">{errors.OCR_TERM_NAME}</p>
                )}
              </div>
              <div>
                <Label>Term Name *</Label>
                <Input
                  value={formData.TERM_NAME}
                  onChange={(e) => handleFieldChange("TERM_NAME", e.target.value)}
                  onBlur={(e) => handleBlur("TERM_NAME", e.target.value)}
                  placeholder="Enter Term Name"
                  error={!!errors.TERM_NAME}
                />
                {errors.TERM_NAME && (
                  <p className="mt-1 text-xs text-red-500">{errors.TERM_NAME}</p>
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
              Edit Term Name
            </h3>
          </div>

          {/* Modal Body */}
          <div className="p-6">
            <form onSubmit={(e) => handleSubmit(e, true)} className="space-y-4">
              <div>
                <Label>OCR Term Name *</Label>
                <Input
                  value={formData.OCR_TERM_NAME}
                  onChange={(e) => handleFieldChange("OCR_TERM_NAME", e.target.value)}
                  onBlur={(e) => handleBlur("OCR_TERM_NAME", e.target.value)}
                  placeholder="Enter OCR Term Name"
                  error={!!errors.OCR_TERM_NAME}
                />
                {errors.OCR_TERM_NAME && (
                  <p className="mt-1 text-xs text-red-500">{errors.OCR_TERM_NAME}</p>
                )}
              </div>
              <div>
                <Label>Term Name *</Label>
                <Input
                  value={formData.TERM_NAME}
                  onChange={(e) => handleFieldChange("TERM_NAME", e.target.value)}
                  onBlur={(e) => handleBlur("TERM_NAME", e.target.value)}
                  placeholder="Enter Term Name"
                  error={!!errors.TERM_NAME}
                />
                {errors.TERM_NAME && (
                  <p className="mt-1 text-xs text-red-500">{errors.TERM_NAME}</p>
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
              setTermNameToDelete(null);
            }
          }}
          onConfirm={handleDelete}
          title="Confirm Delete"
          message="Are you sure you want to delete this term name? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          confirmVariant="danger"
          isLoading={isDeleting}
        />
      </PageContainer>
    </PageWrapper>
  );
}
