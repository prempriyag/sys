import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";
import { EyeCloseIcon, EyeIcon } from "../../icons";
import { API_BASE_URL, API_ENDPOINTS } from "../../config/api";
import { alerterror, alertsuccess } from "../../utils/toast";

export default function ForgotPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const isResetMode = !!token;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}${API_ENDPOINTS.FORGOT_PASSWORD}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      const errMsg = typeof data.detail === "string" ? data.detail : Array.isArray(data.detail) ? data.detail[0]?.msg || "Invalid request" : "Something went wrong. Please try again.";
      if (res.ok) {
        setSuccess(true);
        alertsuccess(data.message || "If your email is registered, you will receive a reset link.");
      } else {
        setError(errMsg);
        alerterror(errMsg, false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error. Please try again.";
      setError(msg);
      alerterror(msg, false);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!password || !confirmPassword) {
      setError("Please fill in both password fields");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}${API_ENDPOINTS.FORGOT_PASSWORD_RESET}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          npassword: password,
          cpassword: confirmPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      const errMsg = typeof data.detail === "string" ? data.detail : Array.isArray(data.detail) ? data.detail[0]?.msg || "Invalid request" : "Invalid or expired link. Please request a new one.";
      if (res.ok) {
        setSuccess(true);
        alertsuccess(data.message || "Password updated. You can now log in.");
        setTimeout(() => {
          window.location.href = "/login";
        }, 2000);
      } else {
        setError(errMsg);
        alerterror(errMsg, false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error. Please try again.";
      setError(msg);
      alerterror(msg, false);
    } finally {
      setLoading(false);
    }
  };

  if (success && !isResetMode) {
    return (
      <>
        <PageMeta title="Check your email | DigiScript" description="Password reset" />
        <AuthLayout>
          <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
            <div className="p-6 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <h2 className="mb-2 text-lg font-semibold text-green-800 dark:text-green-400">
                Check your email
              </h2>
              <p className="mb-4 text-green-700 dark:text-green-300">
                If your email is registered, you will receive a password reset link shortly. The link
                expires in 30 minutes.
              </p>
              <Link
                to="/login"
                className="text-sm font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
              >
                Return to login
              </Link>
            </div>
          </div>
        </AuthLayout>
      </>
    );
  }

  return (
    <>
      <PageMeta
        title={isResetMode ? "Reset Password | DigiScript" : "Forgot Password | DigiScript"}
        description="DigiScript password reset"
      />
      <AuthLayout>
        <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              {isResetMode ? "Reset Password" : "Forgot Password"}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isResetMode
                ? "Enter your new password below."
                : "Enter your email address and we'll send you a link to reset your password."}
            </p>
          </div>

          {error && (
            <div className="p-3 mb-4 text-sm text-red-700 rounded-lg bg-red-50 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          {isResetMode ? (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <Label>New Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute p-2 text-gray-500 -translate-y-1/2 right-1 top-1/2 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    {showPassword ? <EyeCloseIcon className="size-5" /> : <EyeIcon className="size-5" />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Min 8 characters with uppercase, lowercase, number, and special character
                </p>
              </div>
              <div>
                <Label>Confirm Password</Label>
                <Input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <Button type="submit" className="flex-1" size="sm" disabled={loading}>
                  {loading ? "Updating..." : "Update Password"}
                </Button>
                <Link to="/login" className="flex items-center justify-center px-4 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                  Cancel
                </Link>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="flex gap-3">
                <Button type="submit" className="flex-1" size="sm" disabled={loading}>
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>
                <Link
                  to="/login"
                  className="flex items-center justify-center px-4 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Back to login
                </Link>
              </div>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            <strong>DigiScript</strong> - Powered by{" "}
            <a
              href="https://www.ktechproducts.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-500 hover:underline"
            >
              KTech Products
            </a>
          </p>
        </div>
      </AuthLayout>
    </>
  );
}
