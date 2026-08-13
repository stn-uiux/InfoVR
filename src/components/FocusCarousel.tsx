import React from "react";
import { useStore } from "../store/useStore";
import { Icon } from "@iconify/react";
/**
 * FocusCarousel Component
 * Provides a navigation UI to cycle through focused racks in normal mode.
 * Scoped to the active node and its subtree.
 */
export const FocusCarousel: React.FC = () => {
  // Phase 2: 개별 셀렉터로 전환 — 전체 store 구독 제거
  const racks = useStore((s) => s.racks);
  const selectedRackId = useStore((s) => s.selectedRackId);
  const selectRack = useStore((s) => s.selectRack);
  const focusRack = useStore((s) => s.focusRack);
  const isEditMode = useStore((s) => s.isEditMode);
  const activeNodeId = useStore((s) => s.activeNodeId);
  const nodes = useStore((s) => s.nodes);

  // Filter racks rigidly by active node only
  const groupRacks = React.useMemo(() => {
    return racks.filter((r) => r.mapId === activeNodeId);
  }, [racks, activeNodeId]);

  // Requirements: Only visible in normal mode, when a rack is focused, and if more than one rack exists.
  if (isEditMode || !selectedRackId || groupRacks.length <= 1) return null;

  const currentIndex = groupRacks.findIndex((r) => r.rackId === selectedRackId);
  if (currentIndex === -1) return null;

  const handlePrev = () => {
    // Requirements: Wrap around to the last rack if at the first.
    const prevIndex =
      (currentIndex - 1 + groupRacks.length) % groupRacks.length;
    const targetId = groupRacks[prevIndex].rackId;
    selectRack(targetId);
    focusRack(targetId);
  };

  const handleNext = () => {
    // Requirements: Wrap around to the first rack if at the last.
    const nextIndex = (currentIndex + 1) % groupRacks.length;
    const targetId = groupRacks[nextIndex].rackId;
    selectRack(targetId);
    focusRack(targetId);
  };

  return (
    <div
      className="comm-panel"
      style={{
        position: "fixed",
        bottom: "32px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        gap: "var(--spacing-md)",
        padding: "var(--spacing-sm) var(--spacing-xl)",
        borderRadius: "40px",
        boxShadow: "var(--elevation-3)",
        border: "1px solid var(--panel-border)",
        background: "var(--panel-bg)",
        animation: "slideUp 0.3s ease-out",
      }}
    >
      {/* Previous Button */}
      <button
        className="comm-btn comm-btn-secondary"
        style={{
          borderRadius: "50%",
          width: "36px",
          height: "36px",
          padding: 0,
          minWidth: "36px",
          fontSize: "24px",
          border: "1px solid var(--border-weak)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onClick={handlePrev}
        title="Previous Rack"
      >
        <Icon icon="mdi:chevron-left" />
      </button>

      {/* Status Info */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          minWidth: "140px",
          userSelect: "none",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            color: "var(--text-tertiary)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            fontWeight: 700,
            marginBottom: "2px",
          }}
        >
          {groupRacks[currentIndex]?.rackTitle || `Rack ${groupRacks[currentIndex]?.rackId.slice(0, 4).toUpperCase()}`}
        </span>
        <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
          <span
            style={{
              fontSize: "var(--font-size-lg)",
              fontWeight: 700,
              color: "var(--theme-primary)",
            }}
          >
            {currentIndex + 1}
          </span>
          <span
            style={{
              fontSize: "var(--font-size-sm)",
              color: "var(--text-tertiary)",
            }}
          >
            / {groupRacks.length}
          </span>
        </div>
      </div>

      {/* Next Button */}
      <button
        className="comm-btn comm-btn-secondary"
        style={{
          borderRadius: "50%",
          width: "36px",
          height: "36px",
          padding: 0,
          minWidth: "36px",
          fontSize: "24px",
          border: "1px solid var(--border-weak)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onClick={handleNext}
        title="Next Rack"
      >
        <Icon icon="mdi:chevron-right" />
      </button>
    </div>
  );
};
