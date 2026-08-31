import { useStore } from "../../store/useStore";
import { getHighestError } from "../../utils/errorHelpers";
import { findNode } from "../../utils/nodeUtils";

export const DeviceTooltip = () => {
  const hoveredDevice = useStore((s) => s.hoveredDevice);
  const registeredDevices = useStore((s) => s.registeredDevices);
  const racks = useStore((s) => s.racks);
  const nodes = useStore((s) => s.nodes);

  if (!hoveredDevice) return null;

  const { device, x, y, rackTitle, rackId } = hoveredDevice;
  const errorInfo = getHighestError(device.portStates);
  
  const regDevice = registeredDevices.find(rd => rd.deviceId === device.deviceId);
  const ipAddr = device.IPAddr || regDevice?.IPAddr || "-";

  const rack = racks.find(r => r.rackId === rackId);
  const nodeName = rack ? findNode(nodes, rack.mapId)?.name : null;
  const groupName = nodeName || rackTitle || "-";

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
          <span className="comm-tooltip-value">{groupName}</span>
        </div>
        <div className="comm-tooltip-row">
          <span className="comm-tooltip-label">IP:</span>
          <span className="comm-tooltip-value-highlight">{ipAddr}</span>
        </div>
      </div>
    </div>
  );
};
