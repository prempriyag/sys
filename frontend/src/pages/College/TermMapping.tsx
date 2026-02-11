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

export default function TermMapping() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { hasPermission } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    TERM: "", TERM_CODE: "", TERM_START: "", TERM_END: "", IS_ACTIVE: "Y", GRACE_PERIOD: 0
  });
  const hasAddPermission = hasPermission("college_terms", "ADD");
  const hasUpdatePermission = hasPermission("college_terms", "UPDATE");
  const hasDeletePermission = hasPermission("college_terms", "DELETE");

  const handleAdd = () => {
    setFormData({ TERM: "", TERM_CODE: "", TERM_START: "", TERM_END: "", IS_ACTIVE: "Y", GRACE_PERIOD: 0 });
    setShowAddModal(true);
  };

  const handleEdit = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/termmapping/get`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
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
        setEditingId(id);
        setShowEditModal(true);
      }
    } catch (error: any) {
      alerterror(error.message || "Error loading term data");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this term?")) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/termmapping/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (data.status === "Success") {
        alertsuccess("Term deleted successfully");
        setRefreshTrigger((prev) => prev + 1);
      } else {
        alerterror("Error deleting term");
      }
    } catch (error: any) {
      alerterror(error.message || "Error deleting term");
    }
  };

  const handleSubmit = async (e: React.FormEvent, isEdit: boolean) => {
    e.preventDefault();
    try {
      const endpoint = isEdit ? "/api/termmapping/update" : "/api/termmapping/insert";
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
        setFormData({ TERM: "", TERM_CODE: "", TERM_START: "", TERM_END: "", IS_ACTIVE: "Y", GRACE_PERIOD: 0 });
        setEditingId(null);
        setRefreshTrigger((prev) => prev + 1);
      } else {
        alerterror(data.message || "Error saving term");
      }
    } catch (error: any) {
      alerterror(error.message || "Error saving term");
    }
  };

  return (
    <PageWrapper>
      <PageMeta title="Term Mapping | College Module" description="Manage term mappings" />
      <PageBreadcrumb pageTitle="Term Mapping" />
      <PageContainer>
        <DataTable
          refreshTrigger={refreshTrigger}
          toolbarActions={<>{hasAddPermission && <Button size="sm" onClick={handleAdd}>Add Term</Button>}<button onClick={() => setRefreshTrigger((prev) => prev + 1)} className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"><RefreshIcon className="w-4 h-4" /> Refresh</button></>}
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
                  {hasDeletePermission && <button onClick={() => handleDelete(row.Id)} className="text-red-500 hover:text-red-700" title="Delete"><TrashBinIcon className="w-5 h-5" /></button>}
                </div>
              ),
            }] : []),
          ]}
        />
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Add Term</h3>
                <button onClick={() => setShowAddModal(false)} className="text-gray-500 hover:text-gray-700">×</button>
              </div>
              <form onSubmit={(e) => handleSubmit(e, false)}>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div><label className="block text-sm font-medium mb-2">Term *</label><input type="text" value={formData.TERM} onChange={(e) => setFormData({ ...formData, TERM: e.target.value })} required className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">Term Code *</label><input type="text" value={formData.TERM_CODE} onChange={(e) => setFormData({ ...formData, TERM_CODE: e.target.value })} required className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">Term Start *</label><input type="date" value={formData.TERM_START} onChange={(e) => setFormData({ ...formData, TERM_START: e.target.value })} required className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">Term End *</label><input type="date" value={formData.TERM_END} onChange={(e) => setFormData({ ...formData, TERM_END: e.target.value })} required className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">Is Active *</label><select value={formData.IS_ACTIVE} onChange={(e) => setFormData({ ...formData, IS_ACTIVE: e.target.value })} required className="w-full px-4 py-2 border rounded-lg"><option value="Y">Active</option><option value="N">InActive</option></select></div>
                  <div><label className="block text-sm font-medium mb-2">Grace Period *</label><input type="number" value={formData.GRACE_PERIOD} onChange={(e) => setFormData({ ...formData, GRACE_PERIOD: parseInt(e.target.value) || 0 })} required className="w-full px-4 py-2 border rounded-lg" /></div>
                </div>
                <div className="flex gap-2 justify-end"><Button type="submit">Submit</Button><Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button></div>
              </form>
            </div>
          </div>
        )}
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Edit Term</h3>
                <button onClick={() => setShowEditModal(false)} className="text-gray-500 hover:text-gray-700">×</button>
              </div>
              <form onSubmit={(e) => handleSubmit(e, true)}>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div><label className="block text-sm font-medium mb-2">Term *</label><input type="text" value={formData.TERM} onChange={(e) => setFormData({ ...formData, TERM: e.target.value })} required className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">Term Code *</label><input type="text" value={formData.TERM_CODE} onChange={(e) => setFormData({ ...formData, TERM_CODE: e.target.value })} required className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">Term Start *</label><input type="date" value={formData.TERM_START} onChange={(e) => setFormData({ ...formData, TERM_START: e.target.value })} required className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">Term End *</label><input type="date" value={formData.TERM_END} onChange={(e) => setFormData({ ...formData, TERM_END: e.target.value })} required className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">Is Active *</label><select value={formData.IS_ACTIVE} onChange={(e) => setFormData({ ...formData, IS_ACTIVE: e.target.value })} required className="w-full px-4 py-2 border rounded-lg"><option value="Y">Active</option><option value="N">InActive</option></select></div>
                  <div><label className="block text-sm font-medium mb-2">Grace Period *</label><input type="number" value={formData.GRACE_PERIOD} onChange={(e) => setFormData({ ...formData, GRACE_PERIOD: parseInt(e.target.value) || 0 })} required className="w-full px-4 py-2 border rounded-lg" /></div>
                </div>
                <div className="flex gap-2 justify-end"><Button type="submit">Update</Button><Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button></div>
              </form>
            </div>
          </div>
        )}
      </PageContainer>
    </PageWrapper>
  );
}

