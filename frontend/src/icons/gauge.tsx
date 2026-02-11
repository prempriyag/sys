import React from "react";

interface GaugeIconProps {
  className?: string;
}

export const GaugeIcon: React.FC<GaugeIconProps> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 2a10 10 0 0 0-6.88 17.23l.47.36h12.82l.47-.36A10 10 0 0 0 12 2Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 12l3.5-6.06"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="12" cy="12" r="1.5"
      fill="currentColor"
    />
  </svg>
);
