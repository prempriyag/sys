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
import { alertsuccess } from "../../../../utils/toast";

export default function SkipCourses() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { hasPermission } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [courseToDelete, setCourseToDelete] = useState<number | null>(null);
  const [formData, setFormData] = useState({ INSTITUTION_ID: "", EXTERNAL_SUBJECT: "", EXTERNAL_COURSE_ID: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const hasAddPermission = hasPermission("skip_exclude_courses", "ADD");
  const hasUpdatePermission = hasPermission("skip_exclude_courses", "UPDATE");
  const hasDeletePermission = hasPermission("skip_exclude_courses", "DELETE");

  // Helper function to copy text to clipboard
  const copyToClipboard = (text: string | number) => {
    const str = String(text ?? "").trim();
    if (!str) return;
    navigator.clipboard.writeText(str).then(() => {
      alertsuccess("Copied to clipboard!");
    }).catch(() => console.error("Failed to copy"));
  };

  const handleAdd = () => {
    setFormData({ INSTITUTION_ID: "", EXTERNAL_SUBJECT: "", EXTERNAL_COURSE_ID: "" });
    setErrors({});
    setShowAddModal(true);
    setMessage(null);
  };

  const handleEdit = async (id: number) => {
    try {
      const response = await api.post("/api/skipcourses/get", { id });
      const data = response;
      if (data.Id) {
        setFormData({ INSTITUTION_ID: data.INSTITUTION_ID || "", EXTERNAL_SUBJECT: data.EXTERNAL_SUBJECT || "", EXTERNAL_COURSE_ID: data.EXTERNAL_COURSE_ID || "" });
        setErrors({});
        setEditingId(data.Id);
        setShowEditModal(true);
        setMessage(null);
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.response?.data?.detail || error.message || "Error loading course data" });
    }
  };

  const handleDeleteClick = (id: number) => {
    setCourseToDelete(id);
    setShowDeleteConfirmModal(true);
  };

  const handleDelete = async () => {
    if (!courseToDelete) return;

    setIsDeleting(true);
    try {
      const response = await api.post("/api/skipcourses/delete", { id: courseToDelete });
      
      const success = response.status === 1 || response.success || response.status === "Success" || response.message?.toLowerCase().includes("success");
      const messageText = response.message || "Course deleted successfully";

      if (success) {
        setMessage({ type: "success", text: messageText });
        setRefreshTrigger((prev) => prev + 1);
        setShowDeleteConfirmModal(false);
        setCourseToDelete(null);
        setTimeout(() => setMessage(null), 5000);
      } else {
        setMessage({ type: "error", text: messageText });
        setShowDeleteConfirmModal(false);
        setCourseToDelete(null);
        setTimeout(() => setMessage(null), 5000);
      }
    } catch (error: any) {
      console.error("Delete course error:", error);
      setMessage({ type: "error", text: error.response?.data?.detail || error.message || "Error deleting course" });
      setShowDeleteConfirmModal(false);
      setCourseToDelete(null);
      setTimeout(() => setMessage(null), 5000);
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
      case "EXTERNAL_SUBJECT":
        if (!value || value.trim() === "") {
          return "External Subject is required";
        }
        return "";
      case "EXTERNAL_COURSE_ID":
        if (!value || value.trim() === "") {
          return "External Course ID is required";
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
    newErrors.EXTERNAL_SUBJECT = validateField("EXTERNAL_SUBJECT", formData.EXTERNAL_SUBJECT);
    newErrors.EXTERNAL_COURSE_ID = validateField("EXTERNAL_COURSE_ID", formData.EXTERNAL_COURSE_ID);

    // If there are errors, set them and return
    const hasErrors = Object.values(newErrors).some((error) => error !== "");
    if (hasErrors) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      const endpoint = isEdit ? "/api/skipcourses/update" : "/api/skipcourses/insert";
      const body = isEdit
        ? { Id: editingId, ...formData }
        : formData;

      const response = await api.post(endpoint, body);

      const success = response.status === 1 || response.success || response.message?.toLowerCase().includes("success");
      const messageText = response.message || (isEdit ? "Course updated successfully" : "Course added successfully");

      if (success) {
        setMessage({ type: "success", text: messageText });
        setShowAddModal(false);
        setShowEditModal(false);
        setFormData({ INSTITUTION_ID: "", EXTERNAL_SUBJECT: "", EXTERNAL_COURSE_ID: "" });
        setEditingId(null);
        setRefreshTrigger((prev) => prev + 1);
        setTimeout(() => setMessage(null), 5000);
      } else {
        setMessage({ type: "error", text: messageText || "Error saving course" });
        setTimeout(() => setMessage(null), 5000);
      }
    } catch (error: any) {
      console.error("Save course error:", error);
      setMessage({ type: "error", text: error.response?.data?.detail || error.message || "Error saving course" });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageWrapper>
      <PageMeta title="Skip/Exclude Courses | College Module" description="Manage skip courses" />
      <PageBreadcrumb pageTitle="Skip/Exclude Courses" />
      <PageContainer>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">View Skip Courses</h3>
          <div className="flex items-center gap-2">
            <Button onClick={() => setRefreshTrigger((prev) => prev + 1)} variant="outline" startIcon={<RefreshIcon className="w-5 h-5" />}>Refresh Data</Button>
            {hasAddPermission && <Button onClick={handleAdd} startIcon={<PlusIcon className="w-5 h-5" />}>Add Course</Button>}
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
          ajaxUrl="/api/skipcourses/ajaxlist"
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
            { data: "CATEGORY", name: "Category", searchable: true, orderable: true },
            { data: "EXTERNAL_SUBJECT", name: "External Subject", searchable: true, orderable: true },
            { data: "EXTERNAL_COURSE_ID", name: "External Course ID", searchable: true, orderable: true },
            { data: "UPDATED_BY", name: "Updated By", searchable: true, orderable: true },
            { data: "LAST_UPDATED_DATETIME", name: "Updated On", searchable: false, orderable: true },
            ...(hasUpdatePermission || hasDeletePermission ? [{
              data: "actions", name: "Action", searchable: false, orderable: false,
              render: (data: any, row: any) => (
                <div className="flex items-center gap-2">
                  {hasUpdatePermission && <button onClick={() => handleEdit(row.skid)} className="text-brand-500 hover:text-brand-700" title="Edit"><PencilIcon className="w-5 h-5" /></button>}
                  {hasDeletePermission && <button onClick={() => handleDeleteClick(row.skid)} className="text-red-500 hover:text-red-700" title="Delete"><TrashBinIcon className="w-5 h-5" /></button>}
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
        }} className="max-w-md">
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
              Add Course
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
                <Label>External Subject *</Label>
                <Input
                  value={formData.EXTERNAL_SUBJECT}
                  onChange={(e) => handleFieldChange("EXTERNAL_SUBJECT", e.target.value)}
                  onBlur={(e) => handleBlur("EXTERNAL_SUBJECT", e.target.value)}
                  placeholder="Enter External Subject"
                  error={!!errors.EXTERNAL_SUBJECT}
                />
                {errors.EXTERNAL_SUBJECT && (
                  <p className="mt-1 text-xs text-red-500">{errors.EXTERNAL_SUBJECT}</p>
                )}
              </div>
              <div>
                <Label>External Course ID *</Label>
                <Input
                  value={formData.EXTERNAL_COURSE_ID}
                  onChange={(e) => handleFieldChange("EXTERNAL_COURSE_ID", e.target.value)}
                  onBlur={(e) => handleBlur("EXTERNAL_COURSE_ID", e.target.value)}
                  placeholder="Enter External Course ID"
                  error={!!errors.EXTERNAL_COURSE_ID}
                />
                {errors.EXTERNAL_COURSE_ID && (
                  <p className="mt-1 text-xs text-red-500">{errors.EXTERNAL_COURSE_ID}</p>
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
        }} className="max-w-md">
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
              Edit Course
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
                <Label>External Subject *</Label>
                <Input
                  value={formData.EXTERNAL_SUBJECT}
                  onChange={(e) => handleFieldChange("EXTERNAL_SUBJECT", e.target.value)}
                  onBlur={(e) => handleBlur("EXTERNAL_SUBJECT", e.target.value)}
                  placeholder="Enter External Subject"
                  error={!!errors.EXTERNAL_SUBJECT}
                />
                {errors.EXTERNAL_SUBJECT && (
                  <p className="mt-1 text-xs text-red-500">{errors.EXTERNAL_SUBJECT}</p>
                )}
              </div>
              <div>
                <Label>External Course ID *</Label>
                <Input
                  value={formData.EXTERNAL_COURSE_ID}
                  onChange={(e) => handleFieldChange("EXTERNAL_COURSE_ID", e.target.value)}
                  onBlur={(e) => handleBlur("EXTERNAL_COURSE_ID", e.target.value)}
                  placeholder="Enter External Course ID"
                  error={!!errors.EXTERNAL_COURSE_ID}
                />
                {errors.EXTERNAL_COURSE_ID && (
                  <p className="mt-1 text-xs text-red-500">{errors.EXTERNAL_COURSE_ID}</p>
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
              setCourseToDelete(null);
            }
          }}
          onConfirm={handleDelete}
          title="Confirm Delete"
          message="Are you sure you want to delete this course? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          confirmVariant="danger"
          isLoading={isDeleting}
        />
      </PageContainer>
    </PageWrapper>
  );
}
