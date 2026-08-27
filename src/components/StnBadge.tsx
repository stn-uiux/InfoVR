import React from "react";

export type StnBadgeVariant = 
  | "primary" 
  | "secondary" 
  | "success" 
  | "danger" 
  | "warning" 
  | "info"
  | "outline"
  | "ghost";

export interface StnBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: StnBadgeVariant;
  children: React.ReactNode;
}

export const StnBadge: React.FC<StnBadgeProps> = ({ 
  variant = "primary", 
  className = "", 
  children,
  ...props 
}) => {
  return (
    <span className={`stn-badge stn-badge-${variant} ${className}`} {...props}>
      {children}
    </span>
  );
};
