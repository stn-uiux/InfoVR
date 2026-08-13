const fs = require("fs");
const { execSync } = require("child_process");

const filePath = "src/store/useStore.ts";

console.log("Checking out original file...");
execSync("git checkout HEAD src/store/useStore.ts");

let content = fs.readFileSync(filePath, "utf-8");

console.log("Applying csIsLightMode additions...");
content = content.replace(
  "  cyberSpaceEnabled: boolean;\n  setCyberSpaceEnabled: (enabled: boolean) => void;\n  toggleCyberSpace: () => void;",
  `  cyberSpaceEnabled: boolean;
  csIsLightMode: boolean;
  csFloorMirror: number;
  csFloorRoughness: number;
  csBrightness: number;
  csFogIntensity: number;
  csCeilingLightIntensity: number;
  csBloomIntensity: number;
  csAoIntensity: number;
  csNeonIntensity: number;
  csRoomWidthCm: number;
  csRoomLengthCm: number;
  csWallColor: string;
  csCeilingColor: string;
  csFloorColor: string;
  csFogColor: string;
  
  setCyberSpaceEnabled: (enabled: boolean) => void;
  toggleCyberSpace: () => void;
  setCyberSpaceConfig: (config: Partial<AppState>) => void;
  toggleCyberSpaceTheme: () => void;
  setCyberSpaceTheme: (isLight: boolean) => void;`
);

content = content.replace(
  "  cyberSpaceEnabled: false,\n  setCyberSpaceEnabled: (enabled) => set({ cyberSpaceEnabled: enabled }),\n  toggleCyberSpace: () => set((state) => ({ cyberSpaceEnabled: !state.cyberSpaceEnabled })),",
  `  cyberSpaceEnabled: false,
  csIsLightMode: false,
  csFloorMirror: 0.5,
  csFloorRoughness: 0.7,
  csBrightness: 1.5,
  csFogIntensity: 1,
  csCeilingLightIntensity: 0.6,
  csBloomIntensity: 0.3,
  csAoIntensity: 1.5,
  csNeonIntensity: 4.5,
  csRoomWidthCm: 400,
  csRoomLengthCm: 600,
  csWallColor: '#859cba',
  csCeilingColor: '#1d284a',
  csFloorColor: '#373942',
  csFogColor: '#0a1324',

  setCyberSpaceEnabled: (enabled) => set({ cyberSpaceEnabled: enabled }),
  toggleCyberSpace: () => set((state) => ({ cyberSpaceEnabled: !state.cyberSpaceEnabled })),
  setCyberSpaceConfig: (config) => set((state) => ({ ...state, ...config })),
  setCyberSpaceTheme: (isLight) => set((state) => {
    if (isLight) {
      return {
        csIsLightMode: true,
        csWallColor: '#eef2ff',
        csCeilingColor: '#eef2ff',
        csFloorColor: '#9ca3af',
        csFogColor: '#f1f5f9',
        csBrightness: 1.1,
        csCeilingLightIntensity: 1.0,
        csBloomIntensity: 0.6,
        csAoIntensity: 3.0,
        csNeonIntensity: 6.0,
        csFloorMirror: 0.0,
        csFloorRoughness: 1.0,
      };
    } else {
      return {
        csIsLightMode: false,
        csWallColor: '#859cba',
        csCeilingColor: '#1d284a',
        csFloorColor: '#373942',
        csFogColor: '#0a1324',
        csBrightness: 1.5,
        csCeilingLightIntensity: 0.6,
        csBloomIntensity: 0.3,
        csAoIntensity: 1.5,
        csNeonIntensity: 4.5,
        csFloorMirror: 0.5,
        csFloorRoughness: 0.7,
      };
    }
  }),
  toggleCyberSpaceTheme: () => {
    const state = get();
    state.setCyberSpaceTheme(!state.csIsLightMode);
  },`
);

console.log("Applying hoveredDevice changes...");
content = content.replace(
  "  hoveredDevice: { device: Device; x: number; y: number; rackTitle?: string } | null;\n  setHoveredDevice: (payload: { device: Device; x: number; y: number; rackTitle?: string } | null) => void;",
  "  hoveredDevice: { device: Device; x: number; y: number; rackTitle?: string; rackId?: string } | null;\n  setHoveredDevice: (payload: { device: Device; x: number; y: number; rackTitle?: string; rackId?: string } | null) => void;"
);

fs.writeFileSync(filePath, content);
console.log("Done!");
