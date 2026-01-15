/**
 * Toast notification utility functions
 * Similar to the old alerttoster.js functions
 * 
 * Usage:
 * import { alertsuccess, alerterror, alertwarning } from '@/utils/toast';
 * 
 * alertsuccess('Operation completed successfully!');
 * alerterror('An error occurred!', true); // reloads page after 3 seconds
 */

// These functions will be set by the ToastProvider
let toastFunctions: {
  alertsuccess?: (message?: string, reload?: boolean) => void;
  alerterror?: (message?: string, reload?: boolean) => void;
  alertwarning?: (message?: string, reload?: boolean) => void;
  alertinfo?: (message?: string, reload?: boolean) => void;
} = {};

export const setToastFunctions = (functions: typeof toastFunctions) => {
  toastFunctions = functions;
};

/**
 * Show success toast notification
 * @param message - Message to display (default: "Operation completed successfully!")
 * @param reload - Whether to reload page after 3 seconds (default: false)
 */
export const alertsuccess = (message: string = "", reload: boolean = false) => {
  if (toastFunctions.alertsuccess) {
    toastFunctions.alertsuccess(message, reload);
  } else {
    console.warn("Toast functions not initialized. Make sure ToastProvider is set up.");
    // Fallback to browser alert
    alert(message || "Operation completed successfully!");
    if (reload) {
      setTimeout(() => window.location.reload(), 3000);
    }
  }
};

/**
 * Show error toast notification
 * @param message - Message to display (default: "An error occurred!")
 * @param reload - Whether to reload page after 3 seconds (default: false)
 */
export const alerterror = (message: string = "", reload: boolean = false) => {
  if (toastFunctions.alerterror) {
    toastFunctions.alerterror(message, reload);
  } else {
    console.warn("Toast functions not initialized. Make sure ToastProvider is set up.");
    // Fallback to browser alert
    alert(message || "An error occurred!");
    if (reload) {
      setTimeout(() => window.location.reload(), 3000);
    }
  }
};

/**
 * Show warning toast notification
 * @param message - Message to display (default: "Warning!")
 * @param reload - Whether to reload page after 3 seconds (default: false)
 */
export const alertwarning = (message: string = "", reload: boolean = false) => {
  if (toastFunctions.alertwarning) {
    toastFunctions.alertwarning(message, reload);
  } else {
    console.warn("Toast functions not initialized. Make sure ToastProvider is set up.");
    // Fallback to browser alert
    alert(message || "Warning!");
    if (reload) {
      setTimeout(() => window.location.reload(), 3000);
    }
  }
};

/**
 * Show info toast notification
 * @param message - Message to display (default: "Information")
 * @param reload - Whether to reload page after 3 seconds (default: false)
 */
export const alertinfo = (message: string = "", reload: boolean = false) => {
  if (toastFunctions.alertinfo) {
    toastFunctions.alertinfo(message, reload);
  } else {
    console.warn("Toast functions not initialized. Make sure ToastProvider is set up.");
    // Fallback to browser alert
    alert(message || "Information");
    if (reload) {
      setTimeout(() => window.location.reload(), 3000);
    }
  }
};

