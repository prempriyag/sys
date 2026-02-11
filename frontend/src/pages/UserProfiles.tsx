import { useEffect, useState } from "react";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../components/common/PageContainer";
import Button from "../components/ui/button/Button";
import Input from "../components/form/input/InputField";
import Label from "../components/form/Label";
import { Modal } from "../components/ui/modal";
import { useModal } from "../hooks/useModal";
import { useAuth } from "../context/AuthContext";
import { api, API_ENDPOINTS } from "../config/api";
import { alertsuccess, alerterror } from "../utils/toast";

interface ProfileData {
  id: number;
  name: string;
  email: string;
  role_id: number;
  role_name: string;
  college_perm: number;
  hs_perm: number;
  ocr_perm: number;
  status: number;
  last_login: string | null;
  created_at: string | null;
}

export default function UserProfiles() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit profile modal
  const { isOpen: isEditOpen, openModal: openEditModal, closeModal: closeEditModal } = useModal();
  const [editName, setEditName] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Change password modal
  const { isOpen: isPasswordOpen, openModal: openPasswordModal, closeModal: closePasswordModal } = useModal();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const data = await api.get(API_ENDPOINTS.PROFILE);
      console.log("Profile API response:", data);
      setProfile({
        ...data,
        college_perm: Number(data.college_perm) || 0,
        hs_perm: Number(data.hs_perm) || 0,
        ocr_perm: Number(data.ocr_perm) || 0,
        status: data.status !== undefined ? Number(data.status) : 1,
      });
    } catch (error) {
      console.error("Error fetching profile:", error);
      // Fallback to auth context data
      if (user) {
        console.log("Profile fallback - auth user:", user);
        setProfile({
          id: user.id,
          name: user.name || "",
          email: user.email || "",
          role_id: user.role_id || 0,
          role_name: "",
          college_perm: Number(user.college_perm) || 0,
          hs_perm: Number(user.hs_perm) || 0,
          ocr_perm: Number(user.ocr_perm) || 0,
          status: Number(user.status) || 0,
          last_login: user.last_login || null,
          created_at: null,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchProfile();
    }
  }, [user?.id]);

  // Handle edit profile
  const handleOpenEdit = () => {
    setEditName(profile?.name || "");
    setEditError(null);
    openEditModal();
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);

    if (!editName.trim()) {
      setEditError("Name is required");
      return;
    }

    setEditLoading(true);
    try {
      await api.put(API_ENDPOINTS.PROFILE_UPDATE, { name: editName.trim() });
      alertsuccess("Profile updated successfully");
      closeEditModal();
      // Refresh profile data
      await fetchProfile();
      // Update localStorage user data so header reflects change
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          parsed.name = editName.trim();
          localStorage.setItem("user", JSON.stringify(parsed));
        } catch {
          // ignore parse error
        }
      }
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setEditLoading(false);
    }
  };

  // Handle change password
  const handleOpenPassword = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError(null);
    openPasswordModal();
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError("Current password is required");
      return;
    }

    if (!newPassword || !confirmPassword) {
      setPasswordError("Please fill in all password fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }

    setPasswordLoading(true);
    try {
      await api.post(API_ENDPOINTS.PROFILE_CHANGE_PASSWORD, {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      alertsuccess("Password changed successfully");
      closePasswordModal();
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return (
      <PageWrapper>
        <PageMeta title="My Profile | OSUCSC" description="User profile page" />
        <PageBreadcrumb pageTitle="My Profile" />
        <PageContainer>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
              <p className="mt-4 text-gray-500 dark:text-gray-400">Loading profile...</p>
            </div>
          </div>
        </PageContainer>
      </PageWrapper>
    );
  }

  const getStatusBadge = (s: number) => {
    if (Number(s) === 1) {
      return (
        <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/20 dark:text-green-400 dark:ring-green-500/20">
          Active
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-500/20">
        Inactive
      </span>
    );
  };

  const getPermissionBadges = () => {
    const badges = [];
    if (Number(profile?.college_perm) === 1) {
      badges.push(
        <span key="college" className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-500/20">
          College
        </span>
      );
    }
    if (Number(profile?.hs_perm) === 1) {
      badges.push(
        <span key="hs" className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-600/20 dark:bg-purple-900/20 dark:text-purple-400 dark:ring-purple-500/20">
          High School
        </span>
      );
    }
    if (Number(profile?.ocr_perm) === 1) {
      badges.push(
        <span key="ocr" className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-600/20 dark:bg-orange-900/20 dark:text-orange-400 dark:ring-orange-500/20">
          OCR Portal
        </span>
      );
    }
    if (badges.length === 0) {
      return <span className="text-sm text-gray-400 dark:text-gray-500">None</span>;
    }
    return <div className="flex flex-wrap gap-2">{badges}</div>;
  };

  return (
    <PageWrapper>
      <PageMeta
        title="My Profile | OSUCSC"
        description="User profile page with account information"
      />
      <PageBreadcrumb pageTitle="My Profile" />

      <PageContainer>
        {/* Profile Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">
              My Profile
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              View and manage your account information
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleOpenEdit}>
              <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
              Edit Profile
            </Button>
            <Button onClick={handleOpenPassword}>
              <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              Change Password
            </Button>
          </div>
        </div>

        {/* Profile Details Card */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          {/* User Info Section */}
          <div className="border-b border-gray-200 p-5 dark:border-gray-800 lg:p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-500/10 text-brand-500 dark:bg-brand-500/20">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                  {profile?.name || "User"}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {profile?.email || ""}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Full Name
                </p>
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                  {profile?.name || "-"}
                </p>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Email Address
                </p>
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                  {profile?.email || "-"}
                </p>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Role
                </p>
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                  {profile?.role_name || "-"}
                </p>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Status
                </p>
                {profile ? getStatusBadge(profile.status) : "-"}
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Last Login
                </p>
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                  {profile?.last_login || "-"}
                </p>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Account Created
                </p>
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                  {profile?.created_at || "-"}
                </p>
              </div>
            </div>
          </div>

          {/* Permissions Section */}
          <div className="p-5 lg:p-6">
            <h5 className="mb-4 text-sm font-semibold text-gray-800 dark:text-white/90">
              Module Permissions
            </h5>
            {getPermissionBadges()}
          </div>
        </div>
      </PageContainer>

      {/* Edit Profile Modal */}
      <Modal isOpen={isEditOpen} onClose={closeEditModal} className="max-w-[500px] m-4">
        <div className="relative w-full max-w-[500px] rounded-3xl bg-white p-6 dark:bg-gray-900 lg:p-8">
          <div className="mb-6">
            <h4 className="text-xl font-semibold text-gray-800 dark:text-white/90">
              Edit Profile
            </h4>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Update your profile information
            </p>
          </div>

          {editError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
              {editError}
              <button onClick={() => setEditError(null)} className="ml-3 text-red-800 dark:text-red-300 font-bold">
                x
              </button>
            </div>
          )}

          <form onSubmit={handleEditSubmit} className="space-y-5">
            <div>
              <Label>Full Name *</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Enter Full Name"
                required
              />
            </div>

            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={profile?.email || ""}
                disabled
                className="bg-gray-100 dark:bg-gray-700"
              />
              <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
            </div>

            <div>
              <Label>Role</Label>
              <Input
                value={profile?.role_name || ""}
                disabled
                className="bg-gray-100 dark:bg-gray-700"
              />
              <p className="mt-1 text-xs text-gray-500">Contact administrator to change role</p>
            </div>

            <div className="flex items-center gap-3 pt-2 justify-end">
              <Button size="sm" variant="outline" type="button" onClick={closeEditModal}>
                Cancel
              </Button>
              <Button size="sm" type="submit" disabled={editLoading}>
                {editLoading ? (
                  <>
                    <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Change Password Modal */}
      <Modal isOpen={isPasswordOpen} onClose={closePasswordModal} className="max-w-[500px] m-4">
        <div className="relative w-full max-w-[500px] rounded-3xl bg-white p-6 dark:bg-gray-900 lg:p-8">
          <div className="mb-6">
            <h4 className="text-xl font-semibold text-gray-800 dark:text-white/90">
              Change Password
            </h4>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Enter your current password and choose a new one
            </p>
          </div>

          {passwordError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
              {passwordError}
              <button onClick={() => setPasswordError(null)} className="ml-3 text-red-800 dark:text-red-300 font-bold">
                x
              </button>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-5">
            <div>
              <Label>Current Password *</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                required
              />
            </div>

            <div>
              <Label>New Password *</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 8 characters)"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Must contain uppercase, lowercase, number, and special character
              </p>
            </div>

            <div>
              <Label>Confirm New Password *</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
              />
            </div>

            <div className="flex items-center gap-3 pt-2 justify-end">
              <Button size="sm" variant="outline" type="button" onClick={closePasswordModal}>
                Cancel
              </Button>
              <Button size="sm" type="submit" disabled={passwordLoading}>
                {passwordLoading ? (
                  <>
                    <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                    Updating...
                  </>
                ) : (
                  "Update Password"
                )}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </PageWrapper>
  );
}
