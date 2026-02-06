import { useState } from "react";
import PageBreadcrumb from "../../../../components/common/PageBreadCrumb";
import PageMeta from "../../../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../../../components/common/PageContainer";
import DataTable from "../../../../components/ui/DataTable";
import Button from "../../../../components/ui/button/Button";
import { Modal } from "../../../../components/ui/modal";
import Input from "../../../../components/form/input/InputField";
import Label from "../../../../components/form/Label";
import { API_BASE_URL } from "../../../../config/api";
import { RefreshIcon, PlusIcon, PencilIcon, TrashBinIcon } from "../../../../icons";
import { useAuth } from "../../../../context/AuthContext";

export default function DegreeMapping() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { hasPermission } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ DEGREE_CD: "", DEGREE_NAME: "" });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const hasAddPermission = hasPermission("college_degree", "ADD");
  const hasUpdatePermission = hasPermission("college_degree", "UPDATE");
  const hasDeletePermission = hasPermission("college_degree", "DELETE");

  const handleAdd = () => {
    setFormData({ DEGREE_CD: "", DEGREE_NAME: "" });
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
        setEditingId(id);
        setShowEditModal(true);
        setMessage(null);
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Error loading degree data" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this degree?")) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/degreemapping/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({ id }),
      });

      const data = await response.json();
      if (data.status === "Success") {
        setMessage({ type: "success", text: "Degree deleted successfully" });
        setRefreshTrigger((prev) => prev + 1);
      } else {
        setMessage({ type: "error", text: "Error deleting degree" });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Error deleting degree" });
    }
  };

  const handleSubmit = async (e: React.FormEvent, isEdit: boolean) => {
    e.preventDefault();

    try {
      const endpoint = isEdit ? "/api/degreemapping/update" : "/api/degreemapping/insert";
      const body = isEdit
        ? { Id: editingId, ...formData }
        : formData;

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
        setFormData({ DEGREE_CD: "", DEGREE_NAME: "" });
        setEditingId(null);
        setRefreshTrigger((prev) => prev + 1);
      } else {
        setMessage({ type: "error", text: data.message || "Error saving degree" });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Error saving degree" });
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
          <Button
            onClick={() => setRefreshTrigger((prev) => prev + 1)}
            variant="outline"
            startIcon={<RefreshIcon className="w-5 h-5" />}
          >
            Refresh Data
          </Button>
        </div>
        {hasAddPermission && (
          <div className="mb-4 flex justify-center">
            <Button onClick={handleAdd}>
              Add Degree
            </Button>
          </div>
        )}

        {message && (
          <div className={`mb-4 p-4 rounded-lg ${
            message.type === "success" 
              ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400" 
              : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400"
          }`}>
            {message.text}
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
                    render: (data: any, row: any) => {
                      return (
                        <div className="flex items-center gap-2">
                          {hasUpdatePermission && (
                            <button
                              onClick={() => handleEdit(row.Id)}
                              className="text-brand-500 hover:text-brand-700"
                              title="Edit"
                            >
                              <PencilIcon className="w-5 h-5" />
                            </button>
                          )}
                          {hasDeletePermission && (
                            <button
                              onClick={() => handleDelete(row.Id)}
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
        <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} className="max-w-md">
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
                  onChange={(e) => setFormData({ ...formData, DEGREE_CD: e.target.value })}
                  placeholder="Enter Degree Code"
                />
              </div>
              <div>
                <Label>Degree Name *</Label>
                <Input
                  value={formData.DEGREE_NAME}
                  onChange={(e) => setFormData({ ...formData, DEGREE_NAME: e.target.value })}
                  placeholder="Enter Degree Name"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <Button type="submit" className="flex-1">Submit</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1"
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
                  onChange={(e) => setFormData({ ...formData, DEGREE_CD: e.target.value })}
                  placeholder="Enter Degree Code"
                />
              </div>
              <div>
                <Label>Degree Name *</Label>
                <Input
                  value={formData.DEGREE_NAME}
                  onChange={(e) => setFormData({ ...formData, DEGREE_NAME: e.target.value })}
                  placeholder="Enter Degree Name"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <Button type="submit" className="flex-1">Update</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingId(null);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      </PageContainer>
    </PageWrapper>
  );
}



