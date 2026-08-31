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
  style?: React.CSSProperties;
}

export function StnModal({
  isOpen,
  onClose,
  title,
  icon,
  children,
  className = "",
  overlayClassName = "",
  style
}: StnModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div className={`stn-modal-overlay ${overlayClassName}`} onClick={onClose}>
      <div className={`stn-modal ${className}`} style={style} onClick={(e) => e.stopPropagation()}>
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
        <div className="stn-modal-body">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
