import React from "react";

interface RefreshIconProps {
  className?: string;
}

export const RefreshIcon: React.FC<RefreshIconProps> = ({ className }) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M8 0C3.58 0 0 3.58 0 8s3.58 8 8 8 8-3.58 8-8h-2c0 3.31-2.69 6-6 6s-6-2.69-6-6 2.69-6 6-6V0l4 4-4 4V6z"
      fill="currentColor"
    />
  </svg>
);

