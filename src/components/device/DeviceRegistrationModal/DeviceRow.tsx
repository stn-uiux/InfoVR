import { Icon } from "@iconify/react";
import React, { useMemo } from "react";
import { useStore } from "../../../store/useStore";

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
  const { baseModelName, variantLabel } = useMemo(() => {
    const customModels = useStore.getState().customModels;
    let overrideModel = customModels.find((m) => m.modelName === device.modelName);
    let bName = device.modelName || "";
    let vName = "기본타입";

    if (!overrideModel) {
      overrideModel = customModels.find((m) => device.modelName?.startsWith(m.modelName + " "));
      if (overrideModel && device.modelName) {
        bName = overrideModel.modelName;
        vName = device.modelName.substring(overrideModel.modelName.length + 1);
      }
    }

    const isCustomized = device.insertedCards && device.insertedCards.length > 0;
    
    let vLabel = "고정형";
    if (isCustomized) {
      vLabel = "개별구성";
    } else if (overrideModel) {
      vLabel = vName;
    }

    return { baseModelName: bName, variantLabel: vLabel };
  }, [device.modelName, device.insertedCards]);

  return (
    <tr onClick={() => onLocate(device)}>
      <td className="col-check" onClick={(e) => e.stopPropagation()}>
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
      <td>{baseModelName}</td>
      <td>
        {variantLabel === "고정형" ? (
          <StnBadge variant="fixed">
            {variantLabel}
          </StnBadge>
        ) : (
          <StnBadge variant="chassis">
            {variantLabel}
          </StnBadge>
        )}
      </td>
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
        {device.type}
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
          <StnBadge variant="primary">
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
