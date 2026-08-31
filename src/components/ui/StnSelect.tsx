import React, { useState, useRef, useMemo, useCallback } from "react";
import { Icon } from "@iconify/react";
import { useClickOutside } from "../../hooks/useClickOutside";

export interface StnSelectOption {
  label: string;
  value: string | number;
}

export interface StnSelectProps {
  options: StnSelectOption[];
  value: string | number;
  onChange: (val: string | number) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  size?: 'sm' | 'md' | 'lg';
}

export const StnSelect = ({
  options,
  value,
  onChange,
  placeholder = "선택하세요",
  className = "",
  style,
  size = "md"
}: StnSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedLabel = useMemo(() => {
    const opt = options.find((o) => o.value === value);
    return opt ? opt.label : placeholder;
  }, [options, value, placeholder]);

  const handleClose = useCallback(() => setIsOpen(false), []);
  useClickOutside(containerRef, isOpen, handleClose);

  return (
    <div className={`stn-select-container size-${size} ${className}`} style={style} ref={containerRef}>
      <div
        className={`stn-select-trigger ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="stn-select-label">{selectedLabel}</span>
        <span className="stn-select-chevron">
          <Icon icon="material-symbols:keyboard-arrow-down" className="icon" style={{ width: 16, height: 16 }} />
        </span>
      </div>

      {isOpen && (
        <div className="stn-select-popover">
          {options.map((opt, i) => (
            <div
              key={i}
              className={`stn-select-option ${opt.value === value ? "selected" : ""}`}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              <span className="stn-select-option-label">{opt.label}</span>
              {opt.value === value && (
                <span className="stn-select-check-icon">
                  <Icon icon="fluent:checkmark-24-regular" style={{ fontSize: "16px" }} />
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
