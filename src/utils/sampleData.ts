import type { Rack, RegisteredDevice, HierarchyNode, Device, Orientation } from "../types";
import { DEVICE_TEMPLATES } from "./deviceTemplates";
import { 
  getDefaultNodes, 
  GANGNAM_ROOM_1_NODE_ID,
} from "./nodeUtils";
import {
  RACK_WIDTH_STANDARD,
  GRID_SPACING,
} from "../components/constants";

export const generateUUID = () => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return (
    Math.random().toString(36).substring(2, 12) +
    Math.random().toString(36).substring(2, 12)
  );
};

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
    const env = ENVIRONMENTS[Math.floor(Math.random() * ENVIRONMENTS.length)];
    const eqType = template.type === "Server" 
      ? ["WAS", "DB", "WEB"][Math.floor(Math.random() * 3)] 
      : "SW";
    const sysName = SYSTEMS[Math.floor(Math.random() * SYSTEMS.length)];
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
      vendor: "Nokia",
    };
  });

export const sampleNodes: HierarchyNode[] = getDefaultNodes();

// Varying equipment counts per node based on depth and index
export const sampleRegisteredDevices: RegisteredDevice[] = sampleNodes.flatMap((node, idx) => {
  // Root node gets no equipment, but sites, centers and rooms get them
  if (node.type !== "room") return []; // Only room nodes get equipment
  
  let count = 0;
  if (node.nodeId === GANGNAM_ROOM_1_NODE_ID) {
    count = 420; // Lots of devices for the main server room
  } else {
    count = 240 + (idx % 10) * 20; // 240 to 420 devices deterministically
  }
  return generateRegisteredDevices(node.nodeId, node.name, count, `10.${idx + 1}.1.1`, idx);
});

const generateGroupRacks = (
  count: number,
  nodeId: string,
  colsPerRow: number,
  errorIndexes: number[],
  regDevices: RegisteredDevice[],
  faceToFace: boolean = false,
): Rack[] => {
  const racks: Rack[] = [];
  let deviceIdx = 0;

  for (let localIdx = 0; localIdx < count; localIdx++) {
    const row = Math.floor(localIdx / colsPerRow);
    const col = localIdx % colsPerRow;

    const width = RACK_WIDTH_STANDARD;
    const rackSize: 24 | 32 | 48 =
      [24, 32, 48][Math.floor(Math.random() * 3)] as 24 | 32 | 48;

    const hasError = errorIndexes.includes(localIdx);
    const devices: Device[] = [];
    let currentUPos = 1;

    const totalRows = Math.ceil(count / colsPerRow);
    const totalRowWidth = colsPerRow * (RACK_WIDTH_STANDARD + 0.01) - 0.01;
    const startX = -totalRowWidth / 2;
    
    let totalZ = 0;
    if (faceToFace) {
      const lastRow = totalRows - 1;
      const lastPair = Math.floor(lastRow / 2);
      totalZ = lastPair * 4.75 + (lastRow % 2 !== 0 ? 1.75 : 0);
    } else {
      totalZ = (totalRows - 1) * 4.0;
    }
    const startZ = -totalZ / 2;

    // Fill rack until we run out of height or available devices for this node
    while (currentUPos <= rackSize && deviceIdx < regDevices.length) {
      const regDevice = regDevices[deviceIdx];
      
      // Check if it fits in remaining space
      if (currentUPos + (regDevice.size || 1) - 1 <= rackSize) {
        devices.push({
          itemId: generateUUID(),
          title: regDevice.title,
          type: regDevice.type || "Server",
          size: (regDevice.size || 1),
          position: currentUPos,
          modelName: regDevice.modelName,
          vendor: regDevice.vendor,
          deviceId: regDevice.deviceId,
          portStates: [],
        });
        
        currentUPos += (regDevice.size || 1) + 1; // 1U gap between devices
        deviceIdx++; // Move to next unique device
      } else {
        // Doesn't fit, stop filling this rack
        break;
      }
    }

    if (hasError && devices.length > 0) {
      const errorDeviceIdx = Math.floor(Math.random() * devices.length);
      const portNum = Math.floor(Math.random() * 24) + 1;
      devices[errorDeviceIdx].portStates = [{
        portId: `port-${portNum}`,
        status: "error" as const,
        errorLevel: (
          ["warning", "minor", "major", "critical"] as const
        )[Math.floor(Math.random() * 4)],
        errorMessage: "Link down",
        portNumber: String(portNum),
      }];
    }

    const worldX = startX + col * (RACK_WIDTH_STANDARD + 0.01) + (width / 2);
    const stateX = worldX / GRID_SPACING;
    
    // Aisle arrangement: face-to-face pairs with 1.75 unit front gap
    let posZ = row * 4.0;
    let orient = 180;
    
    if (faceToFace) {
      // Hot/cold aisle layout:
      // Row 0: orient=180, z = baseY         (앞면이 아래를 향함)
      // Row 1: orient=0,   z = baseY + 1.75  (앞면이 위를 향함) -> cold aisle = 1.75칸
      // Row 2: orient=180, z = baseY + 4.75  (다음 페어, hot aisle gap = 3.0)
      // Row 3: orient=0,   z = baseY + 6.5   ...
      const pair = Math.floor(row / 2);
      const isSecondInPair = row % 2 !== 0;
      
      const pairSpacing = 4.75; // 1.75 cold + 3.0 hot
      const baseY = pair * pairSpacing;
      posZ = baseY + (isSecondInPair ? 1.75 : 0);
      orient = isSecondInPair ? 0 : 180;
    }

    // Offset Z to center the group
    posZ += startZ;

    racks.push({
      rackId: generateUUID(),
      mapId: nodeId,
      rackSize,
      width,
      position: [stateX, posZ],
      orientation: orient as Orientation,
      devices,
    });
  }
  return racks;
};

// 수도권 과천 랙에 삽입할 7250 IXR-X1 장비 (포트 에러 포함)
const IX1_PORT_ERROR_DEVICE: Device = {
  itemId: "iXR-X1-demo-device-001",
  deviceId: "iXR-X1-demo-registered-001",
  title: "7250 IXR-X1 (Demo)",
  type: "Router",
  modelName: "7250 IXR-X1",
  vendor: "Nokia",
  size: 1,
  position: 1, // U1 위치에 탑재
  // port-5 (critical), port-13 (major), port-21 (warning) 에러
  portStates: [
    { portId: "port-5",  status: "error", errorLevel: "critical", errorMessage: "Link down - Physical layer failure", portNumber: "5" },
    { portId: "port-13", status: "error", errorLevel: "major",    errorMessage: "CRC error rate exceeded threshold", portNumber: "13" },
    { portId: "port-21", status: "error", errorLevel: "warning",  errorMessage: "High latency detected", portNumber: "21" },
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

export const sampleRacks: Rack[] = (() => {
  const racks = sampleNodes.flatMap((node, idx) => {
    const nodeDevices = sampleRegisteredDevices.filter((d) => d.deviceGroupId === node.nodeId);
    if (node.type !== "room") return []; // Only rooms get racks

    if (node.nodeId === GANGNAM_ROOM_1_NODE_ID) {
      // Showcase room: 60 racks, 15 per row, face-to-face
      return generateGroupRacks(60, node.nodeId, 15, [1, 5, 12, 20, 25, 30, 45, 55], nodeDevices, true);
    }

    // All other server rooms: 30+ racks, face-to-face aisle layout
    const rackCount = 30 + (idx % 10);
    return generateGroupRacks(rackCount, node.nodeId, 10, [2, 8, 15, 22], nodeDevices, true);
  });

  // 수도권(강남) 첫 번째 랙에 IXR-X1 데모 장비 삽입
  const gwacheonRackIdx = racks.findIndex((r) => r.mapId === GANGNAM_ROOM_1_NODE_ID);
  if (gwacheonRackIdx !== -1) {
    const targetRack = racks[gwacheonRackIdx];
    // 기존 디바이스를 밀지 않고 랙 중간 높이의 랜덤한 장비와 교체하여 다양한 위치에 배치
    const randomIndex = Math.floor(targetRack.devices.length * 0.5 + Math.random() * (targetRack.devices.length * 0.3));
    
    if (targetRack.devices[randomIndex]) {
      const targetPos = targetRack.devices[randomIndex].position;
      targetRack.devices[randomIndex] = {
        ...IX1_PORT_ERROR_DEVICE,
        position: targetPos,
      };
    } else {
      targetRack.devices.push(IX1_PORT_ERROR_DEVICE);
    }
  }

  return racks;
})();
