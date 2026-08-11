import { useEffect, useState, useMemo, useRef, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { useSvgComposer } from '../hooks/useSvgComposer';
import { usePortInteraction } from '../hooks/usePortInteraction';
import { ModulePopover } from './ModulePopover';
import type { ModulePopoverData } from './ModulePopover';
import type { EquipmentViewSide, InsertedModule, ModuleType } from '../types/equipment';
import { moduleDefinitions } from '../utils/moduleAssets';
import { getDeviceViewSides } from '../utils/deviceAssets';
import type { Device, PortState } from '../types';
// ─── SvgPortView ─── (SVG 프리뷰 + 포트 상호작용)
const SvgPortView = memo(({ device, portStates, tooltipRef, editable, viewSide = "front" }: {
  device: Device;
  portStates: PortState[];
  tooltipRef: React.RefObject<HTMLDivElement>;
  editable?: boolean;
  viewSide?: EquipmentViewSide;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const { composedHtml, isModularDevice, generatedPorts, generatedPortMap } = useSvgComposer(
    device.modelName,
    device.insertedCards || [],
    device.insertedModules || [],
    portStates,
    viewSide,
  );

  usePortInteraction(
    containerRef,
    tooltipRef,
    composedHtml,
    portStates,
    isModularDevice,
    generatedPorts,
    generatedPortMap,
    editable,
  );

  return (
    <div
      ref={containerRef}
      className="svg-port-view-container"
      data-view-side={viewSide}
      dangerouslySetInnerHTML={composedHtml ? { __html: composedHtml } : undefined}
    />
  );
});

// ─── DeviceModal ───
export const DeviceModal = ({ deviceId, onClose }: { deviceId: string; onClose: () => void }) => {
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Store 셀렉터
  const { rawDevice, rackName, registeredDevice } = useStore(useShallow(useCallback((s) => {
    if (!deviceId) return { rawDevice: null, rackName: "", registeredDevice: null };
    let rawDevice = null;
    let rackName = "";
    for (const r of s.racks) {
      const d = r.devices.find(d => d.itemId === deviceId || d.deviceId === deviceId);
      if (d) {
        rawDevice = d;
        rackName = r.rackTitle || `Rack ${r.rackId.slice(0, 4).toUpperCase()}`;
        break;
      }
    }
    const targetId = rawDevice?.deviceId || deviceId;
    const registeredDevice = s.registeredDevices.find(rd => rd.deviceId === targetId) || null;
    return { rawDevice, rackName, registeredDevice };
  }, [deviceId])));

  const updateRegisteredDevice = useStore((s) => s.updateRegisteredDevice);

  const device = rawDevice as Device | null;

  const devicePortStates = useMemo(() => device?.portStates || [], [device]);

  // ─── 모듈 상태 관리 ───
  const [modulePopover, setModulePopover] = useState<ModulePopoverData | null>(null);
  const [localModules, setLocalModules] = useState<InsertedModule[]>([]);
  const isEditMode = useStore(s => s.isEditMode);

  const deviceInsertedModules = device?.insertedModules;
  const deviceInsertedModulesKey = useMemo(
    () => JSON.stringify(deviceInsertedModules || []),
    [deviceInsertedModules],
  );

  useEffect(() => {
    const storeModules = deviceInsertedModules || [];
    // 내용이 동일하면 불필요한 재렌더 방지
    setLocalModules(prev => {
      const prevKey = JSON.stringify(prev);
      return prevKey === deviceInsertedModulesKey ? prev : storeModules;
    });
  }, [device?.itemId, deviceInsertedModules, deviceInsertedModulesKey]);

  const deviceWithModules = useMemo(() => {
    if (!device) return null;
    return { ...device, insertedModules: localModules };
  }, [device, localModules]);

  // ─── 팝오버 이벤트 수신 ───
  const svgContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = svgContainerRef.current;
    if (!container) return;
    const handlePopover = (e: Event) => setModulePopover((e as CustomEvent).detail);
    container.addEventListener("port-module-popover", handlePopover);
    return () => container.removeEventListener("port-module-popover", handlePopover);
  }, []);

  // ─── 썸네일 생성 ───
  const generateThumbnail = useCallback(async (): Promise<string> => {
    if (!svgContainerRef.current) return "";
    try {
      const preferredSide = device?.defaultViewSide || registeredDevice?.defaultViewSide || "front";
      const svgEl =
        svgContainerRef.current.querySelector(`[data-view-side="${preferredSide}"] svg`) ||
        svgContainerRef.current.querySelector("svg");
      if (!svgEl) return "";

      const clonedSvg = svgEl.cloneNode(true) as SVGElement;
      const vb = clonedSvg.getAttribute("viewBox") || "0 0 984 200";
      const parts = vb.split(/\s+/).map(Number);
      clonedSvg.setAttribute("width", (parts[2] || 984).toString());
      clonedSvg.setAttribute("height", (parts[3] || 200).toString());

      const svgStr = new XMLSerializer().serializeToString(clonedSvg);
      const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = url;
      });

      const SCALE = 2;
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth * SCALE;
      canvas.height = img.naturalHeight * SCALE;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL("image/webp", 0.8);
      URL.revokeObjectURL(url);
      return dataUrl;
    } catch (e) {
      console.error("[DeviceModal] Failed to generate thumbnail:", e);
      return "";
    }
  }, [device?.defaultViewSide, registeredDevice?.defaultViewSide]);

  // 팝오버 외부 클릭 시 닫기
  useEffect(() => {
    if (!modulePopover) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".module-popover, .port-hitbox, [id*='port-'], [id^='p']")) return;
      setModulePopover(null);
    };
    const timer = setTimeout(() => {
      window.addEventListener("click", handleClickOutside, { capture: true });
    }, 50);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("click", handleClickOutside, { capture: true });
    };
  }, [modulePopover]);

  // ─── 모듈 삽입/제거 ───
  const handleInsertModule = useCallback((portId: string, moduleType: ModuleType, hitboxId?: string) => {
    const moduleDef = moduleDefinitions.find(m => m.moduleType === moduleType);
    if (!moduleDef) return;

    const newModule: InsertedModule = {
      portId,
      moduleType,
      moduleSvgFileName: moduleDef.svgFileName,
      hitboxId,
    };

    setLocalModules(prev => {
      const filtered = prev.filter(m => hitboxId ? m.hitboxId !== hitboxId : m.portId !== portId);
      return [...filtered, newModule];
    });
    setModulePopover(null);

    if (device?.deviceId) {
      const currentModules = device.insertedModules || [];
      const updated = [...currentModules.filter(m => hitboxId ? m.hitboxId !== hitboxId : m.portId !== portId), newModule];
      
      // 1. 즉시 스토어 업데이트 (Undo 기록 생성)
      updateRegisteredDevice(device.deviceId, { insertedModules: updated });
      
      // 2. 비동기로 썸네일 생성 및 업데이트 (Undo 스킵)
      // SVG 합성 완료를 기다리기 위해 충분한 지연 시간 확보
      setTimeout(() => {
        generateThumbnail().then(thumbUrl => {
          if (thumbUrl) {
            updateRegisteredDevice(device.deviceId!, { dashboardThumbnailUrl: thumbUrl }, true);
          }
        });
      }, 500);
    }
  }, [device, generateThumbnail, updateRegisteredDevice]);

  const handleRemoveModule = useCallback((portId: string, hitboxId?: string) => {
    setLocalModules(prev => prev.filter(m => hitboxId ? m.hitboxId !== hitboxId : m.portId !== portId));
    setModulePopover(null);

    if (device?.deviceId) {
      const currentModules = device.insertedModules || [];
      const updated = currentModules.filter(m => hitboxId ? m.hitboxId !== hitboxId : m.portId !== portId);
      
      // 1. 즉시 스토어 업데이트 (Undo 기록 생성)
      updateRegisteredDevice(device.deviceId, { insertedModules: updated });
      
      // 2. 비동기로 썸네일 생성 및 업데이트 (Undo 스킵)
      // SVG 합성 완료를 기다리기 위해 충분한 지연 시간 확보
      setTimeout(() => {
        generateThumbnail().then(thumbUrl => {
          if (thumbUrl) {
            updateRegisteredDevice(device.deviceId!, { dashboardThumbnailUrl: thumbUrl }, true);
          }
        });
      }, 500);
    }
  }, [device, generateThumbnail, updateRegisteredDevice]);

  const getModuleForPort = useCallback((portId: string, hitboxId?: string) => {
    return localModules.find(m => hitboxId ? m.hitboxId === hitboxId : m.portId === portId);
  }, [localModules]);

  if (!device || !deviceWithModules) return null;

  const existingModule = modulePopover ? getModuleForPort(modulePopover.portId, modulePopover.hitboxId) : undefined;

  const displayVendor = device.vendor || registeredDevice?.vendor;
  const displayModel = device.modelName || registeredDevice?.modelName;
  const displayIp = device.IPAddr || registeredDevice?.IPAddr;
  const displayMac = device.macAddr || registeredDevice?.macAddr;
  const viewSides = getDeviceViewSides(displayModel);
  const modalViewSides = viewSides.length > 0 ? viewSides : ["front" as EquipmentViewSide];
  const defaultViewSide = device.defaultViewSide || registeredDevice?.defaultViewSide || "front";

  return createPortal(
    <div className="device-modal-overlay" onClick={onClose}>
      <div className="device-modal-content" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="device-modal-header">
          <div className="device-modal-header-inner">
            <div className="device-modal-title-row">
              <h2 className="device-modal-title">{device.title}</h2>
              <button className="device-modal-close" onClick={onClose}>×</button>
            </div>
            <div className="device-modal-meta">
              <span className="device-type-badge">{device.type || "Router"}</span>
              <span className="device-rack-info">Rack: {rackName || device.rackId || "Unknown"}</span>
              {displayVendor && <span className="device-rack-info">Vendor: {displayVendor}</span>}
              {displayModel && <span className="device-rack-info">Model: {displayModel}</span>}
              {displayIp && <span className="device-rack-info">IP: {displayIp}</span>}
              {displayMac && <span className="device-rack-info">MAC: {displayMac}</span>}
              {localModules.length > 0 && (
                <span className="module-count-badge">모듈 {localModules.length}개</span>
              )}
            </div>
          </div>
          <div className="device-modal-divider" />
        </div>

        {/* Body */}
        <div className="device-modal-body">
          <div className="device-modal-svg-area">
            <div ref={svgContainerRef} className="device-modal-svg-wrap">
              <div className={`device-modal-view-grid ${modalViewSides.length > 1 ? "two-sided" : ""}`}>
                {modalViewSides.map((side) => (
                  <div
                    key={side}
                    className={`device-modal-view-panel ${defaultViewSide === side ? "is-default" : ""}`}
                  >
                    <div className="device-modal-view-label">
                      <span>{side === "front" ? "앞면" : "뒷면"}</span>
                      {defaultViewSide === side && <strong>기본</strong>}
                    </div>
                    <SvgPortView
                      device={deviceWithModules}
                      portStates={devicePortStates}
                      tooltipRef={tooltipRef as React.RefObject<HTMLDivElement>}
                      editable={isEditMode}
                      viewSide={side}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Active Faults */}
          <ActiveFaults portStates={devicePortStates} />
        </div>

        <div ref={tooltipRef} className="device-modal-tooltip" />
      </div>

      {/* Module Popover */}
      {modulePopover && (
        <ModulePopover
          popover={modulePopover}
          existingModule={existingModule}
          onInsert={handleInsertModule}
          onRemove={handleRemoveModule}
        />
      )}
    </div>,
    document.body
  );
};

// ─── ActiveFaults 서브컴포넌트 ───
const ActiveFaults = ({ portStates }: { portStates: PortState[] }) => {
  const errorPorts = portStates.filter((p) => p.status === "error");
  if (errorPorts.length === 0) return null;

  return (
    <div className="active-faults">
      <h4>Active Faults</h4>
      <div className="active-faults-list">
        {errorPorts.map((err, idx) => {
          const level = err.errorLevel || err.status || "error";
          const chipClass =
            level === "critical" ? "comm-chip-critical" :
            level === "major" ? "comm-chip-major" :
            level === "minor" ? "comm-chip-minor" :
            level === "warning" ? "comm-chip-warning" : "comm-chip-critical";

          return (
            <div key={idx} className="active-fault-item">
              <strong>{err.portId}</strong>
              <span>{err.errorMessage || "Unknown Error"}</span>
              {level && (
                <span className={`comm-chip ${chipClass}`}>{level}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
