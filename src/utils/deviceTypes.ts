import type { DeviceType } from "../types";

/** 장비 종류 선택지 (표시 순서 고정) */
export const DEVICE_TYPE_OPTIONS: ReadonlyArray<{ value: DeviceType; label: string }> = [
  { value: "Router", label: "라우터" },
  { value: "Switch", label: "스위치" },
  { value: "Server", label: "서버" },
  { value: "Transport", label: "광전송장비" },
  { value: "Security", label: "보안장비" },
  { value: "Storage", label: "스토리지" },
];

const DEVICE_TYPE_LABELS: Record<DeviceType, string> = Object.fromEntries(
  DEVICE_TYPE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<DeviceType, string>;

/** 레거시/한글/약어 값을 표준 DeviceType으로 매핑 (소문자 키) */
const DEVICE_TYPE_ALIASES: Record<string, DeviceType> = {
  router: "Router",
  라우터: "Router",
  switch: "Switch",
  스위치: "Switch",
  server: "Server",
  서버: "Server",
  transport: "Transport",
  mspp: "Transport",
  optical: "Transport",
  roadm: "Transport",
  wdm: "Transport",
  광전송장비: "Transport",
  광전송: "Transport",
  전송: "Transport",
  security: "Security",
  firewall: "Security",
  보안장비: "Security",
  보안: "Security",
  storage: "Storage",
  nas: "Storage",
  san: "Storage",
  스토리지: "Storage",
};

export const isDeviceType = (value: unknown): value is DeviceType =>
  typeof value === "string" && value in DEVICE_TYPE_LABELS;

/** 임의 값(레거시 "MSPP", 한글 라벨 등)을 표준 DeviceType으로 변환 */
export function normalizeDeviceType(raw: unknown): DeviceType | undefined;
export function normalizeDeviceType(raw: unknown, fallback: DeviceType): DeviceType;
export function normalizeDeviceType(raw: unknown, fallback?: DeviceType): DeviceType | undefined {
  if (isDeviceType(raw)) return raw;
  if (typeof raw === "string") {
    const alias = DEVICE_TYPE_ALIASES[raw.trim().toLowerCase()];
    if (alias) return alias;
  }
  return fallback;
}

/** DeviceType 한글 라벨. 알 수 없는 값은 원문 그대로 반환 */
export const getDeviceTypeLabel = (type: unknown): string => {
  const normalized = normalizeDeviceType(type);
  if (normalized) return DEVICE_TYPE_LABELS[normalized];
  return typeof type === "string" ? type : "";
};
