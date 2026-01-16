import { useState, useEffect } from "react";
import { Modal } from "../../../components/ui/modal";
import Button from "../../../components/ui/button/Button";
import Input from "../../../components/form/input/InputField";
import Label from "../../../components/form/Label";
import { api, API_ENDPOINTS } from "../../../config/api";
import { Role, UserFormData } from "./types";
import { useToast } from "../../../context/ToastContext";

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddUserModal({
  isOpen,
  onClose,
  onSuccess,
}: AddUserModalProps) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
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
  const { alertsuccess, alerterror } = useToast();

  // Fetch roles
  useEffect(() => {
    if (isOpen) {
      const fetchRoles = async () => {
        try {
          const response = await api.get(API_ENDPOINTS.USERS);
          setRoles(response.roles || []);
        } catch (err: any) {
          console.error("Error fetching roles:", err);
          alerterror("Failed to load roles. Please try again.");
        }
      };
      fetchRoles();
    }
  }, [isOpen, alerterror]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
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
      setErrors({});
    }
  }, [isOpen]);

  // Field-level validation
  const validateField = (name: string, value: any): string => {
    switch (name) {
      case "name":
        if (!value || value.trim() === "") {
          return "Full Name is required";
        }
        return "";
      case "email":
        if (!value || value.trim() === "") {
          return "Email is required";
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return "Please enter a valid email address";
        }
        return "";
      case "password":
        if (!value || value.trim() === "") {
          return "Password is required";
        }
        if (value.length < 8) {
          return "Password must be at least 8 characters";
        }
        return "";
      case "cpassword":
        if (!value || value.trim() === "") {
          return "Confirm Password is required";
        }
        if (value !== formData.password) {
          return "Passwords do not match";
        }
        return "";
      case "role_id":
        if (!value || value === 0) {
          return "Please select a role";
        }
        return "";
      default:
        return "";
    }
  };

  const handleFieldChange = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleBlur = (name: string, value: any) => {
    const error = validateField(name, value);
    if (error) {
      setErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate all fields
    const newErrors: Record<string, string> = {};
    newErrors.name = validateField("name", formData.name);
    newErrors.email = validateField("email", formData.email);
    newErrors.password = validateField("password", formData.password);
    newErrors.cpassword = validateField("cpassword", formData.cpassword);
    newErrors.role_id = validateField("role_id", formData.role_id);

    // Check permissions
    if (!formData.college_perm && !formData.hs_perm && !formData.ocr_perm) {
      newErrors.permissions = "Please select at least one permission";
    }

    // If there are errors, set them and return
    const hasErrors = Object.values(newErrors).some((error) => error !== "");
    if (hasErrors) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const { cpassword, ...submitData } = formData;
      const response = await api.post(API_ENDPOINTS.USERS_INSERT, submitData);
      
      if (response.data?.status === 1 || response.data?.message?.includes("success")) {
        alertsuccess(response.data?.message || "User added successfully");
        onSuccess();
        onClose();
      } else {
        alerterror(response.data?.message || "Failed to add user");
      }
    } catch (err: any) {
      console.error("Add user error:", err);
      alerterror(err.response?.data?.message || err.message || "Failed to add user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-2xl">
      <div className="p-6">
        <h3 className="mb-6 text-xl font-semibold text-gray-800 dark:text-white">
          Add New User
        </h3>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Full Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => handleFieldChange("name", e.target.value)}
              onBlur={(e) => handleBlur("name", e.target.value)}
              placeholder="Enter Full Name"
              required
              className={errors.name ? "border-red-500" : ""}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-500">{errors.name}</p>
            )}
          </div>

          <div>
            <Label>Email *</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => handleFieldChange("email", e.target.value)}
              onBlur={(e) => handleBlur("email", e.target.value)}
              placeholder="Enter Email"
              required
              className={errors.email ? "border-red-500" : ""}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-500">{errors.email}</p>
            )}
          </div>

          <div>
            <Label>Password *</Label>
            <Input
              type="password"
              value={formData.password || ""}
              onChange={(e) => handleFieldChange("password", e.target.value)}
              onBlur={(e) => handleBlur("password", e.target.value)}
              placeholder="Enter Password (min 8 characters)"
              required
              className={errors.password ? "border-red-500" : ""}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-500">{errors.password}</p>
            )}
          </div>

          <div>
            <Label>Confirm Password *</Label>
            <Input
              type="password"
              value={formData.cpassword || ""}
              onChange={(e) => handleFieldChange("cpassword", e.target.value)}
              onBlur={(e) => handleBlur("cpassword", e.target.value)}
              placeholder="Confirm Password"
              required
              className={errors.cpassword ? "border-red-500" : ""}
            />
            {errors.cpassword && (
              <p className="mt-1 text-xs text-red-500">{errors.cpassword}</p>
            )}
          </div>

          <div>
            <Label>Role *</Label>
            <div className="relative">
              <select
                className={`relative w-full appearance-none rounded-lg border bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800 ${
                  errors.role_id ? "border-red-500" : "border-gray-300 focus:border-brand-500"
                }`}
                value={formData.role_id}
                onChange={(e) => handleFieldChange("role_id", parseInt(e.target.value))}
                onBlur={(e) => handleBlur("role_id", parseInt(e.target.value))}
                required
              >
                <option value={0}>Select Role</option>
                {roles.map((role) => (
                  <option key={role.ID} value={role.ID}>
                    {role.ROLE_NAME}
                  </option>
                ))}
              </select>
              <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
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
            {errors.role_id && (
              <p className="mt-1 text-xs text-red-500">{errors.role_id}</p>
            )}
          </div>

          <div>
            <Label>Permissions *</Label>
            {errors.permissions && (
              <p className="mb-2 text-xs text-red-500">{errors.permissions}</p>
            )}
            <div className="mt-2 space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.college_perm === 1}
                  onChange={(e) =>
                    handleFieldChange("college_perm", e.target.checked ? 1 : 0)
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
                    handleFieldChange("hs_perm", e.target.checked ? 1 : 0)
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
                    handleFieldChange("ocr_perm", e.target.checked ? 1 : 0)
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
              onClick={onClose}
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

