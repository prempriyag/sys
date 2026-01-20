import { useState, useEffect } from "react";
import { Modal } from "../../../../components/ui/modal";
import Button from "../../../../components/ui/button/Button";
import Input from "../../../../components/form/input/InputField";
import Label from "../../../../components/form/Label";
import { api, API_BASE_URL } from "../../../../config/api";
import { useToast } from "../../../../context/ToastContext";

interface EditDegreeModalProps {
  isOpen: boolean;
  degreeId: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface DegreeFormData {
  DEGREE_CD: string;
  DEGREE_NAME: string;
}

export default function EditDegreeModal({
  isOpen,
  degreeId,
  onClose,
  onSuccess,
}: EditDegreeModalProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadingDegree, setLoadingDegree] = useState(false);
  const [formData, setFormData] = useState<DegreeFormData>({
    DEGREE_CD: "",
    DEGREE_NAME: "",
  });
  const { alertsuccess, alerterror } = useToast();

  // Fetch degree data
  useEffect(() => {
    if (isOpen && degreeId) {
      const fetchData = async () => {
        setLoadingDegree(true);
        try {
          const response = await api.post(`${API_BASE_URL}/api/degreemapping/get`, { id: degreeId });
          
          // Log response for debugging
          console.log("Degree data response:", response);
          
          // The API returns { Id, DEGREE_CD, DEGREE_NAME } directly
          // Handle both Id and id (case variations)
          const degreeId = response.Id || response.id || response.ID;
          if (response && degreeId) {
            setFormData({
              DEGREE_CD: response.DEGREE_CD || response.degree_cd || "",
              DEGREE_NAME: response.DEGREE_NAME || response.degree_name || "",
            });
            console.log("Form data set:", {
              DEGREE_CD: response.DEGREE_CD || response.degree_cd || "",
              DEGREE_NAME: response.DEGREE_NAME || response.degree_name || "",
            });
          } else {
            console.error("Invalid response structure - missing Id:", response);
            alerterror("Failed to load degree data: Invalid response format");
          }
        } catch (err: any) {
          console.error("Error fetching degree data:", err);
          const errorMessage = err.response?.data?.detail || 
                              err.response?.data?.message || 
                              err.message || 
                              "Failed to load degree data";
          alerterror(errorMessage);
        } finally {
          setLoadingDegree(false);
        }
      };

      fetchData();
    }
  }, [isOpen, degreeId, alerterror]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        DEGREE_CD: "",
        DEGREE_NAME: "",
      });
      setErrors({});
    }
  }, [isOpen]);

  // Field-level validation
  const validateField = (name: string, value: any): string => {
    switch (name) {
      case "DEGREE_CD":
        if (!value || value.trim() === "") {
          return "Degree Code is required";
        }
        return "";
      case "DEGREE_NAME":
        if (!value || value.trim() === "") {
          return "Degree Name is required";
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
    if (!degreeId) return;

    setErrors({});

    // Validate all fields
    const newErrors: Record<string, string> = {};
    newErrors.DEGREE_CD = validateField("DEGREE_CD", formData.DEGREE_CD);
    newErrors.DEGREE_NAME = validateField("DEGREE_NAME", formData.DEGREE_NAME);

    // If there are errors, set them and return
    const hasErrors = Object.values(newErrors).some((error) => error !== "");
    if (hasErrors) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const response = await api.post(`${API_BASE_URL}/api/degreemapping/update`, {
        Id: degreeId,
        ...formData,
      });
      
      console.log("Update degree response:", response);
      
      // Backend returns: {"status": 1, "message": "Successfully updated.", ...}
      if (response && (response.status === 1 || response.status === "1")) {
        alertsuccess(response.message || "Degree updated successfully");
        onSuccess();
        onClose();
      } else {
        alerterror(response.message || "Failed to update degree");
      }
    } catch (err: any) {
      console.error("Update degree error:", err);
      const errorMessage = err.response?.data?.detail || 
                          err.response?.data?.message || 
                          err.message || 
                          "Failed to update degree";
      alerterror(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!degreeId) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <div className="p-6">
        <h3 className="mb-6 text-xl font-semibold text-gray-800 dark:text-white">
          Edit Degree
        </h3>

        {loadingDegree ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
              <p className="mt-4 text-gray-500">Loading degree data...</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Degree Code *</Label>
              <Input
                value={formData.DEGREE_CD}
                onChange={(e) => handleFieldChange("DEGREE_CD", e.target.value)}
                onBlur={(e) => handleBlur("DEGREE_CD", e.target.value)}
                placeholder="Enter Degree Code"
                error={!!errors.DEGREE_CD}
                className={errors.DEGREE_CD ? "border-red-500" : ""}
              />
              {errors.DEGREE_CD && (
                <p className="mt-1 text-xs text-red-500">{errors.DEGREE_CD}</p>
              )}
            </div>

            <div>
              <Label>Degree Name *</Label>
              <Input
                value={formData.DEGREE_NAME}
                onChange={(e) => handleFieldChange("DEGREE_NAME", e.target.value)}
                onBlur={(e) => handleBlur("DEGREE_NAME", e.target.value)}
                placeholder="Enter Degree Name"
                error={!!errors.DEGREE_NAME}
                className={errors.DEGREE_NAME ? "border-red-500" : ""}
              />
              {errors.DEGREE_NAME && (
                <p className="mt-1 text-xs text-red-500">{errors.DEGREE_NAME}</p>
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
                  "Update Degree"
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

