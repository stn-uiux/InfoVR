import layoutSTN from "../assets/layout_STN.json";
import { ROOT_NODE_ID } from "./nodeUtils";
import type { HierarchyNode, Rack, ImportedModel, RegisteredDevice } from "../types";
import type { CustomEquipmentModel } from "../types/equipment";
import { resolveDeviceType } from "./deviceTemplates";
import {
  DEFAULT_CYBER_SPACE_CONFIG,
  LIGHT_THEME_CYBER_SPACE_CONFIG,
  type CyberSpaceConfig,
} from "../types/cyberSpace";
import type { AppState } from "../store/useStore";
import initialCustomModelsData from "./customModels.json";

export interface DefaultLayoutData {
  roomId: string;
  roomName: string;
  nodes: HierarchyNode[];
  racks: Rack[];
  importedModels: ImportedModel[];
  registeredDevices: RegisteredDevice[];
  layouts: Record<string, { racks: Rack[]; importedModels: ImportedModel[] }>;
  nodeEnvironments: Record<string, Partial<CyberSpaceConfig>>;
  cyberSpaceConfig: CyberSpaceConfig;
}

export function getDefaultLayoutData(
  customModels?: CustomEquipmentModel[],
  isLightMode?: boolean,
  lowSpecMode?: boolean,
): DefaultLayoutData {
  const models = customModels && customModels.length > 0
    ? customModels
    : (initialCustomModelsData as unknown as CustomEquipmentModel[]);

  const isLight = isLightMode !== undefined
    ? isLightMode
    : (typeof localStorage !== "undefined" && localStorage.getItem("comm-theme") === "light");

  const baseThemeConfig = isLight ? LIGHT_THEME_CYBER_SPACE_CONFIG : DEFAULT_CYBER_SPACE_CONFIG;

  const roomId = (layoutSTN as any).roomId || "node-1791858160423-0qozazmmj";
  const roomName = (layoutSTN as any).roomName || "테스트베드";

  const rootNode: HierarchyNode = {
    nodeId: ROOT_NODE_ID,
    parentId: null,
    name: "STN",
    type: "root",
    order: 0,
  };

  const roomNode: HierarchyNode = {
    nodeId: roomId,
    parentId: ROOT_NODE_ID,
    name: roomName,
    type: "room",
    order: 0,
  };

  const nodes: HierarchyNode[] = [rootNode, roomNode];

  const racks: Rack[] = ((layoutSTN as any).racks || []).map((r: any) => ({
    ...r,
    mapId: roomId,
    devices: (r.devices || []).map((d: any) => ({
      ...d,
      type: resolveDeviceType(d.modelName, d.type, models),
    })),
  }));

  const importedModels: ImportedModel[] = ((layoutSTN as any).importedModels || []).map((m: any) => ({
    ...m,
    type: resolveDeviceType(m.modelName, m.type, models),
  }));

  const registeredDevices: RegisteredDevice[] = ((layoutSTN as any).registeredDevices || []).map((d: any) => ({
    ...d,
    deviceGroupId: roomId,
    type: resolveDeviceType(d.modelName, d.type, models),
  }));

  const rawCsConfig = (layoutSTN as any).cyberSpaceConfig || {};

  // Theme-specific colors must follow the active theme (baseThemeConfig),
  // while room-specific size/performance parameters are preserved from layoutSTN.
  const cyberSpaceConfig: CyberSpaceConfig = {
    ...baseThemeConfig,
    cyberSpaceEnabled: rawCsConfig.cyberSpaceEnabled ?? baseThemeConfig.cyberSpaceEnabled,
    csCustomSpaceSize: rawCsConfig.csCustomSpaceSize ?? baseThemeConfig.csCustomSpaceSize,
    csRoomWidthCm: rawCsConfig.csRoomWidthCm ?? baseThemeConfig.csRoomWidthCm,
    csRoomLengthCm: rawCsConfig.csRoomLengthCm ?? baseThemeConfig.csRoomLengthCm,
    csOffsetXCm: rawCsConfig.csOffsetXCm ?? baseThemeConfig.csOffsetXCm,
    csOffsetZCm: rawCsConfig.csOffsetZCm ?? baseThemeConfig.csOffsetZCm,
    csLowSpecMode: lowSpecMode !== undefined ? lowSpecMode : (rawCsConfig.csLowSpecMode ?? baseThemeConfig.csLowSpecMode),
    csIsLightMode: isLight,
  };

  const layouts = {
    [roomId]: {
      racks,
      importedModels,
    },
  };

  // Only store room size & performance overrides in nodeEnvironments, NEVER theme colors
  const nodeEnvironments: Record<string, Partial<CyberSpaceConfig>> = {
    [roomId]: {
      cyberSpaceEnabled: cyberSpaceConfig.cyberSpaceEnabled,
      csCustomSpaceSize: cyberSpaceConfig.csCustomSpaceSize,
      csRoomWidthCm: cyberSpaceConfig.csRoomWidthCm,
      csRoomLengthCm: cyberSpaceConfig.csRoomLengthCm,
      csOffsetXCm: cyberSpaceConfig.csOffsetXCm,
      csOffsetZCm: cyberSpaceConfig.csOffsetZCm,
      csLowSpecMode: cyberSpaceConfig.csLowSpecMode,
    },
  };

  return {
    roomId,
    roomName,
    nodes,
    racks,
    importedModels,
    registeredDevices,
    layouts,
    nodeEnvironments,
    cyberSpaceConfig,
  };
}

export function applyDefaultSTNLayout(set: (fn: (state: AppState) => Partial<AppState>) => void, get?: () => AppState) {
  const state = get ? get() : undefined;
  const customModels = state?.customModels;
  const isLight = state?.csIsLightMode ?? (typeof localStorage !== "undefined" && localStorage.getItem("comm-theme") === "light");
  const currentLowSpec = state?.csLowSpecMode;
  const data = getDefaultLayoutData(customModels, isLight, currentLowSpec);

  set((prev) => {
    const preservedLowSpec = currentLowSpec !== undefined ? currentLowSpec : prev.csLowSpecMode;
    return {
      ...prev,
      nodes: data.nodes,
      racks: data.racks,
      importedModels: data.importedModels,
      registeredDevices: data.registeredDevices,
      layouts: data.layouts,
      nodeEnvironments: data.nodeEnvironments,
      activeNodeId: data.roomId,
      activeSceneNodeId: data.roomId,
      cyberSpaceConfig: {
        ...data.cyberSpaceConfig,
        csLowSpecMode: preservedLowSpec,
      },
      ...data.cyberSpaceConfig,
      csLowSpecMode: preservedLowSpec,
      // Baseline synchronization to ensure clean (not dirty) initial state
      baselineNodes: structuredClone(data.nodes),
      baselineRacks: structuredClone(data.racks),
      baselineModels: structuredClone(data.importedModels),
      baselineRegisteredDevices: structuredClone(data.registeredDevices),
      baselineLayouts: structuredClone(data.layouts),
      baselineNodeEnvironments: structuredClone(data.nodeEnvironments),
      baselineActiveNodeId: data.roomId,
      baselineActiveSceneNodeId: data.roomId,
      _importDirty: false,
    };
  });
}
