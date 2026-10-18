import type { CctvDevice } from "../types";
import cctvListData from "./cctvList.json";

/**
 * 수집된 CCTV 목록 반환 (추후 REST API / GraphQL 등의 백엔드 연동 시 이 함수 내부를 fetch로 교체)
 */
export const getCctvList = (): CctvDevice[] => {
  return cctvListData as CctvDevice[];
};

/**
 * 특정 ID의 CCTV 장치 상세 정보 조회
 */
export const getCctvById = (id: string): CctvDevice | undefined => {
  const list = getCctvList();
  return list.find((c) => c.id === id);
};

/**
 * CCTV 상태 뱃지 색상 및 라벨 헬퍼
 * - 정상: 초록색 (#10b981)
 * - 연결 안됨: 회색 (#94a3b8)
 * - critical: 빨강 (#ef4444)
 * - major: 주황 (#f97316)
 * - minor: 노랑 (#eab308)
 * - warning: 파랑 (#3b82f6)
 */
export const getCctvStatusMeta = (status?: string, isLinked: boolean = true) => {
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

export interface CctvFaultInfo {
  severity: "critical" | "major" | "minor" | "warning" | "normal" | "offline";
  title: string;
  description: string;
  occurredAt: string;
  recommendation: string;
}

/**
 * CCTV 장비의 장애/알람 상세 정보 조회
 */
export const getCctvFaultInfo = (
  device: CctvDevice | null,
  isLinked: boolean = true,
): CctvFaultInfo => {
  if (!isLinked || !device) {
    return {
      severity: "offline",
      title: "연동 해제 상태 (미연동)",
      description: "현재 3D 모델에 연동된 실제 CCTV 장비가 없습니다.",
      occurredAt: "-",
      recommendation: "하단의 'CCTV 연동 장비 선택' 버튼을 눌러 카메라를 연동해주세요.",
    };
  }

  const s = device.status?.toLowerCase();
  switch (s) {
    case "critical":
    case "danger":
      return {
        severity: "critical",
        title: "비디오 스트림 전송 지연 및 패킷 손실률 급증",
        description: `IP ${device.ip} 카메라의 RTSP 패킷 손실률이 15%를 초과하여 심각한 영상 끊김이 발생하고 있습니다.`,
        occurredAt: "2026-10-18 16:15:22",
        recommendation: "스위치 포트 링크 속도 및 NVR 대역폭 포화 여부를 긴급 점검하십시오.",
      };
    case "major":
      return {
        severity: "major",
        title: "RTSP 프로토콜 응답 지연 (Latency 경보)",
        description: `스트리밍 응답 지연시간이 350ms 이상으로 증가하여 실시간 모니터링 품질이 저하되었습니다.`,
        occurredAt: "2026-10-18 16:20:10",
        recommendation: "카메라 인코딩 부하 및 스위칭 허브 트래픽을 점검하십시오.",
      };
    case "minor":
      return {
        severity: "minor",
        title: "비디오 인코딩 프레임 드랍 발생 (FPS 저하)",
        description: `설정 규격(${device.fps}fps) 대비 현재 전송 프레임이 18fps로 저하되었습니다.`,
        occurredAt: "2026-10-18 16:25:05",
        recommendation: "카메라 내부 발열 및 프로세서 점유율을 확인하십시오.",
      };
    case "warning":
      return {
        severity: "warning",
        title: "네트워크 대역폭 일시적 변동 감지",
        description: "전송 비트레이트가 일시적으로 불안정하여 버퍼링이 발생할 수 있습니다.",
        occurredAt: "2026-10-18 16:28:40",
        recommendation: "지속적인 패킷 흐름 및 NVR 수신 대역폭을 모니터링하십시오.",
      };
    case "offline":
    case "disconnected":
      return {
        severity: "offline",
        title: "카메라 통신 두절 (Offline)",
        description: `IP ${device.ip}:${device.port} 장치로부터 Ping 및 RTSP 응답이 수신되지 않습니다.`,
        occurredAt: "2026-10-18 16:30:00",
        recommendation: "장비 전원 공급 및 PoE 케이블 연결 상태를 점검하십시오.",
      };
    case "normal":
    case "online":
    default:
      return {
        severity: "normal",
        title: "정상 가동 중 (All Systems Normal)",
        description: "모든 비디오 스트림 및 RTSP 전송이 기준 범위 내에서 안정적으로 동작하고 있습니다.",
        occurredAt: "-",
        recommendation: "현재 조치가 필요한 이상 징후나 장애가 없습니다.",
      };
  }
};
