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
 * - 정상: 초록색 (#10b981)
 * - 연결 안됨: 회색 (#94a3b8)
 * - critical: 빨강 (#ef4444)
 * - major: 주황 (#f97316)
 * - minor: 노랑 (#eab308)
 * - warning: 파랑 (#3b82f6)
 */
export const getThermoHygroStatusMeta = (status?: string, isLinked: boolean = true) => {
  if (!isLinked) {
    return {
      label: "연결 안됨",
      color: "#94a3b8",
      bg: "rgba(148, 163, 184, 0.15)",
      borderColor: "rgba(148, 163, 184, 0.4)",
      statusClass: "status-offline",
    };
  }

  const s = status?.toLowerCase();
  switch (s) {
    case "critical":
    case "danger":
      return {
        label: "Critical",
        color: "#ef4444",
        bg: "rgba(239, 68, 68, 0.15)",
        borderColor: "rgba(239, 68, 68, 0.4)",
        statusClass: "status-critical",
      };
    case "major":
      return {
        label: "Major",
        color: "#f97316",
        bg: "rgba(249, 115, 22, 0.15)",
        borderColor: "rgba(249, 115, 22, 0.4)",
        statusClass: "status-major",
      };
    case "minor":
      return {
        label: "Minor",
        color: "#eab308",
        bg: "rgba(234, 179, 8, 0.15)",
        borderColor: "rgba(234, 179, 8, 0.4)",
        statusClass: "status-minor",
      };
    case "warning":
      return {
        label: "Warning",
        color: "#3b82f6",
        bg: "rgba(59, 130, 246, 0.15)",
        borderColor: "rgba(59, 130, 246, 0.4)",
        statusClass: "status-warning",
      };
    case "offline":
    case "disconnected":
    case "unlinked":
      return {
        label: "연결 안됨",
        color: "#94a3b8",
        bg: "rgba(148, 163, 184, 0.15)",
        borderColor: "rgba(148, 163, 184, 0.4)",
        statusClass: "status-offline",
      };
    case "normal":
    case "online":
    default:
      return {
        label: "Normal",
        color: "#10b981",
        bg: "rgba(16, 185, 129, 0.15)",
        borderColor: "rgba(16, 185, 129, 0.4)",
        statusClass: "status-normal",
      };
  }
};

export interface ThermoHygroFaultInfo {
  severity: "critical" | "major" | "minor" | "warning" | "normal" | "offline";
  title: string;
  description: string;
  occurredAt: string;
  recommendation: string;
}

/**
 * 온습도계 센서의 장애/알람 상세 정보 조회
 */
export const getThermoHygroFaultInfo = (
  device: ThermoHygroDevice | null,
  isLinked: boolean = true,
): ThermoHygroFaultInfo => {
  if (!isLinked || !device) {
    return {
      severity: "offline",
      title: "연동 해제 상태 (미연동)",
      description: "현재 3D 모델에 연동된 실제 온습도계 센서가 없습니다.",
      occurredAt: "-",
      recommendation: "하단의 '온습도계 연동 장비 선택' 버튼을 눌러 센서를 연동해주세요.",
    };
  }

  const s = device.status?.toLowerCase();
  const temp = device.temperature;
  const hum = device.humidity;
  const tMin = device.targetTempMin ?? 18.0;
  const tMax = device.targetTempMax ?? 27.0;
  const hMin = device.targetHumidityMin ?? 40.0;
  const hMax = device.targetHumidityMax ?? 60.0;

  switch (s) {
    case "critical":
    case "danger":
      return {
        severity: "critical",
        title: `임계 허용 온도 초과 고온 경보 (${temp.toFixed(1)}°C)`,
        description: `측정 온도가 위험 한계선(${tMax.toFixed(1)}°C)을 ${Math.abs(temp - tMax).toFixed(1)}°C 초과하여 서버 랙 열손상 위험이 있습니다.`,
        occurredAt: device.lastUpdated || "2026-10-18 16:00:15",
        recommendation: "항온항습기 냉방 출력 증설 및 전산실 차폐 구역 에어플로우를 긴급 점검하십시오.",
      };
    case "major":
      return {
        severity: "major",
        title: `적정 온·습도 기준치 이탈 (${temp.toFixed(1)}°C / ${hum.toFixed(1)}%)`,
        description: `권장 온도(${tMin}~${tMax}°C)를 초과하고 습도(${hum}%)가 하한선 이하로 감지되었습니다.`,
        occurredAt: device.lastUpdated || "2026-10-18 15:59:48",
        recommendation: "해당 열 배기 팬 가동 상태 및 가습기 분무 밸브를 확인하십시오.",
      };
    case "minor":
      return {
        severity: "minor",
        title: `적정 습도 범위 미달 (${hum.toFixed(1)}% / 기준 ${hMin}~${hMax}%)`,
        description: `습도가 권장 하한선(${hMin}%)보다 낮아 랙 장비 정전기 발생 위험이 있습니다.`,
        occurredAt: device.lastUpdated || "2026-10-18 15:58:30",
        recommendation: "전산실 가습기 가동률을 상향 조정하십시오.",
      };
    case "warning":
      return {
        severity: "warning",
        title: "단시간 온·습도 편차 주의 (Warning)",
        description: "최근 10분간 온도 상승 편차가 주의 범위(±1.5°C)에 도달하였습니다.",
        occurredAt: device.lastUpdated || "2026-10-18 16:00:02",
        recommendation: "급기구 냉기 토출 방향 및 유량 밸브를 점검하십시오.",
      };
    case "offline":
    case "disconnected":
      return {
        severity: "offline",
        title: "센서 통신 두절 (Offline)",
        description: `IP ${device.ip || "192.168.10.x"} 센서 모듈로부터 수집 패킷 응답이 수신되지 않습니다.`,
        occurredAt: device.lastUpdated || "-",
        recommendation: "센서 전원 공급 상태 및 통신 게이트웨이 선로를 점검하십시오.",
      };
    case "normal":
    case "online":
    default:
      return {
        severity: "normal",
        title: "정상 상태 유지 중 (All Systems Normal)",
        description: `현재 온도(${temp.toFixed(1)}°C) 및 습도(${hum.toFixed(1)}%)가 적정 권장 범위 내에서 안정적으로 유지되고 있습니다.`,
        occurredAt: "-",
        recommendation: "현재 조치가 필요한 이상 징후나 장애가 없습니다.",
      };
  }
};
