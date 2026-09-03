/**
 * Port Utilities
 *
 * 모듈러 카드 장비의 포트 동적 생성/매핑 핵심 로직.
 * SVG raw text에서 port-hitbox 정보를 추출하고,
 * insertedCards + shelfNo/slotNo 기반으로 realPortNumber를 생성한다.
 */

import type { InsertedCard, EquipmentPort, GeneratedPort } from "../types/equipment";
import type { PortState } from "../types/index";

// ── 내부 타입 ─────────────────────────────────────────────────────────

/** SVG raw text에서 추출된 로컬 포트 정보 */
export interface LocalPortInfo {
  /** SVG 내 로컬 포트 번호 (e.g. "1", "2", ...) */
  localPort: string;
  /** 포트 유형 (e.g. "sfp", "qsfp", "port", "console", "mgmt") */
  portType: string;
  /** SVG path의 d 속성 (포트 위치/크기 추출용) */
  pathD?: string;
}


// ── 1. SVG raw text에서 port-hitbox 정보 추출 ────────────────────────

/**
 * SVG raw text에서 class="port-hitbox" 요소를 파싱하여
 * localPort, portType 정보를 추출한다.
 *
 * 지원하는 SVG 구조:
 * ```xml
 * <path
 *   class="port-hitbox"
 *   data-port-type="sfp"
 *   data-local-port="1"
 *   d="M 54.5 10.5 H 86.7 V 35.2 H 54.5 Z"
 * />
 * ```
 */
export function extractPortsFromSvg(svgText: string): LocalPortInfo[] {
  const ports: LocalPortInfo[] = [];

  if (!svgText) return ports;

  // port-hitbox 요소를 정규식으로 추출
  // <path ... class="port-hitbox" ... /> 또는 <rect ... class="port-hitbox" ... />
  const hitboxRegex = /<(?:path|rect)\s[^>]*class="port-hitbox"[^>]*\/?>/gi;
  const matches = svgText.matchAll(hitboxRegex);

  for (const match of matches) {
    const elementStr = match[0];

    // data-local-port 추출
    const localPortMatch = elementStr.match(/data-local-port="([^"]+)"/);
    if (!localPortMatch) continue;

    // data-port-type 추출
    const portTypeMatch = elementStr.match(/data-port-type="([^"]+)"/);

    // d 속성 추출 (path 요소인 경우)
    const pathDMatch = elementStr.match(/\bd="([^"]+)"/);

    ports.push({
      localPort: localPortMatch[1],
      portType: portTypeMatch?.[1] ?? "unknown",
      pathD: pathDMatch?.[1],
    });
  }

  // localPort 숫자 기준으로 정렬
  ports.sort((a, b) => {
    const numA = parseInt(a.localPort, 10);
    const numB = parseInt(b.localPort, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localPort.localeCompare(b.localPort);
  });

  return ports;
}

// ── 2. insertedCards + SVG raw → 전체 realPort 목록 생성 ─────────────

/**
 * 삽입된 카드 목록과 각 카드의 SVG raw text를 기반으로
 * 전체 장비의 realPortNumber 기반 포트 목록을 생성한다.
 *
 * @param insertedCards - 삽입된 카드 인스턴스 목록
 * @param cardSvgMap    - cardFileName → raw SVG text 매핑
 * @returns 전체 GeneratedPort 배열 (shelfNo/slotNo/localPort 기반)
 */
export function generatePortMap(
  insertedCards: InsertedCard[],
  cardSvgMap: Map<string, string>,
): GeneratedPort[] {
  const allPorts: GeneratedPort[] = [];

  for (const card of insertedCards) {
    const svgText = cardSvgMap.get(card.cardFileName);
    if (!svgText) continue;

    const localPorts = extractPortsFromSvg(svgText);

    for (const lp of localPorts) {
      // portType을 포함한 uniquePortKey로 포트를 고유하게 식별
      // (composeCards / DeviceSvgPreview와 동일한 로직)
      const uniquePortKey = lp.portType && lp.portType !== "unknown"
        ? `${lp.portType}-${lp.localPort}`
        : lp.localPort;
      const realPortNumber = `${card.shelfNo}/${card.slotNo}/${uniquePortKey}`;

      allPorts.push({
        realPortNumber,
        localPort: lp.localPort,
        cardInstanceId: card.instanceId,
        cardFileName: card.cardFileName,
        portType: lp.portType,
        status: "normal",
        pathD: lp.pathD,
      });
    }
  }

  return allPorts;
}

// ── 3. 외부 portStatusMap 적용 ──────────────────────────────────────

/**
 * 외부에서 전달받은 포트 상태 맵을 GeneratedPort 배열에 적용한다.
 *
 * @param ports         - generatePortMap()으로 생성된 포트 목록
 * @param portStatusMap - realPortNumber → status 매핑
 *                        (e.g. { "1/1/9": "critical", "1/2/3": "warning" })
 * @returns status가 적용된 새 GeneratedPort 배열 (원본 불변)
 */
export function applyPortStatuses(
  ports: GeneratedPort[],
  portStatusMap: Record<string, "normal" | "critical" | "major" | "minor" | "warning" | "disabled">,
): GeneratedPort[] {
  if (!portStatusMap || Object.keys(portStatusMap).length === 0) {
    return ports;
  }

  return ports.map((port) => {
    let newStatus = portStatusMap[port.realPortNumber];
    
    // Fallback: 부분 일치 (샘플 데이터나 포트 번호만 있는 경우)
    if (!newStatus) {
      const partialKey1 = port.localPort;
      const partialKey2 = port.portType !== "unknown" && port.portType !== "port" ? `${port.portType}-${port.localPort}` : port.localPort;
      
      const prefixMatch = port.realPortNumber.match(/^(\d+\/\d+\/)/);
      const prefix = prefixMatch ? prefixMatch[1] : "";

      const pType = port.portType.toLowerCase();
      const isDataPort = pType === "port" || pType === "unknown" || 
                         pType.includes("sfp") || pType.includes("qsfp") || pType === "ethernet";

      newStatus = 
        portStatusMap[partialKey2] || 
        (prefix ? portStatusMap[`${prefix}${partialKey2}`] : undefined);

      if (!newStatus && isDataPort) {
        newStatus = 
          portStatusMap[partialKey1] || 
          portStatusMap[`port-${partialKey1}`] || 
          (prefix ? portStatusMap[`${prefix}${partialKey1}`] : undefined) ||
          (prefix ? portStatusMap[`${prefix}port-${partialKey1}`] : undefined);
      }
    }

    if (newStatus && newStatus !== port.status) {
      return { ...port, status: newStatus };
    }
    return port;
  });
}

// ── 4. PortState[] 변환 (기존 에러 시스템과 호환) ────────────────────

/**
 * GeneratedPort 배열을 기존 PortState[] 형식으로 변환한다.
 * 기존 에러 시스템(DeviceModal, PortErrorOverlay 등)과의 호환성을 위해 사용.
 *
 * @param ports - GeneratedPort 배열
 * @returns PortState[] (portId = realPortNumber)
 */
export function generatedPortsToPortStates(
  ports: GeneratedPort[],
): PortState[] {
  return ports.map((port) => {
    const ps: PortState = {
      portId: port.realPortNumber,
      status: port.status === "normal" ? "normal" : "error",
      portName: `${port.portType.toUpperCase()} ${port.localPort}`,
      portNumber: port.realPortNumber,
      cardInstanceId: port.cardInstanceId,
    };

    // 에러 상태인 경우 errorLevel 매핑
    if (port.status !== "normal") {
      ps.errorLevel = mapStatusToErrorLevel(port.status);
      ps.errorMessage = `Port ${port.realPortNumber} is in ${port.status} state`;
    }

    return ps;
  });
}

/**
 * GeneratedPort의 status를 ErrorLevel로 변환
 */
function mapStatusToErrorLevel(
  status: "critical" | "major" | "minor" | "warning" | "disabled",
): "critical" | "major" | "minor" | "warning" {
  switch (status) {
    case "critical":
      return "critical";
    case "major":
      return "major";
    case "warning":
      return "warning";
    case "minor":
    case "disabled":
      return "minor";
    default:
      return "minor";
  }
}

// ── 5. 기존 PortState[]에서 realPortNumber 기반 상태 매핑 ────────────

/**
 * 기존 PortState[] 배열에서 realPortNumber를 key로 사용하는
 * 상태 맵을 생성한다. 모듈러 카드 장비의 에러 동기화에 사용.
 *
 * @param portStates - Device.portStates
 * @returns realPortNumber → status 매핑
 */
export function buildPortStatusMapFromPortStates(
  portStates: PortState[],
): Record<string, "normal" | "critical" | "major" | "minor" | "warning" | "disabled"> {
  const map: Record<
    string,
    "normal" | "critical" | "major" | "minor" | "warning" | "disabled"
  > = {};

  for (const ps of portStates) {
    // portNumber 또는 portId를 realPortNumber로 사용
    const key = ps.portNumber || ps.portId;
    if (!key) continue;

    if (ps.status === "error") {
      // errorLevel을 기반으로 세분화된 상태 매핑
      switch (ps.errorLevel) {
        case "critical":
          map[key] = "critical";
          break;
        case "major":
          map[key] = "major";
          break;
        case "warning":
          map[key] = "warning";
          break;
        case "minor":
          map[key] = "minor";
          break;
        default:
          map[key] = "critical";
      }
    } else {
      map[key] = "normal";
    }
  }

  return map;
}

// ── 6. InsertedCard에 포트 목록 주입 ─────────────────────────────────

/**
 * InsertedCard 배열의 각 카드에 런타임 포트 목록을 주입한다.
 * EquipmentAssemblyModal 저장 시 또는 DeviceModal 렌더 시 사용.
 *
 * @param insertedCards - 삽입된 카드 인스턴스 목록
 * @param cardSvgMap    - cardFileName → raw SVG text 매핑
 * @returns ports 필드가 채워진 InsertedCard 배열 (원본 불변)
 */
export function enrichCardsWithPorts(
  insertedCards: InsertedCard[],
  cardSvgMap: Map<string, string>,
): InsertedCard[] {
  return insertedCards.map((card) => {
    const svgText = cardSvgMap.get(card.cardFileName);
    if (!svgText) return card;

    const localPorts = extractPortsFromSvg(svgText);

    const ports: EquipmentPort[] = localPorts.map((lp) => ({
      realPortNumber: `${card.shelfNo}/${card.slotNo}/${lp.portType && lp.portType !== "unknown" ? `${lp.portType}-${lp.localPort}` : lp.localPort}`,
      localPort: lp.localPort,
      cardInstanceId: card.instanceId,
      portType: lp.portType,
      status: "normal" as const,
    }));

    return { ...card, ports };
  });
}
