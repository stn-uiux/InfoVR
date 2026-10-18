import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Icon } from "@iconify/react";
import { useStore } from "../../store/useStore";
import { getCctvList, getCctvStatusMeta } from "../../utils/cctvService";
import type { CctvDevice } from "../../types";

export const CctvMappingModal: React.FC = () => {
  const activeModelId = useStore((s) => s.activeCctvMappingModelId);
  const setActiveCctvMappingModelId = useStore((s) => s.setActiveCctvMappingModelId);
  const importedModels = useStore((s) => s.importedModels);
  const linkCctvToModel = useStore((s) => s.linkCctvToModel);

  const [searchQuery, setSearchQuery] = useState("");

  const targetModel = useMemo(() => {
    if (!activeModelId) return null;
    return importedModels.find((m) => m.id === activeModelId) ?? null;
  }, [activeModelId, importedModels]);

  const allCctvDevices = useMemo(() => getCctvList(), []);

  // Check which CCTV devices are already linked to other models
  const linkedCctvMap = useMemo(() => {
    const map = new Map<string, string>(); // cctvId -> modelId
    importedModels.forEach((m) => {
      if (m.cctvId) {
        map.set(m.cctvId, m.id);
      }
    });
    return map;
  }, [importedModels]);

  const filteredDevices = useMemo(() => {
    if (!searchQuery.trim()) return allCctvDevices;
    const q = searchQuery.toLowerCase().trim();
    return allCctvDevices.filter(
      (d) =>
        d.id.toLowerCase().includes(q) ||
        d.name.toLowerCase().includes(q) ||
        d.location.toLowerCase().includes(q) ||
        d.ip.toLowerCase().includes(q) ||
        d.model.toLowerCase().includes(q) ||
        d.manufacturer.toLowerCase().includes(q),
    );
  }, [allCctvDevices, searchQuery]);

  const handleClose = useCallback(() => {
    setActiveCctvMappingModelId(null);
  }, [setActiveCctvMappingModelId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        handleClose();
      }
    };
    if (activeModelId) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeModelId, handleClose]);

  if (!activeModelId || !targetModel) return null;

  const currentLinkedCctvId = targetModel.cctvId;
  const currentLinkedDevice = allCctvDevices.find((d) => d.id === currentLinkedCctvId);

  const handleLink = (device: CctvDevice) => {
    linkCctvToModel(targetModel.id, device.id);
  };

  const handleUnlink = () => {
    linkCctvToModel(targetModel.id, null);
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
            <div className="mapping-header-icon-wrap">
              <Icon icon="mdi:cctv" width="22" height="22" className="mapping-header-icon" />
            </div>
            <div>
              <h2 className="mapping-modal-title">CCTV 장비 연동 설정</h2>
              <p className="mapping-modal-subtitle">
                3D CCTV 객체 (<span className="mapping-highlight">{targetModel.name || "CCTV"}</span>)에 실제 관제 CCTV 장비를 매핑합니다.
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
            {currentLinkedDevice ? (
              <span className="mapping-badge mapping-badge-linked">
                <Icon icon="mdi:check" width="14" height="14" />
                [{currentLinkedDevice.id}] {currentLinkedDevice.name}
              </span>
            ) : (
              <span className="mapping-badge mapping-badge-unlinked">
                미연동 (아래 목록에서 장비를 선택하세요)
              </span>
            )}
          </div>
          {currentLinkedDevice && (
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
            placeholder="CCTV 장비명, IP, 설치 위치, 모델명 검색..."
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

        {/* CCTV List */}
        <div className="mapping-list-scroll">
          {filteredDevices.length === 0 ? (
            <div className="mapping-empty-list">
              <Icon icon="mdi:cctv" width="40" height="40" className="mapping-empty-icon" />
              <p>검색 조건에 일치하는 CCTV 장비가 없습니다.</p>
            </div>
          ) : (
            filteredDevices.map((device) => {
              const isCurrentLinked = device.id === currentLinkedCctvId;
              const linkedOtherModelId = linkedCctvMap.get(device.id);
              const isLinkedToOther = !!linkedOtherModelId && linkedOtherModelId !== targetModel.id;
              const statusMeta = getCctvStatusMeta(device.status);

              return (
                <div
                  key={device.id}
                  className={`mapping-list-item ${
                    isCurrentLinked ? "mapping-item-active" : ""
                  } ${isLinkedToOther ? "mapping-item-disabled" : ""}`}
                  onClick={() => {
                    if (isLinkedToOther) return;
                    handleLink(device);
                  }}
                >
                  <div className="mapping-item-avatar">
                    <Icon icon="mdi:cctv" width="24" height="24" />
                    <span className={`mapping-status-dot ${statusMeta.statusClass}`} />
                  </div>

                  <div className="mapping-item-content">
                    <div className="mapping-item-title-row">
                      <span className="mapping-item-id">{device.id}</span>
                      <span className="mapping-item-name">{device.name}</span>
                      <span className={`mapping-pill ${statusMeta.statusClass}`}>
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
                        <strong>위치:</strong> {device.location}
                      </span>
                      <span className="mapping-meta-item">
                        <strong>IP:</strong> {device.ip}:{device.port}
                      </span>
                      <span className="mapping-meta-item">
                        <strong>해상도:</strong> {device.resolution} ({device.fps}fps)
                      </span>
                      <span className="mapping-meta-item">
                        <strong>모델:</strong> {device.manufacturer} {device.model}
                      </span>
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
                          if (!isLinkedToOther) handleLink(device);
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
            💡 에디트 모드를 OFF한 후 3D 화면의 CCTV를 클릭하면 실시간 모니터링 영상과 정보를 확인할 수 있습니다.
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
