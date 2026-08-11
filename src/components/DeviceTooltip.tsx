import React from "react";
import { useStore } from "../store/useStore";
import { getHighestError } from "../utils/errorHelpers";

export const DeviceTooltip = () => {
  const hoveredDevice = useStore((s) => s.hoveredDevice);

  if (!hoveredDevice) return null;

  const { device, x, y, rackTitle } = hoveredDevice;
  const errorInfo = getHighestError(device.portStates);

  return (
    <div
      style={{
        position: "fixed",
        top: y + 15,
        left: x + 15,
        pointerEvents: "none",
        zIndex: 9999,
        background: "rgba(20, 24, 33, 0.95)",
        border: `1px solid ${errorInfo ? errorInfo.color : "rgba(255,255,255,0.1)"}`,
        borderRadius: "8px",
        padding: "12px 16px",
        color: "#ffffff",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        minWidth: "160px",
        fontFamily: "Pretendard, sans-serif",
      }}
    >
      <div className="comm-tooltip-header">
        {device.title || device.modelName}
        {errorInfo && (
          <span className="comm-tooltip-error" style={{ color: errorInfo.color }}>
            [장애]
          </span>
        )}
      </div>

      <div className="comm-tooltip-divider" />

      <div className="comm-tooltip-content-col">
        <div className="comm-tooltip-row">
          <span className="comm-tooltip-label">그룹:</span>
          <span className="comm-tooltip-value">{rackTitle || "-"}</span>
        </div>
        <div className="comm-tooltip-row">
          <span className="comm-tooltip-label">IP:</span>
          <span className="comm-tooltip-value-highlight">{device.IPAddr || "-"}</span>
        </div>
      </div>
    </div>
  );
};
