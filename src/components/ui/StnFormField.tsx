import React, { ReactNode } from "react";

interface StnFormFieldProps {
  label?: string;
  required?: boolean;
  error?: string;
  fullWidth?: boolean;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const StnFormField: React.FC<StnFormFieldProps> = ({
  label,
  required = false,
  error,
  fullWidth = false,
  children,
  className = "",
  style,
}) => {
  return (
    <div
      className={`stn-form-field ${fullWidth ? "stn-form-field-full" : ""} ${className}`}
      style={style}
    >
      {label && (
        <label>
          {label}
          {required && <span className="stn-form-required">*</span>}
        </label>
      )}
      {children}
      {error && <span className="stn-form-error">{error}</span>}
    </div>
  );
};
