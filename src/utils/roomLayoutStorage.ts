import { AppState } from "../store/useStore";
import type { Rack, RegisteredDevice, ImportedModel } from "../types";

export interface RoomLayoutJson {
  version: string;
  roomId: string;
  cyberSpaceConfig?: any;
  racks: Rack[];
  importedModels: ImportedModel[];
  registeredDevices: RegisteredDevice[];
}

export const exportRoomLayoutJson = (roomId: string, storeState: AppState) => {
  if (!roomId) {
    storeState.showToast("내보낼 전산실이 선택되지 않았습니다.", "error");
    return;
  }

  const isCurrentRoom = roomId === storeState.activeNodeId;
  const layout = storeState.layouts[roomId];
  const racks = isCurrentRoom ? storeState.racks : (layout?.racks || []);
  const importedModels = isCurrentRoom ? storeState.importedModels : (layout?.importedModels || []);
  const cyberSpaceConfig = storeState.nodeEnvironments[roomId];

  const registeredDevices = storeState.registeredDevices.filter(
    (d) => d.deviceGroupId === roomId
  );

  const exportData: RoomLayoutJson = {
    version: "1.0",
    roomId,
    cyberSpaceConfig,
    racks,
    importedModels,
    registeredDevices,
  };

  const jsonStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  
  // Find room name for the file name
  const roomNode = storeState.nodes.find(n => n.nodeId === roomId);
  const roomName = roomNode ? roomNode.name : "Room";
  
  a.href = url;
  a.download = `layout_${roomName.replace(/\s+/g, '_')}_${new Date().getTime()}.json`;
  a.click();
  URL.revokeObjectURL(url);

  storeState.showToast("전산실 레이아웃을 성공적으로 내보냈습니다.", "success");
};

export const importRoomLayoutJson = async (
  roomId: string,
  file: File,
  storeState: AppState
) => {
  if (!roomId) {
    storeState.showToast("불러올 전산실이 선택되지 않았습니다.", "error");
    return;
  }

  try {
    const text = await file.text();
    const data: RoomLayoutJson = JSON.parse(text);

    if (data.version !== "1.0" || !Array.isArray(data.racks)) {
      throw new Error("유효하지 않은 레이아웃 파일입니다.");
    }

    if (data.cyberSpaceConfig) {
      storeState.setCyberSpaceConfig(data.cyberSpaceConfig);
    }

    const newRacks = (data.racks || []).map(r => {
      const newRackId = crypto.randomUUID();
      return {
        ...r,
        rackId: newRackId,
        mapId: roomId,
        devices: r.devices.map(d => ({ ...d, itemId: crypto.randomUUID(), rackId: newRackId }))
      };
    });
    const newModels = (data.importedModels || []).map(m => ({
      ...m,
      id: crypto.randomUUID()
    }));
    const newDevices = (data.registeredDevices || []).map(d => ({
      ...d,
      deviceGroupId: roomId
    }));

    // Call a store action to replace the layout for the room.
    storeState.replaceRoomLayout(roomId, newRacks, newModels, newDevices);

    storeState.showToast("레이아웃을 성공적으로 불러왔습니다.", "success");
  } catch (error) {
    console.error("Import failed:", error);
    storeState.showToast("레이아웃 불러오기에 실패했습니다.", "error");
  }
};
