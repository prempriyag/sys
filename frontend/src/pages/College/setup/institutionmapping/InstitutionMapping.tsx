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

interface InstitutionMappingProps {
  instType?: string;
}

export default function InstitutionMapping({ instType = "" }: InstitutionMappingProps) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { hasPermission } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [institutionToDelete, setInstitutionToDelete] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    INSTITUTION_TYPE: "", INSTITUTION_ID: "", INSTITUTION_NAME: "", INSTITUTION_ZIPCODE: "",
    SLATE_INSTITUTION_ID: "", SLATE_INSTITUTION_NAME: "", EXTERNAL_INSTITUTION_NAME: "", EXTERNAL_INSTITUTION_ZIPCODE: ""
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const hasAddPermission = hasPermission("institutions_mapping", "ADD");
  const hasUpdatePermission = hasPermission("institutions_mapping", "UPDATE");
  const hasDeletePermission = hasPermission("institutions_mapping", "DELETE");

  // Helper function to copy text to clipboard
  const copyToClipboard = (text: string | number) => {
    const str = String(text ?? "").trim();
    if (!str) return;
    navigator.clipboard.writeText(str).then(() => {
      alertsuccess("Copied to clipboard!");
    }).catch(() => console.error("Failed to copy"));
  };

  const handleAdd = () => {
    setFormData({
      INSTITUTION_TYPE: instType || "", INSTITUTION_ID: "", INSTITUTION_NAME: "", INSTITUTION_ZIPCODE: "",
      SLATE_INSTITUTION_ID: "", SLATE_INSTITUTION_NAME: "", EXTERNAL_INSTITUTION_NAME: "", EXTERNAL_INSTITUTION_ZIPCODE: ""
    });
    setErrors({});
    setShowAddModal(true);
    setMessage(null);
  };

  const handleEdit = async (id: number) => {
    try {
      const response = await api.post("/api/institutionmapping/get", { id });
      const data = response;
      if (data.Id) {
        setFormData({
          INSTITUTION_TYPE: data.INSTITUTION_TYPE || "", INSTITUTION_ID: data.INSTITUTION_ID || "", INSTITUTION_NAME: data.INSTITUTION_NAME || "",
          INSTITUTION_ZIPCODE: data.INSTITUTION_ZIPCODE || "", SLATE_INSTITUTION_ID: data.SLATE_INSTITUTION_ID || "",
          SLATE_INSTITUTION_NAME: data.SLATE_INSTITUTION_NAME || "", EXTERNAL_INSTITUTION_NAME: data.EXTERNAL_INSTITUTION_NAME || "",
          EXTERNAL_INSTITUTION_ZIPCODE: data.EXTERNAL_INSTITUTION_ZIPCODE || ""
        });
        setErrors({});
        setEditingId(data.Id);
        setShowEditModal(true);
        setMessage(null);
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.response?.data?.detail || error.message || "Error loading institution data" });
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
      const response = await api.post("/api/institutionmapping/delete", { id: institutionToDelete });
      
      const success = response.status === 1 || response.success || response.status === "Success" || response.message?.toLowerCase().includes("success");
      const messageText = response.message || "Institution deleted successfully";

      if (success) {
        setMessage({ type: "success", text: messageText });
        setRefreshTrigger((prev) => prev + 1);
        setShowDeleteConfirmModal(false);
        setInstitutionToDelete(null);
        setTimeout(() => setMessage(null), 5000);
      } else {
        setMessage({ type: "error", text: messageText });
        setShowDeleteConfirmModal(false);
        setInstitutionToDelete(null);
        setTimeout(() => setMessage(null), 5000);
      }
    } catch (error: any) {
      console.error("Delete institution error:", error);
      setMessage({ type: "error", text: error.response?.data?.detail || error.message || "Error deleting institution" });
      setShowDeleteConfirmModal(false);
      setInstitutionToDelete(null);
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
      case "INSTITUTION_NAME":
        if (!value || value.trim() === "") {
          return "Institution Name is required";
        }
        if (value.trim().length < 2) {
          return "Institution Name must be at least 2 characters";
        }
        return "";
      case "SLATE_INSTITUTION_ID":
        if (!value || value.trim() === "") {
          return "Slate Institution ID is required";
        }
        return "";
      case "SLATE_INSTITUTION_NAME":
        if (!value || value.trim() === "") {
          return "Slate Institution Name is required";
        }
        if (value.trim().length < 2) {
          return "Slate Institution Name must be at least 2 characters";
        }
        return "";
      case "EXTERNAL_INSTITUTION_NAME":
        if (!value || value.trim() === "") {
          return "External Institution Name is required";
        }
        if (value.trim().length < 2) {
          return "External Institution Name must be at least 2 characters";
        }
        return "";
      case "INSTITUTION_TYPE":
      case "INSTITUTION_ZIPCODE":
      case "EXTERNAL_INSTITUTION_ZIPCODE":
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

    // Validate all fields
    const newErrors: Record<string, string> = {};
    newErrors.INSTITUTION_ID = validateField("INSTITUTION_ID", formData.INSTITUTION_ID);
    newErrors.INSTITUTION_NAME = validateField("INSTITUTION_NAME", formData.INSTITUTION_NAME);
    newErrors.SLATE_INSTITUTION_ID = validateField("SLATE_INSTITUTION_ID", formData.SLATE_INSTITUTION_ID);
    newErrors.SLATE_INSTITUTION_NAME = validateField("SLATE_INSTITUTION_NAME", formData.SLATE_INSTITUTION_NAME);
    newErrors.EXTERNAL_INSTITUTION_NAME = validateField("EXTERNAL_INSTITUTION_NAME", formData.EXTERNAL_INSTITUTION_NAME);

    // If there are errors, set them and return
    const hasErrors = Object.values(newErrors).some((error) => error !== "");
    if (hasErrors) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      const endpoint = isEdit ? "/api/institutionmapping/update" : "/api/institutionmapping/insert";
      const body = isEdit ? { Id: editingId, ...formData } : formData;

      const response = await api.post(endpoint, body);

      const success = response.status === 1 || response.success || response.message?.toLowerCase().includes("success");
      const messageText = response.message || (isEdit ? "Institution updated successfully" : "Institution added successfully");

      if (success) {
        setMessage({ type: "success", text: messageText });
        setShowAddModal(false);
        setShowEditModal(false);
        setFormData({
          INSTITUTION_TYPE: instType || "", INSTITUTION_ID: "", INSTITUTION_NAME: "", INSTITUTION_ZIPCODE: "",
          SLATE_INSTITUTION_ID: "", SLATE_INSTITUTION_NAME: "", EXTERNAL_INSTITUTION_NAME: "", EXTERNAL_INSTITUTION_ZIPCODE: ""
        });
        setEditingId(null);
        setRefreshTrigger((prev) => prev + 1);
        setTimeout(() => setMessage(null), 5000);
      } else {
        setMessage({ type: "error", text: messageText || "Error saving institution" });
        setTimeout(() => setMessage(null), 5000);
      }
    } catch (error: any) {
      console.error("Save institution error:", error);
      setMessage({ type: "error", text: error.response?.data?.detail || error.message || "Error saving institution" });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const pageTitle = instType === "TECH" ? "Tech Center Mapping" : "Institution Mapping";

  return (
    <PageWrapper>
      <PageMeta title={`${pageTitle} | College Module`} description={`Manage ${pageTitle.toLowerCase()}`} />
      <PageBreadcrumb pageTitle={pageTitle} />
      <PageContainer>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">View Institutions</h3>
          <div className="flex items-center gap-2">
            <Button onClick={() => setRefreshTrigger((prev) => prev + 1)} variant="outline" startIcon={<RefreshIcon className="w-5 h-5" />}>Refresh Data</Button>
            {hasAddPermission && <Button onClick={handleAdd} startIcon={<PlusIcon className="w-5 h-5" />}>Add Institution</Button>}
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
          ajaxUrl={`/api/institutionmapping/ajaxlist?inst_type=${instType}`}
          columns={[
            { data: "SOURCE_TYPE", name: "Source Type", searchable: true, orderable: true },
            { data: "INSTITUTION_TYPE", name: "Institution Type", searchable: true, orderable: true },
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
            { data: "INSTITUTION_ZIPCODE", name: "Institution Zipcode", searchable: true, orderable: true },
            { data: "EXTERNAL_INSTITUTION_NAME", name: "External Institution Name", searchable: true, orderable: true },
            // REMOVED: Slate Institution ID & Slate Institution Name columns (commented per requirement)
            // { data: "SLATE_INSTITUTION_ID", name: "Slate Institution ID", searchable: true, orderable: true },
            // { data: "SLATE_INSTITUTION_NAME", name: "Slate Institution Name", searchable: true, orderable: true },
            { data: "EXTERNAL_INSTITUTION_ZIPCODE", name: "External Institution Zipcode", searchable: true, orderable: true },
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
              Add Institution
            </h3>
          </div>

          {/* Modal Body */}
          <div className="p-6">
            <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Institution Type</Label>
                  <Input
                    value={formData.INSTITUTION_TYPE}
                    onChange={(e) => handleFieldChange("INSTITUTION_TYPE", e.target.value)}
                    placeholder="Enter Institution Type"
                  />
                </div>
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
                  <Label>Institution Name *</Label>
                  <Input
                    value={formData.INSTITUTION_NAME}
                    onChange={(e) => handleFieldChange("INSTITUTION_NAME", e.target.value)}
                    onBlur={(e) => handleBlur("INSTITUTION_NAME", e.target.value)}
                    placeholder="Enter Institution Name"
                    error={!!errors.INSTITUTION_NAME}
                  />
                  {errors.INSTITUTION_NAME && (
                    <p className="mt-1 text-xs text-red-500">{errors.INSTITUTION_NAME}</p>
                  )}
                </div>
                <div>
                  <Label>Institution Zipcode</Label>
                  <Input
                    value={formData.INSTITUTION_ZIPCODE}
                    onChange={(e) => handleFieldChange("INSTITUTION_ZIPCODE", e.target.value)}
                    placeholder="Enter Institution Zipcode"
                  />
                </div>
                <div>
                  <Label>Slate Institution ID *</Label>
                  <Input
                    value={formData.SLATE_INSTITUTION_ID}
                    onChange={(e) => handleFieldChange("SLATE_INSTITUTION_ID", e.target.value)}
                    onBlur={(e) => handleBlur("SLATE_INSTITUTION_ID", e.target.value)}
                    placeholder="Enter Slate Institution ID"
                    error={!!errors.SLATE_INSTITUTION_ID}
                  />
                  {errors.SLATE_INSTITUTION_ID && (
                    <p className="mt-1 text-xs text-red-500">{errors.SLATE_INSTITUTION_ID}</p>
                  )}
                </div>
                <div>
                  <Label>Slate Institution Name *</Label>
                  <Input
                    value={formData.SLATE_INSTITUTION_NAME}
                    onChange={(e) => handleFieldChange("SLATE_INSTITUTION_NAME", e.target.value)}
                    onBlur={(e) => handleBlur("SLATE_INSTITUTION_NAME", e.target.value)}
                    placeholder="Enter Slate Institution Name"
                    error={!!errors.SLATE_INSTITUTION_NAME}
                  />
                  {errors.SLATE_INSTITUTION_NAME && (
                    <p className="mt-1 text-xs text-red-500">{errors.SLATE_INSTITUTION_NAME}</p>
                  )}
                </div>
                <div>
                  <Label>External Institution Name *</Label>
                  <Input
                    value={formData.EXTERNAL_INSTITUTION_NAME}
                    onChange={(e) => handleFieldChange("EXTERNAL_INSTITUTION_NAME", e.target.value)}
                    onBlur={(e) => handleBlur("EXTERNAL_INSTITUTION_NAME", e.target.value)}
                    placeholder="Enter External Institution Name"
                    error={!!errors.EXTERNAL_INSTITUTION_NAME}
                  />
                  {errors.EXTERNAL_INSTITUTION_NAME && (
                    <p className="mt-1 text-xs text-red-500">{errors.EXTERNAL_INSTITUTION_NAME}</p>
                  )}
                </div>
                <div>
                  <Label>External Institution Zipcode</Label>
                  <Input
                    value={formData.EXTERNAL_INSTITUTION_ZIPCODE}
                    onChange={(e) => handleFieldChange("EXTERNAL_INSTITUTION_ZIPCODE", e.target.value)}
                    placeholder="Enter External Institution Zipcode"
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
              Edit Institution
            </h3>
          </div>

          {/* Modal Body */}
          <div className="p-6">
            <form onSubmit={(e) => handleSubmit(e, true)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Institution Type</Label>
                  <Input
                    value={formData.INSTITUTION_TYPE}
                    onChange={(e) => handleFieldChange("INSTITUTION_TYPE", e.target.value)}
                    placeholder="Enter Institution Type"
                  />
                </div>
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
                  <Label>Institution Name *</Label>
                  <Input
                    value={formData.INSTITUTION_NAME}
                    onChange={(e) => handleFieldChange("INSTITUTION_NAME", e.target.value)}
                    onBlur={(e) => handleBlur("INSTITUTION_NAME", e.target.value)}
                    placeholder="Enter Institution Name"
                    error={!!errors.INSTITUTION_NAME}
                  />
                  {errors.INSTITUTION_NAME && (
                    <p className="mt-1 text-xs text-red-500">{errors.INSTITUTION_NAME}</p>
                  )}
                </div>
                <div>
                  <Label>Institution Zipcode</Label>
                  <Input
                    value={formData.INSTITUTION_ZIPCODE}
                    onChange={(e) => handleFieldChange("INSTITUTION_ZIPCODE", e.target.value)}
                    placeholder="Enter Institution Zipcode"
                  />
                </div>
                <div>
                  <Label>Slate Institution ID *</Label>
                  <Input
                    value={formData.SLATE_INSTITUTION_ID}
                    onChange={(e) => handleFieldChange("SLATE_INSTITUTION_ID", e.target.value)}
                    onBlur={(e) => handleBlur("SLATE_INSTITUTION_ID", e.target.value)}
                    placeholder="Enter Slate Institution ID"
                    error={!!errors.SLATE_INSTITUTION_ID}
                  />
                  {errors.SLATE_INSTITUTION_ID && (
                    <p className="mt-1 text-xs text-red-500">{errors.SLATE_INSTITUTION_ID}</p>
                  )}
                </div>
                <div>
                  <Label>Slate Institution Name *</Label>
                  <Input
                    value={formData.SLATE_INSTITUTION_NAME}
                    onChange={(e) => handleFieldChange("SLATE_INSTITUTION_NAME", e.target.value)}
                    onBlur={(e) => handleBlur("SLATE_INSTITUTION_NAME", e.target.value)}
                    placeholder="Enter Slate Institution Name"
                    error={!!errors.SLATE_INSTITUTION_NAME}
                  />
                  {errors.SLATE_INSTITUTION_NAME && (
                    <p className="mt-1 text-xs text-red-500">{errors.SLATE_INSTITUTION_NAME}</p>
                  )}
                </div>
                <div>
                  <Label>External Institution Name *</Label>
                  <Input
                    value={formData.EXTERNAL_INSTITUTION_NAME}
                    onChange={(e) => handleFieldChange("EXTERNAL_INSTITUTION_NAME", e.target.value)}
                    onBlur={(e) => handleBlur("EXTERNAL_INSTITUTION_NAME", e.target.value)}
                    placeholder="Enter External Institution Name"
                    error={!!errors.EXTERNAL_INSTITUTION_NAME}
                  />
                  {errors.EXTERNAL_INSTITUTION_NAME && (
                    <p className="mt-1 text-xs text-red-500">{errors.EXTERNAL_INSTITUTION_NAME}</p>
                  )}
                </div>
                <div>
                  <Label>External Institution Zipcode</Label>
                  <Input
                    value={formData.EXTERNAL_INSTITUTION_ZIPCODE}
                    onChange={(e) => handleFieldChange("EXTERNAL_INSTITUTION_ZIPCODE", e.target.value)}
                    placeholder="Enter External Institution Zipcode"
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
              setInstitutionToDelete(null);
            }
          }}
          onConfirm={handleDelete}
          title="Confirm Delete"
          message="Are you sure you want to delete this institution? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          confirmVariant="danger"
          isLoading={isDeleting}
        />
      </PageContainer>
    </PageWrapper>
  );
}
