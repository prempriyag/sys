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
import AddTermModal from "./AddTermModal";
import EditTermModal from "./EditTermModal";
import ConfirmationModal from "../../../../components/common/ConfirmationModal";

export default function TermMapping() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { hasPermission } = useAuth();
  const { alertsuccess, alerterror } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [selectedTermId, setSelectedTermId] = useState<number | null>(null);
  const [termToDelete, setTermToDelete] = useState<number | null>(null);

  const hasAddPermission = hasPermission("college_terms", "ADD");
  const hasUpdatePermission = hasPermission("college_terms", "UPDATE");
  const hasDeletePermission = hasPermission("college_terms", "DELETE");

  // Handle edit click - show edit modal
  const handleEditClick = (id: number) => {
    setSelectedTermId(id);
    setShowEditModal(true);
  };

  // Handle delete click
  const handleDeleteClick = (id: number) => {
    setTermToDelete(id);
    setShowDeleteConfirmModal(true);
  };

  // Handle delete confirmation
  const handleDeleteTerm = async () => {
    if (!termToDelete) return;

    try {
      const response = await api.post(`${API_BASE_URL}/api/termmapping/delete`, { id: termToDelete });
      
      if (response.status === "Success" || response.status === 1) {
        alertsuccess("Term deleted successfully");
        setRefreshTrigger((prev) => prev + 1);
        setShowDeleteConfirmModal(false);
        setTermToDelete(null);
      } else {
        alerterror(response.message || "Error deleting term");
        setShowDeleteConfirmModal(false);
        setTermToDelete(null);
      }
    } catch (err: any) {
      alerterror(err.response?.data?.message || err.message || "Error deleting term");
      setShowDeleteConfirmModal(false);
      setTermToDelete(null);
    }
  };

  return (
    <PageWrapper>
      <PageMeta title="Term Mapping | College Module" description="Manage term mappings" />
      <PageBreadcrumb pageTitle="Term Mapping" />
      <PageContainer>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">View Terms</h3>
          <div className="flex items-center gap-2">
            <Button onClick={() => setRefreshTrigger((prev) => prev + 1)} variant="outline" startIcon={<RefreshIcon className="w-5 h-5" />}>Refresh Data</Button>
            {hasAddPermission && <Button onClick={() => setShowAddModal(true)} startIcon={<PlusIcon className="w-5 h-5" />}>Add Term</Button>}
          </div>
        </div>
        <DataTable
          refreshTrigger={refreshTrigger}
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
                      title="Edit Term"
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
                      title="Delete Term"
                    >
                      <TrashBinIcon className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ),
            }] : []),
          ]}
        />
      {/* Add Term Modal */}
      <AddTermModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          setRefreshTrigger((prev) => prev + 1);
        }}
      />

      {/* Edit Term Modal */}
      <EditTermModal
        isOpen={showEditModal}
        termId={selectedTermId}
        onClose={() => {
          setShowEditModal(false);
          setSelectedTermId(null);
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
          setTermToDelete(null);
        }}
        onConfirm={handleDeleteTerm}
        title="Confirm Delete"
        message="Are you sure you want to delete this term? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="danger"
      />
      </PageContainer>
    </PageWrapper>
  );
}


