import { useState } from "react";
import PageBreadcrumb from "../../../../components/common/PageBreadCrumb";
import PageMeta from "../../../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../../../components/common/PageContainer";
import DataTable from "../../../../components/ui/DataTable";
import Button from "../../../../components/ui/button/Button";
import { Modal } from "../../../../components/ui/modal";
import Label from "../../../../components/form/Label";
import { api } from "../../../../config/api";
import { RefreshIcon, PencilIcon, TrashBinIcon } from "../../../../icons";
import { useAuth } from "../../../../context/AuthContext";
import ConfirmationModal from "../../../../components/common/ConfirmationModal";
import { alertsuccess, alerterror } from "../../../../utils/toast";

interface GpaPickFormData {
  GPA_SCALE: string;
  WEIGHTED_GPA: string;
  UNWEIGHTED_GPA: string;
  CGPA: string;
  PREFERRED_GPA: string;
}

const INITIAL_FORM_DATA: GpaPickFormData = {
  GPA_SCALE: "",
  WEIGHTED_GPA: "",
  UNWEIGHTED_GPA: "",
  CGPA: "",
  PREFERRED_GPA: "",
};

// Options for GPA_SCALE, WEIGHTED_GPA, UNWEIGHTED_GPA, CGPA (matching CI3)
const GPA_OPTIONS = [
  { value: "", label: "Please Select" },
  { value: "X", label: "X" },
];

// Options for PREFERRED_GPA (matching CI3)
const PREFERRED_GPA_OPTIONS = [
  { value: "", label: "Please Select" },
  { value: "GPA_SCALE", label: "GPA Scale" },
  { value: "WEIGHTED_GPA", label: "Weighted GPA" },
  { value: "UNWEIGHTED_GPA", label: "Unweighted GPA" },
  { value: "CGPA", label: "CGPA" },
];

export default function GpaPickMapping() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { hasPermission } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [gpaPickToDelete, setGpaPickToDelete] = useState<number | null>(null);
  const [formData, setFormData] = useState<GpaPickFormData>({ ...INITIAL_FORM_DATA });
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const hasAddPermission = hasPermission("gpa_pick_mapping", "ADD");
  const hasUpdatePermission = hasPermission("gpa_pick_mapping", "UPDATE");
  const hasDeletePermission = hasPermission("gpa_pick_mapping", "DELETE");

  const handleAdd = () => {
    setFormData({ ...INITIAL_FORM_DATA });
    setShowAddModal(true);
  };

  const handleEdit = async (id: number) => {
    try {
      const response = await api.post("/api/gpapickmapping/get", { id });
      const data = response;
      if (data.Id) {
        setFormData({
          GPA_SCALE: data.GPA_SCALE || "",
          WEIGHTED_GPA: data.WEIGHTED_GPA || "",
          UNWEIGHTED_GPA: data.UNWEIGHTED_GPA || "",
          CGPA: data.CGPA || "",
          PREFERRED_GPA: data.PREFERRED_GPA || "",
        });
        setEditingId(data.Id);
        setShowEditModal(true);
      }
    } catch (error: any) {
      alerterror(error.response?.data?.detail || error.message || "Error loading GPA Pick data");
    }
  };

  const handleDeleteClick = (id: number) => {
    setGpaPickToDelete(id);
    setShowDeleteConfirmModal(true);
  };

  const handleDelete = async () => {
    if (!gpaPickToDelete) return;

    setIsDeleting(true);
    try {
      const response = await api.post("/api/gpapickmapping/delete", { id: gpaPickToDelete });

      const success = response.status === 1 || response.success || response.status === "Success" || response.message?.toLowerCase().includes("success");
      const messageText = response.message || "GPA Pick Mapping deleted successfully";

      if (success) {
        alertsuccess(messageText);
        setRefreshTrigger((prev) => prev + 1);
        setShowDeleteConfirmModal(false);
        setGpaPickToDelete(null);
      } else {
        alerterror(messageText);
        setShowDeleteConfirmModal(false);
        setGpaPickToDelete(null);
      }
    } catch (error: any) {
      console.error("Delete GPA Pick error:", error);
      alerterror(error.response?.data?.detail || error.message || "Error deleting GPA Pick Mapping");
      setShowDeleteConfirmModal(false);
      setGpaPickToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFieldChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent, isEdit: boolean) => {
    e.preventDefault();

    setLoading(true);

    try {
      const endpoint = isEdit ? "/api/gpapickmapping/update" : "/api/gpapickmapping/insert";
      const body = isEdit
        ? { Id: editingId, ...formData }
        : formData;

      const response = await api.post(endpoint, body);

      const success = response.status === 1 || response.success || response.message?.toLowerCase().includes("success");
      const messageText = response.message || (isEdit ? "GPA Pick Mapping updated successfully" : "GPA Pick Mapping added successfully");

      if (success) {
        alertsuccess(messageText);
        setShowAddModal(false);
        setShowEditModal(false);
        setFormData({ ...INITIAL_FORM_DATA });
        setEditingId(null);
        setRefreshTrigger((prev) => prev + 1);
      } else {
        alerterror(messageText || "Error saving GPA Pick Mapping");
      }
    } catch (error: any) {
      console.error("Save GPA Pick error:", error);
      alerterror(error.response?.data?.detail || error.message || "Error saving GPA Pick Mapping");
    } finally {
      setLoading(false);
    }
  };

  // Reusable select component
  const SelectField = ({ label, name, value, options, onChange }: {
    label: string;
    name: string;
    value: string;
    options: { value: string; label: string }[];
    onChange: (name: string, value: string) => void;
  }) => (
    <div>
      <Label>{label}</Label>
      <select
        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-700 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );

  // Form content shared between Add and Edit modals
  const FormFields = () => (
    <>
      <SelectField label="GPA Scale" name="GPA_SCALE" value={formData.GPA_SCALE} options={GPA_OPTIONS} onChange={handleFieldChange} />
      <SelectField label="Weighted GPA" name="WEIGHTED_GPA" value={formData.WEIGHTED_GPA} options={GPA_OPTIONS} onChange={handleFieldChange} />
      <SelectField label="Unweighted GPA" name="UNWEIGHTED_GPA" value={formData.UNWEIGHTED_GPA} options={GPA_OPTIONS} onChange={handleFieldChange} />
      <SelectField label="CGPA" name="CGPA" value={formData.CGPA} options={GPA_OPTIONS} onChange={handleFieldChange} />
      <SelectField label="Preferred GPA" name="PREFERRED_GPA" value={formData.PREFERRED_GPA} options={PREFERRED_GPA_OPTIONS} onChange={handleFieldChange} />
    </>
  );

  return (
    <PageWrapper>
      <PageMeta title="GPA Pick Mapping | School Module" description="Manage GPA Pick mappings" />
      <PageBreadcrumb pageTitle="GPA Pick Mapping" />
      <PageContainer>

        <DataTable
          refreshTrigger={refreshTrigger}
          toolbarActions={<>{hasAddPermission && <Button size="sm" onClick={handleAdd}>Add GPA Pick Mapping</Button>}<button onClick={() => setRefreshTrigger((prev) => prev + 1)} className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"><RefreshIcon className="w-4 h-4" /> Refresh</button></>}
          ajaxUrl="/api/gpapickmapping/ajaxlist"
          columns={[
            { data: "GPA_SCALE", name: "GPA Scale", searchable: true, orderable: true, textCenter: true },
            { data: "WEIGHTED_GPA", name: "Weighted GPA", searchable: true, orderable: true },
            { data: "UNWEIGHTED_GPA", name: "Unweighted GPA", searchable: true, orderable: true, textCenter: true },
            { data: "CGPA", name: "CGPA", searchable: true, orderable: true, textCenter: true },
            { data: "PREFERRED_GPA", name: "Preferred GPA", searchable: true, orderable: true, textCenter: true },
            { data: "CREATED_BY", name: "Updated By", searchable: true, orderable: true },
            { data: "CREATED_DATE", name: "Updated On", searchable: false, orderable: true },
            ...(hasUpdatePermission || hasDeletePermission ? [{
              data: "actions", name: "Action", searchable: false, orderable: false,
              render: (_data: any, row: any) => (
                <div className="flex items-center gap-2">
                  {hasUpdatePermission && <button onClick={() => handleEdit(row.id)} className="text-brand-500 hover:text-brand-700" title="Edit"><PencilIcon className="w-5 h-5" /></button>}
                  {hasDeletePermission && <button onClick={() => handleDeleteClick(row.id)} className="text-red-500 hover:text-red-700" title="Delete"><TrashBinIcon className="w-5 h-5" /></button>}
                </div>
              ),
            }] : []),
          ]}
        />

        {/* Add Modal */}
        <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} className="max-w-md">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Add GPA Pick Mapping</h3>
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
                <Button variant="outline" onClick={() => setShowAddModal(false)} className="flex-1" disabled={loading}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </Modal>

        {/* Edit Modal */}
        <Modal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setEditingId(null); }} className="max-w-md">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Edit GPA Pick Mapping</h3>
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
                <Button variant="outline" onClick={() => { setShowEditModal(false); setEditingId(null); }} className="flex-1" disabled={loading}>
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
              setGpaPickToDelete(null);
            }
          }}
          onConfirm={handleDelete}
          title="Confirm Delete"
          message="Are you sure you want to delete this GPA Pick Mapping? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          confirmVariant="danger"
          isLoading={isDeleting}
        />
      </PageContainer>
    </PageWrapper>
  );
}
