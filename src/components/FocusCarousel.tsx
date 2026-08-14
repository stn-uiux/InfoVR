import React, { useState, useRef } from "react";
import { useStore } from "../store/useStore";
import { Icon } from "@iconify/react";
import { useClickOutside } from "../hooks/useClickOutside";
import { ERROR_COLORS } from "../utils/errorHelpers";
import { findNode } from "../utils/nodeUtils";
import type { Rack, Device, PortState } from "../types";

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

  const listRef = useRef<HTMLDivElement>(null);
  const [isListOpen, setIsListOpen] = useState(false);
  const [sortType, setSortType] = useState<'default' | 'name' | 'error'>('default');

  useClickOutside(listRef, isListOpen, () => setIsListOpen(false));

  const getRackErrorCounts = React.useCallback((rack: Rack) => {
    let critical = 0, major = 0, minor = 0, warning = 0;
    rack.devices.forEach((device: Device) => {
      device.portStates.forEach((port: PortState) => {
        if (port.status === "error") {
          if (port.errorLevel === "critical") critical++;
          else if (port.errorLevel === "major") major++;
          else if (port.errorLevel === "minor") minor++;
          else if (port.errorLevel === "warning") warning++;
        }
      });
    });
    return { critical, major, minor, warning, total: critical + major + minor + warning };
  }, []);

  const sortedPopoverRacks = React.useMemo(() => {
    const racks = [...groupRacks];
    if (sortType === 'name') {
      racks.sort((a, b) => {
        const nameA = a.rackTitle || `Rack ${a.rackId.slice(0, 4).toUpperCase()}`;
        const nameB = b.rackTitle || `Rack ${b.rackId.slice(0, 4).toUpperCase()}`;
        return nameA.localeCompare(nameB);
      });
    } else if (sortType === 'error') {
      racks.sort((a, b) => {
        const errA = getRackErrorCounts(a);
        const errB = getRackErrorCounts(b);
        if (errA.critical !== errB.critical) return errB.critical - errA.critical;
        if (errA.major !== errB.major) return errB.major - errA.major;
        if (errA.minor !== errB.minor) return errB.minor - errA.minor;
        if (errA.warning !== errB.warning) return errB.warning - errA.warning;
        return 0;
      });
    }
    return racks;
  }, [groupRacks, sortType, getRackErrorCounts]);

  // Requirements: Always visible in normal mode, even if no rack is focused.
  if (isEditMode) return null;

  const currentIndex = selectedRackId ? groupRacks.findIndex((r) => r.rackId === selectedRackId) : -1;

  const handlePrev = () => {
    if (groupRacks.length === 0) return;
    // Requirements: Wrap around to the last rack if at the first.
    const prevIndex = currentIndex === -1 ? groupRacks.length - 1 : (currentIndex - 1 + groupRacks.length) % groupRacks.length;
    const targetId = groupRacks[prevIndex].rackId;
    selectRack(targetId);
    focusRack(targetId);
  };

  const handleNext = () => {
    if (groupRacks.length === 0) return;
    // Requirements: Wrap around to the first rack if at the last.
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % groupRacks.length;
    const targetId = groupRacks[nextIndex].rackId;
    selectRack(targetId);
    focusRack(targetId);
  };

  return (
    <div
      ref={listRef}
      style={{
        position: "fixed",
        bottom: "32px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 100,
        animation: "slideUp 0.3s ease-out",
        display: "flex",
      }}
    >
      {/* 랙 리스트 팝오버 (backdrop-filter 버그 방지를 위해 comm-panel 밖으로 분리) */}
      {isListOpen && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 16px)",
            left: 0,
            background: "var(--panel-bg)",
            border: "1px solid var(--panel-border)",
            borderRadius: "12px",
            boxShadow: "var(--elevation-3)",
            width: "280px",
            maxHeight: "300px",
            display: "flex",
            flexDirection: "column",
            zIndex: 200,
            padding: "8px 0",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)"
          }}
        >
          {/* 정렬 헤더 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px 8px 16px', borderBottom: '1px solid var(--border-weak)', marginBottom: '4px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>랙 리스트</span>
            <select 
              value={sortType} 
              onChange={(e) => setSortType(e.target.value as any)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-tertiary)',
                fontSize: '11px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="default">랙등록순</option>
              <option value="name">랙명순</option>
              <option value="error">장애등급순</option>
            </select>
          </div>

          {/* 랙 목록 영역 (스크롤 가능) */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {sortedPopoverRacks.map((rack) => {
            const isCurrent = rack.rackId === selectedRackId;
            const errors = getRackErrorCounts(rack);
            return (
              <div
                key={rack.rackId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 16px",
                  cursor: "pointer",
                  background: isCurrent ? "rgba(26, 115, 232, 0.1)" : "transparent",
                  borderLeft: isCurrent ? "3px solid var(--theme-primary)" : "3px solid transparent",
                  transition: "background 0.2s",
                }}
                onClick={() => {
                  selectRack(rack.rackId);
                  focusRack(rack.rackId);
                  setIsListOpen(false);
                }}
                onMouseEnter={(e) => {
                  if (!isCurrent) e.currentTarget.style.background = "var(--hover-bg)";
                }}
                onMouseLeave={(e) => {
                  if (!isCurrent) e.currentTarget.style.background = "transparent";
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontSize: "13px", fontWeight: isCurrent ? 700 : 500, color: "var(--text-primary)" }}>
                    {rack.rackTitle || `Rack ${rack.rackId.slice(0, 4).toUpperCase()}`}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                    {rack.rackSize}U
                  </span>
                </div>
                {errors.total > 0 && (
                  <div style={{ display: "flex", gap: "4px" }}>
                    {errors.critical > 0 && (
                      <span style={{ background: ERROR_COLORS.critical, color: "#fff", fontSize: "10px", padding: "2px 6px", borderRadius: "10px", fontWeight: 700 }}>
                        C{errors.critical}
                      </span>
                    )}
                    {errors.major > 0 && (
                      <span style={{ background: ERROR_COLORS.major, color: "#fff", fontSize: "10px", padding: "2px 6px", borderRadius: "10px", fontWeight: 700 }}>
                        M{errors.major}
                      </span>
                    )}
                    {errors.minor > 0 && (
                      <span style={{ background: ERROR_COLORS.minor, color: "#fff", fontSize: "10px", padding: "2px 6px", borderRadius: "10px", fontWeight: 700 }}>
                        m{errors.minor}
                      </span>
                    )}
                    {errors.warning > 0 && (
                      <span style={{ background: ERROR_COLORS.warning, color: "#fff", fontSize: "10px", padding: "2px 6px", borderRadius: "10px", fontWeight: 700 }}>
                        W{errors.warning}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </div>
      )}

      <div
        className="comm-panel"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--spacing-sm)",
          padding: "var(--spacing-sm) var(--spacing-sm)",
          borderRadius: "40px",
          boxShadow: "var(--elevation-3)",
          border: "1px solid var(--panel-border)",
          background: "var(--panel-bg)",
        }}
      >
        <button
          className="comm-btn comm-btn-secondary"
          style={{
            borderRadius: "50%",
            width: "36px",
            height: "36px",
            padding: 0,
            minWidth: "36px",
            fontSize: "20px",
            border: "1px solid var(--border-weak)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: isListOpen ? "var(--theme-primary)" : "transparent",
            color: isListOpen ? "#fff" : "inherit",
          }}
          onClick={() => setIsListOpen((prev) => !prev)}
          title="랙 목록 보기"
        >
          <Icon icon="mdi:format-list-bulleted" />
        </button>


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
          minWidth: "200px",
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
          {currentIndex !== -1
            ? (groupRacks[currentIndex]?.rackTitle || `Rack ${groupRacks[currentIndex]?.rackId.slice(0, 4).toUpperCase()}`)
            : (activeNodeId ? findNode(nodes, activeNodeId)?.name || '전산실' : '전산실')}
        </span>
        <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
          {currentIndex !== -1 ? (
            <>
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
            </>
          ) : (
            <>
              <span
                style={{
                  fontSize: "var(--font-size-sm)",
                  color: "var(--text-tertiary)",
                }}
              >
                전체
              </span>
              <span
                style={{
                  fontSize: "var(--font-size-lg)",
                  fontWeight: 700,
                  color: "var(--theme-primary)",
                }}
              >
                {groupRacks.length}
              </span>
              <span
                style={{
                  fontSize: "var(--font-size-sm)",
                  color: "var(--text-tertiary)",
                }}
              >
                대
              </span>
            </>
          )}
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
    </div>
  );
};
