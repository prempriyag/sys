/**
 * StatusBadge Usage Examples
 * 
 * This file demonstrates how to use the StatusBadge component throughout the application.
 * The StatusBadge automatically maps status values to appropriate colors.
 */

import StatusBadge from "./StatusBadge";

// Example 1: Basic usage with common statuses
export function BasicExamples() {
  return (
    <div>
      <StatusBadge status="Delivered" />      {/* Green (success) */}
      <StatusBadge status="Pending" />        {/* Orange (warning) */}
      <StatusBadge status="Failed" />         {/* Red (error) */}
      <StatusBadge status="Active" />         {/* Green (success) */}
      <StatusBadge status="Inactive" />       {/* Red (error) */}
    </div>
  );
}

// Example 2: With different sizes
export function SizeExamples() {
  return (
    <div>
      <StatusBadge status="Processing" size="sm" />  {/* Small badge */}
      <StatusBadge status="Completed" size="md" />   {/* Medium badge */}
    </div>
  );
}

// Example 3: With different variants
export function VariantExamples() {
  return (
    <div>
      <StatusBadge status="Active" variant="light" />   {/* Light variant */}
      <StatusBadge status="Active" variant="solid" />  {/* Solid variant */}
    </div>
  );
}

// Example 4: With numeric statuses
export function NumericStatusExamples() {
  return (
    <div>
      <StatusBadge status={1} />    {/* Green (success) - typically means active */}
      <StatusBadge status={0} />    {/* Red (error) - typically means inactive */}
      <StatusBadge status={2} />    {/* Light (default) - unknown status */}
    </div>
  );
}

// Example 5: With custom status mappings
export function CustomMappingExamples() {
  return (
    <div>
      <StatusBadge 
        status="CustomStatus" 
        customMapping={{ CustomStatus: "info" }} 
      />
      <StatusBadge 
        status="Special" 
        customMapping={{ Special: "primary" }} 
      />
    </div>
  );
}

// Example 6: In a table row (like RecentOrders)
export function TableExample() {
  const items = [
    { id: 1, name: "Item 1", status: "Delivered" },
    { id: 2, name: "Item 2", status: "Pending" },
    { id: 3, name: "Item 3", status: "Failed" },
  ];

  return (
    <table>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td>{item.name}</td>
            <td>
              <StatusBadge status={item.status} size="sm" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Example 7: With backend status values
export function BackendStatusExample() {
  // Common backend status values
  const statuses = [
    "Active",      // → success (green)
    "Inactive",    // → error (red)
    "Blocked",     // → error (red)
    "Pending",     // → warning (orange)
    "Processing",  // → warning (orange)
    "Completed",   // → success (green)
    "Kickout",     // → error (red)
    "Rerun",       // → info (blue)
    "Processed",   // → success (green)
  ];

  return (
    <div>
      {statuses.map((status) => (
        <StatusBadge key={status} status={status} size="sm" />
      ))}
    </div>
  );
}

/**
 * Default Status Mappings:
 * 
 * Success (Green):
 * - Delivered, Completed, Active, Success, Successful, Processed, Approved, Enabled
 * - Numeric: 1, true
 * 
 * Warning (Orange):
 * - Pending, Processing, In-Progress, Waiting, On-Hold, Review, Reviewing
 * 
 * Error (Red):
 * - Failed, Error, Inactive, Blocked, Rejected, Cancelled, Disabled
 * - Numeric: 0, false
 * - Kickout
 * 
 * Info (Blue):
 * - Rerun, Retry, Draft, Scheduled, Queued
 * 
 * Light/Dark (Gray):
 * - Unknown, Other (default for unmapped statuses)
 */

