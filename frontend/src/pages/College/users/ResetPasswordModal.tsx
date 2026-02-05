import { useState } from "react";
import { Modal } from "../../../components/ui/modal";
import Button from "../../../components/ui/button/Button";
import Input from "../../../components/form/input/InputField";
import Label from "../../../components/form/Label";
import { api, API_ENDPOINTS } from "../../../config/api";
import { useToast } from "../../../context/ToastContext";

interface ResetPasswordModalProps {
  userId: number | null;
  userName: string;
  onClose: () => void;
  onSuccess: () => void;
}

// Password validation helper - matches backend requirements
const validatePasswordFormat = (password: string): { valid: boolean; error: string } => {
  if (!password || password.trim() === "") {
    return { valid: false, error: "New Password is required" };
  }
  if (password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one uppercase letter" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one lowercase letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Password must contain at least one number" };
  }
  if (!/[^\w]/.test(password)) {
    return { valid: false, error: "Password must contain at least one special character (!@#$%^&*)" };
  }
  return { valid: true, error: "" };
};

export default function ResetPasswordModal({
  userId,
  userName,
  onClose,
  onSuccess,
}: ResetPasswordModalProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [resetPasswordData, setResetPasswordData] = useState({
    npassword: "",
    cpassword: "",
  });
  const { alertsuccess, alerterror } = useToast();

  const handleFieldChange = (name: string, value: string) => {
    setResetPasswordData((prev) => ({ ...prev, [name]: value }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleBlur = (name: string, value: string) => {
    const newErrors: Record<string, string> = { ...errors };
    
    if (name === "npassword") {
      const validation = validatePasswordFormat(value);
      if (!validation.valid) {
        newErrors.npassword = validation.error;
      } else {
        delete newErrors.npassword;
      }
      // Also check confirm password if it has a value
      if (resetPasswordData.cpassword && value !== resetPasswordData.cpassword) {
        newErrors.cpassword = "Passwords do not match";
      } else if (resetPasswordData.cpassword) {
        delete newErrors.cpassword;
      }
    } else if (name === "cpassword") {
      if (!value || value.trim() === "") {
        newErrors.cpassword = "Confirm Password is required";
      } else if (value !== resetPasswordData.npassword) {
        newErrors.cpassword = "Passwords do not match";
      } else {
        delete newErrors.cpassword;
      }
    }
    
    setErrors(newErrors);
  };

  const handleResetPassword = async () => {
    if (!userId) return;

    setErrors({});

    // Validate all fields
    const newErrors: Record<string, string> = {};
    
    // Validate password format
    const passwordValidation = validatePasswordFormat(resetPasswordData.npassword);
    if (!passwordValidation.valid) {
      newErrors.npassword = passwordValidation.error;
    }

    if (!resetPasswordData.cpassword || resetPasswordData.cpassword.trim() === "") {
      newErrors.cpassword = "Confirm Password is required";
    } else if (resetPasswordData.npassword !== resetPasswordData.cpassword) {
      newErrors.cpassword = "New password and confirm password do not match";
    }

    // If there are errors, set them and return
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const response = await api.post(`${API_ENDPOINTS.USERS_RESET_PASSWORD}/${userId}`, resetPasswordData);
      
      // Check for success response - api returns JSON directly (not wrapped in response.data)
      // Backend returns { message: "...", success: true }
      const isSuccess = response.success || response.message?.toLowerCase().includes("success");
      
      if (isSuccess) {
        setSuccess(true);
        alertsuccess(response.message || "Password reset successfully");
        setResetPasswordData({ npassword: "", cpassword: "" });
        onSuccess();
        // Delay closing modal so user can see success message
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        alerterror(response.message || "Failed to reset password");
      }
    } catch (err: any) {
      console.error("Reset password error:", err);
      alerterror(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  if (!userId) return null;

  return (
    <Modal isOpen={true} onClose={onClose} className="max-w-md">
      <div className="p-6">
        <h3 className="mb-6 text-xl font-semibold text-gray-800 dark:text-white">
          Reset Password - {userName}
        </h3>

        <form onSubmit={(e) => { e.preventDefault(); handleResetPassword(); }} className="space-y-4">
          <div>
            <Label>New Password *</Label>
            <Input
              type="password"
              value={resetPasswordData.npassword}
              onChange={(e) => handleFieldChange("npassword", e.target.value)}
              onBlur={(e) => handleBlur("npassword", e.target.value)}
              placeholder="Enter New Password"
              className={errors.npassword ? "border-red-500" : ""}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Must be 8+ characters with uppercase, lowercase, number, and special character (!@#$%^&*)
            </p>
            {errors.npassword && (
              <p className="mt-1 text-xs text-red-500">{errors.npassword}</p>
            )}
          </div>
          <div>
            <Label>Confirm Password *</Label>
            <Input
              type="password"
              value={resetPasswordData.cpassword}
              onChange={(e) => handleFieldChange("cpassword", e.target.value)}
              onBlur={(e) => handleBlur("cpassword", e.target.value)}
              placeholder="Confirm New Password"
              className={errors.cpassword ? "border-red-500" : ""}
            />
            {errors.cpassword && (
              <p className="mt-1 text-xs text-red-500">{errors.cpassword}</p>
            )}
          </div>
          <div className="flex gap-4 pt-4">
            <Button 
              type="submit" 
              className={`flex-1 ${success ? "bg-green-600 hover:bg-green-600" : ""}`} 
              disabled={loading || success}
            >
              {loading ? (
                <>
                  <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                  Resetting...
                </>
              ) : success ? (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Password Reset Successfully!
                </>
              ) : (
                "Reset Password"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={loading || success}
            >
              {success ? "Closing..." : "Cancel"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}



