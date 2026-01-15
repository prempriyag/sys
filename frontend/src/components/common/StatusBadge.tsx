import Badge from "../ui/badge/Badge";

type StatusValue = string | number;

interface StatusBadgeProps {
  status: StatusValue;
  size?: "sm" | "md";
  variant?: "light" | "solid";
  customMapping?: Record<string, "success" | "error" | "warning" | "info" | "primary" | "light" | "dark">;
}

/**
 * StatusBadge - A reusable component that automatically maps status values to appropriate badge colors
 * 
 * @example
 * <StatusBadge status="Delivered" />
 * <StatusBadge status="Pending" />
 * <StatusBadge status="Active" />
 * <StatusBadge status={1} /> // For numeric statuses
 * <StatusBadge status="Custom" customMapping={{ Custom: "info" }} />
 */
const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = "sm",
  variant = "light",
  customMapping = {},
}) => {
  // Convert status to string for consistent comparison
  const statusStr = String(status).trim();

  // Default status mappings (case-insensitive)
  const defaultMapping: Record<string, "success" | "error" | "warning" | "info" | "primary" | "light" | "dark"> = {
    // Success statuses
    "delivered": "success",
    "completed": "success",
    "active": "success",
    "success": "success",
    "successful": "success",
    "processed": "success",
    "approved": "success",
    "enabled": "success",
    "1": "success", // Numeric 1 typically means active/success
    "true": "success",
    
    // Warning statuses
    "pending": "warning",
    "processing": "warning",
    "in-progress": "warning",
    "in progress": "warning",
    "waiting": "warning",
    "on-hold": "warning",
    "on hold": "warning",
    "review": "warning",
    "reviewing": "warning",
    
    // Error statuses
    "failed": "error",
    "error": "error",
    "inactive": "error",
    "blocked": "error",
    "rejected": "error",
    "cancelled": "error",
    "canceled": "error",
    "disabled": "error",
    "0": "error", // Numeric 0 typically means inactive/error
    "false": "error",
    "kickout": "error",
    
    // Info statuses
    "rerun": "info",
    "retry": "info",
    "draft": "info",
    "scheduled": "info",
    "queued": "info",
    
    // Light/Dark statuses
    "unknown": "light",
    "other": "light",
  };

  // Merge custom mapping with default mapping (custom takes precedence)
  const statusMapping = { ...defaultMapping, ...customMapping };

  // Get color based on status (case-insensitive)
  const getStatusColor = (): "success" | "error" | "warning" | "info" | "primary" | "light" | "dark" => {
    const lowerStatus = statusStr.toLowerCase();
    
    // Check exact match first
    if (statusMapping[lowerStatus]) {
      return statusMapping[lowerStatus];
    }
    
    // Check partial matches for compound statuses
    for (const [key, color] of Object.entries(statusMapping)) {
      if (lowerStatus.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerStatus)) {
        return color;
      }
    }
    
    // Default to light if no match found
    return "light";
  };

  const color = getStatusColor();

  return (
    <Badge size={size} color={color} variant={variant}>
      {statusStr}
    </Badge>
  );
};

export default StatusBadge;

