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
import AddTermNameModal from "./AddTermNameModal";
import EditTermNameModal from "./EditTermNameModal";
import ConfirmationModal from "../../../../components/common/ConfirmationModal";

export default function TermNameMapping() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { hasPermission } = useAuth();
  const { alertsuccess, alerterror } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [selectedTermNameId, setSelectedTermNameId] = useState<number | null>(null);
  const [termNameToDelete, setTermNameToDelete] = useState<number | null>(null);

  const hasAddPermission = hasPermission("college_term_names", "ADD");
  const hasUpdatePermission = hasPermission("college_term_names", "UPDATE");
  const hasDeletePermission = hasPermission("college_term_names", "DELETE");

  // Handle edit click - show edit modal
  const handleEditClick = (id: number) => {
    setSelectedTermNameId(id);
    setShowEditModal(true);
  };

  // Handle delete click
  const handleDeleteClick = (id: number) => {
    setTermNameToDelete(id);
    setShowDeleteConfirmModal(true);
  };

  // Handle delete confirmation
  const handleDeleteTermName = async () => {
    if (!termNameToDelete) return;

    try {
      const response = await api.post(`${API_BASE_URL}/api/termnamemapping/delete`, { id: termNameToDelete });
      
      if (response.status === "Success" || response.status === 1) {
        alertsuccess("Term name deleted successfully");
        setRefreshTrigger((prev) => prev + 1);
        setShowDeleteConfirmModal(false);
        setTermNameToDelete(null);
      } else {
        alerterror(response.message || "Error deleting term name");
        setShowDeleteConfirmModal(false);
        setTermNameToDelete(null);
      }
    } catch (err: any) {
      alerterror(err.response?.data?.message || err.message || "Error deleting term name");
      setShowDeleteConfirmModal(false);
      setTermNameToDelete(null);
    }
  };

  return (
    <PageWrapper>
      <PageMeta title="Term Name Mapping | College Module" description="Manage term name mappings" />
      <PageBreadcrumb pageTitle="Term Name Mapping" />
      <PageContainer>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">View Term Names</h3>
          <div className="flex items-center gap-2">
            <Button onClick={() => setRefreshTrigger((prev) => prev + 1)} variant="outline" startIcon={<RefreshIcon className="w-5 h-5" />}>Refresh Data</Button>
            {hasAddPermission && <Button onClick={() => setShowAddModal(true)} startIcon={<PlusIcon className="w-5 h-5" />}>Add Term Name</Button>}
          </div>
        </div>
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
              render: (_data: any, row: any) => (
                <div className="flex items-center gap-3">
                  {hasUpdatePermission && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditClick(row.Id);
                      }}
                      className="text-brand-500 hover:text-brand-600 dark:text-brand-400 transition-colors"
                      title="Edit Term Name"
                    >
                      <PencilIcon className="w-5 h-5" />
                    </button>
                  )}
                  {hasDeletePermission && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(row.Id);
                      }}
                      className="text-red-500 hover:text-red-600 dark:text-red-400 transition-colors"
                      title="Delete Term Name"
                    >
                      <TrashBinIcon className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ),
            }] : []),
          ]}
        />
      {/* Add Term Name Modal */}
      <AddTermNameModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          setRefreshTrigger((prev) => prev + 1);
        }}
      />

      {/* Edit Term Name Modal */}
      <EditTermNameModal
        isOpen={showEditModal}
        termNameId={selectedTermNameId}
        onClose={() => {
          setShowEditModal(false);
          setSelectedTermNameId(null);
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
          setTermNameToDelete(null);
        }}
        onConfirm={handleDeleteTermName}
        title="Confirm Delete"
        message="Are you sure you want to delete this term name? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="danger"
      />
      </PageContainer>
    </PageWrapper>
  );
}


