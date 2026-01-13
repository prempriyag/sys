import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../../components/common/PageContainer";
import Button from "../../../components/ui/button/Button";
import Input from "../../../components/form/input/InputField";
import Label from "../../../components/form/Label";
import { api, API_ENDPOINTS } from "../../../config/api";
import { Role, UserFormData } from "./types";

export default function AddUser() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState<Role[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<UserFormData>({
    name: "",
    email: "",
    password: "",
    cpassword: "",
    role_id: 0,
    college_perm: 0,
    hs_perm: 0,
    ocr_perm: 0,
    status: 1,
  });

  // Fetch roles
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await api.get(API_ENDPOINTS.USERS);
        setRoles(response.roles || []);
      } catch (err: any) {
        if (err?.status === 403) {
          setError("You don't have permission to access user management. Please contact your administrator.");
        } else {
          console.error("Error fetching roles:", err);
          setError("Failed to load roles. Please try again.");
        }
      }
    };
    fetchRoles();
  }, []);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.name || !formData.email || !formData.role_id || !formData.password || !formData.cpassword) {
      setError("Please fill in all required fields");
      return;
    }

    if (formData.password !== formData.cpassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (!formData.college_perm && !formData.hs_perm && !formData.ocr_perm) {
      setError("Please select at least one permission");
      return;
    }

    setLoading(true);
    try {
      const { cpassword, ...submitData } = formData;
      await api.post(API_ENDPOINTS.USERS_INSERT, submitData);
      // Navigate back to user management list
      navigate("/college/users");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageWrapper>
      <PageMeta
        title="Add User | College Module"
        description="Add a new user to the system"
      />
      <PageBreadcrumb pageTitle="Add User" />

      <PageContainer>
        <div className="mb-6">
          <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">
            Add New User
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
            <Label>Email *</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="Enter Email"
              required
            />
          </div>

          <div>
            <Label>Password *</Label>
            <Input
              type="password"
              value={formData.password || ""}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Enter Password (min 8 characters)"
              required
            />
          </div>

          <div>
            <Label>Confirm Password *</Label>
            <Input
              type="password"
              value={formData.cpassword || ""}
              onChange={(e) => setFormData({ ...formData, cpassword: e.target.value })}
              placeholder="Confirm Password"
              required
            />
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
                  Adding...
                </>
              ) : (
                "Add User"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/college/users")}
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

