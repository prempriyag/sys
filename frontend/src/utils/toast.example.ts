/**
 * Toast Notification Usage Examples
 * 
 * This file shows how to use the toast notification system, similar to the old alerttoster.js
 */

// Method 1: Using the hook (recommended for React components)
import { useToast } from "../context/ToastContext";

function MyComponent() {
  const { alertsuccess, alerterror, alertwarning } = useToast();

  const handleSuccess = () => {
    alertsuccess("Operation completed successfully!");
  };

  const handleError = () => {
    alerterror("An error occurred!", true); // reloads page after 3 seconds
  };

  const handleWarning = () => {
    alertwarning("Please check your input!");
  };

  return (
    <div>
      <button onClick={handleSuccess}>Show Success</button>
      <button onClick={handleError}>Show Error</button>
      <button onClick={handleWarning}>Show Warning</button>
    </div>
  );
}

// Method 2: Using the utility functions (works anywhere, similar to old alerttoster.js)
import { alertsuccess, alerterror, alertwarning } from "./toast";

// In any function or event handler:
function handleApiResponse(data: any) {
  if (data.status == 1) {
    alertsuccess(data.message, data.refresh);
  } else {
    alerterror(data.message, data.refresh);
  }
}

// Example usage matching the old PHP code pattern:
// if (data.status == 1) {
//   alertsuccess(data.message, data.refresh);
// } else {
//   alerterror(data.message, data.refresh);
// }

