import type { HierarchyNode, NodeType, PortState, RegisteredDevice, Rack } from "../types";

// ─── Default Node IDs (고정 상수) ──────────────────────────────────────────────

// depth 1
export const ROOT_NODE_ID = "stn-root";
// depth 2
export const SUDOGWON_NODE_ID = "sudogwon";
export const CHUNGCHEONG_NODE_ID = "chungcheong";
// depth 3
export const SEOUL_NODE_ID = "seoul";
export const GYEONGGI_NODE_ID = "gyeonggi";
// depth 4
export const GANGNAM_CENTER_NODE_ID = "gangnam-center";
export const GANGBUK_CENTER_NODE_ID = "gangbuk-center";
export const GWACHEON_CENTER_NODE_ID = "gwacheon-center";
export const DAEJEON_CENTER_NODE_ID = "daejeon-center";
export const SEJONG_CENTER_NODE_ID = "sejong-center";
// depth 5 (rooms)
export const GANGNAM_ROOM_1_NODE_ID = "gangnam-room-1"; 
export const GANGNAM_ROOM_2_NODE_ID = "gangnam-room-2"; 
export const GANGNAM_ROOM_3_NODE_ID = "gangnam-room-3"; 
export const GANGBUK_ROOM_1_NODE_ID = "gangbuk-room-1";
export const GANGBUK_ROOM_2_NODE_ID = "gangbuk-room-2";
export const GWACHEON_ROOM_1_NODE_ID = "gwacheon-room-1";
export const GWACHEON_ROOM_2_NODE_ID = "gwacheon-room-2";
export const DAEJEON_ROOM_NODE_ID = "daejeon-room-1"; 
export const SEJONG_ROOM_NODE_ID = "sejong-room-1";
export const NONE_NODE_ID = "none";

// ─── Default Tree ──────────────────────────────────────────────────────────────

/** 5-Depth Tree: STN > 지역 > 도시 > 센터 > 서버실 */
export const getDefaultNodes = (): HierarchyNode[] => [
  // Depth 1
  { nodeId: ROOT_NODE_ID, parentId: null, name: "STN", type: "root", order: 0 },
  // Depth 2
  { nodeId: SUDOGWON_NODE_ID, parentId: ROOT_NODE_ID, name: "수도권", type: "group", order: 0 },
  { nodeId: CHUNGCHEONG_NODE_ID, parentId: ROOT_NODE_ID, name: "충청권", type: "group", order: 1 },
  // Depth 3
  { nodeId: SEOUL_NODE_ID, parentId: SUDOGWON_NODE_ID, name: "서울", type: "group", order: 0 },
  { nodeId: GYEONGGI_NODE_ID, parentId: SUDOGWON_NODE_ID, name: "경기", type: "group", order: 1 },
  // Depth 4
  { nodeId: GANGNAM_CENTER_NODE_ID, parentId: SEOUL_NODE_ID, name: "강남센터", type: "group", order: 0 },
  { nodeId: GANGBUK_CENTER_NODE_ID, parentId: SEOUL_NODE_ID, name: "강북센터", type: "group", order: 1 },
  { nodeId: GWACHEON_CENTER_NODE_ID, parentId: GYEONGGI_NODE_ID, name: "과천센터", type: "group", order: 2 },
  { nodeId: DAEJEON_CENTER_NODE_ID, parentId: CHUNGCHEONG_NODE_ID, name: "대전센터", type: "group", order: 0 },
  { nodeId: SEJONG_CENTER_NODE_ID, parentId: CHUNGCHEONG_NODE_ID, name: "세종센터", type: "group", order: 1 },
  // Depth 5
  { nodeId: GANGNAM_ROOM_1_NODE_ID, parentId: GANGNAM_CENTER_NODE_ID, name: "강남 1전산실", type: "room", order: 0 },
  { nodeId: GANGNAM_ROOM_2_NODE_ID, parentId: GANGNAM_CENTER_NODE_ID, name: "강남 2전산실", type: "room", order: 1 },
  { nodeId: GANGNAM_ROOM_3_NODE_ID, parentId: GANGNAM_CENTER_NODE_ID, name: "강남 3전산실", type: "room", order: 2 },
  { nodeId: GANGBUK_ROOM_1_NODE_ID, parentId: GANGBUK_CENTER_NODE_ID, name: "강북 1전산실", type: "room", order: 0 },
  { nodeId: GANGBUK_ROOM_2_NODE_ID, parentId: GANGBUK_CENTER_NODE_ID, name: "강북 2전산실", type: "room", order: 1 },
  { nodeId: GWACHEON_ROOM_1_NODE_ID, parentId: GWACHEON_CENTER_NODE_ID, name: "과천 1전산실", type: "room", order: 0 },
  { nodeId: GWACHEON_ROOM_2_NODE_ID, parentId: GWACHEON_CENTER_NODE_ID, name: "과천 2전산실", type: "room", order: 1 },
  { nodeId: DAEJEON_ROOM_NODE_ID, parentId: DAEJEON_CENTER_NODE_ID, name: "대전센터 전산실", type: "room", order: 0 },
  { nodeId: SEJONG_ROOM_NODE_ID, parentId: SEJONG_CENTER_NODE_ID, name: "세종센터 전산실", type: "room", order: 0 },
];

// ─── Tree Traversal Utilities ──────────────────────────────────────────────────

/** 직계 자식 노드 반환 (order 순 정렬) */
export const getChildren = (
  nodes: HierarchyNode[],
  parentId: string | null,
): HierarchyNode[] =>
  nodes
    .filter((n) => n.parentId === parentId)
    .sort((a, b) => {
      const aIsGroup = a.type !== 'room';
      const bIsGroup = b.type !== 'room';
      if (aIsGroup && !bIsGroup) return -1;
      if (!aIsGroup && bIsGroup) return 1;
      return a.order - b.order;
    });

/** 지정 노드 + 하위 전체 nodeId 집합 반환 (자기 포함) */
export const getSubtreeNodeIds = (
  nodes: HierarchyNode[],
  nodeId: string,
): Set<string> => {
  const result = new Set<string>();
  const stack = [nodeId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    result.add(current);
    for (const child of nodes) {
      if (child.parentId === current && !result.has(child.nodeId)) {
        stack.push(child.nodeId);
      }
    }
  }
  return result;
};

/** root까지 조상 경로 배열 반환 [root, ..., parent, self] (breadcrumb용) */
export const getAncestorPath = (
  nodes: HierarchyNode[],
  nodeId: string | null,
): HierarchyNode[] => {
  if (!nodeId) return [];
  const path: HierarchyNode[] = [];
  let current = nodes.find((n) => n.nodeId === nodeId);
  while (current) {
    path.unshift(current);
    current = current.parentId
      ? nodes.find((n) => n.nodeId === current!.parentId)
      : undefined;
  }
  return path;
};

/** root 노드 찾기 */
export const getRootNode = (
  nodes: HierarchyNode[],
): HierarchyNode | undefined => nodes.find((n) => n.parentId === null);

/** 노드 ID로 노드 찾기 */
export const findNode = (
  nodes: HierarchyNode[],
  nodeId: string | null,
): HierarchyNode | undefined => {
  if (!nodeId) return undefined;
  return nodes.find((n) => n.nodeId === nodeId);
};

/** 특정 노드가 leaf인지 (자식 없는지) 확인 */
export const isLeafNode = (
  nodes: HierarchyNode[],
  nodeId: string,
): boolean => !nodes.some((n) => n.parentId === nodeId);

// ─── Migration Helpers ─────────────────────────────────────────────────────────

/** 이전 groupName → nodeId 매핑 (하위 호환) */
export const migrateGroupNameToNodeId = (
  groupName: string,
): string => {
  switch (groupName) {
    case "과천":
    case "gwacheon":
      return GANGNAM_ROOM_1_NODE_ID;
    case "대전":
    case "daejeon":
      return DAEJEON_ROOM_NODE_ID;
    default:
      return groupName; // return as is if not a known legacy name
  }
};

/** 노드 ID를 기반으로 노드 이름을 로버스트하게 반환 (fallback 포함) */
export const getNodeName = (
  nodes: HierarchyNode[],
  nodeId: string | null,
): string => {
  if (!nodeId || nodeId === NONE_NODE_ID) return "없음";
  
  // 1. Direct match
  const direct = findNode(nodes, nodeId);
  if (direct) return direct.name;
  
  // 2. Try migration mapping
  const migratedId = migrateGroupNameToNodeId(nodeId);
  if (migratedId !== nodeId) {
    const migrated = findNode(nodes, migratedId);
    if (migrated) return migrated.name;
  }
  
  // 3. Known ID logic
  if (nodeId === "gwacheon-room-1f" || nodeId === "gwacheon") return "강남 1전산실";
  if (nodeId === "daejeon-room-1f" || nodeId === "daejeon") return "대전센터 전산실";
  
  return nodeId; // Final fallback
};

/** 노드의 깊이 반환 (root = 1) */
export const getNodeDepth = (nodes: HierarchyNode[], nodeId: string | null): number => {
  if (!nodeId) return 0;
  const path = getAncestorPath(nodes, nodeId);
  return path.length;
};

/** 노드의 전체 경로 이름 반환 (예: "STN > 수도권 > 경기") */
export const getFullPath = (nodes: HierarchyNode[], nodeId: string | null): string => {
  if (!nodeId) return "";
  const path = getAncestorPath(nodes, nodeId);
  if (path.length === 0) return "";
  return path.map((n) => n.name).join(" > ");
};

/** 특정 노드 및 모든 하위 노드의 전체 장비 개수 합산 반환 */
export const getSubtreeEquipmentCount = (
  nodes: HierarchyNode[],
  registeredDevices: RegisteredDevice[],
  nodeId: string,
): number => {
  const descendantIds = getSubtreeNodeIds(nodes, nodeId);
  return registeredDevices.filter((rd) => descendantIds.has(rd.deviceGroupId || '')).length;
};

/** 특정 노드의 직계 장비 개수 반환 (등록 장비 기준) */
export const getNodeEquipmentCount = (
  registeredDevices: RegisteredDevice[],
  nodeId: string | "ALL",
): number => {
  if (nodeId === "ALL") return registeredDevices.length;
  return registeredDevices.filter((rd) => rd.deviceGroupId === nodeId).length;
};

export const getNodeDevices = (
  nodeId: string,
  registeredDevices: RegisteredDevice[],
  racks: Rack[],
): { device: RegisteredDevice; rackId: string | null; instanceId: string | null; portStates: PortState[] | undefined }[] => {
  const nodeRegDevices = registeredDevices.filter((rd) => rd.deviceGroupId === nodeId);

  const placementMap = new Map<string, { rackId: string; instanceId: string; portStates: PortState[] | undefined }>();
  for (const r of racks) {
    for (const d of r.devices) {
      if (d.deviceId) placementMap.set(d.deviceId, { rackId: r.rackId, instanceId: d.itemId, portStates: d.portStates });
    }
  }

  return nodeRegDevices.map((rd) => {
    const placement = placementMap.get(rd.deviceId);
    return { 
      device: rd, 
      rackId: placement?.rackId || null, 
      instanceId: placement?.instanceId || null,
      portStates: placement?.portStates
    };
  });
};

export const getSubtreeDevices = (
  nodes: HierarchyNode[],
  nodeId: string,
  registeredDevices: RegisteredDevice[],
  racks: Rack[],
): { 
  device: RegisteredDevice; 
  rackId: string | null; 
  instanceId: string | null;
  portStates: PortState[] | undefined;
}[] => {
  const descendantIds = getSubtreeNodeIds(nodes, nodeId);
  const nodeRegDevices = registeredDevices.filter((rd) => descendantIds.has(rd.deviceGroupId || ''));

  const placementMap = new Map<string, { rackId: string; instanceId: string; portStates: PortState[] | undefined }>();
  for (const r of racks) {
    for (const d of r.devices) {
      if (d.deviceId) placementMap.set(d.deviceId, { rackId: r.rackId, instanceId: d.itemId, portStates: d.portStates });
    }
  }

  return nodeRegDevices.map((rd) => {
    const placement = placementMap.get(rd.deviceId);
    return { 
      device: rd, 
      rackId: placement?.rackId || null, 
      instanceId: placement?.instanceId || null,
      portStates: placement?.portStates 
    };
  });
};


/**
 * 특정 경로 문자열(예: "STN > 수도권 > 경기")을 기반으로 노드들을 조회하거나 생성 정보를 생성합니다.
 * 실제 Store 반영은 upsertNodes 등을 통해 수행되어야 합니다.
 */
export const resolvePathToNodeId = (
  nodes: HierarchyNode[],
  pathStr: string,
  existingNewNodes: HierarchyNode[] = [],
  nodeTypeHint?: string,
): { nodeId: string; newNodes: HierarchyNode[] } => {
  const parts = pathStr.split(">").map((s) => s.trim());
  const allNodes = [...nodes, ...existingNewNodes];
  const createdNodes: HierarchyNode[] = [];

  let currentParentId: string | null = null;
  let lastNodeId = "";

  for (let i = 0; i < parts.length; i++) {
    const partName = parts[i];
    // 현재 부모 아래에 같은 이름을 가진 노드가 있는지 확인
    const found = allNodes.find(
      (n) => n.name.trim().toLowerCase() === partName.toLowerCase() && n.parentId === currentParentId,
    );

    if (found) {
      currentParentId = found.nodeId;
      lastNodeId = found.nodeId;
    } else {
      // 노드 생성
      const isLeaf = i === parts.length - 1;
      const newNodeId = `node-${Math.random().toString(36).substring(2, 9)}`;
      const newNode: HierarchyNode = {
        nodeId: newNodeId,
        parentId: currentParentId,
        name: partName,
        type: i === 0 ? "root" : (isLeaf && nodeTypeHint ? nodeTypeHint as NodeType : "group"),
        order: 99, // 신규 생성 노드는 우선 뒤로 배치
      };
      createdNodes.push(newNode);
      allNodes.push(newNode);
      currentParentId = newNodeId;
      lastNodeId = newNodeId;
    }
  }

  return { nodeId: lastNodeId, newNodes: createdNodes };
};
