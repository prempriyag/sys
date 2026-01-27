import { useState } from "react";
import { CloseIcon } from "../../icons";

interface ErrorScreenshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  batchId: string;
}

export default function ErrorScreenshotModal({
  isOpen,
  onClose,
  imageUrl,
  batchId,
}: ErrorScreenshotModalProps) {
  const [imageError, setImageError] = useState(false);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
            Error Screenshot - Batch ID: {batchId}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Image Content */}
        <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
          {imageError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-32 h-32 mb-4 text-gray-400">
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
          ) : imageUrl ? (
            <div className="flex items-center justify-center">
              <img
                src={imageUrl}
                alt={`Error screenshot for batch ${batchId}`}
                className="max-w-full h-auto rounded-lg border border-gray-200 dark:border-gray-700"
                onError={() => setImageError(true)}
                style={{ border: "none" }}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-32 h-32 mb-4 text-gray-400 animate-pulse">
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
              <p className="text-gray-500 dark:text-gray-400">Loading screenshot...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

