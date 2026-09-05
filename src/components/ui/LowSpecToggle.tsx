import { useStore } from "../../store/useStore";
import { Icon } from "@iconify/react";

export const LowSpecToggle = () => {
  const csLowSpecMode = useStore((s) => s.csLowSpecMode);
  const setCyberSpaceConfig = useStore((s) => s.setCyberSpaceConfig);

  const toggleLowSpec = () => {
    setCyberSpaceConfig({ csLowSpecMode: !csLowSpecMode });
  };

  return (
    <div
      className={`low-spec-toggle ${csLowSpecMode ? 'active' : ''}`}
      onClick={toggleLowSpec}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && toggleLowSpec()}
      title={`저사양 모드 ${csLowSpecMode ? "끄기" : "켜기"}`}
    >
      <div className="low-spec-toggle-knob">
        <Icon
          icon="material-symbols:eco"
          className="icon"
          width="14"
          height="14"
        />
      </div>
    </div>
  );
};
