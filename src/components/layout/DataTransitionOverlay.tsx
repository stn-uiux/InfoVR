import React from "react";
import { useStore } from "../../store/useStore";
import { Icon } from "@iconify/react";

/**
 * Fullscreen dimmed overlay with loading animation shown when transitioning
 * rooms, loading sample data, or loading STN testbed.
 */
export const DataTransitionOverlay: React.FC = () => {
  const isDataTransitioning = useStore((s) => s.isDataTransitioning);
  const dataTransitionMeta = useStore((s) => s.dataTransitionMeta);

  if (!isDataTransitioning || !dataTransitionMeta) return null;

  const { type, badge, title, desc, icon } = dataTransitionMeta;

  return (
    <div
      className="mode-transition-overlay data-transition-overlay"
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      <div className={`mode-transition-card data-transition-card ${type}`}>
        {/* Animated Tech Spinner with Center Icon */}
        <div className="mode-transition-spinner-container">
          <div className={`mode-transition-ring data-${type}`} />
          <div className="mode-transition-icon-wrap">
            <Icon
              icon={icon}
              className={`mode-transition-center-icon data-${type}-color`}
              style={{ width: "28px", height: "28px" }}
            />
          </div>
        </div>

        {/* Status Badge */}
        <div className={`mode-transition-badge data-${type}-badge`}>
          <span className="mode-transition-dot" />
          {badge}
        </div>

        {/* Text Details */}
        <div className="mode-transition-title">{title}</div>
        <div className="mode-transition-desc">{desc}</div>

        {/* Smooth Loading Track Bar */}
        <div className="mode-transition-progress-track">
          <div className={`mode-transition-progress-bar data-${type}-bar`} />
        </div>
      </div>
    </div>
  );
};
