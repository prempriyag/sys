import type React from "react";
import type { FC } from "react";

interface InputProps {
  type?: "text" | "number" | "email" | "password" | "date" | "time" | string;
  id?: string;
  name?: string;
  placeholder?: string;
  value?: string | number;
  autoComplete?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
  min?: string;
  max?: string;
  step?: number;
  disabled?: boolean;
  required?: boolean;
  success?: boolean;
  error?: boolean;
  hint?: string;
  size?: "sm" | "md" | "lg";
}

const Input: FC<InputProps> = ({
  type = "text",
  id,
  name,
  placeholder,
  value,
  autoComplete,
  onChange,
  onBlur,
  onKeyDown,
  className = "",
  min,
  max,
  step,
  disabled = false,
  required = false,
  success = false,
  error = false,
  hint,
  size = "md",
}) => {
  // Size-based height classes
  const sizeClasses = {
    sm: "h-8 text-xs px-3 py-1.5",
    md: "h-11 text-sm px-4 py-2.5",
    lg: "h-12 text-base px-5 py-3",
  };
  
  // For date/time inputs, don't use appearance-none to show native date picker
  const isDateOrTime = type === "date" || type === "time";
  const appearanceClass = isDateOrTime ? "" : "appearance-none";
  const datePadding = isDateOrTime ? "pr-10" : "";
  let inputClasses = ` w-full rounded-lg border ${appearanceClass} ${sizeClasses[size]} ${datePadding} shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3  dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 ${className}`;

  if (disabled) {
    inputClasses += ` text-gray-500 border-gray-300 opacity-40 bg-gray-100 cursor-not-allowed dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 opacity-40`;
  } else if (error) {
    inputClasses += `  border-error-500 focus:border-error-300 focus:ring-error-500/20 dark:text-error-400 dark:border-error-500 dark:focus:border-error-800`;
  } else if (success) {
    inputClasses += `  border-success-500 focus:border-success-300 focus:ring-success-500/20 dark:text-success-400 dark:border-success-500 dark:focus:border-success-800`;
  } else {
    inputClasses += ` bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white/90  dark:focus:border-brand-800`;
  }

  // If value is provided without onChange, treat as read-only to avoid React warning
  const isControlled = value !== undefined && value !== null;
  const valueProps = isControlled && !onChange
    ? { defaultValue: value, readOnly: true as const }
    : { value, onChange };

  return (
    <div className="relative">
      <input
        type={type}
        id={id}
        name={name}
        placeholder={placeholder}
        {...valueProps}
        autoComplete={autoComplete}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        required={required}
        className={inputClasses}
      />

      {hint && (
        <p
          className={`mt-1.5 text-xs ${
            error
              ? "text-error-500"
              : success
              ? "text-success-500"
              : "text-gray-500"
          }`}
        >
          {hint}
        </p>
      )}
    </div>
  );
};

export default Input;
