import React, { useEffect, useMemo, useCallback } from "react";
import { Icon } from "@iconify/react";
import { useStore } from "../../store/useStore";
import { getThermoHygroById, getThermoHygroList, getThermoHygroStatusMeta, getThermoHygroFaultInfo } from "../../utils/thermoHygroService";
import type { ThermoHygroDevice } from "../../types";

const DropletGaugeSvg: React.FC<{ humidity: number; id: string }> = ({ humidity, id }) => {
  const humVal = typeof humidity === "number" ? humidity : 45.2;
  const humPct = Math.max(0, Math.min(100, humVal)) / 100;

  let fillH: number;
  if (humPct <= 0.5) {
    fillH = 11 * Math.pow(humPct / 0.5, 0.95);
  } else {
    fillH = 11 + 19 * Math.pow((humPct - 0.5) / 0.5, 1.05);
  }
  const fillY = 31 - fillH;

  const clipId = `thermo-modal-drop-clip-${id}`;
  const gradId = `thermo-modal-drop-grad-${id}`;

  return (
    <svg
      width="20"
      height="28"
      viewBox="0 0 24 32"
      style={{ overflow: "visible", flexShrink: 0 }}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          <path d="M 12 1 C 15.5 8, 23 14, 23 20 A 11 11 0 0 1 1 20 C 1 14, 8.5 8, 12 1 Z" />
        </clipPath>
        <linearGradient id={gradId} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#0284c7" />
          <stop offset="50%" stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      {/* Background */}
      <path
        d="M 12 1 C 15.5 8, 23 14, 23 20 A 11 11 0 0 1 1 20 C 1 14, 8.5 8, 12 1 Z"
        className="thermo-droplet-bg"
      />
      {/* Liquid Fill */}
      <g clipPath={`url(#${clipId})`}>
        <rect
          x="0"
          y={fillY}
          width="24"
          height={fillH + 4}
          fill={`url(#${gradId})`}
        />
        {humPct > 0.05 && humPct < 0.95 && (
          <path
            d={`M 1 ${fillY} Q 12 ${fillY - 1.5} 23 ${fillY}`}
            stroke="#e0f2fe"
            strokeWidth="1.2"
            fill="none"
            opacity="0.85"
          />
        )}
      </g>
      {/* Outer Border */}
      <path
        d="M 12 1 C 15.5 8, 23 14, 23 20 A 11 11 0 0 1 1 20 C 1 14, 8.5 8, 12 1 Z"
        fill="none"
        stroke="#38bdf8"
        strokeWidth="1.8"
      />
    </svg>
  );
};

export const ThermoHygroDetailModal: React.FC = () => {
  const activeModelId = useStore((s) => s.activeThermoHygroDetailModelId);
  const setActiveThermoHygroDetailModelId = useStore((s) => s.setActiveThermoHygroDetailModelId);
  const setActiveThermoHygroMappingModelId = useStore((s) => s.setActiveThermoHygroMappingModelId);
  const importedModels = useStore((s) => s.importedModels);

  const targetModel = useMemo(() => {
    if (!activeModelId) return null;
    return importedModels.find((m) => m.id === activeModelId) ?? null;
  }, [activeModelId, importedModels]);

  const linkedSensor: ThermoHygroDevice | null = useMemo(() => {
    if (!targetModel) return null;
    if (targetModel.thermoHygroId) {
      const found = getThermoHygroById(targetModel.thermoHygroId);
      if (found) return found;
    }
    const fallbackList = getThermoHygroList();
    return fallbackList[0] || null;
  }, [targetModel]);

  const isActuallyLinked = !!(targetModel?.thermoHygroId && getThermoHygroById(targetModel.thermoHygroId));
  const statusMeta = useMemo(() => {
    return getThermoHygroStatusMeta(linkedSensor?.status, isActuallyLinked);
  }, [linkedSensor?.status, isActuallyLinked]);

  const faultInfo = useMemo(() => {
    return getThermoHygroFaultInfo(linkedSensor, isActuallyLinked);
  }, [linkedSensor, isActuallyLinked]);

  const handleClose = useCallback(() => {
    setActiveThermoHygroDetailModelId(null);
  }, [setActiveThermoHygroDetailModelId]);

  const handleOpenEditMapping = () => {
    if (!targetModel) return;
    // Keep ThermoHygroDetailModal open in the background so closing mapping returns to it
    setActiveThermoHygroMappingModelId(targetModel.id);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If mapping modal is open on top, don't close detail modal on Escape
      if (e.key === "Escape" && !useStore.getState().activeThermoHygroMappingModelId) {
        handleClose();
      }
    };
    if (activeModelId) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeModelId, handleClose]);

  if (!activeModelId || !targetModel || !linkedSensor) return null;

  const temp = linkedSensor.temperature;
  const hum = linkedSensor.humidity;
  const targetTempMin = linkedSensor.targetTempMin ?? 18.0;
  const targetTempMax = linkedSensor.targetTempMax ?? 27.0;
  const targetHumMin = linkedSensor.targetHumidityMin ?? 40.0;
  const targetHumMax = linkedSensor.targetHumidityMax ?? 60.0;

  // Temperature calculations (10°C ~ 35°C span 25°C)
  const tempRatio = Math.max(0, Math.min(1, (temp - 10) / 25));
  const tempOptStart = Math.max(0, Math.min(100, ((targetTempMin - 10) / 25) * 100));
  const tempOptWidth = Math.max(0, Math.min(100 - tempOptStart, ((targetTempMax - targetTempMin) / 25) * 100));

  // Humidity calculations (0% ~ 100%)
  const humRatio = Math.max(0, Math.min(1, hum / 100));
  const humOptStart = Math.max(0, Math.min(100, targetHumMin));
  const humOptWidth = Math.max(0, Math.min(100 - humOptStart, targetHumMax - targetHumMin));

  return (
    <div
      className="mapping-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="thermo-detail-modal-card">
        {/* Header */}
        <div className="thermo-detail-header">
          <div className="thermo-detail-header-left">
            <div className="thermo-detail-icon-wrap">
              <Icon icon="mdi:thermometer-water" width="22" height="22" />
            </div>
            <div className="thermo-detail-title-box">
              {/* 1행: "id" "name" [상태 뱃지] */}
              <div className="thermo-detail-title-row">
                <span className="thermo-detail-id-badge">{linkedSensor.id}</span>
                <h3 className="thermo-detail-title">
                  {linkedSensor.name || targetModel.name || "온습도계"}
                </h3>
                <span className={`mapping-pill ${statusMeta.statusClass}`}>
                  {statusMeta.label}
                </span>
              </div>
              {/* 2행: "location" 표출 */}
              <p className="thermo-detail-subtitle">
                위치: {linkedSensor.location || targetModel.name || "전산실 내부"}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="mapping-btn-icon-close"
            onClick={handleClose}
            title="닫기"
          >
            <Icon icon="mdi:close" width="18" height="18" />
          </button>
        </div>

        {/* Unlinked Banner notice (헤더 하단 위치 및 표준 CCTV 배너 스타일 적용) */}
        {!isActuallyLinked && (
          <div className="cctv-unlinked-banner">
            <Icon icon="mdi:information" width="18" height="18" className="cctv-banner-icon" />
            <span className="cctv-banner-text">
              현재 3D 온습도계에 연동된 센서가 없어 샘플 데이터가 표시되고 있습니다.
            </span>
            <button
              type="button"
              className="cctv-btn-banner-link"
              onClick={handleOpenEditMapping}
            >
              장비 연동하기 &rarr;
            </button>
          </div>
        )}

        {/* Metrics Area (Image 1 style) */}
        <div className="thermo-detail-metrics">
          {/* Left Column: Temperature */}
          <div className="thermo-metric-col temp">
            <span className="thermo-metric-lbl">온도</span>
            <div className="thermo-metric-val">
              {temp.toFixed(1)}
              <span className="thermo-metric-unit">°C</span>
            </div>
            <div className="thermo-target-info">
              <span className="thermo-target-lbl">TARGET :</span>
              <span className="thermo-target-val">
                {targetTempMin.toFixed(1)} ~ {targetTempMax.toFixed(1)} °C
              </span>
            </div>
            <div className="thermo-target-bar-track">
              <div
                className="thermo-target-bar-opt temp-opt"
                style={{ left: `${tempOptStart}%`, width: `${tempOptWidth}%` }}
              />
              <div
                className="thermo-target-bar-dot temp-dot"
                style={{ left: `${tempRatio * 100}%` }}
              />
            </div>
          </div>

          {/* Center Vertical Divider */}
          <div className="thermo-popover-vdiv" />

          {/* Right Column: Humidity */}
          <div className="thermo-metric-col hum">
            <span className="thermo-metric-lbl">습도</span>
            <div className="thermo-metric-val hum-val-row">
              <DropletGaugeSvg humidity={hum} id={targetModel.id} />
              <span>{hum.toFixed(1)}</span>
              <span className="thermo-metric-unit">%</span>
            </div>
            <div className="thermo-target-info">
              <span className="thermo-target-lbl">TARGET :</span>
              <span className="thermo-target-val">
                {targetHumMin.toFixed(1)} ~ {targetHumMax.toFixed(1)} %
              </span>
            </div>
            <div className="thermo-target-bar-track">
              <div
                className="thermo-target-bar-opt hum-opt"
                style={{ left: `${humOptStart}%`, width: `${humOptWidth}%` }}
              />
              <div
                className="thermo-target-bar-dot hum-dot"
                style={{ left: `${humRatio * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Location & Battery Footer Row */}
        <div className="thermo-detail-info-row">
          <div className="thermo-detail-location">
            <span>📍 위치: {linkedSensor.location || targetModel.name || "전산실 내부"}</span>
          </div>
          <div className="thermo-detail-battery">
            <span>🔋 {linkedSensor.battery !== undefined ? `${linkedSensor.battery}%` : "100%"}</span>
          </div>
        </div>

        {/* Fault & Alarm Status Card (하단으로 위치 이동) */}
        <div className={`device-fault-card ${faultInfo.severity}`}>
          <div className="device-fault-header">
            <div className="device-fault-badge-wrap">
              <span className={`device-fault-pill ${faultInfo.severity}`}>
                <span className="device-fault-dot" />
                {faultInfo.severity.toUpperCase()}
              </span>
              <span className="device-fault-title">{faultInfo.title}</span>
            </div>
            {faultInfo.occurredAt !== "-" && (
              <span className="device-fault-time">
                {faultInfo.occurredAt}
              </span>
            )}
          </div>
          <p className="device-fault-desc">{faultInfo.description}</p>
          {faultInfo.recommendation && (
            <div className="device-fault-action">
              <span className="device-fault-action-label">권고 조치:</span>
              <span className="device-fault-action-text">{faultInfo.recommendation}</span>
            </div>
          )}
        </div>

        {/* Bottom Actions Footer (CCTV Modal Style) */}
        <div className="cctv-modal-footer">
          <div className="cctv-footer-left">
            <button
              type="button"
              className="cctv-btn cctv-btn-change-mapping"
              onClick={handleOpenEditMapping}
            >
              <Icon icon="mdi:link" width="16" height="16" />
              {isActuallyLinked ? "온습도계 연동 장비 변경" : "온습도계 연동 장비 선택"}
            </button>
          </div>
          <button
            type="button"
            className="cctv-btn cctv-btn-primary"
            onClick={handleClose}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
