import type { ThermoHygroDevice } from "../types";
import thermoHygroListData from "./thermoHygroList.json";

/**
 * 수집된 온습도계 목록 반환 (추후 REST API / WebSocket 등의 백엔드 연동 시 이 함수 내부를 비동기 호출로 교체)
 */
export const getThermoHygroList = (): ThermoHygroDevice[] => {
  return thermoHygroListData as ThermoHygroDevice[];
};

/**
 * 특정 ID의 온습도계 장치 상세 정보 조회
 */
export const getThermoHygroById = (id: string): ThermoHygroDevice | undefined => {
  const list = getThermoHygroList();
  return list.find((s) => s.id === id);
};

/**
 * 온습도계 상태 뱃지 색상 및 라벨 헬퍼
 */
export const getThermoHygroStatusMeta = (status?: string) => {
  switch (status) {
    case "warning":
      return {
        label: "주의",
        color: "#f59e0b",
        bg: "rgba(245, 158, 11, 0.15)",
        borderColor: "rgba(245, 158, 11, 0.4)",
      };
    case "danger":
      return {
        label: "위험",
        color: "#ef4444",
        bg: "rgba(239, 68, 68, 0.15)",
        borderColor: "rgba(239, 68, 68, 0.4)",
      };
    case "offline":
      return {
        label: "오프라인",
        color: "#94a3b8",
        bg: "rgba(148, 163, 184, 0.15)",
        borderColor: "rgba(148, 163, 184, 0.4)",
      };
    case "normal":
    default:
      return {
        label: "정상",
        color: "#10b981",
        bg: "rgba(16, 185, 129, 0.15)",
        borderColor: "rgba(16, 185, 129, 0.4)",
      };
  }
};
