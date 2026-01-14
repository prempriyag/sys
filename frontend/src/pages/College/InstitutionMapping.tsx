import { useState } from "react";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../components/common/PageContainer";
import DataTable from "../../components/ui/DataTable";
import Button from "../../components/ui/button/Button";
import { API_BASE_URL } from "../../config/api";
import { RefreshIcon, PlusIcon, PencilIcon, TrashBinIcon } from "../../icons";
import { useAuth } from "../../context/AuthContext";

interface InstitutionMappingProps {
  instType?: string;
}

export default function InstitutionMapping({ instType = "" }: InstitutionMappingProps) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { hasPermission } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    INSTITUTION_TYPE: "", INSTITUTION_ID: "", INSTITUTION_NAME: "", INSTITUTION_ZIPCODE: "",
    SLATE_INSTITUTION_ID: "", SLATE_INSTITUTION_NAME: "", EXTERNAL_INSTITUTION_NAME: "", EXTERNAL_INSTITUTION_ZIPCODE: ""
  });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const hasAddPermission = hasPermission("institutions_mapping", "ADD");
  const hasUpdatePermission = hasPermission("institutions_mapping", "UPDATE");
  const hasDeletePermission = hasPermission("institutions_mapping", "DELETE");

  const handleAdd = () => {
    setFormData({
      INSTITUTION_TYPE: instType || "", INSTITUTION_ID: "", INSTITUTION_NAME: "", INSTITUTION_ZIPCODE: "",
      SLATE_INSTITUTION_ID: "", SLATE_INSTITUTION_NAME: "", EXTERNAL_INSTITUTION_NAME: "", EXTERNAL_INSTITUTION_ZIPCODE: ""
    });
    setShowAddModal(true);
    setMessage(null);
  };

  const handleEdit = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/institutionmapping/get`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (data.Id) {
        setFormData({
          INSTITUTION_TYPE: data.INSTITUTION_TYPE || "", INSTITUTION_ID: data.INSTITUTION_ID || "", INSTITUTION_NAME: data.INSTITUTION_NAME || "",
          INSTITUTION_ZIPCODE: data.INSTITUTION_ZIPCODE || "", SLATE_INSTITUTION_ID: data.SLATE_INSTITUTION_ID || "",
          SLATE_INSTITUTION_NAME: data.SLATE_INSTITUTION_NAME || "", EXTERNAL_INSTITUTION_NAME: data.EXTERNAL_INSTITUTION_NAME || "",
          EXTERNAL_INSTITUTION_ZIPCODE: data.EXTERNAL_INSTITUTION_ZIPCODE || ""
        });
        setEditingId(data.Id);
        setShowEditModal(true);
        setMessage(null);
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Error loading institution data" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this institution?")) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/institutionmapping/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (data.status === "Success") {
        setMessage({ type: "success", text: "Institution deleted successfully" });
        setRefreshTrigger((prev) => prev + 1);
      } else {
        setMessage({ type: "error", text: "Error deleting institution" });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Error deleting institution" });
    }
  };

  const handleSubmit = async (e: React.FormEvent, isEdit: boolean) => {
    e.preventDefault();
    try {
      const endpoint = isEdit ? "/api/institutionmapping/update" : "/api/institutionmapping/insert";
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
        setFormData({
          INSTITUTION_TYPE: instType || "", INSTITUTION_ID: "", INSTITUTION_NAME: "", INSTITUTION_ZIPCODE: "",
          SLATE_INSTITUTION_ID: "", SLATE_INSTITUTION_NAME: "", EXTERNAL_INSTITUTION_NAME: "", EXTERNAL_INSTITUTION_ZIPCODE: ""
        });
        setEditingId(null);
        setRefreshTrigger((prev) => prev + 1);
      } else {
        setMessage({ type: "error", text: data.message || "Error saving institution" });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Error saving institution" });
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
        {message && (
          <div className={`mb-4 p-4 rounded-lg ${message.type === "success" ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400"}`}>
            {message.text}
          </div>
        )}
        <DataTable
          refreshTrigger={refreshTrigger}
          ajaxUrl={`/api/institutionmapping/ajaxlist?inst_type=${instType}`}
          columns={[
            { data: "SOURCE_TYPE", name: "Source Type", searchable: true, orderable: true },
            { data: "INSTITUTION_TYPE", name: "Institution Type", searchable: true, orderable: true },
            { data: "INSTITUTION_ID", name: "Institution ID", searchable: true, orderable: true },
            { data: "INSTITUTION_NAME", name: "Institution Name", searchable: true, orderable: true },
            { data: "INSTITUTION_ZIPCODE", name: "Institution Zipcode", searchable: true, orderable: true },
            { data: "EXTERNAL_INSTITUTION_NAME", name: "External Institution Name", searchable: true, orderable: true },
            { data: "SLATE_INSTITUTION_ID", name: "Slate Institution ID", searchable: true, orderable: true },
            { data: "SLATE_INSTITUTION_NAME", name: "Slate Institution Name", searchable: true, orderable: true },
            { data: "EXTERNAL_INSTITUTION_ZIPCODE", name: "External Institution Zipcode", searchable: true, orderable: true },
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
                <h3 className="text-lg font-semibold">Add Institution</h3>
                <button onClick={() => setShowAddModal(false)} className="text-gray-500 hover:text-gray-700">×</button>
              </div>
              <form onSubmit={(e) => handleSubmit(e, false)}>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div><label className="block text-sm font-medium mb-2">Institution Type</label><input type="text" value={formData.INSTITUTION_TYPE} onChange={(e) => setFormData({ ...formData, INSTITUTION_TYPE: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">Institution ID *</label><input type="text" value={formData.INSTITUTION_ID} onChange={(e) => setFormData({ ...formData, INSTITUTION_ID: e.target.value })} required className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">Institution Name *</label><input type="text" value={formData.INSTITUTION_NAME} onChange={(e) => setFormData({ ...formData, INSTITUTION_NAME: e.target.value })} required className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">Institution Zipcode</label><input type="text" value={formData.INSTITUTION_ZIPCODE} onChange={(e) => setFormData({ ...formData, INSTITUTION_ZIPCODE: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">Slate Institution ID *</label><input type="text" value={formData.SLATE_INSTITUTION_ID} onChange={(e) => setFormData({ ...formData, SLATE_INSTITUTION_ID: e.target.value })} required className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">Slate Institution Name *</label><input type="text" value={formData.SLATE_INSTITUTION_NAME} onChange={(e) => setFormData({ ...formData, SLATE_INSTITUTION_NAME: e.target.value })} required className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">External Institution Name *</label><input type="text" value={formData.EXTERNAL_INSTITUTION_NAME} onChange={(e) => setFormData({ ...formData, EXTERNAL_INSTITUTION_NAME: e.target.value })} required className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">External Institution Zipcode</label><input type="text" value={formData.EXTERNAL_INSTITUTION_ZIPCODE} onChange={(e) => setFormData({ ...formData, EXTERNAL_INSTITUTION_ZIPCODE: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
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
                <h3 className="text-lg font-semibold">Edit Institution</h3>
                <button onClick={() => setShowEditModal(false)} className="text-gray-500 hover:text-gray-700">×</button>
              </div>
              <form onSubmit={(e) => handleSubmit(e, true)}>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div><label className="block text-sm font-medium mb-2">Institution Type</label><input type="text" value={formData.INSTITUTION_TYPE} onChange={(e) => setFormData({ ...formData, INSTITUTION_TYPE: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">Institution ID *</label><input type="text" value={formData.INSTITUTION_ID} onChange={(e) => setFormData({ ...formData, INSTITUTION_ID: e.target.value })} required className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">Institution Name *</label><input type="text" value={formData.INSTITUTION_NAME} onChange={(e) => setFormData({ ...formData, INSTITUTION_NAME: e.target.value })} required className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">Institution Zipcode</label><input type="text" value={formData.INSTITUTION_ZIPCODE} onChange={(e) => setFormData({ ...formData, INSTITUTION_ZIPCODE: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">Slate Institution ID *</label><input type="text" value={formData.SLATE_INSTITUTION_ID} onChange={(e) => setFormData({ ...formData, SLATE_INSTITUTION_ID: e.target.value })} required className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">Slate Institution Name *</label><input type="text" value={formData.SLATE_INSTITUTION_NAME} onChange={(e) => setFormData({ ...formData, SLATE_INSTITUTION_NAME: e.target.value })} required className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">External Institution Name *</label><input type="text" value={formData.EXTERNAL_INSTITUTION_NAME} onChange={(e) => setFormData({ ...formData, EXTERNAL_INSTITUTION_NAME: e.target.value })} required className="w-full px-4 py-2 border rounded-lg" /></div>
                  <div><label className="block text-sm font-medium mb-2">External Institution Zipcode</label><input type="text" value={formData.EXTERNAL_INSTITUTION_ZIPCODE} onChange={(e) => setFormData({ ...formData, EXTERNAL_INSTITUTION_ZIPCODE: e.target.value })} className="w-full px-4 py-2 border rounded-lg" /></div>
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

