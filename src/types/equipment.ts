/**
 * Equipment Assembly Types
 *
 * 장비 모델 선택 및 카드 삽입 기능을 위한 타입 정의
 */

/** 카드 폭 타입: half = 1열, full = 2열, 또는 숫자 문자열로 N열 점유 */
export type CardWidthType = "half" | "full" | string;

/** CardWidthType에서 실제 점유 열 수(colSpan) 반환 */
export function getColSpan(widthType: CardWidthType, maxColumns: number = 2): number {
  if (widthType === "full") return maxColumns;
  if (widthType === "half") return Math.floor(maxColumns / 2) || 1;
  if (widthType === "sixth") return Math.floor(maxColumns / 6) || 1;
  const n = parseInt(widthType);
  return n > 0 ? n : 1;
}

/** 점유 열 수를 CardWidthType 문자열로 변환 (호환 매핑 포함) */
export function colSpanToWidthType(colSpan: number, maxColumns: number = 2): CardWidthType {
  if (colSpan === maxColumns) return "full";
  if (maxColumns > 1 && colSpan === Math.floor(maxColumns / 2)) return "half";
  return String(colSpan);
}

/** 카드 그룹: cpiom = CPIOM 전용, standard = 일반 카드 */
export type CardGroupType = "cpiom" | "standard";

/** 서브 슬롯 (row-based layout용) */
export interface EquipmentSubSlot {
  slotId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 행 정의 (row-based layout용) */
export interface EquipmentRow {
  rowId: string;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
  overlapY: number;
  columns: number;
  subSlots: EquipmentSubSlot[];
}

/** 슬롯 정의 (mixed layout용) */
export interface SlotDefinition {
  slotId: string;
  row: number;
  col?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** 슬롯 유형 식별자 (e.g. "full-860x71", "half-430x46") */
  slotType: string;
  /** 이 슬롯에 허용되는 카드 그룹 (e.g. ["cpiom"], ["standard"]) */
  allowedCardGroups?: string[];
  /** 이 슬롯에 삽입 가능한 cardSizeType / widthType 목록 */
  accepts: string[];
}

/** 장비 모델 정의 */
export interface EquipmentModel {
  modelId: string;
  modelName: string;
  rackUnit?: string; // e.g. "4U", "7U"
  baseSvgUrl: string; // e.g. "/equipment/[2U] 7250 IXR-R4-CARD.svg"
  /** 사용자 정의 장비용 raw SVG */
  baseEquipmentViewSvgRaw?: string;

  cardArea?: {
    x: number;
    y: number;
    width: number;
    height: number;
    columns: number;
    columnWidth: number;
  };
  equipmentSize?: {
    width: number;
    height: number;
  };
  /** mixed layout용 명시적 슬롯 정의 (없으면 uniform grid) */
  slots?: SlotDefinition[];
  /** row-based layout용 행 정의 (IXR-6, IXR-10 등) */
  rows?: EquipmentRow[];
}

/** 카드 정의 (카드 라이브러리에 표시) */
export interface CardDefinition {
  cardFileName: string; // e.g. "R-series-1-half.svg"
  cardType: string; // e.g. "R-series-1"
  svgUrl: string; // glob-resolved import path
  widthType: CardWidthType;
  /** 카드 그룹 ("cpiom" | "standard"). 미지정 시 기존 widthType 기반 매칭 */
  cardGroup?: string;
  /** 슬롯 accepts와 매칭되는 크기 타입 (e.g. "cpiom-828x72", "half-414x77") */
  cardSizeType?: string;
  /** SVG 원본 너비 (px) */
  svgWidth: number;
  /** SVG 원본 높이 (px) */
  svgHeight: number;
}

/** 장비 포트 정보 (런타임 생성) */
export interface EquipmentPort {
  /** 실제 포트 번호 (e.g. "1/1/9") */
  realPortNumber: string;
  /** SVG 내 로컬 포트 번호 (e.g. "9") */
  localPort: string;
  /** 소속 카드 인스턴스 ID */
  cardInstanceId: string;
  /** 포트 유형 (e.g. "qsfp", "sfp", "eth") */
  portType: string;
  /** 포트 상태 */
  status: "normal" | "critical" | "warning" | "disabled";
}

/** [VITE_CACHE_BREAKER_GEN_PORT] */
export interface GeneratedPort {
  /** 실제 포트 번호 (e.g. "1/1/9") - shelfNo/slotNo/localPort */
  realPortNumber: string;
  /** SVG 내 로컬 포트 번호 (e.g. "9") */
  localPort: string;
  /** 소속 카드 인스턴스 ID */
  cardInstanceId: string;
  /** 카드 파일명 (SVG 매핑용) */
  cardFileName: string;
  /** 포트 유형 (e.g. "qsfp", "sfp", "port") */
  portType: string;
  /** 포트 상태 (기본: "normal") */
  status: "normal" | "critical" | "warning" | "disabled";
  /** SVG path의 d 속성 (포트 위치/크기 추출용) */
  pathD?: string;
}

/** 삽입된 카드 인스턴스 */
export interface InsertedCard {
  instanceId: string;
  cardFileName: string;
  cardType: string;
  svgUrl: string;
  widthType: CardWidthType;
  shelfNo: number;
  slotNo: number;
  /** 그리드 내 위치 인덱스 (row * columns + col) */
  positionIndex: number;
  /** 카드 SVG 원본 높이 */
  svgHeight: number;
  /** 런타임 생성된 포트 목록 */
  ports?: EquipmentPort[];
  /** mixed layout용 슬롯 ID (e.g. "row-1-full") 또는 row-based 서브 슬롯 ID */
  slotId?: string;
  /** row-based layout용 행 ID */
  rowId?: string;
  /** 카드 크기 타입 (e.g. "full-860x71", "half-430x46") - slots 모델 전용 */
  cardSizeType?: string;
}

/** 모듈 유형 (포트에 삽입 가능한 트랜시버/커넥터) */
export type ModuleType = "ethernet" | "sfp";

/** 포트에 삽입된 모듈 인스턴스 */
export interface InsertedModule {
  /** 대상 포트 식별자 (realPortNumber e.g. "1/1/9" 또는 SVG portId e.g. "port-sfp-1") */
  portId: string;
  /** 모듈 유형 */
  moduleType: ModuleType;
  /** 모듈 SVG 파일명 (e.g. "Ethernet.svg") */
  moduleSvgFileName: string;
  hitboxId?: string;
}

/** 모듈 정의 (라이브러리 표시용) */
export interface ModuleDefinition {
  /** 모듈 유형 */
  moduleType: ModuleType;
  /** 표시 이름 */
  displayName: string;
  /** SVG 파일명 */
  svgFileName: string;
  /** SVG URL (img 태그용) */
  svgUrl: string;
}

/** 장비 조립 결과 (저장 시) */
export interface EquipmentAssemblyResult {
  equipmentModel: EquipmentModel;
  insertedCards: InsertedCard[];
  insertedModules?: InsertedModule[];

}

// ══════════════════════════════════════════════════════════════════════════════
// 사용자 등록 장비 모델 / 카드 정의
// ══════════════════════════════════════════════════════════════════════════════

/** 장비 구조: normal = 단일 바디 장비, card-based = 카드 삽입 가능 장비 */
export type CustomModelType = "normal" | "card-based";
export type EquipmentViewSide = "front" | "rear";

export interface EquipmentVariant {
  variantId: string;
  variantName: string;
  isDefault: boolean;
  insertedCards: InsertedCard[];
  variantPngRaw?: string;
}

/** 사용자 등록 장비 모델 */
export interface CustomEquipmentModel {
  modelId: string;
  modelName: string;
  unit: number;
  /** 자동 생성: "[{unit}U] {modelName}" */
  displayName: string;
  /** 장비 모델 SVG raw text */
  modelSvgRaw: string;
  /** 장비 모델 PNG 이미지 (data URI) */
  modelPngRaw?: string;
  /** 장비 뒷면 SVG raw text */
  rearSvgRaw?: string;
  /** 대시보드/랙에서 기본으로 표시할 면 */
  defaultViewSide?: EquipmentViewSide;
  modelType: CustomModelType;
  /** 카드 기반 장비: 기본 섀시 SVG raw text */
  baseEquipmentViewSvgRaw?: string;
  /** 카드 영역 정의 (카드 기반 장비 전용) */
  cardArea?: {
    x: number;
    y: number;
    width: number;
    height: number;
    columns: number;
    columnWidth: number;
  };
  /** 각 행의 높이 배열 (카드 기반 장비 전용, 미설정 시 균일 46px) */
  rowHeights?: number[];
  /** 각 행의 열 수 배열 (카드 기반 장비 전용, 미설정 시 cardArea.columns 사용) */
  rowColumns?: number[];
  /** 각 행 아래 간격(margin) 배열 (카드 기반 장비 전용, 미설정 시 0) */
  rowGaps?: number[];
  /** 그리드 병합 정보 (InteractiveGridEditor 사용) */
  gridMerges?: { r: number; c: number; rs: number; cs: number }[];
  /** 각 열의 너비 배열 (그리드 에디터 개별 너비 지원) */
  gridColWidths?: number[];
  /** 각 행의 높이 배열 (그리드 에디터 개별 높이 지원 - rowHeights와 분리 보존용) */
  gridRowHeights?: number[];
  /** 장비 SVG 원본 크기 */
  equipmentSize?: {
    width: number;
    height: number;
  };
  /** 할당된 카드 ID 목록 */
  assignedCardIds: string[];
  
  /** 장비종류 (서버, 전송, 교환 등) */
  deviceCategory?: string;
  /** 세부유형 (IP-MPLS, ROADM 등) */
  deviceSubtype?: string;
  /** 제조사 */
  vendor?: string;
  
  /** 섀시형 장비의 타입 조합 (variants) */
  variants?: EquipmentVariant[];
  
  /** 등록일시 */
  createdAt: string;
}

/** 사용자 등록 카드 정의 */
export interface CustomCardDefinition {
  cardId: string;
  cardName: string;
  /** 카드 SVG raw text */
  cardSvgRaw: string;
  /** SVG 원본 너비 */
  svgWidth: number;
  /** SVG 원본 높이 */
  svgHeight: number;
  widthType: CardWidthType;
  /** 이 카드를 지원하는 모델 ID 목록 (비어있으면 모든 모델에서 사용 가능) */
  supportedModelIds?: string[];
  /** 등록일시 */
  createdAt: string;
}
