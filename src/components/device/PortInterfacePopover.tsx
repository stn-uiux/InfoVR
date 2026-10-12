import { useMemo } from 'react';

import type { PortState } from '../../types';

export interface PortInfoData {
  portId: string;
  portType: string;
  hitboxId?: string;
  x: number;
  y: number;
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

  return (
    <div
      className="port-info-popover comm-panel"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        left: info.x,
        top: info.y < 150 ? info.y + 24 : info.y - 8,
        transform: info.y < 150 ? "translate(-50%, 0)" : "translate(-50%, -100%)",
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
            color: 'var(--theme-primary)', 
            backgroundColor: 'var(--hover-bg)',
            padding: '8px',
            borderRadius: '8px',
            display: 'flex'
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
            <div style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-primary)', letterSpacing: '0.5px' }}>
              {info.portId}
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

      {(() => {
        const pState = portStates?.find(p => p.portId === info.portId);
        if (pState && pState.status !== "normal") {
          const level = pState.errorLevel || pState.status || "error";
          const chipClass =
            level === "critical" ? "comm-chip-critical" :
            level === "major" ? "comm-chip-major" :
            level === "minor" ? "comm-chip-minor" :
            level === "warning" ? "comm-chip-warning" : "comm-chip-critical";
          
          return (
            <div style={{
              backgroundColor: 'var(--panel-in-bg)', 
              borderRadius: '6px', 
              padding: '12px 16px',
              border: '1px solid var(--border-weak)',
              borderLeft: '4px solid var(--text-secondary)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)' }}>Active Fault</span>
                <span className={`comm-chip ${chipClass}`}>{level}</span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                {pState.errorMessage || "Unknown Error"}
              </div>
            </div>
          );
        }
        return null;
      })()}
    </div>
  );
};
