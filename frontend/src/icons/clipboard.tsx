import React from "react";

interface ClipboardIconProps {
  className?: string;
}

export const ClipboardIcon: React.FC<ClipboardIconProps> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect
      x="8" y="2" width="8" height="4" rx="1"
      stroke="currentColor"
      strokeWidth="2"
    />
    <line x1="8" y1="11" x2="16" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="8" y1="15" x2="16" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
