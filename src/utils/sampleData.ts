import type { Rack, RegisteredDevice, HierarchyNode, Device, Orientation } from "../types";
import { DEVICE_TEMPLATES } from "./deviceTemplates";
import { 
  getDefaultNodes, 
  GANGNAM_ROOM_1_NODE_ID,
  GANGNAM_ROOM_2_NODE_ID,
  GANGNAM_ROOM_3_NODE_ID,
  GANGBUK_ROOM_1_NODE_ID,
  GANGBUK_ROOM_2_NODE_ID,
  GWACHEON_ROOM_1_NODE_ID,
  GWACHEON_ROOM_2_NODE_ID,
  DAEJEON_ROOM_NODE_ID,
  SEJONG_ROOM_NODE_ID,
} from "./nodeUtils";
import {
  RACK_WIDTH_STANDARD,
  GRID_SPACING,
} from "../components/constants";

// ── 결정론적 UUID 생성 ─────────────────────────────────────────────────────────
let uuidCounter = 0;
const generateUUID = (): string => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  uuidCounter++;
  return `sample-${uuidCounter.toString(36).padStart(8, "0")}-${Date.now().toString(36)}`;
};

export { generateUUID };

// ── 센터 코드 매핑 ─────────────────────────────────────────────────────────────
const getCenterCode = (name: string) => {
  if (name.includes("서울") || name.includes("강남") || name.includes("강북")) return "S";
  if (name.includes("인천")) return "I";
  if (name.includes("판교")) return "P";
  if (name.includes("과천") || name.includes("경기")) return "G";
  if (name.includes("대전")) return "D";
  if (name.includes("세종")) return "J";
  return "S";
};

const ENVIRONMENTS = ["PRD", "DEV", "TST", "STG"];
const SYSTEMS = ["ERP", "KMS", "PORTAL"];

// ── 장비 생성 (DEVICE_TEMPLATES만 사용, customModels 의존성 제거) ────────────────
const generateRegisteredDevices = (
  nodeId: string,
  nodeName: string,
  count: number,
  ipBase: string,
  nodeIdx: number,
): RegisteredDevice[] =>
  Array.from({ length: count }).map((_, i) => {
    const template = DEVICE_TEMPLATES[i % DEVICE_TEMPLATES.length];
    const ipParts = ipBase.split(".");
    const lastOctet = (parseInt(ipParts[3]) + i) % 255;
    const thirdOctet = parseInt(ipParts[2]) + Math.floor((parseInt(ipParts[3]) + i) / 255);
    
    const macSuffix = ((nodeIdx << 8) | i).toString(16).padStart(4, "0");
    const formattedMacSuffix = `${macSuffix.slice(0, 2)}:${macSuffix.slice(2, 4)}`;

    const centerCode = getCenterCode(nodeName);
    // 결정론적 선택 (Math.random() 대신 인덱스 기반)
    const env = ENVIRONMENTS[i % ENVIRONMENTS.length];
    const eqType = template.type === "Server" 
      ? ["WAS", "DB", "WEB"][i % 3] 
      : "SW";
    const sysName = SYSTEMS[i % SYSTEMS.length];
    const seq = String(i + 1).padStart(2, "0");
    const newTitle = `${centerCode}-${env}-${eqType}-${sysName}-${seq}`;

    return {
      deviceId: generateUUID(),
      deviceGroupId: nodeId,
      title: newTitle,
      modelName: template.modelName,
      type: template.type,
      size: template.uSize,
      IPAddr: `${ipParts[0]}.${ipParts[1]}.${thirdOctet}.${lastOctet}`,
      macAddr: `00:00:5E:00:${formattedMacSuffix}`.toUpperCase(),
      vendor: template.vendor,
      insertedCards: [],
    };
  });

export const sampleNodes: HierarchyNode[] = getDefaultNodes();

// ── 전산실별 장비 수량 (축소된 규모) ──────────────────────────────────────────
// 기존: 강남 420개, 기타 240~420개 → 총 3000+ 장비
// 변경: 강남 120개, 기타 60~80개 → 총 ~700 장비
const ROOM_CONFIG: Record<string, { deviceCount: number; rackCount: number; cols: number }> = {
  [GANGNAM_ROOM_1_NODE_ID]: { deviceCount: 120, rackCount: 20, cols: 10 },
  [GANGNAM_ROOM_2_NODE_ID]: { deviceCount: 70, rackCount: 12, cols: 6 },
  [GANGNAM_ROOM_3_NODE_ID]: { deviceCount: 60, rackCount: 10, cols: 5 },
  [GANGBUK_ROOM_1_NODE_ID]: { deviceCount: 60, rackCount: 10, cols: 5 },
  [GANGBUK_ROOM_2_NODE_ID]: { deviceCount: 50, rackCount: 8, cols: 4 },
  [GWACHEON_ROOM_1_NODE_ID]: { deviceCount: 80, rackCount: 14, cols: 7 },
  [GWACHEON_ROOM_2_NODE_ID]: { deviceCount: 60, rackCount: 10, cols: 5 },
  [DAEJEON_ROOM_NODE_ID]: { deviceCount: 70, rackCount: 12, cols: 6 },
  [SEJONG_ROOM_NODE_ID]: { deviceCount: 50, rackCount: 8, cols: 4 },
};

export const sampleRegisteredDevices: RegisteredDevice[] = sampleNodes.flatMap((node, idx) => {
  if (node.type !== "room") return [];
  const config = ROOM_CONFIG[node.nodeId];
  if (!config) return [];
  return generateRegisteredDevices(node.nodeId, node.name, config.deviceCount, `10.${idx + 1}.1.1`, idx);
});

// ── 랙 생성 (face-to-face 핫/콜드 통로 레이아웃) ────────────────────────────────
const RACK_SIZES: (24 | 32 | 48)[] = [24, 32, 48];

const generateGroupRacks = (
  count: number,
  nodeId: string,
  colsPerRow: number,
  errorIndexes: number[],
  regDevices: RegisteredDevice[],
): Rack[] => {
  const racks: Rack[] = [];
  let deviceIdx = 0;

  const totalRows = Math.ceil(count / colsPerRow);
  const totalRowWidth = colsPerRow * (RACK_WIDTH_STANDARD + 0.01) - 0.01;
  const startX = -totalRowWidth / 2;

  // face-to-face Z 계산
  const lastRow = totalRows - 1;
  const lastPair = Math.floor(lastRow / 2);
  const totalZ = lastPair * 4.75 + (lastRow % 2 !== 0 ? 1.75 : 0);
  const startZ = -totalZ / 2;

  for (let localIdx = 0; localIdx < count; localIdx++) {
    const row = Math.floor(localIdx / colsPerRow);
    const col = localIdx % colsPerRow;

    const width = RACK_WIDTH_STANDARD;
    const rackSize = RACK_SIZES[localIdx % RACK_SIZES.length];

    const hasError = errorIndexes.includes(localIdx);
    const devices: Device[] = [];
    let currentUPos = 1;

    // 랙에 장비 채우기
    while (currentUPos <= rackSize && deviceIdx < regDevices.length) {
      const regDevice = regDevices[deviceIdx];
      
      if (currentUPos + (regDevice.size || 1) - 1 <= rackSize) {
        const device: Device = {
          itemId: generateUUID(),
          title: regDevice.title,
          type: regDevice.type || "Server",
          size: (regDevice.size || 1),
          position: currentUPos,
          modelName: regDevice.modelName,
          vendor: regDevice.vendor,
          deviceId: regDevice.deviceId,
          portStates: [],
          insertedCards: [],
        };

        // 에러 포트 설정 — portName/portNumber 사전 설정으로 PortErrorSynchronizer 트리거 방지
        if (hasError && devices.length === 0) {
          const portNum = (localIdx * 3 + 5) % 24 + 1;
          const errorLevels = ["warning", "minor", "major", "critical"] as const;
          device.portStates = [{
            portId: `port-${portNum}`,
            status: "error" as const,
            errorLevel: errorLevels[localIdx % errorLevels.length],
            errorMessage: "Link down",
            portNumber: String(portNum),
            portName: `Port ${portNum}`, // 사전 설정 — enrichment 트리거 방지
          }];
        }

        devices.push(device);
        currentUPos += (regDevice.size || 1) + 1;
        deviceIdx++;
      } else {
        break;
      }
    }

    // Hot/cold aisle layout (face-to-face)
    const pair = Math.floor(row / 2);
    const isSecondInPair = row % 2 !== 0;
    const pairSpacing = 4.75;
    const baseY = pair * pairSpacing;
    const posZ = baseY + (isSecondInPair ? 1.75 : 0) + startZ;
    const orient: Orientation = isSecondInPair ? 0 : 180;

    const worldX = startX + col * (RACK_WIDTH_STANDARD + 0.01) + (width / 2);
    const stateX = worldX / GRID_SPACING;

    racks.push({
      rackId: generateUUID(),
      mapId: nodeId,
      rackSize,
      width,
      position: [stateX, posZ],
      orientation: orient,
      devices,
    });
  }
  return racks;
};

// ── IXR-X1 데모 장비 (포트 에러 포함, portName 사전 설정) ──────────────────────
const IX1_PORT_ERROR_DEVICE: Device = {
  itemId: "iXR-X1-demo-device-001",
  deviceId: "iXR-X1-demo-registered-001",
  title: "7250 IXR-X1 (Demo)",
  type: "Router",
  modelName: "7250 IXR-X1",
  vendor: "Nokia",
  size: 1,
  position: 1,
  portStates: [
    { portId: "port-5",  status: "error", errorLevel: "critical", errorMessage: "Link down - Physical layer failure", portNumber: "5", portName: "Port 5" },
    { portId: "port-13", status: "error", errorLevel: "major",    errorMessage: "CRC error rate exceeded threshold", portNumber: "13", portName: "Port 13" },
    { portId: "port-21", status: "error", errorLevel: "warning",  errorMessage: "High latency detected", portNumber: "21", portName: "Port 21" },
    { portId: "port-1",  status: "normal", portNumber: "1" },
    { portId: "port-3",  status: "normal", portNumber: "3" },
    { portId: "port-7",  status: "normal", portNumber: "7" },
    { portId: "port-9",  status: "normal", portNumber: "9" },
    { portId: "port-11", status: "normal", portNumber: "11" },
    { portId: "port-15", status: "normal", portNumber: "15" },
    { portId: "port-17", status: "normal", portNumber: "17" },
    { portId: "port-19", status: "normal", portNumber: "19" },
    { portId: "port-23", status: "normal", portNumber: "23" },
  ],
};

// ── 최종 샘플 랙 생성 ──────────────────────────────────────────────────────────
export const sampleRacks: Rack[] = (() => {
  const racks = sampleNodes.flatMap((node) => {
    if (node.type !== "room") return [];
    const config = ROOM_CONFIG[node.nodeId];
    if (!config) return [];

    const nodeDevices = sampleRegisteredDevices.filter((d) => d.deviceGroupId === node.nodeId);

    // 에러 랙 인덱스: 전산실별로 2~4개 랙에 에러 배치
    const errorCount = Math.min(4, Math.max(2, Math.floor(config.rackCount / 5)));
    const errorIndexes: number[] = [];
    for (let i = 0; i < errorCount; i++) {
      errorIndexes.push(Math.floor((i + 1) * config.rackCount / (errorCount + 1)));
    }

    return generateGroupRacks(config.rackCount, node.nodeId, config.cols, errorIndexes, nodeDevices);
  });

  // 강남 1전산실 첫 번째 랙에 IXR-X1 데모 장비 삽입
  const gangnamRackIdx = racks.findIndex((r) => r.mapId === GANGNAM_ROOM_1_NODE_ID);
  if (gangnamRackIdx !== -1) {
    const targetRack = racks[gangnamRackIdx];
    const midIdx = Math.floor(targetRack.devices.length / 2);
    
    if (targetRack.devices[midIdx]) {
      const targetPos = targetRack.devices[midIdx].position;
      targetRack.devices[midIdx] = {
        ...IX1_PORT_ERROR_DEVICE,
        position: targetPos,
      };
    } else {
      targetRack.devices.push(IX1_PORT_ERROR_DEVICE);
    }
  }

  return racks;
})();
