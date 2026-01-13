import { useState } from "react";
import Button from "../../../components/ui/button/Button";
import Input from "../../../components/form/input/InputField";
import Label from "../../../components/form/Label";
import { api, API_ENDPOINTS } from "../../../config/api";

interface ResetPasswordModalProps {
  userId: number | null;
  userName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ResetPasswordModal({
  userId,
  userName,
  onClose,
  onSuccess,
}: ResetPasswordModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetPasswordData, setResetPasswordData] = useState({
    npassword: "",
    cpassword: "",
  });

  const handleResetPassword = async () => {
    if (!userId) return;

    setError(null);

    if (!resetPasswordData.npassword || !resetPasswordData.cpassword) {
      setError("Please fill in all password fields");
      return;
    }

    if (resetPasswordData.npassword !== resetPasswordData.cpassword) {
      setError("New password and confirm password do not match");
      return;
    }

    if (resetPasswordData.npassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      await api.post(`${API_ENDPOINTS.USERS_RESET_PASSWORD}/${userId}`, resetPasswordData);
      setResetPasswordData({ npassword: "", cpassword: "" });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  if (!userId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
            Reset Password - {userName}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <Label>New Password *</Label>
            <Input
              type="password"
              value={resetPasswordData.npassword}
              onChange={(e) =>
                setResetPasswordData({ ...resetPasswordData, npassword: e.target.value })
              }
              placeholder="Enter New Password (min 8 characters)"
            />
          </div>
          <div>
            <Label>Confirm Password *</Label>
            <Input
              type="password"
              value={resetPasswordData.cpassword}
              onChange={(e) =>
                setResetPasswordData({ ...resetPasswordData, cpassword: e.target.value })
              }
              placeholder="Confirm New Password"
            />
          </div>
          <div className="flex gap-4 pt-4">
            <Button onClick={handleResetPassword} className="flex-1" disabled={loading}>
              {loading ? (
                <>
                  <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                  Resetting...
                </>
              ) : (
                "Reset Password"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

