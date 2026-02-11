import React from "react";

interface BotIconProps {
  className?: string;
}

export const BotIcon: React.FC<BotIconProps> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="3" y="8" width="18" height="12" rx="2"
      stroke="currentColor"
      strokeWidth="2"
    />
    <circle cx="9" cy="14" r="1.5" fill="currentColor" />
    <circle cx="15" cy="14" r="1.5" fill="currentColor" />
    <line x1="12" y1="4" x2="12" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="3" r="1" fill="currentColor" />
    <line x1="1" y1="13" x2="3" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="21" y1="13" x2="23" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
