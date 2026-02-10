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
import { RefreshIcon, PencilIcon, TrashBinIcon } from "../../../../icons";
import { useAuth } from "../../../../context/AuthContext";
import ConfirmationModal from "../../../../components/common/ConfirmationModal";
import { alertsuccess, alerterror } from "../../../../utils/toast";

interface GpaScaleFormData {
  PERCENTAGE: string;
  GPA: string;
}

const INITIAL_FORM_DATA: GpaScaleFormData = {
  PERCENTAGE: "",
  GPA: "",
};

export default function GpaScaleMapping() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { hasPermission } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [gpaScaleToDelete, setGpaScaleToDelete] = useState<number | null>(null);
  const [formData, setFormData] = useState<GpaScaleFormData>({ ...INITIAL_FORM_DATA });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const hasAddPermission = hasPermission("gpa_scale_mapping", "ADD");
  const hasUpdatePermission = hasPermission("gpa_scale_mapping", "UPDATE");
  const hasDeletePermission = hasPermission("gpa_scale_mapping", "DELETE");

  const handleAdd = () => {
    setFormData({ ...INITIAL_FORM_DATA });
    setErrors({});
    setShowAddModal(true);
  };

  const handleEdit = async (id: number) => {
    try {
      const response = await api.post("/api/gpascalemapping/get", { id });
      const data = response;
      if (data.Id) {
        setFormData({
          PERCENTAGE: data.PERCENTAGE || "",
          GPA: data.GPA || "",
        });
        setErrors({});
        setEditingId(data.Id);
        setShowEditModal(true);
      }
    } catch (error: any) {
      alerterror(error.response?.data?.detail || error.message || "Error loading GPA Scale data");
    }
  };

  const handleDeleteClick = (id: number) => {
    setGpaScaleToDelete(id);
    setShowDeleteConfirmModal(true);
  };

  const handleDelete = async () => {
    if (!gpaScaleToDelete) return;

    setIsDeleting(true);
    try {
      const response = await api.post("/api/gpascalemapping/delete", { id: gpaScaleToDelete });

      const success = response.status === 1 || response.success || response.status === "Success" || response.message?.toLowerCase().includes("success");
      const messageText = response.message || "GPA Scale Mapping deleted successfully";

      if (success) {
        alertsuccess(messageText);
        setRefreshTrigger((prev) => prev + 1);
        setShowDeleteConfirmModal(false);
        setGpaScaleToDelete(null);
      } else {
        alerterror(messageText);
        setShowDeleteConfirmModal(false);
        setGpaScaleToDelete(null);
      }
    } catch (error: any) {
      console.error("Delete GPA Scale error:", error);
      alerterror(error.response?.data?.detail || error.message || "Error deleting GPA Scale Mapping");
      setShowDeleteConfirmModal(false);
      setGpaScaleToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Field validation
  const validateField = (name: string, value: string): string => {
    switch (name) {
      case "PERCENTAGE":
        if (!value || value.trim() === "") return "Percentage is required";
        return "";
      case "GPA":
        if (!value || value.trim() === "") return "GPA is required";
        return "";
      default:
        return "";
    }
  };

  const handleFieldChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
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
    newErrors.PERCENTAGE = validateField("PERCENTAGE", formData.PERCENTAGE);
    newErrors.GPA = validateField("GPA", formData.GPA);

    const hasErrors = Object.values(newErrors).some((error) => error !== "");
    if (hasErrors) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      const endpoint = isEdit ? "/api/gpascalemapping/update" : "/api/gpascalemapping/insert";
      const body = isEdit
        ? { Id: editingId, ...formData }
        : formData;

      const response = await api.post(endpoint, body);

      const success = response.status === 1 || response.success || response.message?.toLowerCase().includes("success");
      const messageText = response.message || (isEdit ? "GPA Scale Mapping updated successfully" : "GPA Scale Mapping added successfully");

      if (success) {
        alertsuccess(messageText);
        setShowAddModal(false);
        setShowEditModal(false);
        setFormData({ ...INITIAL_FORM_DATA });
        setEditingId(null);
        setRefreshTrigger((prev) => prev + 1);
      } else {
        alerterror(messageText || "Error saving GPA Scale Mapping");
      }
    } catch (error: any) {
      console.error("Save GPA Scale error:", error);
      alerterror(error.response?.data?.detail || error.message || "Error saving GPA Scale Mapping");
    } finally {
      setLoading(false);
    }
  };

  // Form content shared between Add and Edit modals
  const FormFields = () => (
    <>
      <div>
        <Label>Percentage *</Label>
        <Input
          value={formData.PERCENTAGE}
          onChange={(e) => handleFieldChange("PERCENTAGE", e.target.value)}
          onBlur={(e) => handleBlur("PERCENTAGE", e.target.value)}
          placeholder="Enter Percentage"
          error={!!errors.PERCENTAGE}
        />
        {errors.PERCENTAGE && (
          <p className="mt-1 text-xs text-red-500">{errors.PERCENTAGE}</p>
        )}
      </div>
      <div>
        <Label>GPA *</Label>
        <Input
          value={formData.GPA}
          onChange={(e) => handleFieldChange("GPA", e.target.value)}
          onBlur={(e) => handleBlur("GPA", e.target.value)}
          placeholder="Enter GPA"
          error={!!errors.GPA}
        />
        {errors.GPA && (
          <p className="mt-1 text-xs text-red-500">{errors.GPA}</p>
        )}
      </div>
    </>
  );

  return (
    <PageWrapper>
      <PageMeta title="GPA Scale Mapping | School Module" description="Manage GPA Scale mappings" />
      <PageBreadcrumb pageTitle="GPA Scale Mapping" />
      <PageContainer>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">View GPA Scale Mapping</h3>
          <div className="flex items-center gap-2">
            {hasAddPermission && (
              <Button onClick={handleAdd}>Add GPA Scale Mapping</Button>
            )}
            <Button onClick={() => setRefreshTrigger((prev) => prev + 1)} variant="outline" startIcon={<RefreshIcon className="w-5 h-5" />}>Refresh Data</Button>
          </div>
        </div>

        <DataTable
          refreshTrigger={refreshTrigger}
          ajaxUrl="/api/gpascalemapping/ajaxlist"
          columns={[
            { data: "PERCENTAGE", name: "Percentage", searchable: true, orderable: true, textCenter: true },
            { data: "GPA", name: "GPA", searchable: true, orderable: true, textCenter: true },
            { data: "UPDATED_BY", name: "Updated By", searchable: true, orderable: true },
            { data: "UPDATED_DATE", name: "Updated On", searchable: false, orderable: true },
            ...(hasUpdatePermission || hasDeletePermission ? [{
              data: "actions", name: "Action", searchable: false, orderable: false,
              render: (_data: any, row: any) => (
                <div className="flex items-center gap-2">
                  {hasUpdatePermission && <button onClick={() => handleEdit(row.Id)} className="text-brand-500 hover:text-brand-700" title="Edit"><PencilIcon className="w-5 h-5" /></button>}
                  {hasDeletePermission && <button onClick={() => handleDeleteClick(row.Id)} className="text-red-500 hover:text-red-700" title="Delete"><TrashBinIcon className="w-5 h-5" /></button>}
                </div>
              ),
            }] : []),
          ]}
        />

        {/* Add Modal */}
        <Modal isOpen={showAddModal} onClose={() => { setShowAddModal(false); setErrors({}); }} className="max-w-md">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Add GPA Scale Mapping</h3>
          </div>
          <div className="p-6">
            <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
              <FormFields />
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
                <Button variant="outline" onClick={() => { setShowAddModal(false); setErrors({}); }} className="flex-1" disabled={loading}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </Modal>

        {/* Edit Modal */}
        <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setEditingId(null); setErrors({}); }} className="max-w-md">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Edit GPA Scale Mapping</h3>
          </div>
          <div className="p-6">
            <form onSubmit={(e) => handleSubmit(e, true)} className="space-y-4">
              <FormFields />
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
                <Button variant="outline" onClick={() => { setShowEditModal(false); setEditingId(null); setErrors({}); }} className="flex-1" disabled={loading}>
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
              setGpaScaleToDelete(null);
            }
          }}
          onConfirm={handleDelete}
          title="Confirm Delete"
          message="Are you sure you want to delete this GPA Scale Mapping? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          confirmVariant="danger"
          isLoading={isDeleting}
        />
      </PageContainer>
    </PageWrapper>
  );
}
