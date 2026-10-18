// 에러 레벨
export type ErrorLevel = "critical" | "major" | "minor" | "warning";

// 노드 타입 (확장 가능)
export type NodeType = "root" | "group" | "site" | "room" | "zone";

// 계층 노드 (트리 구조)
export interface HierarchyNode {
  nodeId: string; // 고유 ID
  parentId: string | null; // null = root
  name: string; // 표시 이름
  type: NodeType; // 노드 유형
  order: number; // 형제 정렬 순서
  metadata?: Record<string, unknown>; // 확장 데이터 (선택)
}

// 하위 호환용 GroupName (migration 전용)
export type GroupName = "과천" | "대전";

// 제조사 이름
export type VendorName =
  | "AXGATE"
  | "Cisco"
  | "Ciena"
  | "Coweaver"
  | "Dasan"
  | "Dell"
  | "Edgecore"
  | "Juniper"
  | "Nokia"
  | "Rebellions"
  | "Supermicro"
  | "Ubiquoss"
  | "Woorinet"
  | "3Com"
  | "Aruba"
  | "HP"
  | "IBM"
  | "Fujitsu"
  | "Piolink"
  // Legacy mappings for existing templates/data
  | "코위버PTN"
  | "CISCO"
  | "Huawei"
  | "유비쿼스"
  | "텔레필드"
  | string;

// 장비 종류 (라우터 / 스위치 / 서버 / 광전송장비 / 보안장비 / 스토리지)
// 표시 라벨 및 레거시 값("MSPP" 등) 정규화는 utils/deviceTypes.ts 참고
export type DeviceType = "Router" | "Switch" | "Server" | "Transport" | "Security" | "Storage";

/** 
 * [VITE_CACHE_BREAKER_9999] 
 * 이 주석은 Vite 개발 서버의 모듈 캐시를 완전히 파괴하기 위해 추가되었습니다.
 * 장비 (t_rack_device - 랙에 배치된 장비)
 */
export interface Device {
  itemId: string;
  rackId?: string;
  deviceId?: string;
  title: string;
  position: number;
  imageName?: string;
  size: number;
  mountSide?: "front" | "rear"; // 랙 전면/후면 마운트 위치 (양방향 랙용)
  del_yn?: string;
  modiDate?: string;
  regDate?: string;
  type: DeviceType;
  modelName?: string;
  vendor?: VendorName;
  IPAddr?: string;
  macAddr?: string;
  portStates: PortState[];
  insertedCards?: import("./equipment").InsertedCard[];
  insertedModules?: import("./equipment").InsertedModule[];

  defaultViewSide?: import("./equipment").EquipmentViewSide;
  devicePngRaw?: string;
}

/** [VITE_CACHE_BREAKER_PORT] */
export interface PortState {
  portId: string;
  status: "normal" | "error";
  errorLevel?: ErrorLevel;
  errorMessage?: string;
  portName?: string;
  portNumber?: string;
  /** 모듈러 카드 소속 인스턴스 ID (카드 기반 장비 전용) */
  cardInstanceId?: string;
}

// 등록 장비 (t_device 마스터 장비 인벤토리)
export interface RegisteredDevice {
  // 필수 필드 (Primary, 사용자 정의 필수)
  deviceId: string;
  IPAddr: string;
  title: string;
  macAddr: string;

  // 이외의 t_device 옵셔널 속성들
  deviceGroupId?: string; // (ex: nodeId)
  modelId?: number;
  standardCheck?: number;
  deviceCheck?: number;
  standardDeviceId?: number;
  modelName?: string;
  hostName?: string;
  tmid?: string;
  externalId?: number;
  IsrAddr?: string;
  snmpVer?: string;
  snmpPort?: number;
  readCommunity?: string;
  writeCommunity?: string;
  snmpId?: string;
  snmpPwd?: string;
  snmpAuthpass?: string;
  snmpPrivpass?: string;
  snmpAuthprotocol?: string;
  snmpPrivprotocol?: string;
  snmpV3level?: number;
  connectType?: string;
  connectPort?: string;
  connectId?: string;
  connectPwd?: string;
  targetIp?: string;
  targetPort?: string;
  reservParam?: string;
  userSubnet?: string;
  interfaceSubnet?: string;
  proxyIp?: string;
  proxyPort?: string;
  proxyId?: string;
  proxyPwd?: string;
  privilegeUser?: string;
  privilegeMethod?: string;
  privilegePwd?: string;
  memo?: string;
  colErrStatus?: number;
  colInvStatus?: string;
  deviceState?: number;
  isKnown?: number;
  errorPredict?: number;
  regUser?: string;
  regDate?: string;
  colDate?: string;
  modiUser?: string;
  modiDate?: string;
  addItem1?: string;
  addItem2?: string;
  addItem3?: string;
  interfaceMacList?: string;
  osVersion?: string;
  isDevMonit?: number;
  isDevSetting?: number;
  isDeviceOid?: number;
  snmpControl?: number;
  cpumemControl?: number;
  interfaceControl?: number;
  pingControl?: number;
  connectControl?: number;
  sdnControl?: number;
  syslogControl?: number;
  syslogPerfControl?: number;
  diskControl?: number;
  processControl?: number;
  tmpHmdControl?: number;
  cctvControl?: number;
  ptnTunnelControl?: number;
  ptnServiceControl?: number;
  ipmplsLspControl?: number;
  ipmplsServiceControl?: number;
  roadmServiceControl?: number;
  ipmplsEquipControl?: number;
  roadmEquipControl?: number;
  ptnEquipControl?: number;
  transportLinkControl?: number;
  upsControl?: number;
  tmpHmdChamberControl?: number;
  fireDetectionControl?: number;
  del_yn?: string;
  system_code_id?: string;
  delDate?: string;
  delUser?: string;
  encoding?: string;
  deviceOidSetting?: number;
  lspControl?: number;
  serviceControl?: number;
  transportPathControl?: number;
  vlanarpControl?: number;

  // UI/3D 확장을 위한 기존 속성 유지
  type?: DeviceType;
  size?: number; // (ex: uSize)
  vendor?: VendorName;

  // 장비 조립(SVG 구성) 추가
  insertedCards?: import("./equipment").InsertedCard[];
  insertedModules?: import("./equipment").InsertedModule[];
  generatedPorts?: import("./equipment").GeneratedPort[];
  defaultViewSide?: import("./equipment").EquipmentViewSide;
  devicePngRaw?: string;
  portStates?: PortState[];
}

// 렉 방향
export type Orientation = 0 | 90 | 180 | 270;

// 렉 (t_rack 및 3D 속성 통합)
export interface Rack {
  rackId: string;
  mapId: string; // (ex: nodeId)
  rackTitle?: string;
  rackType?: string;
  rackSize: 24 | 32 | 48; // (ex: uHeight)
  rackDepth?: number; // 랙 깊이 (cm)
  isBidirectional?: boolean; // 양방향(전면/후면 모두 장착 가능) 여부
  memo?: string;
  del_yn?: string;
  modiDate?: string;
  regDate?: string;

  // 3D 확장 속성 (새로 편입)
  width: number;
  position: [number, number];
  orientation?: Orientation;

  devices: Device[];
}

export interface DraggedItem {
  type: "rk"; // rack
}

// Built-in 모델 종류
export type BuiltinModelType =
  | "Wall"
  | "Chair"
  | "Desk"
  | "Desk2"
  | "Partition"
  | "Clock"
  | "Light"
  | "ACStand"
  | "Printer"
  | "DeskOn"
  | "DeskOff"
  | "ChairOffice"
  | "PartitionModel"
  | "TableLarge"
  | "TableSmall"
  | "DoorAuto"
  | "CCTV"
  | "ThermoHygro";

// 가시성 모드 (투명 유리 vs 불투명)
export type VisibilityMode = "transparent" | "opaque";

// Partition 파라메트릭 파라미터
export interface PartitionParams {
  height: number;
  length: number;
  thickness: number;
  color: string;
  visibilityMode: VisibilityMode;
}

// Wall 파라메트릭 파라미터
export interface WallParams {
  height: number; // Y축 높이 (미터)
  length: number; // X축 길이 (미터)
  thickness: number; // Z축 두께 (미터)
  color: string; // hex color
  roughness?: number; // 거칠기 (0~1)
  metalness?: number; // 금속성 (0~1)
  opacity?: number; // 투명도 (0~1)
}

// Light 파라메트릭 파라미터
export interface LightParams {
  intensity: number; // 빛 세기
  color: string; // hex color
  castShadow: boolean; // 그림자 여부
  shadowMapSize: number; // 그림자 해상도 (256 ~ 4096)
}

// Glass 재질 파라미터 오버라이드
export interface GlassParams {
  color: string;
  roughness: number;
  metalness: number;
  opacity: number;
}

// 임포트된 3D 모델
export interface ImportedModel {
  id: string;
  name: string;
  fileName: string;
  /** Base64 data URL of the GLB file, or public URL path for built-in models */
  dataUrl: string;
  position: [number, number, number];
  rotation: [number, number, number]; // Euler angles in radians
  scale: [number, number, number];
  /** Actual physical base size of the model (x, y, z) in meters before scaling */
  baseSize?: [number, number, number];
  /** Per-model movement toggle: true = movable, false = locked (default: false) */
  isMoveEnabled?: boolean;
  /** If set, this model is a built-in default model */
  builtinType?: BuiltinModelType;
  /** Wall-specific parametric dimensions (only when builtinType === "Wall") */
  wallParams?: WallParams;
  /** Partition-specific parametric dimensions (only when builtinType === "Partition") */
  partitionParams?: PartitionParams;
  /** Light-specific parameters (only when builtinType === "Light") */
  lightParams?: LightParams;
  /** Whether this model has any material with 'glass' in its name */
  hasGlass?: boolean;
  /** User-defined overrides for glass materials */
  glassParams?: GlassParams;
  /** Linked CCTV device ID (if this model is a CCTV) */
  cctvId?: string;
  /** Linked ThermoHygrometer device ID (if this model is a ThermoHygro) */
  thermoHygroId?: string;
}

// 온습도계 센서 장치 인터페이스 (백엔드 연동용)
export interface ThermoHygroDevice {
  id: string; // 고유 ID (예: TH-001)
  name: string; // 표시 장비명
  location: string; // 설치 위치
  temperature: number; // 현재 온도 (°C)
  humidity: number; // 현재 습도 (%)
  targetTempMin?: number; // 적정 온도 최소치 (기본 18°C)
  targetTempMax?: number; // 적정 온도 최대치 (기본 27°C)
  targetHumidityMin?: number; // 적정 습도 최소치 (기본 40%)
  targetHumidityMax?: number; // 적정 습도 최대치 (기본 60%)
  battery?: number; // 배터리 잔량 (%)
  status: "normal" | "critical" | "major" | "minor" | "warning" | "offline" | "danger"; // 상태 (정상: 초록, critical: 빨강, major: 주황, minor: 노랑, warning: 파랑, 연결안됨/오프라인: 회색)
  modelName?: string; // 모델명
  manufacturer?: string; // 제조사
  ip?: string; // 통신 IP
  installedDate?: string; // 설치일
  lastUpdated?: string; // 최근 측정 일시
}

// CCTV 장치 인터페이스 (백엔드 연동용)
export interface CctvDevice {
  id: string; // 고유 ID (예: CCTV-01)
  name: string; // 표시 장비명
  location: string; // 설치 위치
  ip: string; // IP 주소
  port: number; // RTSP / 제어 포트
  manufacturer: string; // 제조사
  model: string; // 모델 번호
  resolution: string; // 해상도
  fps: number; // 프레임 레이트
  codec?: string; // 코덱
  status: "normal" | "critical" | "major" | "minor" | "warning" | "offline" | "online"; // 상태 (정상: 초록, critical: 빨강, major: 주황, minor: 노랑, warning: 파랑, 연결안됨/오프라인: 회색)
  imageUrl?: string; // 실시간 스냅샷 또는 샘플 이미지 URL
  videoUrl?: string; // 실시간 스트림 또는 샘플 영상 URL
  rtspUrl?: string; // RTSP 스트리밍 주소
  installedDate?: string; // 설치 일자
  ptzSupport?: boolean; // PTZ 회전 제어 지원 여부
}
