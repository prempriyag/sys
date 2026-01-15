import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../../components/common/PageContainer";
import DataTable from "../../../components/ui/DataTable";
import Button from "../../../components/ui/button/Button";
import { api, API_ENDPOINTS, API_BASE_URL, getAuthToken } from "../../../config/api";
import { useAuth } from "../../../context/AuthContext";
import { PencilIcon, TrashBinIcon, LockIcon } from "../../../icons";
import ResetPasswordModal from "./ResetPasswordModal";

export default function UserManagement() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string>("");

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

  // Handle delete user
  const handleDeleteUser = async (userId: number) => {
    if (!confirm("Are you sure you want to delete this user?")) {
      return;
    }

    try {
      await api.delete(`${API_ENDPOINTS.USERS_DELETE}/${userId}`);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    }
  };

  // Handle status update
  const handleStatusUpdate = async (userId: number, status: number) => {
    try {
      await api.post(`${API_ENDPOINTS.USERS_UPDATE_STATUS}/${userId}?dvalue=${status}`);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  // Parse HTML status to get user ID and status value
  const parseStatusClick = (htmlString: string) => {
    const match = htmlString.match(/statusid.*?id="(\d+)".*?data-val="(\d+)"/);
    if (match) {
      const userId = parseInt(match[1]);
      const newStatus = parseInt(match[2]);
      handleStatusUpdate(userId, newStatus);
    }
  };

  // Sanitize HTML by removing onclick handlers and other event handlers
  const sanitizeHTML = (htmlString: string): string => {
    if (!htmlString) return "";
    // Remove onclick, onmouseover, onmouseout, and other event handlers
    return htmlString
      .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, "") // Remove all on* event handlers
      .replace(/\s*on\w+\s*=\s*{[^}]*}/gi, ""); // Remove React-style event handlers
  };

  // Handle edit click - navigate to edit page
  const handleEditClick = (userId: number) => {
    navigate(`/college/users/edit/${userId}`);
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
            onClick={() => navigate("/college/users/add")}
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
              render: (data: string) => (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    parseStatusClick(data);
                  }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHTML(data) }}
                />
              ),
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
                          handleDeleteUser(deleteUserId);
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
    </PageWrapper>
  );
}

