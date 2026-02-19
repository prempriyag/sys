import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../../components/common/PageContainer";
import Button from "../../../components/ui/button/Button";
import Input from "../../../components/form/input/InputField";
import Label from "../../../components/form/Label";
import { api, API_ENDPOINTS } from "../../../config/api";
import { Role, UserFormData } from "./types";

export default function EditUser() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const userId = id ? parseInt(id) : null;

  const [roles, setRoles] = useState<Role[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);
  const [formData, setFormData] = useState<UserFormData>({
    name: "",
    email: "",
    role_id: 0,
    college_perm: 0,
    hs_perm: 0,
    ocr_perm: 0,
    status: 1,
  });

  // Fetch roles and user data
  useEffect(() => {
    const fetchData = async () => {
      if (!userId) {
        setError("Invalid user ID");
        setLoadingUser(false);
        return;
      }

      try {
        // Fetch roles
        const rolesResponse = await api.get(API_ENDPOINTS.USERS);
        setRoles(rolesResponse.roles || []);

        // Fetch user data
        const userResponse = await api.get(`${API_ENDPOINTS.USERS_EDIT}/${userId}`);
        console.log("User data response:", userResponse);
        setFormData({
          name: userResponse.name || "",
          email: userResponse.email || "",
          role_id: userResponse.role_id || 0,
          college_perm: userResponse.college_perm ?? 0,
          hs_perm: userResponse.hs_perm ?? 0,
          ocr_perm: userResponse.ocr_perm ?? 0,
          status: userResponse.status ?? 1,
        });
      } catch (err: any) {
        if (err?.status === 403) {
          setError("You don't have permission to edit users. Please contact your administrator.");
        } else {
          console.error("Error fetching data:", err);
          setError(err instanceof Error ? err.message : "Failed to load user data");
        }
      } finally {
        setLoadingUser(false);
      }
    };

    fetchData();
  }, [userId]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setError(null);

    // Validation
    if (!formData.name || !formData.role_id) {
      setError("Please fill in all required fields");
      return;
    }

    if (!formData.college_perm && !formData.hs_perm && !formData.ocr_perm) {
      setError("Please select at least one permission");
      return;
    }

    setLoading(true);
    try {
      await api.put(`${API_ENDPOINTS.USERS_UPDATE}/${userId}`, formData);
      // Navigate back to user management list
      navigate("/users");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setLoading(false);
    }
  };

  if (loadingUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
          <p className="mt-4 text-gray-500">Loading user data...</p>
        </div>
      </div>
    );
  }

  return (
    <PageWrapper>
      <PageMeta
        title="Edit User | College Module"
        description="Edit user information"
      />
      <PageBreadcrumb pageTitle="Edit User" />

      <PageContainer>
        <div className="mb-6">
          <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">
            Edit User
          </h3>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label>Full Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter Full Name"
              required
            />
          </div>

          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={formData.email}
              disabled
              className="bg-gray-100 dark:bg-gray-700"
            />
            <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
          </div>

          <div>
            <Label>Role *</Label>
            <div className="relative">
              <select
                className="relative w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                value={formData.role_id}
                onChange={(e) => setFormData({ ...formData, role_id: parseInt(e.target.value) })}
                required
              >
                <option value={0}>Select Role</option>
                {roles.map((role) => (
                  <option key={role.ID} value={role.ID}>
                    {role.ROLE_NAME}
                  </option>
                ))}
              </select>
              <span className="absolute right-4 top-1/2 -translate-y-1/2">
                <svg
                  className="fill-current"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M19.5 8.25L12 15.75L4.5 8.25"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </div>
          </div>

          <div>
            <Label>Permissions *</Label>
            <div className="mt-2 space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.college_perm === 1}
                  onChange={(e) =>
                    setFormData({ ...formData, college_perm: e.target.checked ? 1 : 0 })
                  }
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">College</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.hs_perm === 1}
                  onChange={(e) =>
                    setFormData({ ...formData, hs_perm: e.target.checked ? 1 : 0 })
                  }
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">High School</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.ocr_perm === 1}
                  onChange={(e) =>
                    setFormData({ ...formData, ocr_perm: e.target.checked ? 1 : 0 })
                  }
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">OCR Portal</span>
              </label>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              type="submit"
              className="flex-1"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                  Updating...
                </>
              ) : (
                "Update User"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/users")}
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </PageContainer>
    </PageWrapper>
  );
}

