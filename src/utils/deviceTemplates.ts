import type { DeviceType, VendorName } from "../types";
import type { CustomEquipmentModel, EquipmentVariant } from "../types/equipment";

export interface DeviceTemplate {
  modelName: string;
  type: DeviceType;
  uSize: number;
  vendor: VendorName;
  /** true if this template was created from a user-registered custom model */
  isCustom?: boolean;
  /** Reference to the custom model ID (only for custom models) */
  customModelId?: string;
  /** Reference to a specific variant for chassis models */
  variant?: EquipmentVariant;
}

/**
 * Nokia 7250 IXR Model Catalog
 * Source of truth for available device models and their specs.
 */
export const DEVICE_TEMPLATES: DeviceTemplate[] = [
  { modelName: "7250 IXR-e big", type: "Router", uSize: 1, vendor: "Nokia" },
  { modelName: "7250 IXR-e small", type: "Router", uSize: 1, vendor: "Nokia" },
  { modelName: "7250 IXR-ec", type: "Router", uSize: 1, vendor: "Nokia" },
  { modelName: "7250 IXR-s", type: "Router", uSize: 1, vendor: "Nokia" },
  { modelName: "7250 IXR-X1", type: "Router", uSize: 1, vendor: "Nokia" },
  { modelName: "7250 IXR-X3", type: "Router", uSize: 1, vendor: "Nokia" },
  { modelName: "7250 IXR-Xs", type: "Router", uSize: 1, vendor: "Nokia" },
  { modelName: "7250 IXR-R4", type: "Router", uSize: 2, vendor: "Nokia" },
  { modelName: "7250 IXR-R6", type: "Router", uSize: 3, vendor: "Nokia" },
  { modelName: "7250 IXR-R6d", type: "Router", uSize: 4, vendor: "Nokia" },
  { modelName: "7250 IXR-6", type: "Router", uSize: 7, vendor: "Nokia" },
  { modelName: "7250 IXR-R6dl", type: "Router", uSize: 7, vendor: "Nokia" },
  { modelName: "7250 IXR-10", type: "Router", uSize: 13, vendor: "Nokia" },
  { modelName: "AS7326-56X", type: "Switch", uSize: 1, vendor: "Edgecore" },
  { modelName: "AXGATE 90", type: "Router", uSize: 1, vendor: "AXGATE" },
  { modelName: "DELL-R640", type: "Server", uSize: 1, vendor: "Dell" },
  { modelName: "ECS4650-54T", type: "Switch", uSize: 1, vendor: "Edgecore" },
  { modelName: "AS-4125GS-TNRT2", type: "Server", uSize: 4, vendor: "Supermicro" },
  
  // Gwacheon Assets
  { modelName: "3C16985B", type: "Switch", uSize: 1, vendor: "3Com" },
  { modelName: "7210SAS-S-24", type: "Router", uSize: 1, vendor: "Nokia" },
  { modelName: "7220_IXR-D3L", type: "Router", uSize: 1, vendor: "Nokia" },
  { modelName: "7220_IXR_D2L", type: "Router", uSize: 1, vendor: "Nokia" },
  { modelName: "CSE 512L-260B", type: "Server", uSize: 1, vendor: "Supermicro" },
  { modelName: "CX6300M-24", type: "Switch", uSize: 1, vendor: "Aruba" },
  { modelName: "R230", type: "Server", uSize: 1, vendor: "Dell" },
  { modelName: "R450", type: "Server", uSize: 1, vendor: "Dell" },
  { modelName: "Tifront-G24", type: "Switch", uSize: 1, vendor: "Piolink" },
  { modelName: "V6848XG_dasan", type: "Switch", uSize: 1, vendor: "Dasan" },
  { modelName: "WS-C3560E-24TD-S", type: "Switch", uSize: 1, vendor: "Cisco" },
  { modelName: "WS-C3560E-24TD-SD", type: "Switch", uSize: 1, vendor: "Cisco" },
  { modelName: "WS-C3560X-24T-L", type: "Switch", uSize: 1, vendor: "Cisco" },
  { modelName: "X3550-M3", type: "Server", uSize: 1, vendor: "IBM" },
  { modelName: "X3550-M4", type: "Server", uSize: 1, vendor: "IBM" },
  { modelName: "DL380-G9", type: "Server", uSize: 2, vendor: "HP" },
  { modelName: "DL380P-G8", type: "Server", uSize: 2, vendor: "HP" },
  { modelName: "PAS_K", type: "Server", uSize: 2, vendor: "Piolink" },
  { modelName: "R730", type: "Server", uSize: 2, vendor: "Dell" },
  { modelName: "R740", type: "Server", uSize: 2, vendor: "Dell" },
  { modelName: "RX2540-M1", type: "Server", uSize: 2, vendor: "Fujitsu" },
  { modelName: "X3650-M4", type: "Server", uSize: 2, vendor: "IBM" },
  { modelName: "DL580-G7", type: "Server", uSize: 4, vendor: "HP" },
];

/**
 * 기존 하드코딩 템플릿 + 사용자 등록 모델을 합산한 전체 템플릿 목록 반환.
 * 사용자 등록 모델은 DeviceTemplate 형태로 변환됩니다.
 */
export function getEffectiveTemplates(
  customModels: CustomEquipmentModel[],
  deletedDefaultTemplates: string[] = [],
): DeviceTemplate[] {
  const customTemplates: DeviceTemplate[] = [];

  for (const m of customModels) {
    if (m.modelType === "card-based" && m.variants && m.variants.length > 0) {
      for (const v of m.variants) {
        const appendedName = v.variantName === "기본타입" ? m.modelName : `${m.modelName} ${v.variantName}`;
        customTemplates.push({
          modelName: appendedName,
          type: (m.type || "Router") as DeviceType,
          uSize: m.unit,
          vendor: (m.vendor || "Nokia") as VendorName,
          isCustom: true,
          customModelId: m.modelId,
          variant: v,
        });
      }
    } else {
      customTemplates.push({
        modelName: m.modelName,
        type: (m.type || "Router") as DeviceType,
        uSize: m.unit,
        vendor: (m.vendor || "Nokia") as VendorName,
        isCustom: true,
        customModelId: m.modelId,
      });
    }
  }

  // 기본 모델은 커스텀 모델에 동일 이름(기본타입)이 없을 경우에만 포함.
  // 커스텀 모델이 생성된(확장된) 모든 modelName들을 Set으로 수집.
  const customModelNames = new Set(customTemplates.map((t) => t.modelName));
  const filteredDefaults = DEVICE_TEMPLATES.filter(
    (t) => !deletedDefaultTemplates.includes(t.modelName) && !customModelNames.has(t.modelName),
  );

  const combined = [...customTemplates, ...filteredDefaults];

  // 정렬 기준: 1. 장비 크기(uSize) 오름차순, 2. 모델명 알파벳순
  combined.sort((a, b) => {
    if (a.uSize !== b.uSize) {
      return a.uSize - b.uSize;
    }
    return a.modelName.localeCompare(b.modelName);
  });

  return combined;
}
