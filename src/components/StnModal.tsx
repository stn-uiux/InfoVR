import React, { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";

interface StnModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string | ReactNode;
  icon?: string;
  children: ReactNode;
  className?: string;
  overlayClassName?: string;
}

export function StnModal({
  isOpen,
  onClose,
  title,
  icon,
  children,
  className = "",
  overlayClassName = ""
}: StnModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div className={`stn-modal-overlay ${overlayClassName}`} onClick={onClose}>
      <div className={`stn-modal ${className}`} onClick={(e) => e.stopPropagation()}>
        <div className="stn-modal-header">
          <h2>
            {icon && (
              <div className="icon-wrap">
                <Icon icon={icon} />
              </div>
            )}
            {title}
          </h2>
          <button className="stn-modal-close" onClick={onClose} aria-label="닫기">
            <Icon icon="material-symbols:close" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
