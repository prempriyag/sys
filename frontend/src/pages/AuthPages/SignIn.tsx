import { useEffect } from "react";
import { useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "../../components/auth/SignInForm";
import { useAuth } from "../../context/AuthContext";

export default function SignIn() {
  const { isAuthenticated, user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to dashboard if already authenticated
    if (!loading && isAuthenticated && user) {
      // Redirect based on permissions
      if (user.college_perm === 1) {
        navigate("/dashboard", { replace: true });
      } else if (user.hs_perm === 1) {
        navigate("/school/dashboard", { replace: true });
      } else if (user.ocr_perm === 1) {
        navigate("/ocrverify/dashboard", { replace: true });
      } else {
        // Default to college dashboard if no permissions match
        navigate("/dashboard", { replace: true });
      }
    }
  }, [isAuthenticated, user, loading, navigate]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
          <p className="mt-4 text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // If authenticated, don't render the login form (will redirect)
  if (isAuthenticated) {
    return null;
  }

  return (
    <>
      <PageMeta
        title="React.js SignIn Dashboard | TailAdmin - Next.js Admin Dashboard Template"
        description="This is React.js SignIn Tables Dashboard page for TailAdmin - React.js Tailwind CSS Admin Dashboard Template"
      />
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </>
  );
}
