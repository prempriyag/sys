import { useState } from "react";
import PageBreadcrumb from "../../../../components/common/PageBreadCrumb";
import PageMeta from "../../../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../../../components/common/PageContainer";
import DataTable from "../../../../components/ui/DataTable";
import Button from "../../../../components/ui/button/Button";
import { API_BASE_URL } from "../../../../config/api";
import { RefreshIcon, PlusIcon, PencilIcon, TrashBinIcon } from "../../../../icons";
import { useAuth } from "../../../../context/AuthContext";

export default function SkipKeywords() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { hasPermission } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ KEYWORD: "", TO_DO: "", FROM_TABLE_NAME: "", FROM_COLUMN_NAME: "", DISABLED_FLAG: "" });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const hasAddPermission = hasPermission("osu_skip_keywords", "ADD");
  const hasUpdatePermission = hasPermission("osu_skip_keywords", "UPDATE");
  const hasDeletePermission = hasPermission("osu_skip_keywords", "DELETE");

  const handleAdd = () => {
    setFormData({ KEYWORD: "", TO_DO: "", FROM_TABLE_NAME: "", FROM_COLUMN_NAME: "", DISABLED_FLAG: "" });
    setShowAddModal(true);
    setMessage(null);
  };

  const handleEdit = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/skipkeywords/get`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (data.SNO) {
        setFormData({
          KEYWORD: data.KEYWORD || "",
          TO_DO: data.TO_DO || "",
          FROM_TABLE_NAME: data.FROM_TABLE_NAME || "",
          FROM_COLUMN_NAME: data.FROM_COLUMN_NAME || "",
          DISABLED_FLAG: data.DISABLED_FLAG || "",
        });
        setEditingId(data.SNO);
        setShowEditModal(true);
        setMessage(null);
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Error loading skip keyword data" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this skip keyword?")) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/skipkeywords/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (data.status === "Success") {
        setMessage({ type: "success", text: "Skip keyword deleted successfully" });
        setRefreshTrigger((prev) => prev + 1);
      } else {
        setMessage({ type: "error", text: "Error deleting skip keyword" });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Error deleting skip keyword" });
    }
  };

  const handleSubmit = async (e: React.FormEvent, isEdit: boolean) => {
    e.preventDefault();
    try {
      const endpoint = isEdit ? "/api/skipkeywords/update" : "/api/skipkeywords/insert";
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
        setMessage({ type: "success", text: data.message || "Success" });
        setShowAddModal(false);
        setShowEditModal(false);
        setFormData({ KEYWORD: "", TO_DO: "", FROM_TABLE_NAME: "", FROM_COLUMN_NAME: "", DISABLED_FLAG: "" });
        setEditingId(null);
        setRefreshTrigger((prev) => prev + 1);
      } else {
        setMessage({ type: "error", text: data.message || "Error saving skip keyword" });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Error saving skip keyword" });
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
        {message && (
          <div className={`mb-4 p-4 rounded-lg ${message.type === "success" ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400"}`}>
            {message.text}
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
                  {hasDeletePermission && <button onClick={() => handleDelete(row.SNO)} className="text-red-500 hover:text-red-700" title="Delete"><TrashBinIcon className="w-5 h-5" /></button>}
                </div>
              ),
            }] : []),
          ]}
        />
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Add Skip Keyword</h3>
                <button onClick={() => setShowAddModal(false)} className="text-gray-500 hover:text-gray-700">×</button>
              </div>
              <form onSubmit={(e) => handleSubmit(e, false)}>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div><label className="block text-sm font-medium mb-2">Keyword</label><input type="text" value={formData.KEYWORD} onChange={(e) => setFormData({ ...formData, KEYWORD: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">To Do</label><input type="text" value={formData.TO_DO} onChange={(e) => setFormData({ ...formData, TO_DO: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">From Table Name</label><input type="text" value={formData.FROM_TABLE_NAME} onChange={(e) => setFormData({ ...formData, FROM_TABLE_NAME: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">From Column Name</label><input type="text" value={formData.FROM_COLUMN_NAME} onChange={(e) => setFormData({ ...formData, FROM_COLUMN_NAME: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">Disabled Flag</label><input type="text" value={formData.DISABLED_FLAG} onChange={(e) => setFormData({ ...formData, DISABLED_FLAG: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
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
                <h3 className="text-lg font-semibold">Edit Skip Keyword</h3>
                <button onClick={() => setShowEditModal(false)} className="text-gray-500 hover:text-gray-700">×</button>
              </div>
              <form onSubmit={(e) => handleSubmit(e, true)}>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div><label className="block text-sm font-medium mb-2">Keyword</label><input type="text" value={formData.KEYWORD} onChange={(e) => setFormData({ ...formData, KEYWORD: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">To Do</label><input type="text" value={formData.TO_DO} onChange={(e) => setFormData({ ...formData, TO_DO: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">From Table Name</label><input type="text" value={formData.FROM_TABLE_NAME} onChange={(e) => setFormData({ ...formData, FROM_TABLE_NAME: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">From Column Name</label><input type="text" value={formData.FROM_COLUMN_NAME} onChange={(e) => setFormData({ ...formData, FROM_COLUMN_NAME: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">Disabled Flag</label><input type="text" value={formData.DISABLED_FLAG} onChange={(e) => setFormData({ ...formData, DISABLED_FLAG: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
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

