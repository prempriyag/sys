import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: "primary" | "danger" | "success" | "warning" | "outline";
  isLoading?: boolean;
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "primary",
  isLoading = false,
}: ConfirmationModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} showCloseButton={false} className="max-w-md">
      {/* Modal Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
          {title}
        </h3>
      </div>

      {/* Modal Body */}
      <div className="p-6">
        <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
          {message}
        </p>
        <div className="flex items-center justify-end gap-4">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1"
          >
            {cancelText}
          </Button>
          <Button
            variant={confirmVariant === "danger" || confirmVariant === "success" || confirmVariant === "warning" ? "primary" : confirmVariant}
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 ${
              confirmVariant === "danger" 
                ? "bg-error-500 hover:bg-error-600 text-white border-error-500" 
                : confirmVariant === "success"
                ? "bg-success-500 hover:bg-success-600 text-white border-success-500"
                : confirmVariant === "warning"
                ? "bg-warning-500 hover:bg-warning-600 text-white border-warning-500"
                : ""
            }`}
          >
            {isLoading ? (
              <>
                <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                Processing...
              </>
            ) : (
              confirmText
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

