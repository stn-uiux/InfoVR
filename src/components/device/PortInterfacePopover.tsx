import { useMemo, useRef, useLayoutEffect, useState } from 'react';

import type { PortState } from '../../types';

export interface PortInfoData {
  portId: string;
  portType: string;
  hitboxId?: string;
  x: number;
  y: number;
  portState?: PortState;
}

export interface PortInterfacePopoverProps {
  info: PortInfoData;
  portStates?: PortState[];
  onClose: () => void;
}

export const PortInterfacePopover = ({
  info,
  portStates,
  onClose,
}: PortInterfacePopoverProps) => {
  // 포트 상태 매칭 (직접 전달된 portState 우선, 없으면 다양한 ID 포맷으로 검색)
  const pState = useMemo(() => {
    if (info.portState) return info.portState;
    if (!portStates || portStates.length === 0) return undefined;

    // 1. 정확한 portId 또는 portNumber 일치
    let found = portStates.find(p => p.portId === info.portId || p.portNumber === info.portId);
    if (found) return found;

    // 2. hitboxId 일치
    if (info.hitboxId) {
      found = portStates.find(p => p.portId === info.hitboxId || p.portNumber === info.hitboxId);
      if (found) return found;
    }

    // 3. 접두사 제거 비교 (예: port-5 vs 5, eth-5 vs 5, sfp-5 vs 5)
    const cleanInfoId = info.portId.replace(/^(port|eth|sfp|qsfp)-/i, "");
    found = portStates.find(p => {
      const cleanPId = p.portId.replace(/^(port|eth|sfp|qsfp)-/i, "");
      return cleanPId === cleanInfoId;
    });
    if (found) return found;

    // 4. hitboxId 접두사 제거 비교
    if (info.hitboxId) {
      const cleanHitboxId = info.hitboxId.replace(/^(port|eth|sfp|qsfp)-/i, "");
      found = portStates.find(p => {
        const cleanPId = p.portId.replace(/^(port|eth|sfp|qsfp)-/i, "");
        return cleanPId === cleanHitboxId;
      });
      if (found) return found;
    }

    // 5. 슬래시(/) 포함 모듈러 포트 매칭 (예: 1/1/port-5 또는 1/1/5)
    if (info.portId.includes("/")) {
      const infoParts = info.portId.split("/");
      const lastInfo = infoParts[infoParts.length - 1].replace(/^(port|eth|sfp|qsfp)-/i, "");
      found = portStates.find(p => {
        if (!p.portId.includes("/")) return false;
        const pParts = p.portId.split("/");
        const lastP = pParts[pParts.length - 1].replace(/^(port|eth|sfp|qsfp)-/i, "");
        return infoParts.slice(0, -1).join("/") === pParts.slice(0, -1).join("/") && lastInfo === lastP;
      });
      if (found) return found;
    }

    // 6. 끝자리 숫자 매칭 fallback (예: 둘 다 5번 포트)
    const infoNumMatch = info.portId.match(/(\d+)$/);
    if (infoNumMatch) {
      const infoNum = infoNumMatch[1];
      found = portStates.find(p => {
        const pNumMatch = p.portId.match(/(\d+)$/);
        return pNumMatch && pNumMatch[1] === infoNum;
      });
      if (found) return found;
    }

    return undefined;
  }, [info, portStates]);

  const isFault = pState && pState.status !== "normal";
  const faultLevel = isFault ? (pState.errorLevel || pState.status || "critical").toLowerCase() : "normal";

  // 사용자 지정 색상 맵: critical(빨강), major(주황), minor(노랑), warning(파랑), 정상(초록)
  const SEVERITY_COLORS: Record<string, { color: string; bg: string; border: string }> = {
    critical: {
      color: "#ef4444",
      bg: "rgba(239, 68, 68, 0.08)",
      border: "rgba(239, 68, 68, 0.3)",
    },
    major: {
      color: "#f97316",
      bg: "rgba(249, 115, 22, 0.08)",
      border: "rgba(249, 115, 22, 0.3)",
    },
    minor: {
      color: "#eab308",
      bg: "rgba(234, 179, 8, 0.08)",
      border: "rgba(234, 179, 8, 0.3)",
    },
    warning: {
      color: "#3b82f6",
      bg: "rgba(59, 130, 246, 0.08)",
      border: "rgba(59, 130, 246, 0.3)",
    },
    normal: {
      color: "#00b11f",
      bg: "rgba(0, 177, 31, 0.08)",
      border: "rgba(0, 177, 31, 0.3)",
    },
  };

  const severityConfig = SEVERITY_COLORS[faultLevel] || SEVERITY_COLORS.critical;

  // Generate stable mock data based on portId
  const mockData = useMemo(() => {
    // simple hash
    let hash = 0;
    for (let i = 0; i < info.portId.length; i++) hash = hash + info.portId.charCodeAt(i);
    
    const random = (seed: number) => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };
    
    const totalBandwidth = 10000; // Gbps
    const usagePercent = 20 + random(hash) * 60; // 20% ~ 80%
    const usedBandwidth = totalBandwidth * (usagePercent / 100);
    const availableBandwidth = totalBandwidth - usedBandwidth;
    
    const connections = [
      "인천시청(주)", "해양경찰청#1", "정부과천청사", "국가정보자원관리원", "한국전력공사"
    ];
    
    return {
      ip: `25.9.${Math.floor(random(hash+1)*255)}.${Math.floor(random(hash+2)*255)}`,
      remoteName: connections[Math.floor(random(hash+3) * connections.length)],
      remotePort: `p1/${Math.floor(random(hash+4)*5)+1}/${Math.floor(random(hash+5)*48)+1}`,
      totalBandwidth,
      usagePercent,
      usedBandwidth,
      availableBandwidth
    };
  }, [info.portId]);

  const popoverRef = useRef<HTMLDivElement>(null);

  // 예상 높이: 약 280~320px. 위쪽에 320px 공간이 없으면 아래쪽에 띄우도록 기본값 설정
  const initialPlaceBelow = info.y < 320;
  const [placement, setPlacement] = useState<{
    top: number;
    left: number;
  }>({
    left: info.x,
    top: initialPlaceBelow ? info.y + 24 : Math.max(16, info.y - 300),
  });

  useLayoutEffect(() => {
    const el = popoverRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const popW = rect.width || 420;
    const popH = rect.height || 280;

    const vh = window.innerHeight;
    const vw = window.innerWidth;

    // 포트 위/아래 공간
    const spaceAbove = info.y - 16;
    const spaceBelow = vh - info.y - 16;

    // 위쪽 공간이 팝오버 높이 + 여백보다 부족하면 아래쪽에 띄움
    let placeBelow = spaceAbove < (popH + 16);
    // 아래쪽 공간도 부족한데 위쪽 공간이 더 넓다면 위쪽 선택
    if (placeBelow && spaceBelow < (popH + 16) && spaceAbove > spaceBelow) {
      placeBelow = false;
    }

    let top = placeBelow ? info.y + 20 : info.y - popH - 12;

    // 뷰포트 상/하단 클램핑 (화면 밖으로 절대 잘리지 않도록 보정)
    if (top < 16) {
      top = 16;
    } else if (top + popH > vh - 16) {
      top = Math.max(16, vh - popH - 16);
    }

    // 뷰포트 좌/우측 클램핑
    const margin = 16;
    const clampedLeft = Math.max(popW / 2 + margin, Math.min(vw - popW / 2 - margin, info.x));

    setPlacement({
      top,
      left: clampedLeft,
    });
  }, [info.x, info.y, isFault]);

  return (
    <div
      ref={popoverRef}
      className="port-info-popover comm-panel"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        left: placement.left,
        top: placement.top,
        transform: "translate(-50%, 0)",
        zIndex: 11000,
        padding: "16px",
        minWidth: "400px",
        pointerEvents: "auto",
        animation: "eam-fi .15s ease-out",
        display: "flex",
        flexDirection: "column",
        gap: "16px"
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ 
            color: severityConfig.color, 
            backgroundColor: isFault ? severityConfig.bg : 'var(--hover-bg)',
            border: isFault ? `1px solid ${severityConfig.border}` : '1px solid transparent',
            padding: '8px',
            borderRadius: '8px',
            display: 'flex',
            transition: 'all 0.2s ease'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="16" y="16" width="6" height="6" rx="1" />
              <rect x="2" y="16" width="6" height="6" rx="1" />
              <rect x="9" y="2" width="6" height="6" rx="1" />
              <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" />
              <path d="M12 12V8" />
            </svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-primary)', letterSpacing: '0.5px' }}>
                {info.portId}
              </div>
              {isFault && (
                <span 
                  className={`comm-chip comm-chip-${faultLevel}`} 
                  style={{ 
                    fontSize: '10px', 
                    padding: '1px 6px', 
                    textTransform: 'uppercase',
                    color: severityConfig.color,
                    backgroundColor: severityConfig.bg,
                    borderColor: severityConfig.border
                  }}
                >
                  {faultLevel}
                </span>
              )}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {mockData.ip}
            </div>
          </div>
        </div>
        <button 
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
          </svg>
        </button>
      </div>
      
      <div style={{ 
        backgroundColor: 'var(--panel-in-bg)', 
        borderRadius: '6px', 
        padding: '12px 16px',
        border: '1px solid var(--border-weak)'
      }}>
        <div style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span style={{ color: 'var(--theme-primary)', fontWeight: 'bold' }}>{mockData.remoteName}</span>
          <span style={{ color: 'var(--text-secondary)' }}>{mockData.remotePort}</span>
          <span style={{ color: '#00b11f', margin: '0 4px' }}>↔</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>현재장비</span>
          <span style={{ color: 'var(--text-secondary)' }}>{info.portId}</span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px', alignItems: 'center' }}>
          <div style={{ color: 'var(--text-secondary)' }}>총 대역폭 <span style={{ color: 'var(--text-primary)', marginLeft: '4px', fontWeight: '600' }}>{mockData.totalBandwidth.toFixed(1)} Gbps</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>사용률</span>
            <div style={{ width: '80px', height: '6px', backgroundColor: 'var(--border-medium)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${mockData.usagePercent}%`, height: '100%', backgroundColor: 'var(--theme-primary)', borderRadius: '3px' }} />
            </div>
            <span style={{ color: 'var(--theme-primary)', fontWeight: 'bold' }}>{mockData.usagePercent.toFixed(1)}%</span>
          </div>
        </div>
        
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          사용대역폭 <span style={{ color: 'var(--theme-primary)', margin: '0 4px', fontWeight: 'bold' }}>{mockData.usedBandwidth.toFixed(1)} Gbps</span> / 
          가용대역폭 <span style={{ color: '#00b11f', margin: '0 4px', fontWeight: 'bold' }}>{mockData.availableBandwidth.toFixed(1)} Gbps</span>
        </div>
      </div>

      {isFault && (
        <div style={{
          backgroundColor: severityConfig.bg,
          borderRadius: '6px', 
          padding: '12px 16px',
          border: `1px solid ${severityConfig.border}`,
          borderLeft: `4px solid ${severityConfig.color}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ 
                display: 'inline-block', 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                backgroundColor: severityConfig.color,
                boxShadow: `0 0 6px ${severityConfig.color}`
              }} />
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)' }}>Active Fault</span>
            </div>
            <span 
              className={`comm-chip comm-chip-${faultLevel}`} 
              style={{ 
                textTransform: 'uppercase', 
                fontSize: '10px', 
                padding: '2px 6px',
                color: severityConfig.color,
                backgroundColor: severityConfig.bg,
                borderColor: severityConfig.border
              }}
            >
              {faultLevel}
            </span>
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--text-primary)', fontWeight: '500', lineHeight: 1.4 }}>
            {pState.errorMessage || "Unknown Error"}
          </div>
          {pState.portId && pState.portId !== info.portId && (
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              장애 대상 포트: <strong style={{ color: 'var(--text-primary)' }}>{pState.portId}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
