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

export default function GradeMapping() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { hasPermission } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [gradeToDelete, setGradeToDelete] = useState<number | null>(null);
  const [formData, setFormData] = useState({ GRADE: "", GRADE_TO_CONSIDER: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const hasAddPermission = hasPermission("par_grade_mapping", "ADD");
  const hasUpdatePermission = hasPermission("par_grade_mapping", "UPDATE");
  const hasDeletePermission = hasPermission("par_grade_mapping", "DELETE");

  const handleAdd = () => {
    setFormData({ GRADE: "", GRADE_TO_CONSIDER: "" });
    setErrors({});
    setShowAddModal(true);
  };

  const handleEdit = async (id: number) => {
    try {
      const response = await api.post("/api/grademapping/get", { id });
      const data = response;
      if (data.ID) {
        setFormData({ GRADE: data.EQUIVALENT_GRADE || "", GRADE_TO_CONSIDER: data.TRANSCRIPT_GRADE || "" });
        setErrors({});
        setEditingId(data.ID);
        setShowEditModal(true);
      }
    } catch (error: any) {
      alerterror(error.response?.data?.detail || error.message || "Error loading grade data");
    }
  };

  const handleDeleteClick = (id: number) => {
    setGradeToDelete(id);
    setShowDeleteConfirmModal(true);
  };

  const handleDelete = async () => {
    if (!gradeToDelete) return;

    setIsDeleting(true);
    try {
      const response = await api.post("/api/grademapping/delete", { id: gradeToDelete });
      
      const success = response.status === 1 || response.success || response.status === "Success" || response.message?.toLowerCase().includes("success");
      const messageText = response.message || "Grade deleted successfully";

      if (success) {
        alertsuccess(messageText);
        setRefreshTrigger((prev) => prev + 1);
        setShowDeleteConfirmModal(false);
        setGradeToDelete(null);
      } else {
        alerterror(messageText);
        setShowDeleteConfirmModal(false);
        setGradeToDelete(null);
      }
    } catch (error: any) {
      console.error("Delete grade error:", error);
      alerterror(error.response?.data?.detail || error.message || "Error deleting grade");
      setShowDeleteConfirmModal(false);
      setGradeToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Field validation
  const validateField = (name: string, value: string): string => {
    switch (name) {
      case "GRADE":
        if (!value || value.trim() === "") {
          return "Grade is required";
        }
        if (value.trim().length < 1) {
          return "Grade must be at least 1 character";
        }
        return "";
      case "GRADE_TO_CONSIDER":
        if (!value || value.trim() === "") {
          return "Grade To Consider is required";
        }
        if (value.trim().length < 1) {
          return "Grade To Consider must be at least 1 character";
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
    newErrors.GRADE = validateField("GRADE", formData.GRADE);
    newErrors.GRADE_TO_CONSIDER = validateField("GRADE_TO_CONSIDER", formData.GRADE_TO_CONSIDER);

    // If there are errors, set them and return
    const hasErrors = Object.values(newErrors).some((error) => error !== "");
    if (hasErrors) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      const endpoint = isEdit ? "/api/grademapping/update" : "/api/grademapping/insert";
      const body = isEdit
        ? { Id: editingId, ...formData }
        : formData;

      const response = await api.post(endpoint, body);

      const success = response.status === 1 || response.success || response.message?.toLowerCase().includes("success");
      const messageText = response.message || (isEdit ? "Grade updated successfully" : "Grade added successfully");

      if (success) {
        alertsuccess(messageText);
        setShowAddModal(false);
        setShowEditModal(false);
        setFormData({ GRADE: "", GRADE_TO_CONSIDER: "" });
        setEditingId(null);
        setRefreshTrigger((prev) => prev + 1);
      } else {
        alerterror(messageText || "Error saving grade");
      }
    } catch (error: any) {
      console.error("Save grade error:", error);
      alerterror(error.response?.data?.detail || error.message || "Error saving grade");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageWrapper>
      <PageMeta title="Equivalent Grades Mapping | College Module" description="Manage equivalent grade mappings" />
      <PageBreadcrumb pageTitle="Equivalent Grades Mapping" />
      <PageContainer>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">View Equivalent Grades</h3>
          <div className="flex items-center gap-2">
            {hasAddPermission && (
              <Button onClick={handleAdd}>Add Grade</Button>
            )}
            <Button onClick={() => setRefreshTrigger((prev) => prev + 1)} variant="outline" startIcon={<RefreshIcon className="w-5 h-5" />}>Refresh Data</Button>
          </div>
        </div>

        <DataTable
          refreshTrigger={refreshTrigger}
          ajaxUrl="/api/grademapping/ajaxlist"
          columns={[
            { data: "EQUIVALENT_GRADE", name: "Equivalent Grade", searchable: true, orderable: true },
            { data: "TRANSCRIPT_GRADE", name: "Transcript Grade", searchable: true, orderable: true },
            { data: "UPDATED_BY", name: "Updated By", searchable: true, orderable: true },
            { data: "UPDATED_ON", name: "Updated On", searchable: false, orderable: true },
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
              Add Equivalent Grade
            </h3>
          </div>

          {/* Modal Body */}
          <div className="p-6">
            <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
              <div>
                <Label>Grade *</Label>
                <Input
                  value={formData.GRADE}
                  onChange={(e) => handleFieldChange("GRADE", e.target.value)}
                  onBlur={(e) => handleBlur("GRADE", e.target.value)}
                  placeholder="Enter Grade"
                  error={!!errors.GRADE}
                />
                {errors.GRADE && (
                  <p className="mt-1 text-xs text-red-500">{errors.GRADE}</p>
                )}
              </div>
              <div>
                <Label>Grade To Consider *</Label>
                <Input
                  value={formData.GRADE_TO_CONSIDER}
                  onChange={(e) => handleFieldChange("GRADE_TO_CONSIDER", e.target.value)}
                  onBlur={(e) => handleBlur("GRADE_TO_CONSIDER", e.target.value)}
                  placeholder="Enter Grade To Consider"
                  error={!!errors.GRADE_TO_CONSIDER}
                />
                {errors.GRADE_TO_CONSIDER && (
                  <p className="mt-1 text-xs text-red-500">{errors.GRADE_TO_CONSIDER}</p>
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
              Edit Equivalent Grade
            </h3>
          </div>

          {/* Modal Body */}
          <div className="p-6">
            <form onSubmit={(e) => handleSubmit(e, true)} className="space-y-4">
              <div>
                <Label>Grade *</Label>
                <Input
                  value={formData.GRADE}
                  onChange={(e) => handleFieldChange("GRADE", e.target.value)}
                  onBlur={(e) => handleBlur("GRADE", e.target.value)}
                  placeholder="Enter Grade"
                  error={!!errors.GRADE}
                />
                {errors.GRADE && (
                  <p className="mt-1 text-xs text-red-500">{errors.GRADE}</p>
                )}
              </div>
              <div>
                <Label>Grade To Consider *</Label>
                <Input
                  value={formData.GRADE_TO_CONSIDER}
                  onChange={(e) => handleFieldChange("GRADE_TO_CONSIDER", e.target.value)}
                  onBlur={(e) => handleBlur("GRADE_TO_CONSIDER", e.target.value)}
                  placeholder="Enter Grade To Consider"
                  error={!!errors.GRADE_TO_CONSIDER}
                />
                {errors.GRADE_TO_CONSIDER && (
                  <p className="mt-1 text-xs text-red-500">{errors.GRADE_TO_CONSIDER}</p>
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
              setGradeToDelete(null);
            }
          }}
          onConfirm={handleDelete}
          title="Confirm Delete"
          message="Are you sure you want to delete this grade? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          confirmVariant="danger"
          isLoading={isDeleting}
        />
      </PageContainer>
    </PageWrapper>
  );
}
