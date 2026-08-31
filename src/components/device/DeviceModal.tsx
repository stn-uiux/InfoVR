import { useEffect, useState, useMemo, useRef, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from "../../store/useStore";
import { useShallow } from 'zustand/react/shallow';
import { useSvgComposer } from "../../hooks/useSvgComposer";
import { usePortInteraction } from "../../hooks/usePortInteraction";
import { ModulePopover } from "./ModulePopover";
import type { ModulePopoverData } from "./ModulePopover";
import type { EquipmentViewSide, InsertedModule, ModuleType } from "../../types/equipment";
import { moduleDefinitions } from "../../utils/moduleAssets";
import { getDeviceViewSides } from "../../utils/deviceAssets";
import type { Device, PortState } from "../../types";
import type { CustomEquipmentModel } from "../../types/equipment";
import { getEffectiveCards } from "../../utils/sampleUtils";
// ─── SvgPortView ─── (SVG 프리뷰 + 포트 상호작용)
const SvgPortView = memo(({ device, portStates, tooltipRef, editable, viewSide = "front", customModels }: {
  device: Device;
  portStates: PortState[];
  tooltipRef: React.RefObject<HTMLDivElement>;
  editable?: boolean;
  viewSide?: EquipmentViewSide;
  customModels: CustomEquipmentModel[];
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const { composedHtml, isModularDevice, generatedPorts, generatedPortMap } = useSvgComposer(
    device.modelName,
    getEffectiveCards(device, customModels),
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

// ─── GaugeChart ───
const GaugeChart = ({ label, value, unit, id, details, titleRightNode }: { label: string; value: number; unit: string; id: string; details?: React.ReactNode; titleRightNode?: React.ReactNode }) => {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = `${circumference / 2} ${circumference}`;
  const strokeDashoffset = ((100 - value) / 100) * (circumference / 2);
  
  let gradientId = `gauge-gradient-primary-${id}`;
  if (value > 85) gradientId = `gauge-gradient-critical-${id}`;
  else if (value > 70) gradientId = `gauge-gradient-warning-${id}`;

  return (
    <div className="perf-gauge-wrapper">
      <div className="perf-gauge-header">
        <div className="perf-gauge-label">{label}</div>
        {titleRightNode && <div className="perf-gauge-title-right">{titleRightNode}</div>}
      </div>
      <div className="perf-gauge-content-row">
        <div className="perf-gauge-chart-area">
          <svg className="perf-gauge" viewBox="0 0 100 55">
            <defs>
              <linearGradient id={`gauge-gradient-primary-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--theme-primary)" />
                <stop offset="100%" stopColor="var(--theme-secondary)" />
              </linearGradient>
              <linearGradient id={`gauge-gradient-warning-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#fbbf24" />
              </linearGradient>
              <linearGradient id={`gauge-gradient-critical-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#e03131" />
                <stop offset="100%" stopColor="#ff6b6b" />
              </linearGradient>
            </defs>
            {/* Background Track */}
            <path
              d="M 10 50 A 40 40 0 0 1 90 50"
              fill="none"
              stroke="var(--bg-tertiary)"
              strokeWidth="10"
              strokeLinecap="round"
            />
            {/* Value Track */}
            <path
              d="M 10 50 A 40 40 0 0 1 90 50"
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: "stroke-dashoffset 0.8s ease-out, stroke 0.8s" }}
            />
          </svg>
          <div className="perf-gauge-inner-text">
            <span className="perf-gauge-inner-val">{value.toFixed(1)}</span>
            <span className="perf-gauge-inner-unit">{unit}</span>
          </div>
        </div>
        <div className="perf-gauge-info">
          {!details && (
            <div className="perf-gauge-value-row">
              <span className="perf-gauge-value">{value.toFixed(1)}</span>
              <span className="perf-gauge-unit">{unit}</span>
            </div>
          )}
          {details && <div className="perf-gauge-details">{details}</div>}
        </div>
      </div>
    </div>
  );
};

// ─── DevicePerformanceWidget ───
const DevicePerformanceWidget = ({ device }: { device: Device }) => {
  const [data, setData] = useState({ 
    val1: 0, val2: 0, val3: 0, val4: 0, val5: 0,
    str1: '', str2: '', status: true
  });

  useEffect(() => {
    // Mock data animation
    const interval = setInterval(() => {
      setData(prev => ({
        val1: Math.min(100, Math.max(0, prev.val1 + (Math.random() * 10 - 5))),
        val2: Math.min(100, Math.max(0, prev.val2 + (Math.random() * 10 - 5))),
        val3: Math.min(100, Math.max(0, prev.val3 + (Math.random() * 10 - 5))),
        val4: Math.random() * 100,
        val5: Math.random() * 100,
        str1: (Math.random() * 5).toFixed(2),
        str2: (Math.random() * 1000).toFixed(0),
        status: Math.random() > 0.1
      }));
    }, 2000);
    // Init
    setData({
      val1: Math.random() * 100, val2: Math.random() * 100, val3: Math.random() * 100,
      val4: Math.random() * 100, val5: Math.random() * 100,
      str1: (Math.random() * 5).toFixed(2),
      str2: (Math.random() * 1000).toFixed(0),
      status: true
    });
    return () => clearInterval(interval);
  }, []);

  const typeLower = (device.type || "").toLowerCase();
  let category = "network";
  if (typeLower.includes("server") || typeLower.includes("host")) category = "server";
  else if (typeLower.includes("optical") || typeLower.includes("transmission") || typeLower.includes("wdm")) category = "optical";

  const renderProgressBar = (label: string, value: number, unit: string = "%") => {
    let colorClass = "";
    if (value > 85) colorClass = "critical";
    else if (value > 70) colorClass = "warning";
    
    return (
      <div className="perf-widget-item">
        <div className="perf-widget-label">
          <span>{label}</span>
          <span className="perf-widget-value">{value.toFixed(1)}{unit}</span>
        </div>
        <div className="perf-widget-bar-bg">
          <div className={`perf-widget-bar-fill ${colorClass}`} style={{ width: `${value}%` }} />
        </div>
      </div>
    );
  };

  const renderBox = (label: string, value: string | React.ReactNode) => (
    <div className="perf-widget-box">
      <span className="perf-widget-box-label">{label}</span>
      <span className="perf-widget-box-value">{value}</span>
    </div>
  );

  return (
    <div className="device-modal-perf-sidebar">
      <div className="perf-widget-header">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
        </svg>
        실시간 성능 지표
      </div>

      {category === "server" && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "16px" }}>
            <GaugeChart 
              id="cpu" 
              label="CPU 사용률" 
              titleRightNode={<span>코어 수: <strong style={{color: 'var(--text-primary)'}}>32 Cores</strong></span>}
              value={data.val1} 
              unit="%" 
              details={
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <div>
                    <div>User (프로세스)</div>
                    <strong style={{color: 'var(--text-primary)', fontSize: '13px'}}>{(data.val1 * 0.7).toFixed(1)} %</strong>
                  </div>
                  <div>
                    <div>System (OS)</div>
                    <strong style={{color: 'var(--text-primary)', fontSize: '13px'}}>{(data.val1 * 0.3).toFixed(1)} %</strong>
                  </div>
                </div>
              }
            />
          </div>
          {renderProgressBar("메모리 사용률", data.val2)}
          {renderProgressBar("디스크 사용률", data.val3)}
          
          <div className="perf-widget-grid">
            {renderBox("Load Avg", `${data.str1}, ${(parseFloat(data.str1)*0.8).toFixed(2)}, ${(parseFloat(data.str1)*0.6).toFixed(2)}`)}
            {renderBox("디스크 IOPS", `${data.str2} ops/s`)}
          </div>
          <div className="perf-widget-grid">
            {renderBox("가용성 (Uptime)", "99.99% (94d 12h)")}
            {renderBox("상태", <><span className={`perf-widget-status-indicator ${data.status ? 'up' : 'down'}`}/>{data.status ? '정상' : '경고'}</>)}
          </div>
        </>
      )}

      {category === "network" && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
            <GaugeChart 
              id="in" 
              label="In 대역폭" 
              titleRightNode={<span>총 대역폭: <strong style={{color: 'var(--text-primary)'}}>400.0 Gbps</strong></span>}
              value={data.val1} 
              unit="%" 
              details={
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <div>
                    <div>사용대역폭</div>
                    <strong style={{color: 'var(--text-primary)', fontSize: '13px'}}>{(400 * (data.val1/100)).toFixed(1)} Gbps</strong>
                  </div>
                  <div>
                    <div>가용대역폭</div>
                    <strong style={{color: 'var(--text-primary)', fontSize: '13px'}}>{(400 * ((100-data.val1)/100)).toFixed(1)} Gbps</strong>
                  </div>
                </div>
              }
            />
            <GaugeChart 
              id="out" 
              label="Out 대역폭" 
              titleRightNode={<span>총 대역폭: <strong style={{color: 'var(--text-primary)'}}>400.0 Gbps</strong></span>}
              value={data.val2} 
              unit="%" 
              details={
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <div>
                    <div>사용대역폭</div>
                    <strong style={{color: 'var(--text-primary)', fontSize: '13px'}}>{(400 * (data.val2/100)).toFixed(1)} Gbps</strong>
                  </div>
                  <div>
                    <div>가용대역폭</div>
                    <strong style={{color: 'var(--text-primary)', fontSize: '13px'}}>{(400 * ((100-data.val2)/100)).toFixed(1)} Gbps</strong>
                  </div>
                </div>
              }
            />
          </div>
          
          <div className="perf-widget-grid">
            {renderBox("패킷 처리량", `${(data.val4 * 10).toFixed(0)} pps`)}
            {renderBox("에러율 (Drops)", `${(data.val5 / 100).toFixed(2)}%`)}
          </div>
          <div className="perf-widget-grid">
            {renderBox("동시 세션 수", `${(parseFloat(data.str2) * 10).toFixed(0)}`)}
            {renderBox("링크 상태", <><span className={`perf-widget-status-indicator ${data.status ? 'up' : 'down'}`}/>{data.status ? 'Up (Active)' : 'Down'}</>)}
          </div>
        </>
      )}

      {category === "optical" && (
        <>
          {renderProgressBar("모듈 온도", data.val1, "°C")}
          {renderProgressBar("OSNR (광 신호 대 잡음비)", data.val2, " dB")}
          
          <div className="perf-widget-grid">
            {renderBox("Rx 광 수신 레벨", `-${(data.val3 / 10 + 10).toFixed(2)} dBm`)}
            {renderBox("Tx 광 송신 레벨", `${(data.val4 / 10).toFixed(2)} dBm`)}
          </div>
          <div className="perf-widget-grid">
            {renderBox("BER (비트 오차율)", `1.0E-${Math.floor(data.val5 / 10) + 6}`)}
            {renderBox("절체 상태 (APS)", <><span className={`perf-widget-status-indicator ${data.status ? 'up' : 'down'}`}/>{data.status ? '정상 (Working)' : '절체 (Protect)'}</>)}
          </div>
        </>
      )}
    </div>
  );
};


// ─── DeviceModal ───
export const DeviceModal = ({ deviceId, onClose }: { deviceId: string; onClose: () => void }) => {
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Store 셀렉터
  const { rawDevice, rackName, registeredDevice, customModels } = useStore(useShallow(useCallback((s) => {
    if (!deviceId) return { rawDevice: null, rackName: "", registeredDevice: null, customModels: s.customModels };
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
    return { rawDevice, rackName, registeredDevice, customModels: s.customModels };
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
    }
  }, [device, updateRegisteredDevice]);

  const handleRemoveModule = useCallback((portId: string, hitboxId?: string) => {
    setLocalModules(prev => prev.filter(m => hitboxId ? m.hitboxId !== hitboxId : m.portId !== portId));
    setModulePopover(null);

    if (device?.deviceId) {
      const currentModules = device.insertedModules || [];
      const updated = currentModules.filter(m => hitboxId ? m.hitboxId !== hitboxId : m.portId !== portId);
      
      // 1. 즉시 스토어 업데이트 (Undo 기록 생성)
      updateRegisteredDevice(device.deviceId, { insertedModules: updated });
    }
  }, [device, updateRegisteredDevice]);

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
        {/* Performance Sidebar */}
        <DevicePerformanceWidget device={device} />

        {/* Main Content */}
        <div className="device-modal-main">
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
                        customModels={customModels}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Active Faults */}
            <ActiveFaults portStates={devicePortStates} />
          </div>
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
