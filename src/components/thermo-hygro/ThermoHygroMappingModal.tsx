import React, { useState, useMemo } from "react";
import { Icon } from "@iconify/react";
import { useStore } from "../../store/useStore";
import { getThermoHygroList, getThermoHygroStatusMeta } from "../../utils/thermoHygroService";
import type { ThermoHygroDevice } from "../../types";

export const ThermoHygroMappingModal: React.FC = () => {
  const activeModelId = useStore((s) => s.activeThermoHygroMappingModelId);
  const setActiveThermoHygroMappingModelId = useStore((s) => s.setActiveThermoHygroMappingModelId);
  const importedModels = useStore((s) => s.importedModels);
  const linkThermoHygroToModel = useStore((s) => s.linkThermoHygroToModel);
  const showToast = useStore((s) => s.showToast);

  const [searchQuery, setSearchQuery] = useState("");

  const targetModel = useMemo(() => {
    if (!activeModelId) return null;
    return importedModels.find((m) => m.id === activeModelId) ?? null;
  }, [activeModelId, importedModels]);

  const allSensors = useMemo(() => getThermoHygroList(), []);

  // Check which sensors are already linked to other models
  const linkedSensorMap = useMemo(() => {
    const map = new Map<string, string>(); // sensorId -> modelId
    importedModels.forEach((m) => {
      if (m.thermoHygroId) {
        map.set(m.thermoHygroId, m.id);
      }
    });
    return map;
  }, [importedModels]);

  const filteredSensors = useMemo(() => {
    if (!searchQuery.trim()) return allSensors;
    const q = searchQuery.toLowerCase().trim();
    return allSensors.filter(
      (s) =>
        s.id.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.location.toLowerCase().includes(q) ||
        (s.modelName && s.modelName.toLowerCase().includes(q)) ||
        (s.manufacturer && s.manufacturer.toLowerCase().includes(q)),
    );
  }, [allSensors, searchQuery]);

  if (!activeModelId || !targetModel) return null;

  const currentLinkedSensorId = targetModel.thermoHygroId;
  const currentLinkedSensor = allSensors.find((s) => s.id === currentLinkedSensorId);

  const handleClose = () => {
    setActiveThermoHygroMappingModelId(null);
  };

  const handleLink = (sensor: ThermoHygroDevice) => {
    linkThermoHygroToModel(targetModel.id, sensor.id);
  };

  const handleUnlink = () => {
    linkThermoHygroToModel(targetModel.id, null);
  };

  return (
    <div
      className="mapping-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="mapping-modal-card mapping-modal-container">
        {/* Header */}
        <div className="mapping-modal-header">
          <div className="mapping-header-title-box">
            <div
              className="mapping-header-icon-wrap"
              style={{ background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8" }}
            >
              <Icon icon="mdi:thermometer-water" width="22" height="22" className="mapping-header-icon" />
            </div>
            <div>
              <h2 className="mapping-modal-title">온습도계 장비 연동 설정</h2>
              <p className="mapping-modal-subtitle">
                3D 온습도계 (<span className="mapping-highlight">{targetModel.name || "온습도계"}</span>)에 실제 관제 온습도 센서를 매핑합니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="mapping-btn-icon-close"
            onClick={handleClose}
            title="닫기"
          >
            <Icon icon="mdi:close" width="20" height="20" />
          </button>
        </div>

        {/* Current status bar */}
        <div className="mapping-status-bar">
          <div className="mapping-status-bar-left">
            <span className="mapping-status-label">현재 연동 상태:</span>
            {currentLinkedSensor ? (
              <span className="mapping-badge mapping-badge-linked">
                <Icon icon="mdi:check" width="14" height="14" />
                [{currentLinkedSensor.id}] {currentLinkedSensor.location || currentLinkedSensor.name} ({currentLinkedSensor.temperature}°C / {currentLinkedSensor.humidity}%)
              </span>
            ) : (
              <span className="mapping-badge mapping-badge-unlinked">
                미연동 (아래 목록에서 연동할 온습도 센서를 선택하세요)
              </span>
            )}
          </div>
          {currentLinkedSensor && (
            <button
              type="button"
              className="mapping-btn mapping-btn-unlink"
              onClick={handleUnlink}
            >
              <Icon icon="mdi:link-off" width="16" height="16" />
              연동 해제
            </button>
          )}
        </div>

        {/* Search bar */}
        <div className="mapping-search-box">
          <Icon icon="material-symbols:search" width="20" height="20" className="mapping-search-icon" />
          <input
            type="text"
            className="mapping-search-input"
            placeholder="온습도 센서명, 위치, ID, 모델명 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="mapping-search-clear"
              onClick={() => setSearchQuery("")}
            >
              <Icon icon="mdi:close" width="16" height="16" />
            </button>
          )}
        </div>

        {/* Sensor List */}
        <div className="mapping-list-scroll">
          {filteredSensors.length === 0 ? (
            <div className="mapping-empty-list">
              <Icon icon="mdi:thermometer-water" width="40" height="40" className="mapping-empty-icon" />
              <p>검색 조건에 일치하는 온습도 센서가 없습니다.</p>
            </div>
          ) : (
            filteredSensors.map((sensor) => {
              const isCurrentLinked = sensor.id === currentLinkedSensorId;
              const linkedOtherModelId = linkedSensorMap.get(sensor.id);
              const isLinkedToOther = !!linkedOtherModelId && linkedOtherModelId !== targetModel.id;
              const statusMeta = getThermoHygroStatusMeta(sensor.status);

              return (
                <div
                  key={sensor.id}
                  className={`mapping-list-item ${
                    isCurrentLinked ? "mapping-item-active" : ""
                  } ${isLinkedToOther ? "mapping-item-disabled" : ""}`}
                  onClick={() => {
                    if (isLinkedToOther) return;
                    handleLink(sensor);
                  }}
                >
                  <div
                    className="mapping-item-avatar"
                    style={{
                      background: "rgba(56, 189, 248, 0.12)",
                      color: "#38bdf8",
                    }}
                  >
                    <Icon icon="mdi:thermometer-water" width="24" height="24" />
                    <span
                      className="mapping-status-dot"
                      style={{ background: statusMeta.color }}
                    />
                  </div>

                  <div className="mapping-item-content">
                    <div className="mapping-item-title-row">
                      <span className="mapping-item-id">{sensor.id}</span>
                      <span className="mapping-item-name">{sensor.location || sensor.name}</span>
                      <span
                        className="mapping-pill"
                        style={{
                          background: statusMeta.bg,
                          color: statusMeta.color,
                          border: `1px solid ${statusMeta.borderColor}`,
                        }}
                      >
                        {statusMeta.label}
                      </span>
                      {isLinkedToOther && (
                        <span className="mapping-pill mapping-pill-muted">
                          (다른 3D 객체와 연동됨)
                        </span>
                      )}
                    </div>

                    <div className="mapping-item-meta-row">
                      <span className="mapping-meta-item">
                        <strong>현재 수치:</strong>{" "}
                        <span style={{ color: "#38bdf8", fontWeight: 700 }}>
                          {sensor.temperature.toFixed(1)}°C
                        </span>{" "}
                        /{" "}
                        <span style={{ color: "#60a5fa", fontWeight: 700 }}>
                          {sensor.humidity.toFixed(1)}%
                        </span>
                      </span>
                      {sensor.battery !== undefined && (
                        <span className="mapping-meta-item">
                          <strong>배터리:</strong> {sensor.battery}%
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mapping-item-actions">
                    {isCurrentLinked ? (
                      <button
                        type="button"
                        className="mapping-btn mapping-btn-connected"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnlink();
                        }}
                      >
                        <Icon icon="mdi:check" width="16" height="16" />
                        연동완료
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={`mapping-btn ${isLinkedToOther ? "mapping-btn-disabled" : "mapping-btn-link"}`}
                        disabled={isLinkedToOther}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isLinkedToOther) handleLink(sensor);
                        }}
                        title={isLinkedToOther ? "이미 다른 3D 객체와 연동된 장비입니다" : undefined}
                      >
                        <Icon icon="mdi:link" width="16" height="16" />
                        연동
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="mapping-modal-footer">
          <span className="mapping-footer-hint">
            💡 에디트 모드를 OFF한 후 3D 화면의 온습도계를 클릭하면 실시간 모니터링 정보를 확인할 수 있습니다.
          </span>
          <button
            type="button"
            className="mapping-btn mapping-btn-primary"
            onClick={handleClose}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

