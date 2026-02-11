import React from "react";

interface FlaskIconProps {
  className?: string;
}

export const FlaskIcon: React.FC<FlaskIconProps> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M9 3h6M10 3v7.4a2 2 0 0 1-.46 1.28L4.28 18.54A2 2 0 0 0 5.82 22h12.36a2 2 0 0 0 1.54-3.46l-5.26-6.86A2 2 0 0 1 14 10.4V3"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
