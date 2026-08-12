import { useStore } from "../store/useStore";
import { Icon } from "@iconify/react";

export const CyberSpaceToggle = () => {
  const cyberSpaceEnabled = useStore((s) => s.cyberSpaceEnabled);
  const toggleCyberSpace = useStore((s) => s.toggleCyberSpace);

  return (
    <div
      className={`cyber-space-toggle ${cyberSpaceEnabled ? "active" : ""}`}
      onClick={toggleCyberSpace}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && toggleCyberSpace()}
      aria-label={`${cyberSpaceEnabled ? "Disable" : "Enable"} server room environment`}
      title={cyberSpaceEnabled ? "서버룸 환경 OFF" : "서버룸 환경 ON"}
    >
      <div className="cyber-space-toggle-knob">
        {cyberSpaceEnabled ? (
          <Icon icon="mdi:server" width="13" height="13" />
        ) : (
          <Icon icon="mdi:server-off" width="13" height="13" />
        )}
      </div>
    </div>
  );
};
