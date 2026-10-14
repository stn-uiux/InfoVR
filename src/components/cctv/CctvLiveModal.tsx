import React, { useState, useEffect, useMemo, useRef } from "react";
import { Icon } from "@iconify/react";
import { useStore } from "../../store/useStore";
import { getCctvById, getCctvList } from "../../utils/cctvService";
import type { CctvDevice } from "../../types";

export const CctvLiveModal: React.FC = () => {
  const activeModelId = useStore((s) => s.activeCctvLiveModelId);
  const setActiveCctvLiveModelId = useStore((s) => s.setActiveCctvLiveModelId);
  const setActiveCctvMappingModelId = useStore((s) => s.setActiveCctvMappingModelId);
  const isEditMode = useStore((s) => s.isEditMode);
  const importedModels = useStore((s) => s.importedModels);

  const viewportRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState("");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [refreshKey, setRefreshKey] = useState(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Real-time clock for CCTV timestamp overlay
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const hh = String(now.getHours()).padStart(2, "0");
      const min = String(now.getMinutes()).padStart(2, "0");
      const ss = String(now.getSeconds()).padStart(2, "0");
      setCurrentTime(`${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const targetModel = useMemo(() => {
    if (!activeModelId) return null;
    return importedModels.find((m) => m.id === activeModelId) ?? null;
  }, [activeModelId, importedModels]);

  // Find linked CCTV device or fallback to first sample device
  const cctvDevice: CctvDevice | null = useMemo(() => {
    if (!targetModel) return null;
    if (targetModel.cctvId) {
      const found = getCctvById(targetModel.cctvId);
      if (found) return found;
    }
    // Fallback default sample device if not linked yet
    const fallbackList = getCctvList();
    return fallbackList[0] || null;
  }, [targetModel]);

  const isActuallyLinked = !!(targetModel?.cctvId && getCctvById(targetModel.cctvId));

  if (!activeModelId || !targetModel || !cctvDevice) return null;

  const handleClose = () => {
    setActiveCctvLiveModelId(null);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshKey(Date.now());
    setTimeout(() => setIsRefreshing(false), 300);
  };

  const handleFullscreen = () => {
    if (!viewportRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (viewportRef.current.requestFullscreen) {
      viewportRef.current.requestFullscreen().catch(() => {});
    }
  };

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.min(2.5, Math.max(1, +(prev + delta).toFixed(1))));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
  };

  const handleOpenEditMapping = () => {
    const modelId = targetModel.id;
    handleClose();
    useStore.getState().setActiveCctvMappingModelId(modelId);
  };

  const sampleImageSrc =
    cctvDevice.imageUrl || cctvDevice.videoUrl || "/assets/cctv_sample.jpg";

  return (
    <div
      className="cctv-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="cctv-modal-card cctv-live-container">
        {/* Header */}
        <div className="cctv-modal-header">
          <div className="cctv-header-title-box">
            <div className="cctv-header-icon-wrap cctv-header-icon-live">
              <Icon icon="mdi:cctv" width="24" height="24" />
            </div>
            <div>
              <div className="cctv-live-title-row">
                <h2 className="cctv-modal-title">{cctvDevice.name}</h2>
                <span className="cctv-live-pulse-badge">
                  <span className="cctv-pulse-dot" />
                  LIVE
                </span>
                {!isActuallyLinked && (
                  <span className="cctv-pill cctv-pill-amber">
                    샘플 화면 미리보기 (미연동)
                  </span>
                )}
              </div>
              <p className="cctv-modal-subtitle">
                {cctvDevice.location} &bull; IP: {cctvDevice.ip} &bull; {cctvDevice.resolution}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="cctv-btn-icon-close"
            onClick={handleClose}
            title="닫기"
          >
            <Icon icon="mdi:close" width="20" height="20" />
          </button>
        </div>

        {/* Notice banner if unlinked */}
        {!isActuallyLinked && (
          <div className="cctv-unlinked-banner">
            <Icon icon="mdi:information" width="18" height="18" className="cctv-banner-icon" />
            <span className="cctv-banner-text">
              현재 3D CCTV에 연동된 장비가 없어 기본 샘플 화면이 표시되고 있습니다.
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

        {/* Main Content Layout: Media (Left) + Details (Right) */}
        <div className="cctv-live-body">
          {/* Media Section */}
          <div className="cctv-video-section">
            <div
              ref={viewportRef}
              className={`cctv-video-viewport ${isRefreshing ? "cctv-viewport-refreshing" : ""}`}
            >
              <img
                src={sampleImageSrc}
                alt={cctvDevice.name}
                className="cctv-video-element"
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: "center center",
                  transition: "transform 0.2s ease-out",
                  userSelect: "none",
                  pointerEvents: "none",
                }}
              />

              {/* Video/Image On-Screen Display (OSD) Overlays */}
              <div className="cctv-osd cctv-osd-top-left">
                <span className="cctv-osd-rec">● LIVE</span>
                <span className="cctv-osd-text">{cctvDevice.id} [CAM 01]</span>
              </div>

              <div className="cctv-osd cctv-osd-top-right">
                <span className="cctv-osd-clock">{currentTime}</span>
              </div>

              <div className="cctv-osd cctv-osd-bottom-left">
                <span className="cctv-osd-meta">
                  {cctvDevice.resolution} @ {cctvDevice.fps}FPS | 4.2 Mbps
                </span>
              </div>

              <div className="cctv-osd cctv-osd-bottom-right">
                {zoomLevel > 1 && (
                  <span className="cctv-osd-zoom-badge">ZOOM {zoomLevel}x</span>
                )}
                <span className="cctv-osd-status">CH-01 [MAIN STREAM]</span>
              </div>
            </div>

            {/* Media Controls Bar */}
            <div className="cctv-video-controls">
              <div className="cctv-controls-left">
                <button
                  type="button"
                  className="cctv-ctrl-btn"
                  onClick={handleRefresh}
                  title="화면 새로고침"
                >
                  <Icon icon="mdi:refresh" width="18" height="18" />
                  <span>실시간 갱신</span>
                </button>
                <div className="cctv-pill cctv-pill-green" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span className="cctv-pulse-dot" />
                  <span>스트리밍 정상</span>
                </div>
              </div>

              <div className="cctv-controls-right">
                {/* PTZ Zoom Controls */}
                <div className="cctv-zoom-group">
                  <button
                    type="button"
                    className="cctv-ctrl-btn cctv-zoom-btn"
                    onClick={() => handleZoom(-0.2)}
                    disabled={zoomLevel <= 1}
                    title="축소"
                  >
                    <Icon icon="mdi:magnify-minus-outline" width="18" height="18" />
                  </button>
                  <button
                    type="button"
                    className="cctv-zoom-indicator"
                    onClick={handleResetZoom}
                    title="100% 리셋"
                  >
                    {Math.round(zoomLevel * 100)}%
                  </button>
                  <button
                    type="button"
                    className="cctv-ctrl-btn cctv-zoom-btn"
                    onClick={() => handleZoom(0.2)}
                    disabled={zoomLevel >= 2.5}
                    title="확대"
                  >
                    <Icon icon="mdi:magnify-plus-outline" width="18" height="18" />
                  </button>
                </div>

                <button
                  type="button"
                  className="cctv-ctrl-btn"
                  onClick={handleFullscreen}
                  title="전체화면"
                >
                  <Icon icon="material-symbols:fullscreen" width="20" height="20" />
                  <span>전체화면</span>
                </button>
              </div>
            </div>
          </div>

          {/* Details & Specifications Section */}
          <div className="cctv-details-section">
            <h3 className="cctv-section-title">
              <Icon icon="mdi:information" width="18" height="18" />
              장비 상세 제원
            </h3>

            <div className="cctv-spec-grid">
              <div className="cctv-spec-card">
                <span className="cctv-spec-label">장비 식별 번호</span>
                <span className="cctv-spec-value cctv-highlight">{cctvDevice.id}</span>
              </div>
              <div className="cctv-spec-card">
                <span className="cctv-spec-label">통신 상태</span>
                <span className="cctv-spec-value cctv-text-green">
                  ● 정상 (온라인)
                </span>
              </div>

              <div className="cctv-spec-card">
                <span className="cctv-spec-label">IP 주소 / 포트</span>
                <span className="cctv-spec-value">
                  {cctvDevice.ip}:{cctvDevice.port}
                </span>
              </div>
              <div className="cctv-spec-card">
                <span className="cctv-spec-label">해상도 / 프레임</span>
                <span className="cctv-spec-value">
                  {cctvDevice.resolution} / {cctvDevice.fps}fps
                </span>
              </div>

              <div className="cctv-spec-card">
                <span className="cctv-spec-label">제조사 / 모델</span>
                <span className="cctv-spec-value">
                  {cctvDevice.manufacturer} {cctvDevice.model}
                </span>
              </div>
              <div className="cctv-spec-card">
                <span className="cctv-spec-label">스트리밍 코덱</span>
                <span className="cctv-spec-value">{cctvDevice.codec || "H.264"}</span>
              </div>

              <div className="cctv-spec-card cctv-spec-card-full">
                <span className="cctv-spec-label">설치 위치</span>
                <span className="cctv-spec-value">{cctvDevice.location}</span>
              </div>

              {cctvDevice.rtspUrl && (
                <div className="cctv-spec-card cctv-spec-card-full">
                  <span className="cctv-spec-label">RTSP 스트리밍 주소</span>
                  <span className="cctv-spec-value cctv-spec-code">
                    {cctvDevice.rtspUrl}
                  </span>
                </div>
              )}

              <div className="cctv-spec-card">
                <span className="cctv-spec-label">설치 일자</span>
                <span className="cctv-spec-value">
                  {cctvDevice.installedDate || "2025-01-15"}
                </span>
              </div>
              <div className="cctv-spec-card">
                <span className="cctv-spec-label">PTZ 제어 지원</span>
                <span className="cctv-spec-value">
                  {cctvDevice.ptzSupport ? "지원됨 (ON)" : "고정형 (OFF)"}
                </span>
              </div>
            </div>

            {/* Network telemetry stats */}
            <h3 className="cctv-section-title comm-mt-16">
              <Icon icon="mdi:server-network" width="18" height="18" />
              네트워크 실시간 전송 지표
            </h3>
            <div className="cctv-telemetry-box">
              <div className="cctv-telemetry-item">
                <span className="cctv-telemetry-label">지연시간 (Latency)</span>
                <span className="cctv-telemetry-val cctv-text-green">14 ms</span>
              </div>
              <div className="cctv-telemetry-item">
                <span className="cctv-telemetry-label">패킷 손실률</span>
                <span className="cctv-telemetry-val cctv-text-green">0.0 %</span>
              </div>
              <div className="cctv-telemetry-item">
                <span className="cctv-telemetry-label">대역폭 점유</span>
                <span className="cctv-telemetry-val">4.2 Mbps</span>
              </div>
              <div className="cctv-telemetry-item">
                <span className="cctv-telemetry-label">인코딩 상태</span>
                <span className="cctv-telemetry-val cctv-text-green">HARDWARE (GPU)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="cctv-modal-footer">
          <div className="cctv-footer-left">
            <button
              type="button"
              className="cctv-btn cctv-btn-change-mapping"
              onClick={handleOpenEditMapping}
            >
              <Icon icon="mdi:link" width="16" height="16" />
              CCTV 연동 장비 변경
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
