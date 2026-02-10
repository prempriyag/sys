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

export default function OverrideEditMapping() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { hasPermission } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [overrideToDelete, setOverrideToDelete] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    INSTITUTION_ID: "", TERM: "", SUBJECT: "", COURSE: "", EQV_SUBJECT: "", EQV_COURSE: "", COURSE_ATTRIBUTE: ""
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const hasAddPermission = hasPermission("override_edit_mapping", "ADD");
  const hasUpdatePermission = hasPermission("override_edit_mapping", "UPDATE");
  const hasDeletePermission = hasPermission("override_edit_mapping", "DELETE");

  // Helper function to copy text to clipboard
  const copyToClipboard = (text: string | number) => {
    const str = String(text ?? "").trim();
    if (!str) return;
    navigator.clipboard.writeText(str).then(() => {
      alertsuccess("Copied to clipboard!");
    }).catch(() => console.error("Failed to copy"));
  };

  const handleAdd = () => {
    setFormData({ INSTITUTION_ID: "", TERM: "", SUBJECT: "", COURSE: "", EQV_SUBJECT: "", EQV_COURSE: "", COURSE_ATTRIBUTE: "" });
    setErrors({});
    setShowAddModal(true);
  };

  const handleEdit = async (id: number) => {
    try {
      const response = await api.post("/api/overrideeditmapping/get", { id });
      const data = response;
      if (data.Id) {
        setFormData({
          INSTITUTION_ID: data.INSTITUTION_ID || "", TERM: data.TERM || "", SUBJECT: data.SUBJECT || "",
          COURSE: data.COURSE || "", EQV_SUBJECT: data.EQV_SUBJECT || "", EQV_COURSE: data.EQV_COURSE || "",
          COURSE_ATTRIBUTE: data.COURSE_ATTRIBUTE || ""
        });
        setErrors({});
        setEditingId(data.Id);
        setShowEditModal(true);
      }
    } catch (error: any) {
      alerterror(error.response?.data?.detail || error.message || "Error loading override data");
    }
  };

  const handleDeleteClick = (id: number) => {
    setOverrideToDelete(id);
    setShowDeleteConfirmModal(true);
  };

  const handleDelete = async () => {
    if (!overrideToDelete) return;

    setIsDeleting(true);
    try {
      const response = await api.post("/api/overrideeditmapping/delete", { id: overrideToDelete });
      
      const success = response.status === 1 || response.success || response.status === "Success" || response.message?.toLowerCase().includes("success");
      const messageText = response.message || "Override deleted successfully";

      if (success) {
        alertsuccess(messageText);
        setRefreshTrigger((prev) => prev + 1);
        setShowDeleteConfirmModal(false);
        setOverrideToDelete(null);
      } else {
        alerterror(messageText);
        setShowDeleteConfirmModal(false);
        setOverrideToDelete(null);
      }
    } catch (error: any) {
      console.error("Delete override error:", error);
      alerterror(error.response?.data?.detail || error.message || "Error deleting override");
      setShowDeleteConfirmModal(false);
      setOverrideToDelete(null);
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
      case "TERM":
        if (!value || value.trim() === "") {
          return "Term is required";
        }
        return "";
      case "SUBJECT":
        if (!value || value.trim() === "") {
          return "Subject is required";
        }
        return "";
      case "COURSE":
        if (!value || value.trim() === "") {
          return "Course is required";
        }
        return "";
      case "EQV_SUBJECT":
      case "EQV_COURSE":
      case "COURSE_ATTRIBUTE":
        // Optional fields, no validation needed
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

    // Validate all required fields
    const newErrors: Record<string, string> = {};
    newErrors.INSTITUTION_ID = validateField("INSTITUTION_ID", formData.INSTITUTION_ID);
    newErrors.TERM = validateField("TERM", formData.TERM);
    newErrors.SUBJECT = validateField("SUBJECT", formData.SUBJECT);
    newErrors.COURSE = validateField("COURSE", formData.COURSE);

    // If there are errors, set them and return
    const hasErrors = Object.values(newErrors).some((error) => error !== "");
    if (hasErrors) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      const endpoint = isEdit ? "/api/overrideeditmapping/update" : "/api/overrideeditmapping/insert";
      const body = isEdit
        ? { Id: editingId, ...formData }
        : formData;

      const response = await api.post(endpoint, body);

      const success = response.status === 1 || response.success || response.message?.toLowerCase().includes("success");
      const messageText = response.message || (isEdit ? "Override updated successfully" : "Override added successfully");

      if (success) {
        alertsuccess(messageText);
        setShowAddModal(false);
        setShowEditModal(false);
        setFormData({ INSTITUTION_ID: "", TERM: "", SUBJECT: "", COURSE: "", EQV_SUBJECT: "", EQV_COURSE: "", COURSE_ATTRIBUTE: "" });
        setEditingId(null);
        setRefreshTrigger((prev) => prev + 1);
      } else {
        alerterror(messageText || "Error saving override");
      }
    } catch (error: any) {
      console.error("Save override error:", error);
      alerterror(error.response?.data?.detail || error.message || "Error saving override");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageWrapper>
      <PageMeta title="Override Edit Mapping | College Module" description="Manage override edit mappings" />
      <PageBreadcrumb pageTitle="Override Edit Mapping" />
      <PageContainer>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">View Override Edit Mappings</h3>
          <div className="flex items-center gap-2">
            {hasAddPermission && (
              <Button onClick={handleAdd}>Add Override</Button>
            )}
            <Button onClick={() => setRefreshTrigger((prev) => prev + 1)} variant="outline" startIcon={<RefreshIcon className="w-5 h-5" />}>Refresh Data</Button>
          </div>
        </div>

        <DataTable
          refreshTrigger={refreshTrigger}
          ajaxUrl="/api/overrideeditmapping/ajaxlist"
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
            { data: "TERM", name: "Term", searchable: true, orderable: true },
            { data: "SUBJECT", name: "Subject", searchable: true, orderable: true },
            { data: "COURSE", name: "Course", searchable: true, orderable: true },
            { data: "EQV_SUBJECT", name: "Equivalent Subject", searchable: true, orderable: true },
            { data: "EQV_COURSE", name: "Equivalent Course", searchable: true, orderable: true },
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
        }} className="max-w-2xl">
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
              Add Override
            </h3>
          </div>

          {/* Modal Body */}
          <div className="p-6 max-h-[80vh] overflow-y-auto">
            <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
                  <Label>Subject *</Label>
                  <Input
                    value={formData.SUBJECT}
                    onChange={(e) => handleFieldChange("SUBJECT", e.target.value)}
                    onBlur={(e) => handleBlur("SUBJECT", e.target.value)}
                    placeholder="Enter Subject"
                    error={!!errors.SUBJECT}
                  />
                  {errors.SUBJECT && (
                    <p className="mt-1 text-xs text-red-500">{errors.SUBJECT}</p>
                  )}
                </div>
                <div>
                  <Label>Course *</Label>
                  <Input
                    value={formData.COURSE}
                    onChange={(e) => handleFieldChange("COURSE", e.target.value)}
                    onBlur={(e) => handleBlur("COURSE", e.target.value)}
                    placeholder="Enter Course"
                    error={!!errors.COURSE}
                  />
                  {errors.COURSE && (
                    <p className="mt-1 text-xs text-red-500">{errors.COURSE}</p>
                  )}
                </div>
                <div>
                  <Label>Equivalent Subject</Label>
                  <Input
                    value={formData.EQV_SUBJECT}
                    onChange={(e) => handleFieldChange("EQV_SUBJECT", e.target.value)}
                    placeholder="Enter Equivalent Subject"
                  />
                </div>
                <div>
                  <Label>Equivalent Course</Label>
                  <Input
                    value={formData.EQV_COURSE}
                    onChange={(e) => handleFieldChange("EQV_COURSE", e.target.value)}
                    placeholder="Enter Equivalent Course"
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
        }} className="max-w-2xl">
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
              Edit Override
            </h3>
          </div>

          {/* Modal Body */}
          <div className="p-6 max-h-[80vh] overflow-y-auto">
            <form onSubmit={(e) => handleSubmit(e, true)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
                  <Label>Subject *</Label>
                  <Input
                    value={formData.SUBJECT}
                    onChange={(e) => handleFieldChange("SUBJECT", e.target.value)}
                    onBlur={(e) => handleBlur("SUBJECT", e.target.value)}
                    placeholder="Enter Subject"
                    error={!!errors.SUBJECT}
                  />
                  {errors.SUBJECT && (
                    <p className="mt-1 text-xs text-red-500">{errors.SUBJECT}</p>
                  )}
                </div>
                <div>
                  <Label>Course *</Label>
                  <Input
                    value={formData.COURSE}
                    onChange={(e) => handleFieldChange("COURSE", e.target.value)}
                    onBlur={(e) => handleBlur("COURSE", e.target.value)}
                    placeholder="Enter Course"
                    error={!!errors.COURSE}
                  />
                  {errors.COURSE && (
                    <p className="mt-1 text-xs text-red-500">{errors.COURSE}</p>
                  )}
                </div>
                <div>
                  <Label>Equivalent Subject</Label>
                  <Input
                    value={formData.EQV_SUBJECT}
                    onChange={(e) => handleFieldChange("EQV_SUBJECT", e.target.value)}
                    placeholder="Enter Equivalent Subject"
                  />
                </div>
                <div>
                  <Label>Equivalent Course</Label>
                  <Input
                    value={formData.EQV_COURSE}
                    onChange={(e) => handleFieldChange("EQV_COURSE", e.target.value)}
                    placeholder="Enter Equivalent Course"
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
              setOverrideToDelete(null);
            }
          }}
          onConfirm={handleDelete}
          title="Confirm Delete"
          message="Are you sure you want to delete this override? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          confirmVariant="danger"
          isLoading={isDeleting}
        />
      </PageContainer>
    </PageWrapper>
  );
}
