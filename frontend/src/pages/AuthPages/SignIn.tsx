import { useEffect } from "react";
import { useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "../../components/auth/SignInForm";
import { useAuth } from "../../context/AuthContext";
import ThemedLoader from "../../components/common/ThemedLoader";

export default function SignIn() {
  const { isAuthenticated, user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to SIR dashboard if already authenticated
    if (!loading && isAuthenticated && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, user, loading, navigate]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <ThemedLoader size={32} className="text-brand-500" label="Loading" />
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
        title="DigiScript SignIn | KTech Products"
        description="DigiScript KTech Products"
      />
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </>
  );
}
