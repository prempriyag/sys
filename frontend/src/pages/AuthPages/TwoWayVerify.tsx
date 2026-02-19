import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import Button from "../../components/ui/button/Button";
import { useAuth } from "../../context/AuthContext";

export default function TwoWayVerify() {
  const { twoWayPending, verifyTwoWayCode, resendTwoWayCode, cancelTwoWay, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [verifyData, setVerifyData] = useState<number[]>([]);
  const [countdown, setCountdown] = useState(180); // 3 minutes in seconds

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Redirect if no pending 2FA
  useEffect(() => {
    if (!twoWayPending) {
      navigate("/login", { replace: true });
    } else {
      setVerifyData(twoWayPending.verify_data);
    }
  }, [twoWayPending, navigate]);

  // Countdown timer (3 minutes, matching CI3)
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}min ${sec < 10 ? "0" : ""}${sec}sec`;
  };

  const handleVerify = useCallback(
    async (code: number) => {
      if (loading || countdown <= 0) return;
      setError("");
      setSuccess("");
      setLoading(true);
      try {
        await verifyTwoWayCode(String(code));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Verification failed. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [loading, countdown, verifyTwoWayCode]
  );

  const handleResend = async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const newData = await resendTwoWayCode();
      setVerifyData(newData);
      setCountdown(180); // Reset timer
      setSuccess("Verification code resent successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend code.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    cancelTwoWay();
  };

  if (!twoWayPending) {
    return null;
  }

  return (
    <>
      <PageMeta
        title="Two Way Verification"
        description="Two Way Verification"
      />
      <AuthLayout>
        <div className="auth-form-container">
          <div className="mb-5 sm:mb-8 text-center">
            <h1 className="mb-2 text-2xl font-semibold text-white sm:text-3xl">
              Two Way Verification
            </h1>
            <p className="text-sm text-white/60">
              Which number do you see on your mail?
            </p>
            <p className="mt-2 text-sm text-brand-400">
              <svg className="inline-block w-4 h-4 mr-1 animate-bounce" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
              {twoWayPending.email_masked}
            </p>
            <p className="mt-1 text-xs text-white/40">
              This extra step helps DigiScript make sure it&apos;s really you.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 text-sm text-red-300 bg-red-500/20 rounded-lg border border-red-500/30">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 text-sm text-green-300 bg-green-500/15 rounded-lg border border-green-500/30">
              {success}
            </div>
          )}

          {/* Verification code buttons - 3 numbers to choose from */}
          <div className="flex justify-center gap-4 mb-6">
            {verifyData.map((code, idx) => (
              <button
                key={idx}
                type="button"
                disabled={loading || countdown <= 0}
                onClick={() => handleVerify(code)}
                className={`
                  w-16 h-16 flex items-center justify-center rounded-full border-2
                  text-xl font-bold transition-all duration-200
                  ${loading || countdown <= 0
                    ? "border-white/20 text-white/30 cursor-not-allowed"
                    : "border-brand-400 text-brand-400 hover:bg-brand-500/20 hover:border-brand-300 hover:scale-110 cursor-pointer"
                  }
                `}
              >
                {code}
              </button>
            ))}
          </div>

          {/* Timer */}
          <div className="text-center mb-6">
            {countdown > 0 ? (
              <p className="text-sm font-semibold text-white/70">
                {formatTime(countdown)}
              </p>
            ) : (
              <p className="text-sm font-semibold text-red-400">
                Time Out
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-3">
            {countdown <= 0 && (
              <Button
                type="button"
                className="w-full auth-submit-btn"
                size="sm"
                onClick={handleResend}
                disabled={loading}
              >
                {loading ? "Resending..." : "Resend Code"}
              </Button>
            )}
            <button
              type="button"
              className="w-full py-2.5 text-sm font-medium text-white/60 border border-white/20 rounded-lg hover:bg-white/10 hover:text-white/90 transition-all"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </button>
          </div>

          <p className="text-center pt-4 text-xs text-white/40">
            <strong className="text-white/60">DigiScript</strong> - Powered by{" "}
            <a
              href="https://www.ktechproducts.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-400 hover:text-brand-300"
            >
              KTech Products
            </a>
          </p>
        </div>
      </AuthLayout>
    </>
  );
}
