import React from "react";
import { useStore } from "../../store/useStore";
import { Icon } from "@iconify/react";

/**
 * Fullscreen dimmed overlay with loading animation shown when transitioning
 * between Edit Mode ON and OFF.
 */
export const ModeTransitionOverlay: React.FC = () => {
  const isModeTransitioning = useStore((s) => s.isModeTransitioning);
  const modeTransitionTarget = useStore((s) => s.modeTransitionTarget);

  if (!isModeTransitioning) return null;

  const isEnteringEdit = modeTransitionTarget === true;

  return (
    <div
      className="mode-transition-overlay"
      role="status"
      aria-live="polite"
      aria-label={isEnteringEdit ? "에디트 모드로 전환 중" : "조회 모드로 전환 중"}
    >
      <div className="mode-transition-card">
        {/* Animated Tech Spinner with Center Icon */}
        <div className="mode-transition-spinner-container">
          <div
            className={`mode-transition-ring ${
              isEnteringEdit ? "edit-mode" : "view-mode"
            }`}
          />
          <div className="mode-transition-icon-wrap">
            <Icon
              icon={isEnteringEdit ? "mdi:cube-outline" : "mdi:cube-off-outline"}
              className={`mode-transition-center-icon ${
                isEnteringEdit ? "edit-color" : "view-color"
              }`}
            />
          </div>
        </div>

        {/* Status Badge */}
        <div
          className={`mode-transition-badge ${
            isEnteringEdit ? "edit-badge" : "view-badge"
          }`}
        >
          <span className="mode-transition-dot" />
          {isEnteringEdit ? "EDIT MODE" : "VIEW MODE"}
        </div>

        {/* Text Details */}
        <div className="mode-transition-title">
          {isEnteringEdit ? "에디트 모드로 전환 중..." : "조회 모드로 전환 중..."}
        </div>
        <div className="mode-transition-desc">
          {isEnteringEdit
            ? "3D 편집 환경 및 그리드를 불러오고 있습니다"
            : "가상공간 렌더링 환경을 준비하고 있습니다"}
        </div>

        {/* Smooth Loading Track Bar */}
        <div className="mode-transition-progress-track">
          <div
            className={`mode-transition-progress-bar ${
              isEnteringEdit ? "edit-bar" : "view-bar"
            }`}
          />
        </div>
      </div>
    </div>
  );
};
