import { useState } from "react";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../components/common/PageContainer";
import DataTable from "../../components/ui/DataTable";
import Button from "../../components/ui/button/Button";
import { API_BASE_URL } from "../../config/api";
import { RefreshIcon, PlusIcon, PencilIcon, TrashBinIcon } from "../../icons";
import { useAuth } from "../../context/AuthContext";

export default function YearMapping() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { hasPermission } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingYear, setEditingYear] = useState<string | null>(null);
  const [formData, setFormData] = useState({ YEAR_CD: "" });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const hasAddPermission = hasPermission("year_mapping", "ADD");
  const hasUpdatePermission = hasPermission("year_mapping", "UPDATE");
  const hasDeletePermission = hasPermission("year_mapping", "DELETE");

  const handleAdd = () => {
    setFormData({ YEAR_CD: "" });
    setShowAddModal(true);
    setMessage(null);
  };

  const handleEdit = async (yearCd: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/yearmapping/get`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
        body: JSON.stringify({ id: yearCd }),
      });
      const data = await response.json();
      if (data.YEAR_CD) {
        setFormData({ YEAR_CD: data.YEAR_CD });
        setEditingYear(yearCd);
        setShowEditModal(true);
        setMessage(null);
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Error loading year data" });
    }
  };

  const handleDelete = async (yearCd: string) => {
    if (!window.confirm("Are you sure you want to delete this year?")) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/yearmapping/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
        body: JSON.stringify({ id: yearCd }),
      });
      const data = await response.json();
      if (data.status === "Success") {
        setMessage({ type: "success", text: "Year deleted successfully" });
        setRefreshTrigger((prev) => prev + 1);
      } else {
        setMessage({ type: "error", text: "Error deleting year" });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Error deleting year" });
    }
  };

  const handleSubmit = async (e: React.FormEvent, isEdit: boolean) => {
    e.preventDefault();
    try {
      const endpoint = isEdit ? "/api/yearmapping/update" : "/api/yearmapping/insert";
      const body = isEdit ? { YEAR_CD: formData.YEAR_CD, OLD_YEAR_CD: editingYear } : formData;
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (data.status === 1) {
        setMessage({ type: "success", text: data.message || "Success" });
        setShowAddModal(false);
        setShowEditModal(false);
        setFormData({ YEAR_CD: "" });
        setEditingYear(null);
        setRefreshTrigger((prev) => prev + 1);
      } else {
        setMessage({ type: "error", text: data.message || "Error saving year" });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Error saving year" });
    }
  };

  return (
    <PageWrapper>
      <PageMeta title="Year Mapping | College Module" description="Manage year mappings" />
      <PageBreadcrumb pageTitle="Year Mapping" />
      <PageContainer>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">View Years</h3>
          <div className="flex items-center gap-2">
            <Button onClick={() => setRefreshTrigger((prev) => prev + 1)} variant="outline" startIcon={<RefreshIcon className="w-5 h-5" />}>Refresh Data</Button>
            {hasAddPermission && <Button onClick={handleAdd} startIcon={<PlusIcon className="w-5 h-5" />}>Add Year</Button>}
          </div>
        </div>
        {message && (
          <div className={`mb-4 p-4 rounded-lg ${message.type === "success" ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400"}`}>
            {message.text}
          </div>
        )}
        <DataTable
          refreshTrigger={refreshTrigger}
          ajaxUrl="/api/yearmapping/ajaxlist"
          columns={[
            { data: "YEAR_CD", name: "Year Code", searchable: true, orderable: true },
            ...(hasUpdatePermission || hasDeletePermission ? [{
              data: "actions", name: "Action", searchable: false, orderable: false,
              render: (data: any, row: any) => (
                <div className="flex items-center gap-2">
                  {hasUpdatePermission && <button onClick={() => handleEdit(row.YEAR_CD)} className="text-brand-500 hover:text-brand-700" title="Edit"><PencilIcon className="w-5 h-5" /></button>}
                  {hasDeletePermission && <button onClick={() => handleDelete(row.YEAR_CD)} className="text-red-500 hover:text-red-700" title="Delete"><TrashBinIcon className="w-5 h-5" /></button>}
                </div>
              ),
            }] : []),
          ]}
        />
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Add Year</h3>
                <button onClick={() => setShowAddModal(false)} className="text-gray-500 hover:text-gray-700">×</button>
              </div>
              <form onSubmit={(e) => handleSubmit(e, false)}>
                <div className="mb-4"><label className="block text-sm font-medium mb-2">Year Code *</label><input type="text" value={formData.YEAR_CD} onChange={(e) => setFormData({ ...formData, YEAR_CD: e.target.value })} required className="w-full px-4 py-2 border rounded-lg" /></div>
                <div className="flex gap-2 justify-end"><Button type="submit">Submit</Button><Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button></div>
              </form>
            </div>
          </div>
        )}
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Edit Year</h3>
                <button onClick={() => setShowEditModal(false)} className="text-gray-500 hover:text-gray-700">×</button>
              </div>
              <form onSubmit={(e) => handleSubmit(e, true)}>
                <div className="mb-4"><label className="block text-sm font-medium mb-2">Year Code *</label><input type="text" value={formData.YEAR_CD} onChange={(e) => setFormData({ ...formData, YEAR_CD: e.target.value })} required className="w-full px-4 py-2 border rounded-lg" /></div>
                <div className="flex gap-2 justify-end"><Button type="submit">Update</Button><Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button></div>
              </form>
            </div>
          </div>
        )}
      </PageContainer>
    </PageWrapper>
  );
}

