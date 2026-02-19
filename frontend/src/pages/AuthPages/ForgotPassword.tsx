import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
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
        <PageMeta title="Check your email" description="Password reset" />
        <AuthLayout>
          <div className="auth-form-container">
            <div className="p-6 rounded-lg bg-green-500/15 border border-green-500/30">
              <h2 className="mb-2 text-lg font-semibold text-green-300">
                Check your email
              </h2>
              <p className="mb-4 text-green-200/80 text-sm">
                If your email is registered, you will receive a password reset link shortly. The link
                expires in 30 minutes.
              </p>
              <Link
                to="/login"
                className="text-sm font-medium text-brand-400 hover:text-brand-300"
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
        title={isResetMode ? "Reset Password" : "Forgot Password"}
        description="DigiScript password reset"
      />
      <AuthLayout>
        <div className="auth-form-container">
          <div className="mb-5 sm:mb-8 text-center">
            <h1 className="mb-2 text-2xl font-semibold text-white sm:text-3xl">
              {isResetMode ? "Reset Password" : "Forgot Password"}
            </h1>
            <p className="text-sm text-white/60">
              {isResetMode
                ? "Enter your new password below."
                : "Enter your email address and we'll send you a link to reset your password."}
            </p>
          </div>

          {error && (
            <div className="p-3 mb-4 text-sm text-red-300 bg-red-500/20 rounded-lg border border-red-500/30">
              {error}
            </div>
          )}

          {isResetMode ? (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block mb-1.5 text-sm font-medium text-white/80">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="auth-input pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute p-2 text-white/50 -translate-y-1/2 right-1 top-1/2 hover:text-white/80"
                  >
                    {showPassword ? <EyeCloseIcon className="size-5" /> : <EyeIcon className="size-5" />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-white/40">
                  Min 8 characters with uppercase, lowercase, number, and special character
                </p>
              </div>
              <div>
                <label className="block mb-1.5 text-sm font-medium text-white/80">Confirm Password</label>
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="auth-input"
                />
              </div>
              <div className="flex gap-3">
                <Button type="submit" className="flex-1 auth-submit-btn" size="sm" disabled={loading}>
                  {loading ? "Updating..." : "Update Password"}
                </Button>
                <Link to="/login" className="flex items-center justify-center px-4 text-sm text-white/60 hover:text-white/90">
                  Cancel
                </Link>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div>
                <label className="block mb-1.5 text-sm font-medium text-white/80">Email</label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="auth-input"
                />
              </div>
              <div className="flex gap-3">
                <Button type="submit" className="flex-1 auth-submit-btn" size="sm" disabled={loading}>
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>
                <Link
                  to="/login"
                  className="flex items-center justify-center px-4 text-sm text-white/60 hover:text-white/90"
                >
                  Back to login
                </Link>
              </div>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-white/40">
            <strong className="text-white/60">DigiScript</strong> - Powered by{" "}
            <a
              href="https://www.ktechproducts.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-400 hover:underline"
            >
              KTech Products
            </a>
          </p>
        </div>
      </AuthLayout>
    </>
  );
}
