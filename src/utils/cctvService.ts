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
