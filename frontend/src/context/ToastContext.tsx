import { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from "react";
import { setToastFunctions } from "../utils/toast";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  variant: ToastVariant;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (variant: ToastVariant, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
  alertsuccess: (message?: string, reload?: boolean) => void;
  alerterror: (message?: string, reload?: boolean) => void;
  alertwarning: (message?: string, reload?: boolean) => void;
  alertinfo: (message?: string, reload?: boolean) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider = ({ children }: ToastProviderProps) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const removeToastRef = useRef<((id: string) => void) | null>(null);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  // Store removeToast in ref so it can be accessed in showToast
  removeToastRef.current = removeToast;

  const showToast = useCallback(
    (variant: ToastVariant, message: string, duration: number = 3000) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: Toast = { id, variant, message, duration };
      
      setToasts((prev) => [...prev, newToast]);

      // Auto remove after duration
      if (duration > 0) {
        setTimeout(() => {
          if (removeToastRef.current) {
            removeToastRef.current(id);
          }
        }, duration);
      }
    },
    []
  );

  const alertsuccess = useCallback(
    (message: string = "", reload: boolean = false) => {
      showToast("success", message || "Operation completed successfully!");
      if (reload) {
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      }
    },
    [showToast]
  );

  const alerterror = useCallback(
    (message: string = "", reload: boolean = false) => {
      showToast("error", message || "An error occurred!");
      if (reload) {
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      }
    },
    [showToast]
  );

  const alertwarning = useCallback(
    (message: string = "", reload: boolean = false) => {
      showToast("warning", message || "Warning!");
      if (reload) {
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      }
    },
    [showToast]
  );

  const alertinfo = useCallback(
    (message: string = "", reload: boolean = false) => {
      showToast("info", message || "Information");
      if (reload) {
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      }
    },
    [showToast]
  );

  // Expose functions globally via toast utility
  useEffect(() => {
    setToastFunctions({
      alertsuccess,
      alerterror,
      alertwarning,
      alertinfo,
    });
  }, [alertsuccess, alerterror, alertwarning, alertinfo]);

  return (
    <ToastContext.Provider
      value={{
        toasts,
        showToast,
        removeToast,
        alertsuccess,
        alerterror,
        alertwarning,
        alertinfo,
      }}
    >
      {children}
    </ToastContext.Provider>
  );
};

