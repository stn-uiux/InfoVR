import type { DeviceType, VendorName } from "../types";
import type { CustomEquipmentModel } from "../types/equipment";

export interface DeviceTemplate {
  modelName: string;
  type: DeviceType;
  uSize: number;
  vendor: VendorName;
  /** true if this template was created from a user-registered custom model */
  isCustom?: boolean;
  /** Reference to the custom model ID (only for custom models) */
  customModelId?: string;
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
];

/**
 * 기존 하드코딩 템플릿 + 사용자 등록 모델을 합산한 전체 템플릿 목록 반환.
 * 사용자 등록 모델은 DeviceTemplate 형태로 변환됩니다.
 */
export function getEffectiveTemplates(
  customModels: CustomEquipmentModel[],
  deletedDefaultTemplates: string[] = [],
): DeviceTemplate[] {
  const customTemplates: DeviceTemplate[] = customModels.map((m) => ({
    modelName: m.modelName,
    type: "Router" as DeviceType,
    uSize: m.unit,
    vendor: "Nokia" as VendorName,
    isCustom: true,
    customModelId: m.modelId,
  }));

  const customModelNames = new Set(customTemplates.map((t) => t.modelName));
  const filteredDefaults = DEVICE_TEMPLATES.filter(
    (t) => !deletedDefaultTemplates.includes(t.modelName) && !customModelNames.has(t.modelName),
  );

  return [...customTemplates, ...filteredDefaults];
}
