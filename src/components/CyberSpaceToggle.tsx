import { useStore } from "../store/useStore";
import { Icon } from "@iconify/react";

export const CyberSpaceToggle = () => {
  const cyberSpaceEnabled = useStore((s) => s.cyberSpaceEnabled);
  const csIsVisible = useStore((s) => s.csIsVisible);
  const toggleCsIsVisible = useStore((s) => s.toggleCsIsVisible);

  return (
    <div
      className={`cyber-space-toggle ${csIsVisible ? "active" : ""}`}
      onClick={() => {
        if (cyberSpaceEnabled) toggleCsIsVisible();
      }}
      role="button"
      tabIndex={cyberSpaceEnabled ? 0 : -1}
      onKeyDown={(e) => cyberSpaceEnabled && e.key === "Enter" && toggleCsIsVisible()}
      aria-label={`${csIsVisible ? "Hide" : "Show"} server room environment`}
      title={cyberSpaceEnabled ? (csIsVisible ? "가상 공간 뷰 끄기" : "가상 공간 뷰 켜기") : "가상 공간 사용 불가 (사이드 패널에서 켜주세요)"}
      style={{
        opacity: cyberSpaceEnabled ? 1 : 0.4,
        pointerEvents: cyberSpaceEnabled ? "auto" : "none",
        cursor: cyberSpaceEnabled ? "pointer" : "not-allowed"
      }}
    >
      <div className="cyber-space-toggle-knob">
        {csIsVisible ? (
          <Icon icon="ri:box-3-fill" width="13" height="13" />
        ) : (
          <Icon icon="mdi:cube-off-outline" width="13" height="13" />
        )}
      </div>
    </div>
  );
};
