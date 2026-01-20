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

export default function SkipKeywords() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { hasPermission } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [skipKeywordToDelete, setSkipKeywordToDelete] = useState<number | null>(null);
  const [formData, setFormData] = useState({ KEYWORD: "", TO_DO: "", FROM_TABLE_NAME: "", FROM_COLUMN_NAME: "", DISABLED_FLAG: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const hasAddPermission = hasPermission("osu_skip_keywords", "ADD");
  const hasUpdatePermission = hasPermission("osu_skip_keywords", "UPDATE");
  const hasDeletePermission = hasPermission("osu_skip_keywords", "DELETE");

  const handleAdd = () => {
    setFormData({ KEYWORD: "", TO_DO: "", FROM_TABLE_NAME: "", FROM_COLUMN_NAME: "", DISABLED_FLAG: "" });
    setErrors({});
    setShowAddModal(true);
    setMessage(null);
  };

  const handleEdit = async (id: number) => {
    try {
      const response = await api.post("/api/skipkeywords/get", { id });
      const data = response;
      if (data.SNO) {
        setFormData({
          KEYWORD: data.KEYWORD || "",
          TO_DO: data.TO_DO || "",
          FROM_TABLE_NAME: data.FROM_TABLE_NAME || "",
          FROM_COLUMN_NAME: data.FROM_COLUMN_NAME || "",
          DISABLED_FLAG: data.DISABLED_FLAG || "",
        });
        setErrors({});
        setEditingId(data.SNO);
        setShowEditModal(true);
        setMessage(null);
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.response?.data?.detail || error.message || "Error loading skip keyword data" });
    }
  };

  const handleDeleteClick = (id: number) => {
    setSkipKeywordToDelete(id);
    setShowDeleteConfirmModal(true);
  };

  const handleDelete = async () => {
    if (!skipKeywordToDelete) return;

    setIsDeleting(true);
    try {
      const response = await api.post("/api/skipkeywords/delete", { id: skipKeywordToDelete });
      
      const success = response.status === 1 || response.success || response.status === "Success" || response.message?.toLowerCase().includes("success");
      const messageText = response.message || "Skip keyword deleted successfully";

      if (success) {
        setMessage({ type: "success", text: messageText });
        setRefreshTrigger((prev) => prev + 1);
        setShowDeleteConfirmModal(false);
        setSkipKeywordToDelete(null);
        setTimeout(() => setMessage(null), 5000);
      } else {
        setMessage({ type: "error", text: messageText });
        setShowDeleteConfirmModal(false);
        setSkipKeywordToDelete(null);
        setTimeout(() => setMessage(null), 5000);
      }
    } catch (error: any) {
      console.error("Delete skip keyword error:", error);
      setMessage({ type: "error", text: error.response?.data?.detail || error.message || "Error deleting skip keyword" });
      setShowDeleteConfirmModal(false);
      setSkipKeywordToDelete(null);
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setIsDeleting(false);
    }
  };

  // Field validation
  const validateField = (name: string, value: string): string => {
    switch (name) {
      case "KEYWORD":
        if (!value || value.trim() === "") {
          return "Keyword is required";
        }
        return "";
      case "TO_DO":
        // Optional field, no validation needed
        return "";
      case "FROM_TABLE_NAME":
        // Optional field, no validation needed
        return "";
      case "FROM_COLUMN_NAME":
        // Optional field, no validation needed
        return "";
      case "DISABLED_FLAG":
        // Optional field, no validation needed
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
    newErrors.KEYWORD = validateField("KEYWORD", formData.KEYWORD);

    // If there are errors, set them and return
    const hasErrors = Object.values(newErrors).some((error) => error !== "");
    if (hasErrors) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      const endpoint = isEdit ? "/api/skipkeywords/update" : "/api/skipkeywords/insert";
      const body = isEdit
        ? { Id: editingId, ...formData }
        : formData;

      const response = await api.post(endpoint, body);

      const success = response.status === 1 || response.success || response.message?.toLowerCase().includes("success");
      const messageText = response.message || (isEdit ? "Skip keyword updated successfully" : "Skip keyword added successfully");

      if (success) {
        setMessage({ type: "success", text: messageText });
        setShowAddModal(false);
        setShowEditModal(false);
        setFormData({ KEYWORD: "", TO_DO: "", FROM_TABLE_NAME: "", FROM_COLUMN_NAME: "", DISABLED_FLAG: "" });
        setEditingId(null);
        setRefreshTrigger((prev) => prev + 1);
        setTimeout(() => setMessage(null), 5000);
      } else {
        setMessage({ type: "error", text: messageText || "Error saving skip keyword" });
        setTimeout(() => setMessage(null), 5000);
      }
    } catch (error: any) {
      console.error("Save skip keyword error:", error);
      setMessage({ type: "error", text: error.response?.data?.detail || error.message || "Error saving skip keyword" });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageWrapper>
      <PageMeta title="Skip Keywords | College Module" description="Manage skip keywords" />
      <PageBreadcrumb pageTitle="Skip Keywords" />
      <PageContainer>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">View Skip Keywords</h3>
          <div className="flex items-center gap-2">
            <Button onClick={() => setRefreshTrigger((prev) => prev + 1)} variant="outline" startIcon={<RefreshIcon className="w-5 h-5" />}>Refresh Data</Button>
            {hasAddPermission && <Button onClick={handleAdd} startIcon={<PlusIcon className="w-5 h-5" />}>Add Skip Keyword</Button>}
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
          ajaxUrl="/api/skipkeywords/ajaxlist"
          columns={[
            { data: "KEYWORD", name: "Keyword", searchable: true, orderable: true },
            { data: "FROM_COLUMN_NAME", name: "From Column Name", searchable: true, orderable: true },
            { data: "FROM_TABLE_NAME", name: "From Table Name", searchable: true, orderable: true },
            { data: "DISABLED_FLAG", name: "Disabled Flag", searchable: true, orderable: true },
            { data: "TO_DO", name: "To Do", searchable: true, orderable: true },
            ...(hasUpdatePermission || hasDeletePermission ? [{
              data: "actions", name: "Action", searchable: false, orderable: false,
              render: (data: any, row: any) => (
                <div className="flex items-center gap-2">
                  {hasUpdatePermission && <button onClick={() => handleEdit(row.SNO)} className="text-brand-500 hover:text-brand-700" title="Edit"><PencilIcon className="w-5 h-5" /></button>}
                  {hasDeletePermission && <button onClick={() => handleDeleteClick(row.SNO)} className="text-red-500 hover:text-red-700" title="Delete"><TrashBinIcon className="w-5 h-5" /></button>}
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
              Add Skip Keyword
            </h3>
          </div>

          {/* Modal Body */}
          <div className="p-6">
            <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Keyword *</Label>
                  <Input
                    value={formData.KEYWORD}
                    onChange={(e) => handleFieldChange("KEYWORD", e.target.value)}
                    onBlur={(e) => handleBlur("KEYWORD", e.target.value)}
                    placeholder="Enter Keyword"
                    error={!!errors.KEYWORD}
                  />
                  {errors.KEYWORD && (
                    <p className="mt-1 text-xs text-red-500">{errors.KEYWORD}</p>
                  )}
                </div>
                <div>
                  <Label>To Do</Label>
                  <Input
                    value={formData.TO_DO}
                    onChange={(e) => handleFieldChange("TO_DO", e.target.value)}
                    placeholder="Enter To Do"
                  />
                </div>
                <div>
                  <Label>From Table Name</Label>
                  <Input
                    value={formData.FROM_TABLE_NAME}
                    onChange={(e) => handleFieldChange("FROM_TABLE_NAME", e.target.value)}
                    placeholder="Enter From Table Name"
                  />
                </div>
                <div>
                  <Label>From Column Name</Label>
                  <Input
                    value={formData.FROM_COLUMN_NAME}
                    onChange={(e) => handleFieldChange("FROM_COLUMN_NAME", e.target.value)}
                    placeholder="Enter From Column Name"
                  />
                </div>
                <div>
                  <Label>Disabled Flag</Label>
                  <Input
                    value={formData.DISABLED_FLAG}
                    onChange={(e) => handleFieldChange("DISABLED_FLAG", e.target.value)}
                    placeholder="Enter Disabled Flag"
                  />
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
              Edit Skip Keyword
            </h3>
          </div>

          {/* Modal Body */}
          <div className="p-6">
            <form onSubmit={(e) => handleSubmit(e, true)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Keyword *</Label>
                  <Input
                    value={formData.KEYWORD}
                    onChange={(e) => handleFieldChange("KEYWORD", e.target.value)}
                    onBlur={(e) => handleBlur("KEYWORD", e.target.value)}
                    placeholder="Enter Keyword"
                    error={!!errors.KEYWORD}
                  />
                  {errors.KEYWORD && (
                    <p className="mt-1 text-xs text-red-500">{errors.KEYWORD}</p>
                  )}
                </div>
                <div>
                  <Label>To Do</Label>
                  <Input
                    value={formData.TO_DO}
                    onChange={(e) => handleFieldChange("TO_DO", e.target.value)}
                    placeholder="Enter To Do"
                  />
                </div>
                <div>
                  <Label>From Table Name</Label>
                  <Input
                    value={formData.FROM_TABLE_NAME}
                    onChange={(e) => handleFieldChange("FROM_TABLE_NAME", e.target.value)}
                    placeholder="Enter From Table Name"
                  />
                </div>
                <div>
                  <Label>From Column Name</Label>
                  <Input
                    value={formData.FROM_COLUMN_NAME}
                    onChange={(e) => handleFieldChange("FROM_COLUMN_NAME", e.target.value)}
                    placeholder="Enter From Column Name"
                  />
                </div>
                <div>
                  <Label>Disabled Flag</Label>
                  <Input
                    value={formData.DISABLED_FLAG}
                    onChange={(e) => handleFieldChange("DISABLED_FLAG", e.target.value)}
                    placeholder="Enter Disabled Flag"
                  />
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
              setSkipKeywordToDelete(null);
            }
          }}
          onConfirm={handleDelete}
          title="Confirm Delete"
          message="Are you sure you want to delete this skip keyword? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          confirmVariant="danger"
          isLoading={isDeleting}
        />
      </PageContainer>
    </PageWrapper>
  );
}
