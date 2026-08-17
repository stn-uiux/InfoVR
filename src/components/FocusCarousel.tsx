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
    setIsListOpen(false);
  };

  const handleNext = () => {
    if (groupRacks.length === 0) return;
    // Requirements: Wrap around to the first rack if at the last.
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % groupRacks.length;
    const targetId = groupRacks[nextIndex].rackId;
    selectRack(targetId);
    focusRack(targetId);
    setIsListOpen(false);
  };

  return (
    <div
      ref={listRef}
      className="focus-carousel-wrapper"
    >
      {/* 랙 리스트 팝오버 (backdrop-filter 버그 방지를 위해 comm-panel 밖으로 분리) */}
      {isListOpen && (
        <div
          className="focus-carousel-popover"
        >
          {/* 정렬 헤더 */}
          <div className="focus-list-header">
            <span className="focus-list-title">랙 리스트</span>
            <select
              value={sortType}
              onChange={(e) => setSortType(e.target.value as any)}
              className="focus-list-select"
            >
              <option value="default">랙등록순</option>
              <option value="name">랙명순</option>
              <option value="error">장애등급순</option>
            </select>
          </div>

          {/* 랙 목록 영역 (스크롤 가능) */}
          <div className="focus-list-body">
            {sortedPopoverRacks.map((rack) => {
              const isCurrent = rack.rackId === selectedRackId;
              const errors = getRackErrorCounts(rack);
              return (
                <div
                  key={rack.rackId}
                  className={`focus-list-item ${isCurrent ? 'is-current' : ''}`}
                  onClick={() => {
                    selectRack(rack.rackId);
                    focusRack(rack.rackId);
                    setIsListOpen(false);
                  }}
                  onMouseEnter={() => { }}
                  onMouseLeave={() => { }}
                >
                  <div className="focus-item-info">
                    <span className="focus-item-title">
                      {rack.rackTitle || `Rack ${rack.rackId.slice(0, 4).toUpperCase()}`}
                    </span>
                    <span className="focus-item-size">
                      {rack.rackSize}U
                    </span>
                  </div>
                  {errors.total > 0 && (
                    <div className="focus-item-errors">
                      {errors.critical > 0 && (
                        <span className="focus-error-badge" style={{ background: ERROR_COLORS.critical }}>
                          C{errors.critical}
                        </span>
                      )}
                      {errors.major > 0 && (
                        <span className="focus-error-badge" style={{ background: ERROR_COLORS.major }}>
                          M{errors.major}
                        </span>
                      )}
                      {errors.minor > 0 && (
                        <span className="focus-error-badge" style={{ background: ERROR_COLORS.minor }}>
                          m{errors.minor}
                        </span>
                      )}
                      {errors.warning > 0 && (
                        <span className="focus-error-badge" style={{ background: ERROR_COLORS.warning }}>
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

      <div className="comm-panel focus-nav-container">
        <button
          className={`focus-nav-btn ${isListOpen ? 'is-active' : ''}`}
          onClick={() => setIsListOpen((prev) => !prev)}
          title="랙 목록 보기"
        >
          <Icon icon="mdi:format-list-bulleted" />
        </button>


        {/* Previous Button */}
        <button
          className="focus-nav-btn"
          onClick={handlePrev}
          title="Previous Rack"
        >
          <Icon icon="mdi:chevron-left" />
        </button>

        {/* Status Info */}
        <div className="focus-status-wrapper">
          <span className="focus-status-title">
            {currentIndex !== -1
              ? (groupRacks[currentIndex]?.rackTitle || `Rack ${groupRacks[currentIndex]?.rackId.slice(0, 4).toUpperCase()}`)
              : (activeNodeId ? findNode(nodes, activeNodeId)?.name || '전산실' : '전산실')}
          </span>
          <div className="focus-status-numbers">
            {currentIndex !== -1 ? (
              <>
                <span className="focus-num-primary">
                  {currentIndex + 1}
                </span>
                <span className="focus-num-secondary">
                  / {groupRacks.length}
                </span>
              </>
            ) : (
              <>
                <span className="focus-num-secondary">
                  전체
                </span>
                <span className="focus-num-primary">
                  {groupRacks.length}
                </span>
                <span className="focus-num-secondary">
                  대
                </span>
              </>
            )}
          </div>
        </div>

        {/* Next Button */}
        <button
          className="focus-nav-btn"
          onClick={handleNext}
          title="Next Rack"
        >
          <Icon icon="mdi:chevron-right" />
        </button>
      </div>
    </div>
  );
};
