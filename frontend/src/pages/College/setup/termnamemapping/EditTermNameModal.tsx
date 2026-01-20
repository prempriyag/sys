import { useState, useEffect } from "react";
import { Modal } from "../../../../components/ui/modal";
import Button from "../../../../components/ui/button/Button";
import Input from "../../../../components/form/input/InputField";
import Label from "../../../../components/form/Label";
import { api, API_BASE_URL } from "../../../../config/api";
import { useToast } from "../../../../context/ToastContext";

interface EditTermNameModalProps {
  isOpen: boolean;
  termNameId: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface TermNameFormData {
  OCR_TERM_NAME: string;
  TERM_NAME: string;
}

export default function EditTermNameModal({
  isOpen,
  termNameId,
  onClose,
  onSuccess,
}: EditTermNameModalProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadingTermName, setLoadingTermName] = useState(false);
  const [formData, setFormData] = useState<TermNameFormData>({
    OCR_TERM_NAME: "",
    TERM_NAME: "",
  });
  const { alertsuccess, alerterror } = useToast();

  // Fetch term name data
  useEffect(() => {
    if (isOpen && termNameId) {
      const fetchData = async () => {
        setLoadingTermName(true);
        try {
          const response = await api.post(`${API_BASE_URL}/api/termnamemapping/get`, { id: termNameId });
          
          // Log response for debugging
          console.log("Term name data response:", response);
          
          // The API returns the data directly
          if (response && (response.Id || response.id)) {
            setFormData({
              OCR_TERM_NAME: response.OCR_TERM_NAME || "",
              TERM_NAME: response.TERM_NAME || "",
            });
            console.log("Form data set:", {
              OCR_TERM_NAME: response.OCR_TERM_NAME || "",
              TERM_NAME: response.TERM_NAME || "",
            });
          } else {
            console.error("Invalid response structure - missing Id:", response);
            alerterror("Failed to load term name data: Invalid response format");
          }
        } catch (err: any) {
          console.error("Error fetching term name data:", err);
          const errorMessage = err.response?.data?.detail || 
                              err.response?.data?.message || 
                              err.message || 
                              "Failed to load term name data";
          alerterror(errorMessage);
        } finally {
          setLoadingTermName(false);
        }
      };

      fetchData();
    }
  }, [isOpen, termNameId, alerterror]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        OCR_TERM_NAME: "",
        TERM_NAME: "",
      });
      setErrors({});
    }
  }, [isOpen]);

  // Field-level validation
  const validateField = (name: string, value: any): string => {
    switch (name) {
      case "OCR_TERM_NAME":
        if (!value || value.trim() === "") {
          return "OCR Term Name is required";
        }
        return "";
      case "TERM_NAME":
        if (!value || value.trim() === "") {
          return "Term Name is required";
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
    if (!termNameId) return;

    setErrors({});

    // Validate all fields
    const newErrors: Record<string, string> = {};
    newErrors.OCR_TERM_NAME = validateField("OCR_TERM_NAME", formData.OCR_TERM_NAME);
    newErrors.TERM_NAME = validateField("TERM_NAME", formData.TERM_NAME);

    // If there are errors, set them and return
    const hasErrors = Object.values(newErrors).some((error) => error !== "");
    if (hasErrors) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const response = await api.post(`${API_BASE_URL}/api/termnamemapping/update`, {
        Id: termNameId,
        ...formData,
      });
      
      if (response.status === 1 || response.message?.includes("success")) {
        alertsuccess(response.message || "Term name updated successfully");
        onSuccess();
        onClose();
      } else {
        alerterror(response.message || "Failed to update term name");
      }
    } catch (err: any) {
      console.error("Update term name error:", err);
      alerterror(err.response?.data?.message || err.message || "Failed to update term name");
    } finally {
      setLoading(false);
    }
  };

  if (!termNameId) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <div className="p-6">
        <h3 className="mb-6 text-xl font-semibold text-gray-800 dark:text-white">
          Edit Term Name
        </h3>

        {loadingTermName ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
              <p className="mt-4 text-gray-500">Loading term name data...</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>OCR Term Name *</Label>
              <Input
                value={formData.OCR_TERM_NAME}
                onChange={(e) => handleFieldChange("OCR_TERM_NAME", e.target.value)}
                onBlur={(e) => handleBlur("OCR_TERM_NAME", e.target.value)}
                placeholder="Enter OCR Term Name"
                error={!!errors.OCR_TERM_NAME}
                className={errors.OCR_TERM_NAME ? "border-red-500" : ""}
              />
              {errors.OCR_TERM_NAME && (
                <p className="mt-1 text-xs text-red-500">{errors.OCR_TERM_NAME}</p>
              )}
            </div>

            <div>
              <Label>Term Name *</Label>
              <Input
                value={formData.TERM_NAME}
                onChange={(e) => handleFieldChange("TERM_NAME", e.target.value)}
                onBlur={(e) => handleBlur("TERM_NAME", e.target.value)}
                placeholder="Enter Term Name"
                error={!!errors.TERM_NAME}
                className={errors.TERM_NAME ? "border-red-500" : ""}
              />
              {errors.TERM_NAME && (
                <p className="mt-1 text-xs text-red-500">{errors.TERM_NAME}</p>
              )}
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
                  "Update Term Name"
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
        )}
      </div>
    </Modal>
  );
}

