import type { DeviceType, VendorName } from "../types";
import type { CustomEquipmentModel, EquipmentVariant } from "../types/equipment";
import { normalizeDeviceType } from "./deviceTypes";

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
  /** true if this is the bare chassis template without any variant attached */
  isBaseChassis?: boolean;
}

/**
 * Nokia 7250 IXR Model Catalog
 * Source of truth for available device models and their specs.
 * type: Router(라우터) / Switch(스위치) / Server(서버) / Transport(광전송장비) / Security(보안장비) / Storage(스토리지)
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
  // Nokia TSS(Transport Service Switch) / PSS(Photonic Service Switch): 광전송장비
  { modelName: "1850 TSS-320H", type: "Transport", uSize: 14, vendor: "Nokia" },
  { modelName: "1830 PSS-12X", type: "Transport", uSize: 14, vendor: "Nokia" },
  { modelName: "1850 TSS-320", type: "Transport", uSize: 12, vendor: "Nokia" },
  { modelName: "1830 PSS-32", type: "Transport", uSize: 12, vendor: "Nokia" },
  { modelName: "1850 TSS-160", type: "Transport", uSize: 7, vendor: "Nokia" },
  { modelName: "7705 SAR-8", type: "Router", uSize: 2, vendor: "Nokia" },
  { modelName: "AS7326-56X", type: "Switch", uSize: 1, vendor: "Edgecore" },
  // AXGATE: 방화벽(UTM)
  { modelName: "AXGATE 90", type: "Security", uSize: 1, vendor: "AXGATE" },
  { modelName: "DELL-R640", type: "Server", uSize: 1, vendor: "Dell" },
  { modelName: "ECS4650-54T", type: "Switch", uSize: 1, vendor: "Edgecore" },
  { modelName: "AS-4125GS-TNRT2", type: "Server", uSize: 4, vendor: "Supermicro" },
  
  // Gwacheon Assets
  { modelName: "HPE-JH145A", type: "Switch", uSize: 1, vendor: "HPE" },
  { modelName: "1646-SMC", type: "Transport", uSize: 1, vendor: "Nokia" },
  // Dell PowerVault ME4012 / QNAP NAS: 스토리지
  { modelName: "ME4012", type: "Storage", uSize: 2, vendor: "Dell" },
  { modelName: "TS-432XU-RP-2G", type: "Storage", uSize: 1, vendor: "QNAP" },
  { modelName: "2600XM", type: "Router", uSize: 1, vendor: "Cisco" },
  { modelName: "3C16985B", type: "Switch", uSize: 1, vendor: "3Com" },
  { modelName: "7210SAS-S-24", type: "Switch", uSize: 1, vendor: "Nokia" },
  // Nokia 7220 IXR-D 시리즈: 데이터센터 Leaf/Spine 스위치
  { modelName: "7220_IXR-D3L", type: "Switch", uSize: 1, vendor: "Nokia" },
  { modelName: "7220_IXR_D2L", type: "Switch", uSize: 1, vendor: "Nokia" },
  { modelName: "C3300-24TS", type: "Switch", uSize: 1, vendor: "Cisco" },
  { modelName: "1850-TSS-5C", type: "Transport", uSize: 1, vendor: "Nokia" },
  { modelName: "1830-PSS-16", type: "Transport", uSize: 2, vendor: "Nokia" },
  { modelName: "AXGATE-2300S", type: "Security", uSize: 1, vendor: "AXGATE" },
  { modelName: "CSE 512L-260B", type: "Server", uSize: 1, vendor: "Supermicro" },
  { modelName: "CX6300M-24", type: "Switch", uSize: 1, vendor: "Aruba" },
  // Aruba 9004: SD-WAN 브랜치 게이트웨이
  { modelName: "HPE-Aruba-9004", type: "Router", uSize: 1, vendor: "Aruba" },
  { modelName: "R230", type: "Server", uSize: 1, vendor: "Dell" },
  { modelName: "R450", type: "Server", uSize: 1, vendor: "Dell" },
  { modelName: "S540A", type: "Transport", uSize: 1, vendor: "텔레필드" },
  { modelName: "Tifront-G24", type: "Switch", uSize: 1, vendor: "Piolink" },
  { modelName: "V6848XG_dasan", type: "Switch", uSize: 1, vendor: "Dasan" },
  { modelName: "WS-C3560E-24TD-S", type: "Switch", uSize: 1, vendor: "Cisco" },
  { modelName: "WS-C3560E-24TD-SD", type: "Switch", uSize: 1, vendor: "Cisco" },
  { modelName: "WS-C3560X-24T-L", type: "Switch", uSize: 1, vendor: "Cisco" },
  { modelName: "X3550-M3", type: "Server", uSize: 1, vendor: "IBM" },
  { modelName: "X3550-M4", type: "Server", uSize: 1, vendor: "IBM" },
  { modelName: "7210 SAS-M", type: "Switch", uSize: 2, vendor: "Nokia" },
  { modelName: "DL380-G9", type: "Server", uSize: 2, vendor: "HP" },
  { modelName: "DL380P-G8", type: "Server", uSize: 2, vendor: "HP" },
  // Piolink PAS-K: L4~L7 스위치(ADC/로드밸런서)
  { modelName: "PAS_K", type: "Switch", uSize: 2, vendor: "Piolink" },
  { modelName: "R730", type: "Server", uSize: 2, vendor: "Dell" },
  { modelName: "R740", type: "Server", uSize: 2, vendor: "Dell" },
  { modelName: "RX2540-M1", type: "Server", uSize: 2, vendor: "Fujitsu" },
  { modelName: "X3650-M4", type: "Server", uSize: 2, vendor: "IBM" },
  { modelName: "DL580-G7", type: "Server", uSize: 4, vendor: "HP" },
];

const normalizeModelNameKey = (name: string) => name.trim().toLowerCase().replace(/[\s_-]+/g, " ");

const matchesModelName = (candidate: string, target: string) => {
  const c = candidate.trim().toLowerCase();
  const t = target.trim().toLowerCase();
  if (c === t || t.startsWith(`${c} `)) return true;
  const normC = normalizeModelNameKey(candidate);
  const normT = normalizeModelNameKey(target);
  return normC === normT || normT.startsWith(`${normC} `);
};

/** 기본 카탈로그에서 모델명(타입 조합 포함)에 해당하는 장비 종류 조회 */
export function getTemplateDeviceType(modelName?: string | null): DeviceType | undefined {
  if (!modelName) return undefined;
  return DEVICE_TEMPLATES.find((t) => matchesModelName(t.modelName, modelName))?.type;
}

/**
 * 모델명 기준으로 장비 종류를 결정.
 * 우선순위: 커스텀 모델 type → 기본 카탈로그 type → 저장된 값(레거시 정규화) → fallback
 */
export function resolveDeviceType(
  modelName: string | null | undefined,
  storedType?: unknown,
  customModels: CustomEquipmentModel[] = [],
  fallback: DeviceType = "Server",
): DeviceType {
  if (modelName) {
    const custom = customModels.find((m) => matchesModelName(m.modelName, modelName));
    const customType = normalizeDeviceType(custom?.type);
    if (customType) return customType;
    const templateType = getTemplateDeviceType(modelName);
    if (templateType) return templateType;
  }
  return normalizeDeviceType(storedType, fallback);
}

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
    // 커스텀 모델 type이 없거나 레거시 값이면 기본 카탈로그 → Router 순으로 보정
    const modelType = normalizeDeviceType(m.type, getTemplateDeviceType(m.modelName) || "Router");
    if (m.modelType === "card-based" && m.variants && m.variants.length > 0) {
      customTemplates.push({
        modelName: m.modelName,
        type: modelType,
        uSize: m.unit,
        vendor: (m.vendor || "Nokia") as VendorName,
        isCustom: true,
        customModelId: m.modelId,
        isBaseChassis: true,
      });

      for (const v of m.variants) {
        const appendedName = `${m.modelName} ${v.variantName}`;
        customTemplates.push({
          modelName: appendedName,
          type: modelType,
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
        type: modelType,
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
