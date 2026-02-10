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
import { RefreshIcon, PlusIcon, PencilIcon, TrashBinIcon } from "../../../../icons";
import { useAuth } from "../../../../context/AuthContext";
import ConfirmationModal from "../../../../components/common/ConfirmationModal";
import { alertsuccess, alerterror } from "../../../../utils/toast";

export default function SuffixName() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { hasPermission } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [suffixToDelete, setSuffixToDelete] = useState<number | null>(null);
  const [formData, setFormData] = useState({ Suffix: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const hasAddPermission = hasPermission("suffix_names", "ADD");
  const hasUpdatePermission = hasPermission("suffix_names", "UPDATE");
  const hasDeletePermission = hasPermission("suffix_names", "DELETE");

  const handleAdd = () => {
    setFormData({ Suffix: "" });
    setErrors({});
    setShowAddModal(true);
  };

  const handleEdit = async (id: number) => {
    try {
      const response = await api.post("/api/suffixname/get", { id });
      const data = response;
      if (data.ID) {
        setFormData({ Suffix: data.Suffix || "" });
        setErrors({});
        setEditingId(data.ID);
        setShowEditModal(true);
      }
    } catch (error: any) {
      alerterror(error.response?.data?.detail || error.message || "Error loading suffix data");
    }
  };

  const handleDeleteClick = (id: number) => {
    setSuffixToDelete(id);
    setShowDeleteConfirmModal(true);
  };

  const handleDelete = async () => {
    if (!suffixToDelete) return;

    setIsDeleting(true);
    try {
      const response = await api.post("/api/suffixname/delete", { id: suffixToDelete });
      
      const success = response.status === 1 || response.success || response.status === "Success" || response.message?.toLowerCase().includes("success");
      const messageText = response.message || "Suffix deleted successfully";

      if (success) {
        alertsuccess(messageText);
        setRefreshTrigger((prev) => prev + 1);
        setShowDeleteConfirmModal(false);
        setSuffixToDelete(null);
      } else {
        alerterror(messageText);
        setShowDeleteConfirmModal(false);
        setSuffixToDelete(null);
      }
    } catch (error: any) {
      console.error("Delete suffix error:", error);
      alerterror(error.response?.data?.detail || error.message || "Error deleting suffix");
      setShowDeleteConfirmModal(false);
      setSuffixToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Field validation
  const validateField = (name: string, value: string): string => {
    switch (name) {
      case "Suffix":
        if (!value || value.trim() === "") {
          return "Suffix is required";
        }
        if (value.trim().length < 1) {
          return "Suffix must be at least 1 character";
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
    newErrors.Suffix = validateField("Suffix", formData.Suffix);

    // If there are errors, set them and return
    const hasErrors = Object.values(newErrors).some((error) => error !== "");
    if (hasErrors) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      const endpoint = isEdit ? "/api/suffixname/update" : "/api/suffixname/insert";
      const body = isEdit
        ? { Id: editingId, ...formData }
        : formData;

      const response = await api.post(endpoint, body);

      const success = response.status === 1 || response.success || response.message?.toLowerCase().includes("success");
      const messageText = response.message || (isEdit ? "Suffix updated successfully" : "Suffix added successfully");

      if (success) {
        alertsuccess(messageText);
        setShowAddModal(false);
        setShowEditModal(false);
        setFormData({ Suffix: "" });
        setEditingId(null);
        setRefreshTrigger((prev) => prev + 1);
      } else {
        alerterror(messageText || "Error saving suffix");
      }
    } catch (error: any) {
      console.error("Save suffix error:", error);
      alerterror(error.response?.data?.detail || error.message || "Error saving suffix");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageWrapper>
      <PageMeta title="Suffix Names | College Module" description="Manage suffix names" />
      <PageBreadcrumb pageTitle="Suffix Names" />
      <PageContainer>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">View Suffix Names</h3>
          <div className="flex items-center gap-2">
            {hasAddPermission && (
              <Button onClick={handleAdd}>Add Suffix</Button>
            )}
            <Button onClick={() => setRefreshTrigger((prev) => prev + 1)} variant="outline" startIcon={<RefreshIcon className="w-5 h-5" />}>Refresh Data</Button>
          </div>
        </div>

        <DataTable
          refreshTrigger={refreshTrigger}
          ajaxUrl="/api/suffixname/ajaxlist"
          columns={[
            { data: "Suffix", name: "Suffix", searchable: true, orderable: true },
            { data: "Updated_By", name: "Updated By", searchable: true, orderable: true },
            { data: "Updated_on", name: "Updated On", searchable: false, orderable: true },
            ...(hasUpdatePermission || hasDeletePermission ? [{
              data: "actions", name: "Action", searchable: false, orderable: false,
              render: (data: any, row: any) => (
                <div className="flex items-center gap-2">
                  {hasUpdatePermission && <button onClick={() => handleEdit(row.ID)} className="text-brand-500 hover:text-brand-700" title="Edit"><PencilIcon className="w-5 h-5" /></button>}
                  {hasDeletePermission && <button onClick={() => handleDeleteClick(row.ID)} className="text-red-500 hover:text-red-700" title="Delete"><TrashBinIcon className="w-5 h-5" /></button>}
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
              Add Suffix
            </h3>
          </div>

          {/* Modal Body */}
          <div className="p-6">
            <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
              <div>
                <Label>Suffix *</Label>
                <Input
                  value={formData.Suffix}
                  onChange={(e) => handleFieldChange("Suffix", e.target.value)}
                  onBlur={(e) => handleBlur("Suffix", e.target.value)}
                  placeholder="Enter Suffix"
                  error={!!errors.Suffix}
                />
                {errors.Suffix && (
                  <p className="mt-1 text-xs text-red-500">{errors.Suffix}</p>
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
              Edit Suffix
            </h3>
          </div>

          {/* Modal Body */}
          <div className="p-6">
            <form onSubmit={(e) => handleSubmit(e, true)} className="space-y-4">
              <div>
                <Label>Suffix *</Label>
                <Input
                  value={formData.Suffix}
                  onChange={(e) => handleFieldChange("Suffix", e.target.value)}
                  onBlur={(e) => handleBlur("Suffix", e.target.value)}
                  placeholder="Enter Suffix"
                  error={!!errors.Suffix}
                />
                {errors.Suffix && (
                  <p className="mt-1 text-xs text-red-500">{errors.Suffix}</p>
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
              setSuffixToDelete(null);
            }
          }}
          onConfirm={handleDelete}
          title="Confirm Delete"
          message="Are you sure you want to delete this suffix? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          confirmVariant="danger"
          isLoading={isDeleting}
        />
      </PageContainer>
    </PageWrapper>
  );
}
