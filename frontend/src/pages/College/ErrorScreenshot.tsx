import { useState, useEffect } from "react";
import { useParams } from "react-router";
import { API_BASE_URL } from "../../config/api";
import PageContainer from "../../components/common/PageContainer";

export default function ErrorScreenshot() {
  const { batchId } = useParams<{ batchId: string }>();
  const [imageError, setImageError] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>("");

  useEffect(() => {
    if (batchId) {
      // Construct URL: API_BASE_URL is "http://localhost:8000", so we need /api/viewfile/errorscreenshot/{batchId}
      const url = `${API_BASE_URL}/api/viewfile/errorscreenshot/${batchId}`;
      setImageUrl(url);
    }
  }, [batchId]);

  if (!batchId) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-md w-full">
            <div className="flex flex-col items-center">
              <div className="w-32 h-32 mb-6 text-red-500">
                <svg
                  className="w-full h-full"
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
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                Invalid Batch ID
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
                The batch ID is missing or invalid.
              </p>
              <button
                onClick={() => window.history.back()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-7xl px-1">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Error Screenshot
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Batch ID: {batchId}
          </p>
        </div>

        {/* Error Screenshot Image */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
              Error Screenshot
            </h2>
          </div>
          <div className="p-2">
            {imageError ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <div className="w-24 h-24 mb-4 text-gray-400">
                  <svg
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    className="w-full h-full"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Screenshot Not Found
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  The error screenshot could not be loaded.
                </p>
              </div>
            ) : (
              <div className="w-full bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden">
                <img
                  src={imageUrl}
                  alt={`Error screenshot for batch ${batchId}`}
                  className="w-full h-auto"
                  onError={() => setImageError(true)}
                  style={{ border: "none" }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

