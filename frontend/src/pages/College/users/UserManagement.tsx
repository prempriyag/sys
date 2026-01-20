import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../../components/common/PageContainer";
import DataTable from "../../../components/ui/DataTable";
import Button from "../../../components/ui/button/Button";
import StatusBadge from "../../../components/common/StatusBadge";
import { api, API_ENDPOINTS, API_BASE_URL, getAuthToken } from "../../../config/api";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { PencilIcon, TrashBinIcon, LockIcon } from "../../../icons";
import ResetPasswordModal from "./ResetPasswordModal";
import AddUserModal from "./AddUserModal";
import EditUserModal from "./EditUserModal";
import ConfirmationModal from "../../../components/common/ConfirmationModal";

export default function UserManagement() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { alertsuccess, alerterror } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string>("");
  const [userToDelete, setUserToDelete] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Check authentication on mount
  useEffect(() => {
    const token = getAuthToken();
    if (!isAuthenticated || !token) {
      console.error("[UserManagement] User not authenticated or token missing");
      setError("You are not authenticated. Please login again.");
      // Redirect will be handled by ProtectedRoute, but we can also do it here
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    }
  }, [isAuthenticated, navigate]);

  // Handle delete user click
  const handleDeleteClick = (userId: number) => {
    setUserToDelete(userId);
    setShowDeleteConfirmModal(true);
  };

  // Handle delete user confirmation
  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);
    try {
      const response = await api.delete(`${API_ENDPOINTS.USERS_DELETE}/${userToDelete}`);
      
      console.log("[DELETE] Response received:", response);
      
      // Check for success response (MessageResponse has 'success' and 'message' fields)
      // Handle both direct response (fetch) and wrapped response (axios) formats
      const success = response.success || response.data?.success;
      const message = response.message || response.data?.message || "";
      const isSuccess = success || message.toLowerCase().includes("success");
      
      if (isSuccess) {
        const successMessage = message || "User deleted successfully";
        alertsuccess(successMessage);
        setMessage({ type: "success", text: successMessage });
        setRefreshTrigger((prev) => prev + 1);
        setShowDeleteConfirmModal(false);
        setUserToDelete(null);
        // Clear message after 5 seconds
        setTimeout(() => setMessage(null), 5000);
      } else {
        const errorMessage = message || "Failed to delete user";
        alerterror(errorMessage);
        setMessage({ type: "error", text: errorMessage });
        setShowDeleteConfirmModal(false);
        setUserToDelete(null);
        // Clear message after 5 seconds
        setTimeout(() => setMessage(null), 5000);
      }
    } catch (err: any) {
      console.error("[DELETE] Delete user error:", err);
      const errorMessage = err.response?.data?.detail || err.response?.data?.message || err.message || "Failed to delete user";
      alerterror(errorMessage);
      setMessage({ type: "error", text: errorMessage });
      setShowDeleteConfirmModal(false);
      setUserToDelete(null);
      // Clear message after 5 seconds
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle status update
  const handleStatusUpdate = async (userId: number, status: number) => {
    try {
      await api.post(`${API_ENDPOINTS.USERS_UPDATE_STATUS}/${userId}?dvalue=${status}`);
      alertsuccess("User status updated successfully");
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      alerterror(err.response?.data?.message || err.message || "Failed to update status");
    }
  };

  // Parse HTML status to get user ID, status value, and status text
  const parseStatusClick = (htmlString: string) => {
    const match = htmlString.match(/statusid.*?id="(\d+)".*?data-val="(\d+)"/);
    if (match) {
      const userId = parseInt(match[1]);
      const newStatus = parseInt(match[2]);
      handleStatusUpdate(userId, newStatus);
    }
  };

  // Extract status text from HTML for display
  const extractStatusText = (htmlString: string): string => {
    if (!htmlString) return "";
    // Extract text content from HTML (e.g., "Active", "Inactive", "Blocked")
    const textMatch = htmlString.match(/>([^<]+)</);
    return textMatch ? textMatch[1].trim() : "";
  };

  // Extract user ID from status HTML
  const extractStatusUserId = (htmlString: string): number | null => {
    const match = htmlString.match(/statusid.*?id="(\d+)"/);
    return match ? parseInt(match[1]) : null;
  };

  // Extract status value from status HTML
  const extractStatusValue = (htmlString: string): number | null => {
    const match = htmlString.match(/data-val="(\d+)"/);
    return match ? parseInt(match[1]) : null;
  };

  // Handle edit click - show edit modal
  const handleEditClick = (userId: number) => {
    setSelectedUserId(userId);
    setShowEditUserModal(true);
  };

  // Handle reset password click
  const handleResetPasswordClick = (userId: number, userName: string) => {
    setSelectedUserId(userId);
    setSelectedUserName(userName);
    setShowResetPasswordModal(true);
  };

  return (
    <PageWrapper>
      <PageMeta
        title="User Management | College Module"
        description="Manage users and their permissions"
      />
      <PageBreadcrumb pageTitle="User Management" />

      <PageContainer>
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">
            User Management
          </h3>
          <Button
            onClick={() => setShowAddUserModal(true)}
          >
            Add User
          </Button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-4 text-red-800 dark:text-red-300"
            >
              ×
            </button>
          </div>
        )}

        {/* Success/Error Message Banner */}
        {message && (
          <div className={`mb-4 p-4 rounded-lg border ${
            message.type === "success" 
              ? "bg-green-50 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800" 
              : "bg-red-50 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{message.text}</span>
              <button
                onClick={() => setMessage(null)}
                className={`ml-4 ${message.type === "success" ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300"}`}
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Users DataTable */}
        <DataTable
          refreshTrigger={refreshTrigger}
          columns={[
            { data: "name", name: "Name", searchable: true, orderable: true },
            { data: "email", name: "Email", searchable: true, orderable: true },
            { data: "ROLE_NAME", name: "Role", searchable: true, orderable: true },
            { data: "permission", name: "Permissions", searchable: true, orderable: false },
            {
              data: "password",
              name: "Reset Password",
              searchable: false,
              orderable: false,
              render: (data: string) => {
                // Parse the HTML to extract user ID and name
                const resetMatch = data.match(/getUsername\((\d+)\)/);
                const nameMatch = data.match(/data-username="([^"]+)"/);
                const userId = resetMatch ? parseInt(resetMatch[1]) : null;
                const userName = nameMatch ? nameMatch[1] : "";

                if (!userId) return null;

                return (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleResetPasswordClick(userId, userName);
                    }}
                    className="text-brand-500 hover:text-brand-600 dark:text-brand-400 inline-flex items-center gap-1 transition-colors"
                    title="Reset Password"
                  >
                    <LockIcon className="w-4 h-4" />
                    <span>Reset Password</span>
                  </button>
                );
              },
            },
            {
              data: "status",
              name: "Status",
              searchable: false,
              orderable: false,
              render: (data: string) => {
                const statusText = extractStatusText(data);
                const userId = extractStatusUserId(data);
                const newStatus = extractStatusValue(data);
                
                if (!statusText || !userId || newStatus === null) {
                  return <span>-</span>;
                }

                return (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStatusUpdate(userId, newStatus);
                    }}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                    title={newStatus === 1 ? "Click to make Inactive" : "Click to make Active"}
                  >
                    <StatusBadge status={statusText} size="sm" />
                  </button>
                );
              },
            },
            { data: "created_by", name: "Created By", searchable: true, orderable: true },
            { data: "created_at", name: "Created At", searchable: false, orderable: true },
            { data: "last_login", name: "Last Login", searchable: false, orderable: true },
            { data: "updated_by", name: "Updated By", searchable: true, orderable: true },
            { data: "updated_at", name: "Updated On", searchable: false, orderable: true },
            {
              data: "actions",
              name: "Actions",
              searchable: false,
              orderable: false,
              render: (data: string) => {
                // Parse the HTML to extract user IDs
                const editMatch = data.match(/getUserValue\((\d+)\)/);
                const deleteMatch = data.match(/deleteid.*?id="(\d+)"/);
                const editUserId = editMatch ? parseInt(editMatch[1]) : null;
                const deleteUserId = deleteMatch ? parseInt(deleteMatch[1]) : null;

                return (
                  <div className="flex items-center gap-3">
                    {editUserId && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditClick(editUserId);
                        }}
                        className="text-brand-500 hover:text-brand-600 dark:text-brand-400 transition-colors"
                        title="Edit User"
                      >
                        <PencilIcon className="w-5 h-5" />
                      </button>
                    )}
                    {deleteUserId && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(deleteUserId);
                        }}
                        className="text-red-500 hover:text-red-600 dark:text-red-400 transition-colors"
                        title="Delete User"
                      >
                        <TrashBinIcon className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                );
              },
            },
          ]}
          ajaxUrl={`${API_BASE_URL}${API_ENDPOINTS.USERS_LIST}`}
          ajaxMethod="POST"
          pageLength={10}
          lengthMenu={[10, 25, 50, 100]}
        />
      </PageContainer>

      {/* Add User Modal */}
      <AddUserModal
        isOpen={showAddUserModal}
        onClose={() => {
          setShowAddUserModal(false);
          setMessage(null);
        }}
        onSuccess={(messageText?: string) => {
          setRefreshTrigger((prev) => prev + 1);
          setMessage({ type: "success", text: messageText || "User added successfully" });
          // Clear message after 5 seconds
          setTimeout(() => setMessage(null), 5000);
        }}
      />

      {/* Edit User Modal */}
      <EditUserModal
        isOpen={showEditUserModal}
        userId={selectedUserId}
        onClose={() => {
          setShowEditUserModal(false);
          setSelectedUserId(null);
          setMessage(null);
        }}
        onSuccess={(messageText?: string) => {
          setRefreshTrigger((prev) => prev + 1);
          setMessage({ type: "success", text: messageText || "User updated successfully" });
          // Clear message after 5 seconds
          setTimeout(() => setMessage(null), 5000);
        }}
      />

      {/* Reset Password Modal */}
      {showResetPasswordModal && selectedUserId && (
        <ResetPasswordModal
          userId={selectedUserId}
          userName={selectedUserName}
          onClose={() => {
            setShowResetPasswordModal(false);
            setSelectedUserId(null);
            setSelectedUserName("");
          }}
          onSuccess={() => {
            setRefreshTrigger((prev) => prev + 1);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirmModal}
        onClose={() => {
          if (!isDeleting) {
            setShowDeleteConfirmModal(false);
            setUserToDelete(null);
          }
        }}
        onConfirm={handleDeleteUser}
        title="Confirm Delete"
        message="Are you sure you want to delete this user? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="danger"
        isLoading={isDeleting}
      />
    </PageWrapper>
  );
}

