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
        title="Two Way Verification | DigiScript"
        description="DigiScript Two Way Verification"
      />
      <AuthLayout>
        <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto px-4">
          <div>
            <div className="mb-5 sm:mb-8 text-center">
              <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
                Two Way Verification
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Which number do you see on your mail?
              </p>
              <p className="mt-2 text-sm text-brand-500 dark:text-brand-400">
                <svg className="inline-block w-4 h-4 mr-1 animate-bounce" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
                {twoWayPending.email_masked}
              </p>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                This extra step helps DigiScript make sure it&apos;s really you.
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 text-sm text-green-600 bg-green-50 rounded-lg border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                {success}
              </div>
            )}

            {/* Verification code buttons - 3 numbers to choose from (matching CI3 UI) */}
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
                      ? "border-gray-300 text-gray-400 cursor-not-allowed dark:border-gray-600 dark:text-gray-500"
                      : "border-orange-400 text-orange-500 hover:bg-orange-50 hover:border-orange-500 hover:scale-110 cursor-pointer dark:border-orange-500 dark:text-orange-400 dark:hover:bg-orange-900/20"
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
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {formatTime(countdown)}
                </p>
              ) : (
                <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                  Time Out
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-3">
              {countdown <= 0 && (
                <Button
                  type="button"
                  className="w-full"
                  size="sm"
                  onClick={handleResend}
                  disabled={loading}
                >
                  {loading ? "Resending..." : "Resend Code"}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                size="sm"
                onClick={handleCancel}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>

            <p className="text-center pt-4 text-xs text-gray-500 dark:text-gray-400">
              <strong>DigiScript - Powered by{" "}
                <a
                  href="https://www.ktechproducts.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-500 hover:text-brand-600"
                >
                  KTech Products
                </a>
              </strong>
            </p>
          </div>
        </div>
      </AuthLayout>
    </>
  );
}
