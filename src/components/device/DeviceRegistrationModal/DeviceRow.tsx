import { Icon } from "@iconify/react";
import React from "react";

import type { RegisteredDevice } from "../../../types";
import { StnBadge } from "../../ui/StnBadge";

export interface DeviceRowProps {
  device: RegisteredDevice;
  isSelected: boolean;
  groupName: string;
  statusInfo?: { placed: boolean };
  onLocate: (device: RegisteredDevice) => void;
  onSelect: (id: string, checked: boolean) => void;
  onEdit: (device: RegisteredDevice) => void;
  onDelete: (e: React.MouseEvent<HTMLButtonElement>, device: RegisteredDevice) => void;
}

export const DeviceRow = React.memo(({
  device,
  isSelected,
  groupName,
  statusInfo,
  onLocate,
  onSelect,
  onEdit,
  onDelete
}: DeviceRowProps) => {
  return (
    <tr onClick={() => onLocate(device)}>
      <td className="col-check">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
          }}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onSelect(device.deviceId, e.target.checked);
            }}
          />
        </div>
      </td>
      <td>
        <div className="drm-device-name">
          {device.title || device.modelName}
        </div>
      </td>
      <td>{device.modelName}</td>
      <td
        style={{
          fontFamily: "var(--font-family-mono)",
          fontSize: "12px",
        }}
      >
        {device.IPAddr}
      </td>
      <td
        style={{
          fontFamily: "var(--font-family-mono)",
          fontSize: "12px",
        }}
      >
        {device.macAddr}
      </td>
      <td>
        <span className="drm-vendor-tag">{device.vendor}</span>
      </td>
      <td>
        {statusInfo?.placed === false ? (
          <StnBadge variant="secondary">
            미실장
          </StnBadge>
        ) : (
          <StnBadge variant="primary" style={{ color: "#38bdf8", borderColor: "rgba(56, 189, 248, 0.3)", background: "rgba(56, 189, 248, 0.1)" }}>
            실장
          </StnBadge>
        )}
      </td>
      <td style={{ textAlign: "center" }}>
        <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
          <button
            className="comm-btn comm-icon-btn comm-btn-sm comm-btn-tertiary"
            title="수정"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(device);
            }}
          >
            <Icon icon="material-symbols:edit" className="icon" />
          </button>
          <button
            className="comm-btn comm-icon-btn comm-btn-sm comm-btn-tertiary"
            style={{ color: "var(--severity-critical)" }}
            title="삭제"
            onClick={(e) => onDelete(e, device)}
          >
            <Icon icon="material-symbols:delete" className="icon" />
          </button>
        </div>
      </td>
    </tr>
  );
});

DeviceRow.displayName = "DeviceRow";
