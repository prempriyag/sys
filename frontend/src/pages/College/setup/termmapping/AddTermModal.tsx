import { useState, useEffect } from "react";
import { Modal } from "../../../../components/ui/modal";
import Button from "../../../../components/ui/button/Button";
import Input from "../../../../components/form/input/InputField";
import Label from "../../../../components/form/Label";
import { api, API_BASE_URL } from "../../../../config/api";
import { useToast } from "../../../../context/ToastContext";

interface AddTermModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface TermFormData {
  TERM: string;
  TERM_CODE: string;
  TERM_START: string;
  TERM_END: string;
  IS_ACTIVE: string;
  GRACE_PERIOD: number;
}

export default function AddTermModal({
  isOpen,
  onClose,
  onSuccess,
}: AddTermModalProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<TermFormData>({
    TERM: "",
    TERM_CODE: "",
    TERM_START: "",
    TERM_END: "",
    IS_ACTIVE: "Y",
    GRACE_PERIOD: 0,
  });
  const { alertsuccess, alerterror } = useToast();

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        TERM: "",
        TERM_CODE: "",
        TERM_START: "",
        TERM_END: "",
        IS_ACTIVE: "Y",
        GRACE_PERIOD: 0,
      });
      setErrors({});
    }
  }, [isOpen]);

  // Field-level validation
  const validateField = (name: string, value: any): string => {
    switch (name) {
      case "TERM":
        if (!value || value.trim() === "") {
          return "Term is required";
        }
        return "";
      case "TERM_CODE":
        if (!value || value.trim() === "") {
          return "Term Code is required";
        }
        return "";
      case "TERM_START":
        if (!value || value.trim() === "") {
          return "Term Start is required";
        }
        return "";
      case "TERM_END":
        if (!value || value.trim() === "") {
          return "Term End is required";
        }
        return "";
      case "GRACE_PERIOD":
        if (value === null || value === undefined || value < 0) {
          return "Grace Period must be a valid number";
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
    newErrors.TERM = validateField("TERM", formData.TERM);
    newErrors.TERM_CODE = validateField("TERM_CODE", formData.TERM_CODE);
    newErrors.TERM_START = validateField("TERM_START", formData.TERM_START);
    newErrors.TERM_END = validateField("TERM_END", formData.TERM_END);
    newErrors.GRACE_PERIOD = validateField("GRACE_PERIOD", formData.GRACE_PERIOD);

    // If there are errors, set them and return
    const hasErrors = Object.values(newErrors).some((error) => error !== "");
    if (hasErrors) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const response = await api.post(`${API_BASE_URL}/api/termmapping/insert`, formData);
      
      if (response.status === 1 || response.message?.includes("success")) {
        alertsuccess(response.message || "Term added successfully");
        onSuccess();
        onClose();
      } else {
        alerterror(response.message || "Failed to add term");
      }
    } catch (err: any) {
      console.error("Add term error:", err);
      alerterror(err.response?.data?.message || err.message || "Failed to add term");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-2xl">
      <div className="p-6">
        <h3 className="mb-6 text-xl font-semibold text-gray-800 dark:text-white">
          Add New Term
        </h3>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Term *</Label>
              <Input
                value={formData.TERM}
                onChange={(e) => handleFieldChange("TERM", e.target.value)}
                onBlur={(e) => handleBlur("TERM", e.target.value)}
                placeholder="Enter Term"
                error={!!errors.TERM}
                className={errors.TERM ? "border-red-500" : ""}
              />
              {errors.TERM && (
                <p className="mt-1 text-xs text-red-500">{errors.TERM}</p>
              )}
            </div>

            <div>
              <Label>Term Code *</Label>
              <Input
                value={formData.TERM_CODE}
                onChange={(e) => handleFieldChange("TERM_CODE", e.target.value)}
                onBlur={(e) => handleBlur("TERM_CODE", e.target.value)}
                placeholder="Enter Term Code"
                error={!!errors.TERM_CODE}
                className={errors.TERM_CODE ? "border-red-500" : ""}
              />
              {errors.TERM_CODE && (
                <p className="mt-1 text-xs text-red-500">{errors.TERM_CODE}</p>
              )}
            </div>

            <div>
              <Label>Term Start *</Label>
              <Input
                type="date"
                value={formData.TERM_START}
                onChange={(e) => handleFieldChange("TERM_START", e.target.value)}
                onBlur={(e) => handleBlur("TERM_START", e.target.value)}
                error={!!errors.TERM_START}
                className={errors.TERM_START ? "border-red-500" : ""}
              />
              {errors.TERM_START && (
                <p className="mt-1 text-xs text-red-500">{errors.TERM_START}</p>
              )}
            </div>

            <div>
              <Label>Term End *</Label>
              <Input
                type="date"
                value={formData.TERM_END}
                onChange={(e) => handleFieldChange("TERM_END", e.target.value)}
                onBlur={(e) => handleBlur("TERM_END", e.target.value)}
                error={!!errors.TERM_END}
                className={errors.TERM_END ? "border-red-500" : ""}
              />
              {errors.TERM_END && (
                <p className="mt-1 text-xs text-red-500">{errors.TERM_END}</p>
              )}
            </div>

            <div>
              <Label>Is Active *</Label>
              <div className="relative">
                <select
                  className={`relative w-full appearance-none rounded-lg border bg-transparent px-4 py-2.5 text-sm text-gray-800 outline-none focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800 border-gray-300 focus:border-brand-500`}
                  value={formData.IS_ACTIVE}
                  onChange={(e) => handleFieldChange("IS_ACTIVE", e.target.value)}
                >
                  <option value="Y">Active</option>
                  <option value="N">InActive</option>
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
            </div>

            <div>
              <Label>Grace Period *</Label>
              <Input
                type="number"
                value={formData.GRACE_PERIOD}
                onChange={(e) => handleFieldChange("GRACE_PERIOD", parseInt(e.target.value) || 0)}
                onBlur={(e) => handleBlur("GRACE_PERIOD", parseInt(e.target.value) || 0)}
                placeholder="Enter Grace Period"
                error={!!errors.GRACE_PERIOD}
                className={errors.GRACE_PERIOD ? "border-red-500" : ""}
              />
              {errors.GRACE_PERIOD && (
                <p className="mt-1 text-xs text-red-500">{errors.GRACE_PERIOD}</p>
              )}
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
                "Add Term"
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

