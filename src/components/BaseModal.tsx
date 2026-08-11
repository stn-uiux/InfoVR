import React, { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  overlayCloseDisabled?: boolean;
  title: string | ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function BaseModal({
  isOpen,
  onClose,
  overlayCloseDisabled = false,
  title,
  icon,
  children,
  className = "",
}: BaseModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div
      className="base-modal-overlay"
      onClick={() => {
        if (!overlayCloseDisabled) {
          onClose();
        }
      }}
    >
      <div className={`base-modal-container ${className}`} onClick={(e) => e.stopPropagation()}>
        <div className="base-modal-header">
          <h2>
            {icon && <div className="icon-wrap">{icon}</div>}
            {title}
          </h2>
          <button className="base-modal-close" onClick={onClose} aria-label="Close">
            <Icon icon="material-symbols:close" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

