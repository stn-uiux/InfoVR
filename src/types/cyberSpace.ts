export interface CyberSpaceConfig {
  cyberSpaceEnabled: boolean;
  csIsLightMode: boolean;
  csFloorMirror: number;
  csFloorRoughness: number;
  csBrightness: number;
  csFogIntensity: number;
  csCeilingLightIntensity: number;
  csBloomIntensity: number;
  csAoIntensity: number;
  csNeonIntensity: number;
  csCustomSpaceSize: boolean;
  csRoomWidthCm: number;
  csRoomLengthCm: number;
  csOffsetXCm: number;
  csOffsetZCm: number;
  csWallColor: string;
  csCeilingColor: string;
  csFloorColor: string;
  csFogColor: string;
  csLowSpecMode: boolean;
}

export const DEFAULT_CYBER_SPACE_CONFIG: CyberSpaceConfig = {
  cyberSpaceEnabled: true,
  csIsLightMode: false,
  csFloorMirror: 0.5,
  csFloorRoughness: 0.7,
  csBrightness: 1.5,
  csFogIntensity: 1,
  csCeilingLightIntensity: 0.6,
  csBloomIntensity: 0.3,
  csAoIntensity: 1.5,
  csNeonIntensity: 4.5,
  csCustomSpaceSize: false,
  csRoomWidthCm: 600,
  csRoomLengthCm: 800,
  csOffsetXCm: 0,
  csOffsetZCm: 0,
  csWallColor: "#5979a3",
  csCeilingColor: '#5676a0',
  csFloorColor: '#294463',
  csFogColor: '#0a1324',
  csLowSpecMode: false,
};

export const LIGHT_THEME_CYBER_SPACE_CONFIG: CyberSpaceConfig = {
  ...DEFAULT_CYBER_SPACE_CONFIG,
  cyberSpaceEnabled: true,
  csIsLightMode: true,
  csWallColor: '#eef2ff',
  csCeilingColor: '#eef2ff',
  csFloorColor: '#9ca3af',
  csFogColor: '#f1f5f9',
  csBrightness: 1.1,
  csCeilingLightIntensity: 1.0,
};
