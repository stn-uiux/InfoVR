import React, { InputHTMLAttributes, forwardRef } from "react";
import { Icon } from "@iconify/react";

export interface StnInputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: string;
  hasError?: boolean;
}

export const StnInput = forwardRef<HTMLInputElement, StnInputProps>(
  ({ className = "", icon, hasError, style, ...props }, ref) => {
    return (
      <div className="stn-input-wrapper" style={style}>
        {icon && (
          <span className="stn-input-icon-wrap">
            <Icon icon={icon} className="icon" />
          </span>
        )}
        <input
          ref={ref}
          className={`stn-input ${hasError ? "error" : ""} ${icon ? "has-icon" : ""} ${className}`}
          {...props}
        />
      </div>
    );
  }
);

StnInput.displayName = "StnInput";
