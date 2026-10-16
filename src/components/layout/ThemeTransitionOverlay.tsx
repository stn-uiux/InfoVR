import React from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { Icon } from "@iconify/react";

/**
 * Fullscreen dimmed overlay with loading animation shown when transitioning
 * between Dark Mode and Light Mode.
 */
export const ThemeTransitionOverlay: React.FC = () => {
  const { isThemeTransitioning, themeTransitionTarget } = useTheme();

  if (!isThemeTransitioning || !themeTransitionTarget) return null;

  const isEnteringDark = themeTransitionTarget === "dark";

  return (
    <div
      className="mode-transition-overlay"
      role="status"
      aria-live="polite"
      aria-label={isEnteringDark ? "다크 모드로 전환 중" : "라이트 모드로 전환 중"}
    >
      <div className="mode-transition-card">
        {/* Animated Tech Spinner with Center Icon */}
        <div className="mode-transition-spinner-container">
          <div
            className={`mode-transition-ring ${
              isEnteringDark ? "dark-theme" : "light-theme"
            }`}
          />
          <div className="mode-transition-icon-wrap">
            <Icon
              icon={
                isEnteringDark
                  ? "material-symbols:dark-mode-rounded"
                  : "material-symbols:light-mode-rounded"
              }
              className={`mode-transition-center-icon ${
                isEnteringDark ? "dark-color" : "light-color"
              }`}
              style={{ width: "28px", height: "28px" }}
            />
          </div>
        </div>

        {/* Status Badge */}
        <div
          className={`mode-transition-badge ${
            isEnteringDark ? "dark-badge" : "light-badge"
          }`}
        >
          <span className="mode-transition-dot" />
          {isEnteringDark ? "DARK MODE" : "LIGHT MODE"}
        </div>

        {/* Text Details */}
        <div className="mode-transition-title">
          {isEnteringDark ? "다크 모드로 전환 중..." : "라이트 모드로 전환 중..."}
        </div>
        <div className="mode-transition-desc">
          {isEnteringDark
            ? "다크 테마 환경 및 가상공간을 적용하고 있습니다"
            : "라이트 테마 환경 및 가상공간을 적용하고 있습니다"}
        </div>

        {/* Smooth Loading Track Bar */}
        <div className="mode-transition-progress-track">
          <div
            className={`mode-transition-progress-bar ${
              isEnteringDark ? "dark-bar" : "light-bar"
            }`}
          />
        </div>
      </div>
    </div>
  );
};
