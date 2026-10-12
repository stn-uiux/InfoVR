/**
 * usePortInteraction – 포트 hover/click/tooltip/블링킹 이벤트 바인딩 훅
 *
 * SvgPortView 내부의 거대한 useEffect를 추출한 것입니다.
 * containerRef에 이벤트 리스너를 부착하여 포트 상호작용을 처리합니다.
 */
import { useEffect, useMemo } from 'react';
import type { GeneratedPort } from '../types/equipment';
import { ERROR_COLORS } from '../utils/errorHelpers';
import { ensureKeyframe, isPortId, PORT_SELECTOR, filterPortElements, resolvePortId } from '../utils/svgUtils';
import type { PortState } from '../types';

/** 포트 상태별 색상 */
const PORT_STATUS_COLORS: Record<string, string> = {
  normal: "transparent",
  critical: ERROR_COLORS.critical,
  major: ERROR_COLORS.major,
  minor: ERROR_COLORS.minor,
  warning: ERROR_COLORS.warning,
  disabled: "#666666",
};

export function usePortInteraction(
  containerRef: React.RefObject<HTMLDivElement | null>,
  tooltipRef: React.RefObject<HTMLDivElement | null>,
  composedHtml: string,
  portStates: PortState[],
  isModularDevice: boolean,
  generatedPorts: GeneratedPort[],
  generatedPortMap: Map<string, GeneratedPort>,
  editable: boolean = true,
) {
  const portStateMap = useMemo(() => {
    const map = new Map<string, PortState>();
    portStates.forEach(ps => {
      map.set(ps.portId, ps);
      if (ps.portNumber) map.set(ps.portNumber, ps);
      
      // Fallback for modular devices with shelf/slot/port-N or shelf/slot/N
      if (ps.portId.includes("/")) {
        const parts = ps.portId.split("/");
        if (parts.length === 3) {
          const [shelf, slot, lastPart] = parts;
          const numMatch = lastPart.match(/(\d+)$/);
          if (numMatch) {
            const num = numMatch[1];
            map.set(`${shelf}/${slot}/${num}`, ps);
            map.set(`${shelf}/${slot}/sfp-${num}`, ps);
            map.set(`${shelf}/${slot}/eth-${num}`, ps);
            map.set(`${shelf}/${slot}/qsfp-${num}`, ps);
            map.set(`${shelf}/${slot}/port-${num}`, ps);
          }
        }
      }

      // Fallback for non-modular devices that use data-local-port instead of id
      if (ps.portId.startsWith("port-")) {
        const localPort = ps.portId.replace("port-", "");
        map.set(localPort, ps);
        map.set(`eth-${localPort}`, ps);
        map.set(`sfp-${localPort}`, ps);
        map.set(`qsfp-${localPort}`, ps);
      } else {
        const numMatch = ps.portId.match(/^(\d+)$/);
        if (numMatch) {
          const num = numMatch[1];
          map.set(`port-${num}`, ps);
          map.set(`eth-${num}`, ps);
          map.set(`sfp-${num}`, ps);
        }
      }
    });
    return map;
  }, [portStates, isModularDevice]);

  useEffect(() => {
    let activePortEl: SVGElement | null = null;
    const container = containerRef.current;
    if (!container || !composedHtml) return;

    // ─── SVG 초기 설정 ───
    initializeSvg(container);

    // ─── 포트 스타일 초기화 ───
    const allPortEls = filterPortElements(
      Array.from(container.querySelectorAll(PORT_SELECTOR))
    );

    // DEMO: 에러 포트 매핑 보정
    // 샘플 데이터가 가짜 포트 ID를 생성한 경우, SVG 내에 실제 존재하는 미사용 포트로 결정론적으로 연결합니다.
    const errorStates = portStates.filter(p => p.status === "error");
    errorStates.forEach(ps => {
      let el: SVGElement | null = null;
      if (isModularDevice) {
        el = container.querySelector(`[data-port-number='${ps.portId}']`) as SVGElement | null;
        if (!el) {
          // 모듈이 이미 꽂혀 있는 포트 중 이 에러에 해당하는 포트가 있다면 최우선 선택
          el = allPortEls.find(pel => {
            const pNum = pel.getAttribute("data-port-number");
            const origNum = pel.getAttribute("data-original-port-number");
            const hasMod = pel.getAttribute("data-has-module") === "true";
            return hasMod && (pNum === ps.portId || origNum === ps.portId);
          }) || null;
        }
        if (!el) {
          // 정밀 매칭: 슬롯 번호와 로컬 포트를 조합하여 대상을 찾습니다
          const parts = ps.portId.split("/");
          if (parts.length === 3) {
            const shelf = parts[0];
            const slot = parts[1];
            const localPortMatch = parts[2].match(/(\d+)$/);
            const localPort = localPortMatch ? localPortMatch[1] : "";
            if (localPort) {
              el = (container.querySelector(`[data-port-number^='${shelf}/${slot}/'][data-local-port='${localPort}']`) ||
                    container.querySelector(`[data-port-number='${shelf}/${slot}/sfp-${localPort}']`) ||
                    container.querySelector(`[data-port-number='${shelf}/${slot}/eth-${localPort}']`) ||
                    container.querySelector(`[data-port-number='${shelf}/${slot}/port-${localPort}']`)) as SVGElement | null;
            }
            if (!el) {
              // 해당 슬롯에 위치한 포트들 중 결정론적으로 선택 (카드를 벗어나지 않음)
              const slotPorts = allPortEls.filter(pel => pel.getAttribute("data-port-number")?.startsWith(`${shelf}/${slot}/`));
              if (slotPorts.length > 0) {
                const targetIdx = (parseInt(localPort || "1", 10) - 1) % slotPorts.length;
                el = slotPorts[targetIdx >= 0 ? targetIdx : 0];
              }
            }
          }
        }
      } else {
        el = (container.querySelector(`[id='${ps.portId}']`) ||
              container.querySelector(`[data-local-port='${ps.portId.replace("port-", "")}']`) ||
              container.querySelector(`[data-port-number='${ps.portId.replace("port-", "")}']`)) as SVGElement | null;
        if (!el) {
          const numMatch = ps.portId.match(/(\d+)$/);
          if (numMatch) {
            const num = numMatch[1];
            el = (container.querySelector(`[id='eth-${num}']`) ||
                  container.querySelector(`[id='sfp-${num}']`) ||
                  container.querySelector(`[id='port-${num}']`)) as SVGElement | null;
          }
        }
        if (!el) {
          // 이미 모듈이 꽂혀 있는 포트가 있다면 우선 선택
          el = allPortEls.find(pel => pel.getAttribute("data-has-module") === "true") || null;
        }
      }
        
      if (!el) {
        const availablePorts = allPortEls.filter(pel => {
          const id = resolvePortId(pel);
          return id && !portStateMap.has(id);
        });
        if (availablePorts.length > 0) {
          // 결정론적 해시를 사용하여 항상 동일한 포트에 연결 (랜덤 변경으로 인한 장애 깜빡임 소실 방지)
          const hash = Math.abs(ps.portId.split("").reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0));
          const stableEl = availablePorts[hash % availablePorts.length];
          const realId = resolvePortId(stableEl);
          if (realId) {
            portStateMap.set(realId, ps);
            el = stableEl;
          }
        }
      } else {
        const realId = resolvePortId(el);
        if (realId) {
          portStateMap.set(realId, ps);
        }
        if (el.id) portStateMap.set(el.id, ps);
        const dpn = el.getAttribute("data-port-number");
        if (dpn) portStateMap.set(dpn, ps);
        const dopn = el.getAttribute("data-original-port-number");
        if (dopn) portStateMap.set(dopn, ps);
      }
    });

    // DEMO: 실제 SVG 요소(path/rect) 기반으로 일부 미사용 포트를 결정론적으로 'NORMAL(UP)' 상태로 처리합니다.
    let demoUsedCount = 0;
    allPortEls.forEach((el) => {
      const portId = resolvePortId(el);
      const isErrorPort = (portId && portStateMap.get(portId)?.status === "error") ||
                          (el.id && portStateMap.get(el.id)?.status === "error") ||
                          el.getAttribute("data-error-level") !== null;
      if (portId && !portStateMap.has(portId) && !isErrorPort) {
        const hash = Math.abs(portId.split("").reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0));
        if (hash % 5 === 0 && demoUsedCount < 12) {
          portStateMap.set(portId, {
            portId: portId,
            status: "normal",
            portNumber: portId,
            portName: portId,
          });
          demoUsedCount++;
        }
      }
    });

    initializePortStyles(allPortEls, generatedPortMap, isModularDevice, portStateMap, editable);

    // ─── 이벤트 핸들러 ───
    const resetHover = () => {
      const tooltip = tooltipRef.current;
      if (activePortEl) {
        resetPortStyle(activePortEl, generatedPortMap, isModularDevice, portStateMap, editable);
        activePortEl = null;
      }
      if (tooltip) tooltip.style.display = "none";
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as SVGElement;
      const portEl = target.closest<SVGElement>(PORT_SELECTOR);

      if (portEl && portEl.id && !isPortId(portEl.id) && !portEl.classList.contains("port-hitbox")) {
        resetHover();
        return;
      }
      if (!portEl) { resetHover(); return; }

      const tooltip = tooltipRef.current;
      if (!tooltip) return;

      if (activePortEl !== portEl) {
        resetHover();
        activePortEl = portEl;
        applyHoverStyle(portEl);
      }

      // 툴팁 내용 생성
      const { displayType, displayId, statusStr, statusColor } = resolvePortInfo(
        portEl, generatedPortMap, portStateMap
      );

      tooltip.innerHTML = `
        <div style="font-weight:700; font-size:13px; margin-bottom:6px; color:#80deea;">${displayType} ${displayId}</div>
        <div style="font-weight:600; color:${statusColor}; font-size:12px; text-shadow:0 0 4px ${statusColor}40;">${statusStr}</div>
        ${editable ? `<div style="margin-top:4px; font-size:11px; color:#e0f7fa; opacity:0.8;">Click to manage module</div>` : ""}
      `;
      tooltip.style.display = "block";
    };

    const handleMouseMove = (e: MouseEvent) => {
      const tooltip = tooltipRef.current;
      if (tooltip) {
        tooltip.style.left = `${e.clientX}px`;
        tooltip.style.top = `${e.clientY - 10}px`;
        tooltip.style.transform = "translate(-50%, -100%)";
      }
    };

    const handleMouseOut = () => resetHover();

    const handleClick = (e: MouseEvent) => {
      e.stopPropagation();
      const target = e.target as SVGElement;
      const portEl = target.closest<SVGElement>(PORT_SELECTOR);
      if (!portEl) return;
      if (portEl.id && !isPortId(portEl.id) && !portEl.classList.contains("port-hitbox")) return;

      const portType = portEl.getAttribute("data-port-type");
      const portId = resolvePortId(portEl);
      if (!portId) return;

      const originalPortId = portEl.getAttribute("data-original-port-number");
      const isInUse = portStateMap.has(portId) || (originalPortId && portStateMap.has(originalPortId));
      if (!editable && !isInUse) return;

      const rect = portEl.getBoundingClientRect();
      const actualPortId = (portId && portStateMap.has(portId)) ? portId : (originalPortId && portStateMap.has(originalPortId)) ? originalPortId : portId;

      const popoverData = {
        portId: actualPortId,
        portType: portType || "port",
        hitboxId: portEl.id,
        x: rect.left + rect.width / 2,
        y: rect.top,
      };

      if (editable) {
        const popoverEvent = new CustomEvent("port-module-popover", {
          bubbles: true,
          detail: popoverData,
        });
        container.dispatchEvent(popoverEvent);
      } else {
        const infoEvent = new CustomEvent("port-info-popover", {
          bubbles: true,
          detail: popoverData,
        });
        container.dispatchEvent(infoEvent);
      }
    };

    container.addEventListener("mouseover", handleMouseOver);
    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseout", handleMouseOut);
    container.addEventListener("click", handleClick);

    // ─── 에러 블링킹 ───
    applyErrorBlinking(container, isModularDevice, portStateMap);

    return () => {
      container.removeEventListener("mouseover", handleMouseOver);
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseout", handleMouseOut);
      container.removeEventListener("click", handleClick);
    };
  }, [containerRef, tooltipRef, composedHtml, portStateMap, portStates, isModularDevice, generatedPortMap, generatedPorts, editable]);

  return portStateMap;
}

// ─── 내부 헬퍼 ───

function initializeSvg(container: HTMLDivElement) {
  const svgEl = container.querySelector("svg");
  if (svgEl) {
    if (!svgEl.getAttribute('viewBox')) {
      const w = svgEl.getAttribute('width') || '984';
      const h = svgEl.getAttribute('height') || '200';
      svgEl.setAttribute('viewBox', `0 0 ${parseInt(w, 10)} ${parseInt(h, 10)}`);
    }
    container.style.transform = "none";
    if (container.parentElement) {
      container.parentElement.style.height = "auto";
      container.parentElement.style.overflow = "visible";
    }
    svgEl.style.width = "100%";
    svgEl.style.height = "auto";
    svgEl.style.maxWidth = "880px";
    svgEl.style.display = "block";
  }
  container.querySelectorAll("title").forEach(t => t.textContent = "");
}

function initializePortStyles(
  portEls: SVGElement[],
  generatedPortMap: Map<string, GeneratedPort>,
  isModularDevice: boolean,
  portStateMap: Map<string, PortState>,
  editable: boolean,
) {
  portEls.forEach((el) => {
    const portId = resolvePortId(el);
    const originalPortId = el.getAttribute("data-original-port-number");
    const isInUse = (portId && portStateMap.has(portId)) || (originalPortId && portStateMap.has(originalPortId)) || false;

    if (isModularDevice) {
      // 모듈러 장비: .port-hitbox는 투명 오버레이 → 에러 상태에 따라 색상 설정
      if (portId) {
        const ps = portStateMap.get(portId) || (originalPortId ? portStateMap.get(originalPortId) : undefined);
        if (ps && ps.status !== "normal") {
          const color = ps.errorLevel && ERROR_COLORS[ps.errorLevel] ? ERROR_COLORS[ps.errorLevel] : "#ef4444";
          el.style.fill = `${color}33`;
          el.style.stroke = color;
          el.style.strokeWidth = "1.5px";
        } else {
          if (!editable && isInUse) {
            el.style.fill = "transparent";
            el.style.stroke = "#00b11f";
            el.style.strokeWidth = "1.5px";
          } else {
            el.style.fill = "transparent";
            el.style.stroke = "none";
          }
        }
      } else {
        el.style.fill = "transparent";
        el.style.stroke = "none";
      }
    } else {
      // 비모듈러 장비
      if (!editable && isInUse) {
        // 에러인 경우 applyErrorBlinking에서 animation으로 처리되므로, 
        // 기본 stroke를 추가하여 in-use임을 나타냅니다.
        const ps = portStateMap.get(portId!);
        if (!ps || ps.status === "normal") {
          el.style.fill = "transparent";
          el.style.stroke = "#00b11f";
          el.style.strokeWidth = "1.5px";
        } else {
          el.style.fill = "transparent";
          el.style.stroke = "none";
        }
      } else {
        el.style.fill = "transparent";
        el.style.stroke = "none";
      }
    }

    if (editable) {
      el.style.pointerEvents = "all";
      el.style.cursor = "pointer";
    } else {
      if (isInUse) {
        el.style.pointerEvents = "all";
        el.style.cursor = "pointer";
      } else {
        el.style.pointerEvents = "all"; // Hover 이벤트를 받기 위해 all로 설정 (Click은 내부 로직에서 무시)
        el.style.cursor = "default";
      }
    }
  });
}

function resetPortStyle(
  el: SVGElement,
  generatedPortMap: Map<string, GeneratedPort>,
  isModularDevice: boolean,
  portStateMap: Map<string, PortState>,
  editable: boolean,
) {
  if (el.getAttribute("data-error-level")) {
    el.style.stroke = "";
    el.style.fill = "";
    el.style.strokeWidth = "";
    return;
  }

  const portId = resolvePortId(el);
  const originalPortId = el.getAttribute("data-original-port-number");
  const isInUse = (portId && portStateMap.has(portId)) || (originalPortId && portStateMap.has(originalPortId)) || false;

  if (isModularDevice) {
    // 모듈러 장비: 에러 상태에 따라 색상 복원
    if (portId) {
      const gp = generatedPortMap.get(portId);
      if (gp && gp.status !== "normal") {
        const color = PORT_STATUS_COLORS[gp.status] || "transparent";
        el.style.fill = `${color}33`;
        el.style.stroke = color;
        el.style.strokeWidth = "1.5px";
      } else {
        if (!editable && isInUse) {
          el.style.fill = "transparent";
          el.style.stroke = "#00b11f";
          el.style.strokeWidth = "1.5px";
        } else {
          el.style.fill = "transparent";
          el.style.stroke = "none";
        }
      }
    } else {
      el.style.fill = "transparent";
      el.style.stroke = "none";
    }
  } else {
    // 비모듈러 장비: 기본 투명 상태 및 호버 스타일 완전 초기화
    if (!editable && isInUse) {
      const ps = portStateMap.get(portId!) || (originalPortId ? portStateMap.get(originalPortId) : undefined);
      if (!ps || ps.status === "normal") {
        el.style.fill = "transparent";
        el.style.stroke = "#00b11f";
        el.style.strokeWidth = "1.5px";
        el.style.opacity = "1";
        el.style.filter = "none";
      } else {
        el.style.fill = "transparent";
        el.style.stroke = "none";
        el.style.opacity = "1";
        el.style.filter = "none";
      }
    } else {
      el.style.fill = "transparent";
      el.style.stroke = "none";
      el.style.opacity = "1";
      el.style.filter = "none";
    }
  }
}

function applyHoverStyle(portEl: SVGElement) {
  // 모듈러/비모듈러 공통: 호버 시 옅은 하늘색 배경 및 하늘색 테두리 하이라이트 제공
  const currentFill = portEl.style.fill;
  if (currentFill === "transparent" || !currentFill) {
    portEl.style.fill = "rgba(0, 229, 255, 0.2)";
  }
  portEl.style.stroke = "rgba(0, 229, 255, 0.8)";
  portEl.style.strokeWidth = "2px";
  portEl.style.cursor = "pointer";
}

interface PortInfo {
  displayType: string;
  displayId: string;
  statusStr: string;
  statusColor: string;
}

function resolvePortInfo(
  portEl: SVGElement,
  generatedPortMap: Map<string, GeneratedPort>,
  portStateMap: Map<string, PortState>,
): PortInfo {
  const portId = resolvePortId(portEl);
  const originalPortId = portEl.getAttribute("data-original-port-number");
  const gp = portId ? generatedPortMap.get(portId) : null;
  const ps = (portId && portStateMap.has(portId)) ? portStateMap.get(portId) : (originalPortId ? portStateMap.get(originalPortId) : undefined);

  let pType = gp?.portType ||
    portEl.getAttribute("data-port-type") ||
    portEl.getAttribute("data-porttype") ||
    portEl.querySelector(".port-hitbox")?.getAttribute("data-port-type") ||
    "";
  
  let displayId = portId || (ps ? ps.portId : "");

  // pType fallback
  if (!pType || pType.toLowerCase() === "port") {
    const fallbackType = portEl.getAttribute("data-port-type") ||
      portEl.getAttribute("data-porttype") ||
      portEl.querySelector(".port-hitbox")?.getAttribute("data-port-type");
    if (fallbackType && fallbackType.toLowerCase() !== "port") {
      pType = fallbackType;
    } else {
      const idMatch = portEl.id.match(/port-(qsfp28|qsfp|sfp|console|mgmt|usb)-/i);
      if (idMatch) pType = idMatch[1];
    }
  }

  // displayId 가공
  if (displayId.includes("port-")) {
    const parts = displayId.split("-");
    if (parts.length >= 3) {
      if (!pType) pType = parts[1];
      displayId = parts.slice(2).join("-");
    } else {
      displayId = displayId.replace(/^port-/, "");
    }
  } else if (/^p\d+$/.test(displayId)) {
    displayId = displayId.replace(/^p/, "");
  }

  // 중복 type 접두어 제거
  if (pType && displayId.includes(`${pType.toLowerCase()}-`)) {
    displayId = displayId.replace(`${pType.toLowerCase()}-`, "");
  }

  const displayType = pType ? pType.toUpperCase() : "PORT";

  // 상태 결정 (ps 우선, 없으면 gp, 그 외 기본)
  let statusStr = "DOWN";
  let statusColor = "#9ca3af"; // 회색

  if (ps) {
    if (ps.status === "error") {
      statusStr = ps.errorLevel ? ps.errorLevel.toUpperCase() : "ERROR";
      statusColor = ps.errorLevel && ERROR_COLORS[ps.errorLevel] ? ERROR_COLORS[ps.errorLevel] : "#ff4d4d";
    } else {
      statusStr = "UP";
      statusColor = "#22c55e"; // 초록색
    }
  } else if (gp && gp.status !== "normal") {
    statusStr = gp.status.toUpperCase();
    statusColor = gp.status === "critical" ? ERROR_COLORS.critical
      : gp.status === "major" ? ERROR_COLORS.major
      : gp.status === "minor" ? ERROR_COLORS.minor
      : gp.status === "warning" ? ERROR_COLORS.warning
      : "#888";
  } else {
    const stampedLevel = portEl.getAttribute("data-error-level") as keyof typeof ERROR_COLORS | null;
    if (stampedLevel && ERROR_COLORS[stampedLevel]) {
      statusStr = stampedLevel.toUpperCase();
      statusColor = ERROR_COLORS[stampedLevel];
    }
  }

  return { displayType, displayId, statusStr, statusColor };
}

function applyErrorBlinking(
  container: HTMLDivElement,
  isModularDevice: boolean,
  portStateMap: Map<string, PortState>,
) {
  // 1. 기존에 적용된 모듈 블링킹 및 오버레이 초기화
  container.querySelectorAll<SVGElement>(".inserted-module").forEach((m) => {
    m.style.animation = "";
    m.style.filter = "";
    m.removeAttribute("data-error-level");
  });
  container.querySelectorAll<SVGElement>(".inserted-module-overlay").forEach((o) => {
    o.style.animation = "";
    o.style.fill = "transparent";
    o.style.stroke = "none";
    o.removeAttribute("data-error-level");
  });

  const processedPs = new Set<PortState>();

  Array.from(portStateMap.entries()).forEach(([realId, ps]) => {
    if (ps.status === "error" && !processedPs.has(ps)) {
      processedPs.add(ps);
      const color = ps.errorLevel && ERROR_COLORS[ps.errorLevel] ? ERROR_COLORS[ps.errorLevel] : "#ef4444";
      
      let el: SVGElement | null = null;
      if (isModularDevice) {
        el = container.querySelector(`[data-port-number='${realId}']`) as SVGElement | null;
        if (!el && ps.portId) {
          el = container.querySelector(`[data-port-number='${ps.portId}']`) as SVGElement | null;
        }
        if (!el) {
          const targetId = realId || ps.portId;
          const parts = targetId.split("/");
          if (parts.length === 3) {
            const shelf = parts[0];
            const slot = parts[1];
            const localPortMatch = parts[2].match(/(\d+)$/);
            if (localPortMatch) {
              const localPort = localPortMatch[1];
              el = (container.querySelector(`[data-port-number^='${shelf}/${slot}/'][data-local-port='${localPort}']`) ||
                    container.querySelector(`[data-port-number='${shelf}/${slot}/sfp-${localPort}']`) ||
                    container.querySelector(`[data-port-number='${shelf}/${slot}/eth-${localPort}']`)) as SVGElement | null;
            }
          }
        }
      } else {
        el = container.querySelector(`[id='${realId}']`) as SVGElement | null;
        if (!el && ps.portId) {
          el = container.querySelector(`[id='${ps.portId}']`) as SVGElement | null;
        }
        if (!el && (realId.startsWith("port-") || ps.portId.startsWith("port-"))) {
          const localPort = (realId.startsWith("port-") ? realId : ps.portId).replace("port-", "");
          el = (container.querySelector(`[data-local-port='${localPort}']`) ||
                container.querySelector(`[data-port-number='${localPort}']`) ||
                container.querySelector(`[id='eth-${localPort}']`) ||
                container.querySelector(`[id='sfp-${localPort}']`)) as SVGElement | null;
        }
      }
      
      const animName = `blink-${realId.replace(/[^a-z0-9]/gi, "-")}`;
      ensureKeyframe(animName, color);

      if (el) {
        el.style.animation = `${animName} 1.5s infinite`;
        el.setAttribute("data-error-level", ps.errorLevel || "critical");
      }

      // ─── 모듈(SFP / Ethernet) 블링킹 적용 ───
      // 해당 포트에 꽂힌 모듈도 장애 컬러로 깜빡이게 처리
      const candidateKeys = new Set<string>();
      if (realId) {
        candidateKeys.add(realId);
        const parts = realId.split("/");
        if (parts.length === 3) {
          candidateKeys.add(parts[2]);
          const numMatch = parts[2].match(/(\d+)$/);
          if (numMatch) candidateKeys.add(numMatch[1]);
        }
      }
      if (ps.portId) {
        candidateKeys.add(ps.portId);
        const parts = ps.portId.split("/");
        if (parts.length === 3) {
          candidateKeys.add(parts[2]);
          const numMatch = parts[2].match(/(\d+)$/);
          if (numMatch) candidateKeys.add(numMatch[1]);
        }
      }
      if (ps.portNumber) candidateKeys.add(ps.portNumber);
      if (el) {
        const dpn = el.getAttribute("data-port-number");
        if (dpn) candidateKeys.add(dpn);
        const dopn = el.getAttribute("data-original-port-number");
        if (dopn) candidateKeys.add(dopn);
        if (el.id) candidateKeys.add(el.id);
        const dlp = el.getAttribute("data-local-port");
        if (dlp) candidateKeys.add(dlp);
      }

      const moduleImgs: SVGElement[] = [];
      const moduleOverlays: SVGElement[] = [];

      // 직접 속성 비교로 안전하게 매칭 (CSS selector escaping 문제 원천 차단)
      container.querySelectorAll<SVGElement>(".inserted-module, .inserted-module-overlay").forEach((mod) => {
        const pId = mod.getAttribute("data-port-id");
        const pNum = mod.getAttribute("data-port-number");
        const origNum = mod.getAttribute("data-original-port-number");
        const hbId = mod.getAttribute("data-hitbox-id");
        const local = mod.getAttribute("data-local-port");

        const matches = (pId && candidateKeys.has(pId)) ||
                        (pNum && candidateKeys.has(pNum)) ||
                        (origNum && candidateKeys.has(origNum)) ||
                        (hbId && candidateKeys.has(hbId)) ||
                        (local && candidateKeys.has(local));

        if (matches) {
          if (mod.classList.contains("inserted-module")) {
            if (!moduleImgs.includes(mod)) moduleImgs.push(mod);
          } else {
            if (!moduleOverlays.includes(mod)) moduleOverlays.push(mod);
          }
        }
      });

      // 만약 el 주위의 형제 요소에 모듈이 있는 경우 탐색
      if (el && el.parentElement) {
        el.parentElement.querySelectorAll<SVGElement>(".inserted-module, .inserted-module-overlay").forEach((mod) => {
          const pId = mod.getAttribute("data-port-id");
          if (pId && candidateKeys.has(pId)) {
            if (mod.classList.contains("inserted-module") && !moduleImgs.includes(mod)) moduleImgs.push(mod);
            if (mod.classList.contains("inserted-module-overlay") && !moduleOverlays.includes(mod)) moduleOverlays.push(mod);
          }
        });
      }

      // 모듈 오버레이가 아직 없는 경우(동적 생성)
      moduleImgs.forEach((img) => {
        const portIdAttr = img.getAttribute("data-port-id");
        let overlay = img.parentElement?.querySelector<SVGRectElement>(
          `.inserted-module-overlay[data-port-id='${portIdAttr}']`
        );
        if (!overlay && img.parentElement) {
          const svgNS = "http://www.w3.org/2000/svg";
          overlay = document.createElementNS(svgNS, "rect");
          overlay.setAttribute("class", "inserted-module-overlay");
          overlay.setAttribute("x", img.getAttribute("x") || "0");
          overlay.setAttribute("y", img.getAttribute("y") || "0");
          overlay.setAttribute("width", img.getAttribute("width") || "0");
          overlay.setAttribute("height", img.getAttribute("height") || "0");
          overlay.setAttribute("rx", "2.5");
          overlay.setAttribute("pointer-events", "none");
          if (portIdAttr) overlay.setAttribute("data-port-id", portIdAttr);
          img.parentElement.insertBefore(overlay, img.nextSibling);
        }
        if (overlay && !moduleOverlays.includes(overlay)) {
          moduleOverlays.push(overlay);
        }
      });

      // 모듈 이미지 및 오버레이에 장애 깜빡임 애니메이션 부여
      moduleImgs.forEach((m) => {
        m.style.animation = `${animName}-img 1.5s infinite`;
        m.setAttribute("data-error-level", ps.errorLevel || "critical");
      });

      moduleOverlays.forEach((o) => {
        o.style.animation = `${animName}-overlay 1.5s infinite`;
        o.setAttribute("data-error-level", ps.errorLevel || "critical");
      });
    }
  });
}
