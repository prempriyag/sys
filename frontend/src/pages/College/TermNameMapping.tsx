import { useState } from "react";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../components/common/PageContainer";
import DataTable from "../../components/ui/DataTable";
import Button from "../../components/ui/button/Button";
import { api, API_BASE_URL } from "../../config/api";
import { RefreshIcon, PlusIcon, PencilIcon, TrashBinIcon } from "../../icons";
import { useAuth } from "../../context/AuthContext";
import { alertsuccess, alerterror } from "../../utils/toast";

export default function TermNameMapping() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { hasPermission } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ OCR_TERM_NAME: "", TERM_NAME: "" });
  const hasAddPermission = hasPermission("college_term_names", "ADD");
  const hasUpdatePermission = hasPermission("college_term_names", "UPDATE");
  const hasDeletePermission = hasPermission("college_term_names", "DELETE");

  const handleAdd = () => {
    setFormData({ OCR_TERM_NAME: "", TERM_NAME: "" });
    setShowAddModal(true);
  };

  const handleEdit = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/termnamemapping/get`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (data.Id) {
        setFormData({ OCR_TERM_NAME: data.OCR_TERM_NAME || "", TERM_NAME: data.TERM_NAME || "" });
        setEditingId(id);
        setShowEditModal(true);
      }
    } catch (error: any) {
      alerterror(error.message || "Error loading term name data");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this term name?")) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/termnamemapping/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (data.status === "Success") {
        alertsuccess("Term name deleted successfully");
        setRefreshTrigger((prev) => prev + 1);
      } else {
        alerterror("Error deleting term name");
      }
    } catch (error: any) {
      alerterror(error.message || "Error deleting term name");
    }
  };

  const handleSubmit = async (e: React.FormEvent, isEdit: boolean) => {
    e.preventDefault();
    try {
      const endpoint = isEdit ? "/api/termnamemapping/update" : "/api/termnamemapping/insert";
      const body = isEdit ? { Id: editingId, ...formData } : formData;
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (data.status === 1) {
        alertsuccess(data.message || "Success");
        setShowAddModal(false);
        setShowEditModal(false);
        setFormData({ OCR_TERM_NAME: "", TERM_NAME: "" });
        setEditingId(null);
        setRefreshTrigger((prev) => prev + 1);
      } else {
        alerterror(data.message || "Error saving term name");
      }
    } catch (error: any) {
      alerterror(error.message || "Error saving term name");
    }
  };

  return (
    <PageWrapper>
      <PageMeta title="Term Name Mapping | College Module" description="Manage term name mappings" />
      <PageBreadcrumb pageTitle="Term Name Mapping" />
      <PageContainer>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">View Term Names</h3>
          <Button onClick={() => setRefreshTrigger((prev) => prev + 1)} variant="outline" startIcon={<RefreshIcon className="w-5 h-5" />}>Refresh Data</Button>
        </div>
        {hasAddPermission && (
          <div className="mb-4 flex justify-center">
            <Button onClick={handleAdd}>Add Term Name</Button>
          </div>
        )}
        <DataTable
          refreshTrigger={refreshTrigger}
          ajaxUrl="/api/termnamemapping/ajaxlist"
          columns={[
            { data: "OCR_TERM_NAME", name: "OCR Term Name", searchable: true, orderable: true },
            { data: "TERM_NAME", name: "Term Name", searchable: true, orderable: true },
            { data: "Updated_by", name: "Updated By", searchable: true, orderable: true },
            { data: "Updated_on", name: "Updated On", searchable: false, orderable: true },
            ...(hasUpdatePermission || hasDeletePermission ? [{
              data: "actions", name: "Action", searchable: false, orderable: false,
              render: (data: any, row: any) => (
                <div className="flex items-center gap-2">
                  {hasUpdatePermission && <button onClick={() => handleEdit(row.Id)} className="text-brand-500 hover:text-brand-700" title="Edit"><PencilIcon className="w-5 h-5" /></button>}
                  {hasDeletePermission && <button onClick={() => handleDelete(row.Id)} className="text-red-500 hover:text-red-700" title="Delete"><TrashBinIcon className="w-5 h-5" /></button>}
                </div>
              ),
            }] : []),
          ]}
        />
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Add Term Name</h3>
                <button onClick={() => setShowAddModal(false)} className="text-gray-500 hover:text-gray-700">×</button>
              </div>
              <form onSubmit={(e) => handleSubmit(e, false)}>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">OCR Term Name *</label>
                  <input type="text" value={formData.OCR_TERM_NAME} onChange={(e) => setFormData({ ...formData, OCR_TERM_NAME: e.target.value })} required className="w-full px-4 py-2 border rounded-lg" />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Term Name *</label>
                  <input type="text" value={formData.TERM_NAME} onChange={(e) => setFormData({ ...formData, TERM_NAME: e.target.value })} required className="w-full px-4 py-2 border rounded-lg" />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="submit">Submit</Button>
                  <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
                </div>
              </form>
            </div>
          </div>
        )}
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Edit Term Name</h3>
                <button onClick={() => setShowEditModal(false)} className="text-gray-500 hover:text-gray-700">×</button>
              </div>
              <form onSubmit={(e) => handleSubmit(e, true)}>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">OCR Term Name *</label>
                  <input type="text" value={formData.OCR_TERM_NAME} onChange={(e) => setFormData({ ...formData, OCR_TERM_NAME: e.target.value })} required className="w-full px-4 py-2 border rounded-lg" />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Term Name *</label>
                  <input type="text" value={formData.TERM_NAME} onChange={(e) => setFormData({ ...formData, TERM_NAME: e.target.value })} required className="w-full px-4 py-2 border rounded-lg" />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="submit">Update</Button>
                  <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </PageContainer>
    </PageWrapper>
  );
}

