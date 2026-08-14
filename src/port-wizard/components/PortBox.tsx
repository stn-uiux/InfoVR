import React, { memo } from 'react';
import { motion } from 'motion/react';
import { X, Maximize2 } from 'lucide-react';
import ethernetIcon from '../assets/Ethernet.svg';
import sfpIcon from '../assets/sfp.svg';

export interface PortData {
  portName: string; // e.g., 'Mgmt', 'Ethernet', 'Console'
  portNumber: string | number;
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax]
  cropUrl?: string; // Extracted image data URL
  svgPath?: string; 
  svgType?: 'ethernet' | 'sfp';
}

interface PortBoxProps {
  port: PortData;
  idx: number;
  imageSize: { width: number, height: number };
  isSelected: boolean;
  isPrimarySelection?: boolean;
  isMultiSelect?: boolean;
  isActive: boolean;
  editMode: boolean;
  onDragStart: (idx: number, e: React.MouseEvent) => void;
  onResizeStart: (idx: number, e: React.MouseEvent) => void;
  onDelete: (idx: number, e: React.MouseEvent) => void;
  onNameChange: (idx: number, newName: string) => void;
  onNumberChange: (idx: number, newNumber: string) => void;
  onSvgTypeChange?: (idx: number, newType: 'ethernet' | 'sfp' | undefined) => void;
  onWidthChange: (idx: number, newWidthVal: number) => void;
  onHeightChange: (idx: number, newHeightVal: number) => void;
  onMouseEnter: (idx: number) => void;
  onMouseLeave: () => void;
  saveHistory: () => void;
}

const PortBox: React.FC<PortBoxProps> = ({
  port,
  idx,
  imageSize,
  isSelected,
  isPrimarySelection,
  isMultiSelect,
  isActive,
  editMode,
  onDragStart,
  onResizeStart,
  onDelete,
  onNameChange,
  onNumberChange,
  onSvgTypeChange,
  onWidthChange,
  onHeightChange,
  onMouseEnter,
  onMouseLeave,
  saveHistory
}) => {
  const [ymin, xmin, ymax, xmax] = port.box_2d;
  const vHeight = imageSize.width > 0 ? (imageSize.height / imageSize.width) * 1000 : 1000;
  const left = (xmin / 1000) * imageSize.width;
  const top = (ymin / 1000) * imageSize.height;
  const width = ((xmax - xmin) / 1000) * imageSize.width;
  const height = ((ymax - ymin) / 1000) * imageSize.height;

  return (
    <motion.div
      key={`port-${idx}`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`wizard-port ${
        editMode ? 'wizard-port--edit' : 'wizard-port--view'
      } ${
        isSelected ? 'wizard-port--selected' 
        : isActive ? 'wizard-port--active' 
        : ''
      }`}
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
      }}
      onMouseEnter={() => onMouseEnter(idx)}
      onMouseLeave={onMouseLeave}
      onMouseDown={(e) => {
        if (editMode) onDragStart(idx, e);
      }}
    >
      {/* Target SVG Icon */}
      {port.svgType && (
        <img 
          src={port.svgType === 'ethernet' ? ethernetIcon : sfpIcon}
          alt={port.svgType}
          className="wizard-port__svg-icon"
        />
      )}

      {/* SVG Path rendering if present */}
      {port.svgPath && (
        <svg 
          className="wizard-port__svg-path" 
          viewBox={`${xmin} ${ymin} ${xmax - xmin} ${ymax - ymin}`}
          preserveAspectRatio="none"
        >
          <path 
            d={port.svgPath} 
            fill="currentColor" 
            transform={`translate(${-xmin}, ${-ymin})`}
          />
        </svg>
      )}

      {/* Visual Port Info Overlay */}
      {(!editMode || (editMode && (isActive || isSelected))) && (
        <div className="wizard-port__label">
          {port.portNumber}
        </div>
      )}

      {/* Edit Mode Controls */}
      {editMode && (
        <>
          {/* Quick Actions overlay: Only show for single primary selection, hide if multiple are selected */}
          {!isMultiSelect && (isPrimarySelection || (isActive && isSelected && !isPrimarySelection)) && (
            <div 
              className="wizard-port__controls"
              style={{
                top: top < 120 ? 'calc(100% + 8px)' : 'auto',
                bottom: top < 120 ? 'auto' : 'calc(100% + 8px)',
                left: xmin > 500 ? 'auto' : '0',
                right: xmin > 500 ? '0' : 'auto',
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* Name Input */}
              <div className="wizard-port__field wizard-port__field--tag">
                <span className="wizard-port__field-label">Tag</span>
                <input 
                  type="text" 
                  value={port.portName || ''} 
                  onChange={(e) => onNameChange(idx, e.target.value)}
                  onFocus={saveHistory}
                  placeholder="tag"
                  className="wizard-port__input"
                />
              </div>

              {/* Number Input */}
              <div className="wizard-port__field wizard-port__field--seq">
                <span className="wizard-port__field-label">Seq</span>
                <input 
                  type="text" 
                  value={port.portNumber || ''} 
                  onChange={(e) => onNumberChange(idx, e.target.value)}
                  onFocus={saveHistory}
                  placeholder="1"
                  className="wizard-port__input wizard-port__input--seq"
                />
              </div>

              <div className="wizard-port__divider" />

              {/* SVG Type Selector */}
              <div className="wizard-port__field wizard-port__field--icon">
                <span className="wizard-port__field-label">Icon</span>
                <select
                  value={port.svgType || ''}
                  onChange={(e) => {
                    saveHistory();
                    onSvgTypeChange?.(idx, e.target.value ? (e.target.value as 'ethernet' | 'sfp') : undefined);
                  }}
                  onFocus={saveHistory}
                  className="wizard-port__select"
                >
                  <option value="">None</option>
                  <option value="ethernet">Ethernet</option>
                  <option value="sfp">SFP</option>
                </select>
              </div>

              <div className="wizard-port__divider" />

              {/* Dimensions */}
              <div className="wizard-port__dims">
                <div className="wizard-dims__col">
                  <span className="wizard-dims__label">W</span>
                  <div className="wizard-dims__stepper">
                    <button 
                      onClick={(e) => { e.stopPropagation(); saveHistory(); onWidthChange(idx, Math.max(0, Math.round(xmax - xmin) - 1)); }}
                      className="wizard-dims__step-btn"
                    >-</button>
                    <input 
                      type="number" 
                      value={Math.round(xmax - xmin) || ''} 
                      onChange={(e) => onWidthChange(idx, e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                      onFocus={saveHistory}
                      className="wizard-dims__step-input no-spinners"
                    />
                    <button 
                      onClick={(e) => { e.stopPropagation(); saveHistory(); onWidthChange(idx, Math.round(xmax - xmin) + 1); }}
                      className="wizard-dims__step-btn"
                    >+</button>
                  </div>
                </div>
                <div className="wizard-dims__col">
                  <span className="wizard-dims__label">H</span>
                  <div className="wizard-dims__stepper">
                    <button 
                      onClick={(e) => { e.stopPropagation(); saveHistory(); onHeightChange(idx, Math.max(0, Math.round(((ymax - ymin) / 1000) * vHeight) - 1)); }}
                      className="wizard-dims__step-btn"
                    >-</button>
                    <input 
                      type="number" 
                      value={Math.round(((ymax - ymin) / 1000) * vHeight) || ''} 
                      onChange={(e) => onHeightChange(idx, e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                      onFocus={saveHistory}
                      className="wizard-dims__step-input no-spinners"
                    />
                    <button 
                      onClick={(e) => { e.stopPropagation(); saveHistory(); onHeightChange(idx, Math.round(((ymax - ymin) / 1000) * vHeight) + 1); }}
                      className="wizard-dims__step-btn"
                    >+</button>
                  </div>
                </div>
              </div>

              <div className="wizard-port__divider" />

              {/* Copy Buttons */}
              <div className="wizard-port__copy-group">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true }));
                  }}
                  className="wizard-port__copy-btn"
                  title="Port Copy (Ctrl+D)"
                >
                  PRT
                </button>
              </div>

              <button 
                onClick={(e) => {
                  saveHistory();
                  onDelete(idx, e);
                }}
                className="wizard-port__delete-btn"
              >
                <X />
              </button>
            </div>
          )}

          {/* Resize Handle - Shows only when box is explicitly selected to prevent hover noise */}
          {isSelected && (
            <div 
              className="wizard-port__resize-wrap"
              onMouseDown={(e) => {
                e.stopPropagation();
                onResizeStart(idx, e);
              }}
            >
              <div className="wizard-port__resize-handle">
                <Maximize2 />
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
};

export default memo(PortBox);
