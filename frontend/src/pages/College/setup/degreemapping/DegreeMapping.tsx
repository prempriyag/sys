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
import AddDegreeModal from "./AddDegreeModal";
import EditDegreeModal from "./EditDegreeModal";
import ConfirmationModal from "../../../../components/common/ConfirmationModal";

export default function DegreeMapping() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { hasPermission } = useAuth();
  const { alertsuccess, alerterror } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [selectedDegreeId, setSelectedDegreeId] = useState<number | null>(null);
  const [degreeToDelete, setDegreeToDelete] = useState<number | null>(null);

  const hasAddPermission = hasPermission("college_degree", "ADD");
  const hasUpdatePermission = hasPermission("college_degree", "UPDATE");
  const hasDeletePermission = hasPermission("college_degree", "DELETE");

  // Handle edit click - show edit modal
  const handleEditClick = (id: number) => {
    setSelectedDegreeId(id);
    setShowEditModal(true);
  };

  // Handle delete click
  const handleDeleteClick = (id: number) => {
    setDegreeToDelete(id);
    setShowDeleteConfirmModal(true);
  };

  // Handle delete confirmation
  const handleDeleteDegree = async () => {
    if (!degreeToDelete) return;

    try {
      const response = await api.post(`${API_BASE_URL}/api/degreemapping/delete`, { id: degreeToDelete });
      
      if (response.status === "Success" || response.status === 1) {
        alertsuccess("Degree deleted successfully");
        setRefreshTrigger((prev) => prev + 1);
        setShowDeleteConfirmModal(false);
        setDegreeToDelete(null);
      } else {
        alerterror(response.message || "Error deleting degree");
        setShowDeleteConfirmModal(false);
        setDegreeToDelete(null);
      }
    } catch (err: any) {
      alerterror(err.response?.data?.message || err.message || "Error deleting degree");
      setShowDeleteConfirmModal(false);
      setDegreeToDelete(null);
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
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setRefreshTrigger((prev) => prev + 1)}
              variant="outline"
              startIcon={<RefreshIcon className="w-5 h-5" />}
            >
              Refresh Data
            </Button>
            {hasAddPermission && (
              <Button
                onClick={() => setShowAddModal(true)}
                startIcon={<PlusIcon className="w-5 h-5" />}
              >
                Add Degree
              </Button>
            )}
          </div>
        </div>


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
                    render: (_data: any, row: any) => {
                      return (
                        <div className="flex items-center gap-3">
                          {hasUpdatePermission && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditClick(row.Id);
                              }}
                              className="text-brand-500 hover:text-brand-600 dark:text-brand-400 transition-colors"
                              title="Edit Degree"
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
                              title="Delete Degree"
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
      </PageContainer>

      {/* Add Degree Modal */}
      <AddDegreeModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          setRefreshTrigger((prev) => prev + 1);
        }}
      />

      {/* Edit Degree Modal */}
      <EditDegreeModal
        isOpen={showEditModal}
        degreeId={selectedDegreeId}
        onClose={() => {
          setShowEditModal(false);
          setSelectedDegreeId(null);
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
          setDegreeToDelete(null);
        }}
        onConfirm={handleDeleteDegree}
        title="Confirm Delete"
        message="Are you sure you want to delete this degree? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="danger"
      />
    </PageWrapper>
  );
}



