import React from "react";

interface DatabaseIconProps {
  className?: string;
}

export const DatabaseIcon: React.FC<DatabaseIconProps> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <ellipse
      cx="12" cy="5" rx="9" ry="3"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
);
