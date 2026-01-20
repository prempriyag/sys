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
import AddDegreeModal from "./AddDegreeModal";
import EditDegreeModal from "./EditDegreeModal";
import { Modal } from "../../../../components/ui/modal";
import Input from "../../../../components/form/input/InputField";
import Label from "../../../../components/form/Label";
import ConfirmationModal from "../../../../components/common/ConfirmationModal";

export default function DegreeMapping() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { hasPermission } = useAuth();
  const { alertsuccess, alerterror } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [degreeToDelete, setDegreeToDelete] = useState<number | null>(null);
  const [formData, setFormData] = useState({ DEGREE_CD: "", DEGREE_NAME: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const hasAddPermission = hasPermission("college_degree", "ADD");
  const hasUpdatePermission = hasPermission("college_degree", "UPDATE");
  const hasDeletePermission = hasPermission("college_degree", "DELETE");

  const handleAdd = () => {
    setFormData({ DEGREE_CD: "", DEGREE_NAME: "" });
    setErrors({});
    setShowAddModal(true);
    setMessage(null);
  };

  const handleEdit = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/degreemapping/get`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({ id }),
      });

      const data = await response.json();
      if (data.Id) {
        setFormData({ DEGREE_CD: data.DEGREE_CD, DEGREE_NAME: data.DEGREE_NAME });
        setErrors({});
        setEditingId(id);
        setShowEditModal(true);
        setMessage(null);
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Error loading degree data" });
    }
  };

  const handleDeleteClick = (id: number) => {
    setDegreeToDelete(id);
    setShowDeleteConfirmModal(true);
  };

  const handleDelete = async () => {
    if (!degreeToDelete) return;

    setIsDeleting(true);
    try {
      const response = await api.post("/api/degreemapping/delete", { id: degreeToDelete });
      
      if (response.status === "Success") {
        setMessage({ type: "success", text: "Degree deleted successfully" });
        setRefreshTrigger((prev) => prev + 1);
        setShowDeleteConfirmModal(false);
        setDegreeToDelete(null);
        // Clear message after 5 seconds
        setTimeout(() => setMessage(null), 5000);
      } else {
        setMessage({ type: "error", text: "Error deleting degree" });
        setShowDeleteConfirmModal(false);
        setDegreeToDelete(null);
        // Clear message after 5 seconds
        setTimeout(() => setMessage(null), 5000);
      }
    } catch (error: any) {
      console.error("Delete degree error:", error);
      setMessage({ type: "error", text: error.response?.data?.detail || error.message || "Error deleting degree" });
      setShowDeleteConfirmModal(false);
      setDegreeToDelete(null);
      // Clear message after 5 seconds
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setIsDeleting(false);
    }
  };

  // Field validation
  const validateField = (name: string, value: string): string => {
    switch (name) {
      case "DEGREE_CD":
        if (!value || value.trim() === "") {
          return "Degree Code is required";
        }
        if (value.trim().length < 2) {
          return "Degree Code must be at least 2 characters";
        }
        return "";
      case "DEGREE_NAME":
        if (!value || value.trim() === "") {
          return "Degree Name is required";
        }
        if (value.trim().length < 2) {
          return "Degree Name must be at least 2 characters";
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
    newErrors.DEGREE_CD = validateField("DEGREE_CD", formData.DEGREE_CD);
    newErrors.DEGREE_NAME = validateField("DEGREE_NAME", formData.DEGREE_NAME);

    // If there are errors, set them and return
    const hasErrors = Object.values(newErrors).some((error) => error !== "");
    if (hasErrors) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      const endpoint = isEdit ? "/api/degreemapping/update" : "/api/degreemapping/insert";
      const body = isEdit
        ? { Id: editingId, ...formData }
        : formData;

      const response = await api.post(endpoint, body);

      if (response.status === 1) {
        const successMessage = response.message || (isEdit ? "Degree updated successfully" : "Degree added successfully");
        setMessage({ type: "success", text: successMessage });
        setShowAddModal(false);
        setShowEditModal(false);
        setFormData({ DEGREE_CD: "", DEGREE_NAME: "" });
        setEditingId(null);
        setRefreshTrigger((prev) => prev + 1);
        // Clear message after 5 seconds
        setTimeout(() => setMessage(null), 5000);
      } else {
        setMessage({ type: "error", text: response.message || "Error saving degree" });
        // Clear message after 5 seconds
        setTimeout(() => setMessage(null), 5000);
      }
    } catch (error: any) {
      console.error("Save degree error:", error);
      setMessage({ type: "error", text: error.response?.data?.detail || error.message || "Error saving degree" });
      // Clear message after 5 seconds
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageWrapper>
      <PageMeta
        title="Degree Mapping | College Module"
        description="Manage degree mappings"
      />
      <PageBreadcrumb pageTitle="Degree Mapping" />

      <PageContainer>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">
            View Degrees
          </h3>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setRefreshTrigger((prev) => prev + 1)}
              variant="outline"
              startIcon={<RefreshIcon className="w-5 h-5" />}
            >
              Refresh Data
            </Button>
            {hasAddPermission && (
              <Button
                onClick={() => setShowAddModal(true)}
                startIcon={<PlusIcon className="w-5 h-5" />}
              >
                Add Degree
              </Button>
            )}
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
          ajaxUrl="/api/degreemapping/ajaxlist"
          columns={[
            { data: "DEGREE_CD", name: "Degree Code", searchable: true, orderable: true },
            { data: "DEGREE_NAME", name: "Degree Name", searchable: true, orderable: true },
            { data: "UPDATED_BY", name: "Updated By", searchable: true, orderable: true },
            { data: "LAST_UPDATED_DATETIME", name: "Updated On", searchable: false, orderable: true },
            ...(hasUpdatePermission || hasDeletePermission
              ? [
                  {
                    data: "actions",
                    name: "Action",
                    searchable: false,
                    orderable: false,
                    render: (_data: any, row: any) => {
                      return (
                        <div className="flex items-center gap-3">
                          {hasUpdatePermission && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditClick(row.Id);
                              }}
                              className="text-brand-500 hover:text-brand-600 dark:text-brand-400 transition-colors"
                              title="Edit Degree"
                            >
                              <PencilIcon className="w-5 h-5" />
                            </button>
                          )}
                          {hasDeletePermission && (
                            <button
                              onClick={() => handleDeleteClick(row.Id)}
                              className="text-red-500 hover:text-red-700"
                              title="Delete"
                            >
                              <TrashBinIcon className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      );
                    },
                  },
                ]
              : []),
          ]}
        />

        {/* Add Modal */}
        <Modal isOpen={showAddModal}         onClose={() => {
          setShowAddModal(false);
          setMessage(null);
          setErrors({});
        }} className="max-w-md">
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
              Add Degree
            </h3>
          </div>

          {/* Modal Body */}
          <div className="p-6">
            <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
              <div>
                <Label>Degree Code *</Label>
                <Input
                  value={formData.DEGREE_CD}
                  onChange={(e) => handleFieldChange("DEGREE_CD", e.target.value)}
                  onBlur={(e) => handleBlur("DEGREE_CD", e.target.value)}
                  placeholder="Enter Degree Code"
                  error={!!errors.DEGREE_CD}
                />
                {errors.DEGREE_CD && (
                  <p className="mt-1 text-xs text-red-500">{errors.DEGREE_CD}</p>
                )}
              </div>
              <div>
                <Label>Degree Name *</Label>
                <Input
                  value={formData.DEGREE_NAME}
                  onChange={(e) => handleFieldChange("DEGREE_NAME", e.target.value)}
                  onBlur={(e) => handleBlur("DEGREE_NAME", e.target.value)}
                  placeholder="Enter Degree Name"
                  error={!!errors.DEGREE_NAME}
                />
                {errors.DEGREE_NAME && (
                  <p className="mt-1 text-xs text-red-500">{errors.DEGREE_NAME}</p>
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
        <Modal isOpen={showEditModal}         onClose={() => {
          setShowEditModal(false);
          setEditingId(null);
          setMessage(null);
          setErrors({});
        }} className="max-w-md">
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
              Edit Degree
            </h3>
          </div>

          {/* Modal Body */}
          <div className="p-6">
            <form onSubmit={(e) => handleSubmit(e, true)} className="space-y-4">
              <div>
                <Label>Degree Code *</Label>
                <Input
                  value={formData.DEGREE_CD}
                  onChange={(e) => handleFieldChange("DEGREE_CD", e.target.value)}
                  onBlur={(e) => handleBlur("DEGREE_CD", e.target.value)}
                  placeholder="Enter Degree Code"
                  error={!!errors.DEGREE_CD}
                />
                {errors.DEGREE_CD && (
                  <p className="mt-1 text-xs text-red-500">{errors.DEGREE_CD}</p>
                )}
              </div>
              <div>
                <Label>Degree Name *</Label>
                <Input
                  value={formData.DEGREE_NAME}
                  onChange={(e) => handleFieldChange("DEGREE_NAME", e.target.value)}
                  onBlur={(e) => handleBlur("DEGREE_NAME", e.target.value)}
                  placeholder="Enter Degree Name"
                  error={!!errors.DEGREE_NAME}
                />
                {errors.DEGREE_NAME && (
                  <p className="mt-1 text-xs text-red-500">{errors.DEGREE_NAME}</p>
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
                    "Submit"
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
              setDegreeToDelete(null);
            }
          }}
          onConfirm={handleDelete}
          title="Confirm Delete"
          message="Are you sure you want to delete this degree? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          confirmVariant="danger"
          isLoading={isDeleting}
        />
      </PageContainer>

      {/* Add Degree Modal */}
      <AddDegreeModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          setRefreshTrigger((prev) => prev + 1);
        }}
      />

      {/* Edit Degree Modal */}
      <EditDegreeModal
        isOpen={showEditModal}
        degreeId={selectedDegreeId}
        onClose={() => {
          setShowEditModal(false);
          setSelectedDegreeId(null);
        }}
        onSuccess={() => {
          setRefreshTrigger((prev) => prev + 1);
        }}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirmModal}
        onClose={() => {
          setShowDeleteConfirmModal(false);
          setDegreeToDelete(null);
        }}
        onConfirm={handleDeleteDegree}
        title="Confirm Delete"
        message="Are you sure you want to delete this degree? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="danger"
      />
    </PageWrapper>
  );
}



