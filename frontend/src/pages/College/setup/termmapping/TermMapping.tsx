import { useState } from "react";
import PageBreadcrumb from "../../../../components/common/PageBreadCrumb";
import PageMeta from "../../../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../../../components/common/PageContainer";
import DataTable from "../../../../components/ui/DataTable";
import Button from "../../../../components/ui/button/Button";
import { Modal } from "../../../../components/ui/modal";
import Input from "../../../../components/form/input/InputField";
import Label from "../../../../components/form/Label";
import { api, API_BASE_URL } from "../../../../config/api";
import { RefreshIcon, PlusIcon, PencilIcon, TrashBinIcon } from "../../../../icons";
import { useAuth } from "../../../../context/AuthContext";
import ConfirmationModal from "../../../../components/common/ConfirmationModal";

export default function TermMapping() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { hasPermission } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [termToDelete, setTermToDelete] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    TERM: "", TERM_CODE: "", TERM_START: "", TERM_END: "", IS_ACTIVE: "Y", GRACE_PERIOD: 0
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const hasAddPermission = hasPermission("college_terms", "ADD");
  const hasUpdatePermission = hasPermission("college_terms", "UPDATE");
  const hasDeletePermission = hasPermission("college_terms", "DELETE");

  const handleAdd = () => {
    setFormData({ TERM: "", TERM_CODE: "", TERM_START: "", TERM_END: "", IS_ACTIVE: "Y", GRACE_PERIOD: 0 });
    setErrors({});
    setShowAddModal(true);
    setMessage(null);
  };

  const handleEdit = async (id: number) => {
    try {
      const response = await api.post("/api/termmapping/get", { id });
      const data = response;
      if (data.Id) {
        const startDate = data.TERM_START ? new Date(data.TERM_START).toISOString().split('T')[0] : "";
        const endDate = data.TERM_END ? new Date(data.TERM_END).toISOString().split('T')[0] : "";
        setFormData({
          TERM: data.TERM || "",
          TERM_CODE: data.TERM_CODE || "",
          TERM_START: startDate,
          TERM_END: endDate,
          IS_ACTIVE: data.IS_ACTIVE || "Y",
          GRACE_PERIOD: data.GRACE_PERIOD || 0
        });
        setErrors({});
        setEditingId(id);
        setShowEditModal(true);
        setMessage(null);
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.response?.data?.detail || error.message || "Error loading term data" });
    }
  };

  const handleDeleteClick = (id: number) => {
    setTermToDelete(id);
    setShowDeleteConfirmModal(true);
  };

  const handleDelete = async () => {
    if (!termToDelete) return;

    setIsDeleting(true);
    try {
      const response = await api.post("/api/termmapping/delete", { id: termToDelete });
      
      const success = response.status === 1 || response.success || response.status === "Success" || response.message?.toLowerCase().includes("success");
      const messageText = response.message || "Term deleted successfully";

      if (success) {
        setMessage({ type: "success", text: messageText });
        setRefreshTrigger((prev) => prev + 1);
        setShowDeleteConfirmModal(false);
        setTermToDelete(null);
        setTimeout(() => setMessage(null), 5000);
      } else {
        setMessage({ type: "error", text: messageText });
        setShowDeleteConfirmModal(false);
        setTermToDelete(null);
        setTimeout(() => setMessage(null), 5000);
      }
    } catch (error: any) {
      console.error("Delete term error:", error);
      setMessage({ type: "error", text: error.response?.data?.detail || error.message || "Error deleting term" });
      setShowDeleteConfirmModal(false);
      setTermToDelete(null);
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setIsDeleting(false);
    }
  };

  // Field validation
  const validateField = (name: string, value: any): string => {
    switch (name) {
      case "TERM":
        if (!value || (typeof value === "string" && value.trim() === "")) {
          return "Term is required";
        }
        if (typeof value === "string" && value.trim().length < 2) {
          return "Term must be at least 2 characters";
        }
        return "";
      case "TERM_CODE":
        if (!value || (typeof value === "string" && value.trim() === "")) {
          return "Term Code is required";
        }
        if (typeof value === "string" && value.trim().length < 2) {
          return "Term Code must be at least 2 characters";
        }
        return "";
      case "TERM_START":
        if (!value || value === "") {
          return "Term Start date is required";
        }
        return "";
      case "TERM_END":
        if (!value || value === "") {
          return "Term End date is required";
        }
        if (formData.TERM_START && value < formData.TERM_START) {
          return "Term End date must be after Term Start date";
        }
        return "";
      case "IS_ACTIVE":
        if (!value || (value !== "Y" && value !== "N")) {
          return "Please select a valid status";
        }
        return "";
      case "GRACE_PERIOD":
        if (value === null || value === undefined || value === "") {
          return "Grace Period is required";
        }
        const numValue = typeof value === "number" ? value : parseInt(value);
        if (isNaN(numValue) || numValue < 0) {
          return "Grace Period must be a non-negative number";
        }
        return "";
      default:
        return "";
    }
  };

  const handleFieldChange = (name: string, value: any) => {
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

  const handleBlur = (name: string, value: any) => {
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
    newErrors.TERM = validateField("TERM", formData.TERM);
    newErrors.TERM_CODE = validateField("TERM_CODE", formData.TERM_CODE);
    newErrors.TERM_START = validateField("TERM_START", formData.TERM_START);
    newErrors.TERM_END = validateField("TERM_END", formData.TERM_END);
    newErrors.IS_ACTIVE = validateField("IS_ACTIVE", formData.IS_ACTIVE);
    newErrors.GRACE_PERIOD = validateField("GRACE_PERIOD", formData.GRACE_PERIOD);

    // If there are errors, set them and return
    const hasErrors = Object.values(newErrors).some((error) => error !== "");
    if (hasErrors) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      const endpoint = isEdit ? "/api/termmapping/update" : "/api/termmapping/insert";
      const body = isEdit
        ? { Id: editingId, ...formData }
        : formData;

      const response = await api.post(endpoint, body);

      const success = response.status === 1 || response.success || response.message?.toLowerCase().includes("success");
      const messageText = response.message || (isEdit ? "Term updated successfully" : "Term added successfully");

      if (success) {
        setMessage({ type: "success", text: messageText });
        setShowAddModal(false);
        setShowEditModal(false);
        setFormData({ TERM: "", TERM_CODE: "", TERM_START: "", TERM_END: "", IS_ACTIVE: "Y", GRACE_PERIOD: 0 });
        setEditingId(null);
        setRefreshTrigger((prev) => prev + 1);
        setTimeout(() => setMessage(null), 5000);
      } else {
        setMessage({ type: "error", text: messageText || "Error saving term" });
        setTimeout(() => setMessage(null), 5000);
      }
    } catch (error: any) {
      console.error("Save term error:", error);
      setMessage({ type: "error", text: error.response?.data?.detail || error.message || "Error saving term" });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageWrapper>
      <PageMeta title="Term Mapping | College Module" description="Manage term mappings" />
      <PageBreadcrumb pageTitle="Term Mapping" />
      <PageContainer>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">View Terms</h3>
          <div className="flex items-center gap-2">
            <Button onClick={() => setRefreshTrigger((prev) => prev + 1)} variant="outline" startIcon={<RefreshIcon className="w-5 h-5" />}>Refresh Data</Button>
            {hasAddPermission && <Button onClick={handleAdd} startIcon={<PlusIcon className="w-5 h-5" />}>Add Term</Button>}
          </div>
        </div>

        {/* Success/Error Message Banner */}
        {message && (
          <div className={`mb-4 p-4 rounded-lg border ${
            message.type === "success" 
              ? "bg-green-50 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800" 
              : "bg-red-50 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{message.text}</span>
              <button
                onClick={() => setMessage(null)}
                className={`ml-4 ${message.type === "success" ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300"}`}
              >
                ×
              </button>
            </div>
          </div>
        )}

        <DataTable
          refreshTrigger={refreshTrigger}
          ajaxUrl="/api/termmapping/ajaxlist"
          columns={[
            { data: "TERM", name: "Term", searchable: true, orderable: true },
            { data: "TERM_CODE", name: "Term Code", searchable: true, orderable: true },
            { data: "TERM_START", name: "Term Start", searchable: true, orderable: true },
            { data: "TERM_END", name: "Term End", searchable: true, orderable: true },
            { data: "IS_ACTIVE", name: "Status", searchable: false, orderable: true },
            { data: "GRACE_PERIOD", name: "Grace Period", searchable: true, orderable: true },
            { data: "UPDATED_BY", name: "Updated By", searchable: true, orderable: true },
            { data: "LAST_UPDATED_DATETIME", name: "Updated On", searchable: false, orderable: true },
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
          setMessage(null);
          setErrors({});
        }} className="max-w-2xl">
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
              Add Term
            </h3>
          </div>

          {/* Modal Body */}
          <div className="p-6">
            <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Term *</Label>
                  <Input
                    value={formData.TERM}
                    onChange={(e) => handleFieldChange("TERM", e.target.value)}
                    onBlur={(e) => handleBlur("TERM", e.target.value)}
                    placeholder="Enter Term"
                    error={!!errors.TERM}
                  />
                  {errors.TERM && (
                    <p className="mt-1 text-xs text-red-500">{errors.TERM}</p>
                  )}
                </div>
                <div>
                  <Label>Term Code *</Label>
                  <Input
                    value={formData.TERM_CODE}
                    onChange={(e) => handleFieldChange("TERM_CODE", e.target.value)}
                    onBlur={(e) => handleBlur("TERM_CODE", e.target.value)}
                    placeholder="Enter Term Code"
                    error={!!errors.TERM_CODE}
                  />
                  {errors.TERM_CODE && (
                    <p className="mt-1 text-xs text-red-500">{errors.TERM_CODE}</p>
                  )}
                </div>
                <div>
                  <Label>Term Start *</Label>
                  <Input
                    type="date"
                    value={formData.TERM_START}
                    onChange={(e) => handleFieldChange("TERM_START", e.target.value)}
                    onBlur={(e) => handleBlur("TERM_START", e.target.value)}
                    error={!!errors.TERM_START}
                  />
                  {errors.TERM_START && (
                    <p className="mt-1 text-xs text-red-500">{errors.TERM_START}</p>
                  )}
                </div>
                <div>
                  <Label>Term End *</Label>
                  <Input
                    type="date"
                    value={formData.TERM_END}
                    onChange={(e) => handleFieldChange("TERM_END", e.target.value)}
                    onBlur={(e) => handleBlur("TERM_END", e.target.value)}
                    error={!!errors.TERM_END}
                    min={formData.TERM_START || undefined}
                  />
                  {errors.TERM_END && (
                    <p className="mt-1 text-xs text-red-500">{errors.TERM_END}</p>
                  )}
                </div>
                <div>
                  <Label>Is Active *</Label>
                  <select
                    value={formData.IS_ACTIVE}
                    onChange={(e) => handleFieldChange("IS_ACTIVE", e.target.value)}
                    onBlur={(e) => handleBlur("IS_ACTIVE", e.target.value)}
                    className={`w-full h-11 rounded-lg border px-4 py-2.5 text-sm shadow-theme-xs appearance-none bg-transparent focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 ${
                      errors.IS_ACTIVE
                        ? "border-error-500 focus:border-error-300 focus:ring-error-500/20 dark:border-error-500 dark:focus:border-error-800"
                        : "border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700 dark:focus:border-brand-800"
                    }`}
                  >
                    <option value="Y">Active</option>
                    <option value="N">InActive</option>
                  </select>
                  {errors.IS_ACTIVE && (
                    <p className="mt-1 text-xs text-red-500">{errors.IS_ACTIVE}</p>
                  )}
                </div>
                <div>
                  <Label>Grace Period *</Label>
                  <Input
                    type="number"
                    value={formData.GRACE_PERIOD}
                    onChange={(e) => handleFieldChange("GRACE_PERIOD", parseInt(e.target.value) || 0)}
                    onBlur={(e) => handleBlur("GRACE_PERIOD", parseInt(e.target.value) || 0)}
                    placeholder="Enter Grace Period"
                    error={!!errors.GRACE_PERIOD}
                    min="0"
                  />
                  {errors.GRACE_PERIOD && (
                    <p className="mt-1 text-xs text-red-500">{errors.GRACE_PERIOD}</p>
                  )}
                </div>
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
                    setMessage(null);
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
          setMessage(null);
          setErrors({});
        }} className="max-w-2xl">
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
              Edit Term
            </h3>
          </div>

          {/* Modal Body */}
          <div className="p-6">
            <form onSubmit={(e) => handleSubmit(e, true)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Term *</Label>
                  <Input
                    value={formData.TERM}
                    onChange={(e) => handleFieldChange("TERM", e.target.value)}
                    onBlur={(e) => handleBlur("TERM", e.target.value)}
                    placeholder="Enter Term"
                    error={!!errors.TERM}
                  />
                  {errors.TERM && (
                    <p className="mt-1 text-xs text-red-500">{errors.TERM}</p>
                  )}
                </div>
                <div>
                  <Label>Term Code *</Label>
                  <Input
                    value={formData.TERM_CODE}
                    onChange={(e) => handleFieldChange("TERM_CODE", e.target.value)}
                    onBlur={(e) => handleBlur("TERM_CODE", e.target.value)}
                    placeholder="Enter Term Code"
                    error={!!errors.TERM_CODE}
                  />
                  {errors.TERM_CODE && (
                    <p className="mt-1 text-xs text-red-500">{errors.TERM_CODE}</p>
                  )}
                </div>
                <div>
                  <Label>Term Start *</Label>
                  <Input
                    type="date"
                    value={formData.TERM_START}
                    onChange={(e) => handleFieldChange("TERM_START", e.target.value)}
                    onBlur={(e) => handleBlur("TERM_START", e.target.value)}
                    error={!!errors.TERM_START}
                  />
                  {errors.TERM_START && (
                    <p className="mt-1 text-xs text-red-500">{errors.TERM_START}</p>
                  )}
                </div>
                <div>
                  <Label>Term End *</Label>
                  <Input
                    type="date"
                    value={formData.TERM_END}
                    onChange={(e) => handleFieldChange("TERM_END", e.target.value)}
                    onBlur={(e) => handleBlur("TERM_END", e.target.value)}
                    error={!!errors.TERM_END}
                    min={formData.TERM_START || undefined}
                  />
                  {errors.TERM_END && (
                    <p className="mt-1 text-xs text-red-500">{errors.TERM_END}</p>
                  )}
                </div>
                <div>
                  <Label>Is Active *</Label>
                  <select
                    value={formData.IS_ACTIVE}
                    onChange={(e) => handleFieldChange("IS_ACTIVE", e.target.value)}
                    onBlur={(e) => handleBlur("IS_ACTIVE", e.target.value)}
                    className={`w-full h-11 rounded-lg border px-4 py-2.5 text-sm shadow-theme-xs appearance-none bg-transparent focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 ${
                      errors.IS_ACTIVE
                        ? "border-error-500 focus:border-error-300 focus:ring-error-500/20 dark:border-error-500 dark:focus:border-error-800"
                        : "border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700 dark:focus:border-brand-800"
                    }`}
                  >
                    <option value="Y">Active</option>
                    <option value="N">InActive</option>
                  </select>
                  {errors.IS_ACTIVE && (
                    <p className="mt-1 text-xs text-red-500">{errors.IS_ACTIVE}</p>
                  )}
                </div>
                <div>
                  <Label>Grace Period *</Label>
                  <Input
                    type="number"
                    value={formData.GRACE_PERIOD}
                    onChange={(e) => handleFieldChange("GRACE_PERIOD", parseInt(e.target.value) || 0)}
                    onBlur={(e) => handleBlur("GRACE_PERIOD", parseInt(e.target.value) || 0)}
                    placeholder="Enter Grace Period"
                    error={!!errors.GRACE_PERIOD}
                    min="0"
                  />
                  {errors.GRACE_PERIOD && (
                    <p className="mt-1 text-xs text-red-500">{errors.GRACE_PERIOD}</p>
                  )}
                </div>
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
                    setMessage(null);
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
              setTermToDelete(null);
            }
          }}
          onConfirm={handleDelete}
          title="Confirm Delete"
          message="Are you sure you want to delete this term? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          confirmVariant="danger"
          isLoading={isDeleting}
        />
      </PageContainer>
    </PageWrapper>
  );
}
