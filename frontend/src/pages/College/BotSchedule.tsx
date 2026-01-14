import { useState } from "react";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../components/common/PageContainer";
import DataTable from "../../components/ui/DataTable";
import Button from "../../components/ui/button/Button";
import { API_BASE_URL } from "../../config/api";
import { RefreshIcon, PlusIcon, PencilIcon, TrashBinIcon } from "../../icons";
import { useAuth } from "../../context/AuthContext";

export default function BotSchedule() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { hasPermission } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ PROJECT: "", BOTNAME: "", STARTIST: "", AVERAGETIME: "", FREQUENCY: "", FINISHFIRSTRUN: "", SERVERIP: "", USERNAME: "" });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const hasAddPermission = hasPermission("bot_schedule", "ADD");
  const hasUpdatePermission = hasPermission("bot_schedule", "UPDATE");
  const hasDeletePermission = hasPermission("bot_schedule", "DELETE");

  const handleAdd = () => {
    setFormData({ PROJECT: "", BOTNAME: "", STARTIST: "", AVERAGETIME: "", FREQUENCY: "", FINISHFIRSTRUN: "", SERVERIP: "", USERNAME: "" });
    setShowAddModal(true);
    setMessage(null);
  };

  const handleEdit = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/botschedule/get`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (data.Id) {
        setFormData({
          PROJECT: data.PROJECT || "", BOTNAME: data.BOTNAME || "", STARTIST: data.STARTIST || "",
          AVERAGETIME: data.AVERAGETIME || "", FREQUENCY: data.FREQUENCY || "", FINISHFIRSTRUN: data.FINISHFIRSTRUN || "",
          SERVERIP: data.SERVERIP || "", USERNAME: data.USERNAME || ""
        });
        setEditingId(data.Id);
        setShowEditModal(true);
        setMessage(null);
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Error loading bot schedule data" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this bot schedule?")) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/botschedule/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (data.status === "Success") {
        setMessage({ type: "success", text: "Bot schedule deleted successfully" });
        setRefreshTrigger((prev) => prev + 1);
      } else {
        setMessage({ type: "error", text: "Error deleting bot schedule" });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Error deleting bot schedule" });
    }
  };

  const handleSubmit = async (e: React.FormEvent, isEdit: boolean) => {
    e.preventDefault();
    try {
      const endpoint = isEdit ? "/api/botschedule/update" : "/api/botschedule/insert";
      const body = isEdit ? { Id: editingId, ...formData } : formData;
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
        setFormData({ PROJECT: "", BOTNAME: "", STARTIST: "", AVERAGETIME: "", FREQUENCY: "", FINISHFIRSTRUN: "", SERVERIP: "", USERNAME: "" });
        setEditingId(null);
        setRefreshTrigger((prev) => prev + 1);
      } else {
        setMessage({ type: "error", text: data.message || "Error saving bot schedule" });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Error saving bot schedule" });
    }
  };

  return (
    <PageWrapper>
      <PageMeta title="Bot Schedule | College Module" description="Manage bot schedules" />
      <PageBreadcrumb pageTitle="Bot Schedule" />
      <PageContainer>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">View Bot Schedules</h3>
          <div className="flex items-center gap-2">
            <Button onClick={() => setRefreshTrigger((prev) => prev + 1)} variant="outline" startIcon={<RefreshIcon className="w-5 h-5" />}>Refresh Data</Button>
            {hasAddPermission && <Button onClick={handleAdd} startIcon={<PlusIcon className="w-5 h-5" />}>Add Bot Schedule</Button>}
          </div>
        </div>
        {message && (
          <div className={`mb-4 p-4 rounded-lg ${message.type === "success" ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400"}`}>
            {message.text}
          </div>
        )}
        <DataTable
          refreshTrigger={refreshTrigger}
          ajaxUrl="/api/botschedule/ajaxlist"
          columns={[
            { data: "PROJECT", name: "Project", searchable: true, orderable: true },
            { data: "BOTNAME", name: "Bot Name", searchable: true, orderable: true },
            { data: "STARTIST", name: "Start IST", searchable: true, orderable: true },
            { data: "AVERAGETIME", name: "Average Time", searchable: true, orderable: true },
            { data: "FREQUENCY", name: "Frequency", searchable: true, orderable: true },
            { data: "FINISHFIRSTRUN", name: "Finish First Run", searchable: true, orderable: true },
            { data: "SERVERIP", name: "Server IP", searchable: true, orderable: true },
            { data: "USERNAME", name: "Username", searchable: true, orderable: true },
            { data: "CREATEDON", name: "Created On", searchable: false, orderable: true },
            { data: "CREATEDBY", name: "Created By", searchable: true, orderable: true },
            { data: "UPDATEDON", name: "Updated On", searchable: false, orderable: true },
            { data: "UPDATEDBY", name: "Updated By", searchable: true, orderable: true },
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
                <h3 className="text-lg font-semibold">Add Bot Schedule</h3>
                <button onClick={() => setShowAddModal(false)} className="text-gray-500 hover:text-gray-700">×</button>
              </div>
              <form onSubmit={(e) => handleSubmit(e, false)}>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div><label className="block text-sm font-medium mb-2">Project</label><input type="text" value={formData.PROJECT} onChange={(e) => setFormData({ ...formData, PROJECT: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">Bot Name</label><input type="text" value={formData.BOTNAME} onChange={(e) => setFormData({ ...formData, BOTNAME: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">Start IST</label><input type="text" value={formData.STARTIST} onChange={(e) => setFormData({ ...formData, STARTIST: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">Average Time</label><input type="text" value={formData.AVERAGETIME} onChange={(e) => setFormData({ ...formData, AVERAGETIME: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">Frequency</label><input type="text" value={formData.FREQUENCY} onChange={(e) => setFormData({ ...formData, FREQUENCY: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">Finish First Run</label><input type="text" value={formData.FINISHFIRSTRUN} onChange={(e) => setFormData({ ...formData, FINISHFIRSTRUN: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">Server IP</label><input type="text" value={formData.SERVERIP} onChange={(e) => setFormData({ ...formData, SERVERIP: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">Username</label><input type="text" value={formData.USERNAME} onChange={(e) => setFormData({ ...formData, USERNAME: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
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
                <h3 className="text-lg font-semibold">Edit Bot Schedule</h3>
                <button onClick={() => setShowEditModal(false)} className="text-gray-500 hover:text-gray-700">×</button>
              </div>
              <form onSubmit={(e) => handleSubmit(e, true)}>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div><label className="block text-sm font-medium mb-2">Project</label><input type="text" value={formData.PROJECT} onChange={(e) => setFormData({ ...formData, PROJECT: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">Bot Name</label><input type="text" value={formData.BOTNAME} onChange={(e) => setFormData({ ...formData, BOTNAME: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">Start IST</label><input type="text" value={formData.STARTIST} onChange={(e) => setFormData({ ...formData, STARTIST: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">Average Time</label><input type="text" value={formData.AVERAGETIME} onChange={(e) => setFormData({ ...formData, AVERAGETIME: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">Frequency</label><input type="text" value={formData.FREQUENCY} onChange={(e) => setFormData({ ...formData, FREQUENCY: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">Finish First Run</label><input type="text" value={formData.FINISHFIRSTRUN} onChange={(e) => setFormData({ ...formData, FINISHFIRSTRUN: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">Server IP</label><input type="text" value={formData.SERVERIP} onChange={(e) => setFormData({ ...formData, SERVERIP: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">Username</label><input type="text" value={formData.USERNAME} onChange={(e) => setFormData({ ...formData, USERNAME: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
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

