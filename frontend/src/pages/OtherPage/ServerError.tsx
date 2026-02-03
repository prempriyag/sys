import { useEffect, useState } from "react";
import GridShape from "../../components/common/GridShape";
import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";

export default function ServerError() {
  const [errorMessage, setErrorMessage] = useState("An internal server error occurred.");

  useEffect(() => {
    // Get error message from sessionStorage
    const storedError = sessionStorage.getItem("serverError");
    if (storedError) {
      try {
        const errorData = JSON.parse(storedError);
        if (errorData.message) {
          setErrorMessage(errorData.message);
        }
        // Clear the stored error after reading
        sessionStorage.removeItem("serverError");
      } catch (e) {
        console.error("Error parsing stored error:", e);
      }
    }
  }, []);

  return (
    <>
      <PageMeta
        title="Server Error | TailAdmin - React.js Admin Dashboard Template"
        description="Server error page for TailAdmin - React.js Tailwind CSS Admin Dashboard Template"
      />
      <div className="relative flex flex-col items-center justify-center min-h-screen p-6 overflow-hidden z-1">
        <GridShape />
        <div className="mx-auto w-full max-w-[242px] text-center sm:max-w-[472px]">
          <h1 className="mb-8 font-bold text-gray-800 text-title-md dark:text-white/90 xl:text-title-2xl">
            500
          </h1>

          <div className="mb-6">
            <svg
              className="w-48 h-48 mx-auto text-red-500 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.346 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>

          <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-white">
            Internal Server Error
          </h2>

          <p className="mt-4 mb-6 text-base text-gray-700 dark:text-gray-400 sm:text-lg">
            {errorMessage}
          </p>

          <p className="mb-6 text-sm text-gray-600 dark:text-gray-500">
            The server encountered an error while processing your request. This could be due to:
          </p>

          <ul className="mb-6 text-left text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-2">
            <li>Database connection issues</li>
            <li>Server configuration problems</li>
            <li>Temporary service unavailability</li>
            <li>An unexpected error in the application</li>
          </ul>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-3.5 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            >
              Back to Home Page
            </Link>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-lg border border-brand-500 bg-brand-500 px-5 py-3.5 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-600 dark:bg-brand-500 dark:hover:bg-brand-600"
            >
              Try Again
            </button>
          </div>
        </div>
        {/* <!-- Footer --> */}
        <p className="absolute text-sm text-center text-gray-500 -translate-x-1/2 bottom-6 left-1/2 dark:text-gray-400">
          &copy; {new Date().getFullYear()} - TailAdmin
        </p>
      </div>
    </>
  );
}
