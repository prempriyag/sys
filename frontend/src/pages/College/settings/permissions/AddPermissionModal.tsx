import { useState, useEffect } from "react";
import { Modal } from "../../../../components/ui/modal";
import Button from "../../../../components/ui/button/Button";
import Input from "../../../../components/form/input/InputField";
import Label from "../../../../components/form/Label";
import { api } from "../../../../config/api";
import { useToast } from "../../../../context/ToastContext";

interface Permission {
  ID: number;
  PERMISSION_NAME: string;
  PERMISSION_KEY?: string;
  TYPE?: string;
}

interface AddPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  parentPermissions: Permission[];
}

interface FormData {
  permission_name: string;
  permission_key: string;
  type: string | number;
}

export default function AddPermissionModal({
  isOpen,
  onClose,
  onSuccess,
  parentPermissions,
}: AddPermissionModalProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    permission_name: "",
    permission_key: "",
    type: "parent",
  });
  const [showKeyField, setShowKeyField] = useState(false);
  const { alertsuccess, alerterror } = useToast();

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        permission_name: "",
        permission_key: "",
        type: "parent",
      });
      setShowKeyField(false);
      setErrors({});
    }
  }, [isOpen]);

  // Field-level validation
  const validateField = (name: string, value: any): string => {
    switch (name) {
      case "permission_name":
        if (!value || value.trim() === "") {
          return "Permission name is required";
        }
        return "";
      case "permission_key":
        if (showKeyField && (!value || value.trim() === "")) {
          return "Permission key is required";
        }
        return "";
      case "type":
        if (!value) {
          return "Please select a type";
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

  const handleTypeChange = (value: string) => {
    const isParent = value === "parent";
    setFormData({
      ...formData,
      type: value,
      permission_key: isParent ? "" : formData.permission_key,
    });
    setShowKeyField(!isParent);
    // Clear errors when type changes
    if (errors.permission_key) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.permission_key;
        return newErrors;
      });
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate all fields
    const newErrors: Record<string, string> = {};
    newErrors.permission_name = validateField("permission_name", formData.permission_name);
    newErrors.type = validateField("type", formData.type);
    
    if (showKeyField) {
      newErrors.permission_key = validateField("permission_key", formData.permission_key);
    }

    // If there are errors, set them and return
    const hasErrors = Object.values(newErrors).some((error) => error !== "");
    if (hasErrors) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      // Auto-generate permission key if parent
      let permission_key = formData.permission_key;
      if (formData.type === "parent") {
        permission_key = "par_" + formData.permission_name.toLowerCase().replace(/\s+/g, "_");
      }

      const response = await api.post("/api/permissions/add", {
        permission_name: formData.permission_name,
        permission_key: permission_key,
        type: formData.type,
      });

      if (response.status === 1) {
        const successMessage = response.message || "Permission added successfully";
        alertsuccess(successMessage);
        onSuccess();
        onClose();
      } else {
        const errorMessage = response.message || "Failed to add permission";
        alerterror(errorMessage);
      }
    } catch (err: any) {
      console.error("Add permission error:", err);
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.detail ||
        err.message ||
        "Failed to add permission";
      alerterror(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      {/* Modal Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
          Add Permission
        </h3>
      </div>

      {/* Modal Body */}
      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Title *</Label>
            <Input
              value={formData.permission_name}
              onChange={(e) => handleFieldChange("permission_name", e.target.value)}
              onBlur={(e) => handleBlur("permission_name", e.target.value)}
              placeholder="Enter permission name"
              error={!!errors.permission_name}
              className={errors.permission_name ? "border-red-500" : ""}
            />
            {errors.permission_name && (
              <p className="mt-1 text-xs text-red-500">{errors.permission_name}</p>
            )}
          </div>

          <div>
            <Label>Select *</Label>
            <div className="relative">
              <select
                className={`relative w-full appearance-none rounded-lg border bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800 ${
                  errors.type ? "border-red-500" : "border-gray-300 focus:border-brand-500"
                }`}
                value={formData.type}
                onChange={(e) => handleTypeChange(e.target.value)}
                onBlur={(e) => handleBlur("type", e.target.value)}
                required
              >
                <option value="parent">This is parent</option>
                {parentPermissions.map((per) => (
                  <option key={per.ID} value={per.ID}>
                    {per.PERMISSION_NAME}
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
            {errors.type && (
              <p className="mt-1 text-xs text-red-500">{errors.type}</p>
            )}
          </div>

          {showKeyField && (
            <div>
              <Label>Permission Key *</Label>
              <Input
                type="text"
                value={formData.permission_key}
                onChange={(e) => handleFieldChange("permission_key", e.target.value)}
                onBlur={(e) => handleBlur("permission_key", e.target.value)}
                placeholder="Enter permission key"
                error={!!errors.permission_key}
                className={errors.permission_key ? "border-red-500" : ""}
                required={showKeyField}
              />
              {errors.permission_key && (
                <p className="mt-1 text-xs text-red-500">{errors.permission_key}</p>
              )}
            </div>
          )}

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
                "Submit"
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
