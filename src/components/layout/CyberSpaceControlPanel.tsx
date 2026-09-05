
import { useStore } from "../../store/useStore";
import { Icon } from '@iconify/react';

export const CyberSpaceControlPanel = () => {
  const {
    csIsLightMode,
    csFloorMirror,
    csFloorRoughness,
    csBrightness,
    csBloomIntensity,
    csAoIntensity,
    csNeonIntensity,
    csRoomWidthCm,
    csRoomLengthCm,
    csWallColor,
    csCeilingColor,
    csFloorColor,
    csLowSpecMode,
    setCyberSpaceConfig,
    toggleCyberSpaceTheme,
  } = useStore();

  return (
    <div className="absolute top-16 right-6 pointer-events-auto z-50">
      <div className="bg-[#0f172a]/80 backdrop-blur-md border border-blue-500/30 p-4 rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.15)] flex flex-col gap-6 min-w-[240px] text-white">
        
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-blue-500/30 pb-2">
            <h2 className="text-blue-200 text-xs font-bold tracking-[0.15em] uppercase m-0">
              Theme
            </h2>
            <button 
              onClick={toggleCyberSpaceTheme}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border-none cursor-pointer ${
                csIsLightMode 
                  ? 'bg-blue-100 text-blue-900 shadow-[0_0_15px_rgba(219,234,254,0.5)]' 
                  : 'bg-blue-900/50 text-blue-200 hover:bg-blue-800/50'
              }`}
            >
              {csIsLightMode ? <Icon icon="lucide:sun" width="14" /> : <Icon icon="lucide:moon" width="14" />}
              {csIsLightMode ? 'LIGHT' : 'DARK'}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-blue-200 text-xs font-bold tracking-[0.15em] uppercase border-b border-blue-500/30 pb-2 m-0">
            Colors
          </h2>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-blue-400/80 font-bold text-xs">Wall</span>
              <input
                type="color"
                value={csWallColor}
                onChange={(e) => setCyberSpaceConfig({ csWallColor: e.target.value })}
                className="w-10 h-6 cursor-pointer bg-transparent border-0 p-0 rounded"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-blue-400/80 font-bold text-xs">Ceiling</span>
              <input
                type="color"
                value={csCeilingColor}
                onChange={(e) => setCyberSpaceConfig({ csCeilingColor: e.target.value })}
                className="w-10 h-6 cursor-pointer bg-transparent border-0 p-0 rounded"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-blue-400/80 font-bold text-xs">Floor</span>
              <input
                type="color"
                value={csFloorColor}
                onChange={(e) => setCyberSpaceConfig({ csFloorColor: e.target.value })}
                className="w-10 h-6 cursor-pointer bg-transparent border-0 p-0 rounded"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-blue-200 text-xs font-bold tracking-[0.15em] uppercase border-b border-blue-500/30 pb-2 m-0">
            Lighting & FX
          </h2>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="w-12 text-blue-400/80 font-bold text-xs text-left">Lux</span>
              <input
                type="range"
                min="0.1"
                max="4.0"
                step="0.1"
                value={csBrightness}
                onChange={(e) => setCyberSpaceConfig({ csBrightness: parseFloat(e.target.value) })}
                className="flex-1 h-1.5 bg-blue-900/80 rounded-lg appearance-none cursor-pointer accent-blue-400 hover:accent-blue-300 transition-all"
              />
              <span className="w-8 text-blue-300 font-bold text-xs text-right font-mono">{csBrightness.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-12 text-blue-400/80 font-bold text-xs text-left">Bloom</span>
              <input
                type="range"
                min="0.0"
                max="2.0"
                step="0.05"
                value={csBloomIntensity}
                onChange={(e) => setCyberSpaceConfig({ csBloomIntensity: parseFloat(e.target.value) })}
                className="flex-1 h-1.5 bg-blue-900/80 rounded-lg appearance-none cursor-pointer accent-blue-400 hover:accent-blue-300 transition-all"
              />
              <span className="w-8 text-blue-300 font-bold text-xs text-right font-mono">{csBloomIntensity.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-12 text-blue-400/80 font-bold text-xs text-left">AO</span>
              <input
                type="range"
                min="0.0"
                max="10.0"
                step="0.1"
                value={csAoIntensity}
                onChange={(e) => setCyberSpaceConfig({ csAoIntensity: parseFloat(e.target.value) })}
                className="flex-1 h-1.5 bg-blue-900/80 rounded-lg appearance-none cursor-pointer accent-blue-400 hover:accent-blue-300 transition-all"
              />
              <span className="w-8 text-blue-300 font-bold text-xs text-right font-mono">{csAoIntensity.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-12 text-blue-400/80 font-bold text-xs text-left">Neon</span>
              <input
                type="range"
                min="0.0"
                max="10.0"
                step="0.1"
                value={csNeonIntensity}
                onChange={(e) => setCyberSpaceConfig({ csNeonIntensity: parseFloat(e.target.value) })}
                className="flex-1 h-1.5 bg-blue-900/80 rounded-lg appearance-none cursor-pointer accent-blue-400 hover:accent-blue-300 transition-all"
              />
              <span className="w-8 text-blue-300 font-bold text-xs text-right font-mono">{csNeonIntensity.toFixed(1)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-blue-200 text-xs font-bold tracking-[0.15em] uppercase border-b border-blue-500/30 pb-2 m-0">
            Floor Material
          </h2>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="w-12 text-blue-400/80 font-bold text-xs text-left">Mirror</span>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={csFloorMirror}
                onChange={(e) => setCyberSpaceConfig({ csFloorMirror: parseFloat(e.target.value) })}
                className="flex-1 h-1.5 bg-blue-900/80 rounded-lg appearance-none cursor-pointer accent-blue-400 hover:accent-blue-300 transition-all"
              />
              <span className="w-8 text-blue-300 font-bold text-xs text-right font-mono">{csFloorMirror.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-12 text-blue-400/80 font-bold text-xs text-left">Rough</span>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={csFloorRoughness}
                onChange={(e) => setCyberSpaceConfig({ csFloorRoughness: parseFloat(e.target.value) })}
                className="flex-1 h-1.5 bg-blue-900/80 rounded-lg appearance-none cursor-pointer accent-blue-400 hover:accent-blue-300 transition-all"
              />
              <span className="w-8 text-blue-300 font-bold text-xs text-right font-mono">{csFloorRoughness.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-blue-200 text-xs font-bold tracking-[0.15em] uppercase border-b border-blue-500/30 pb-2 m-0">
            Dimensions (cm)
          </h2>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 text-blue-400/80 font-bold text-xs text-center leading-4">W</span>
              <input
                type="range"
                min="200"
                max="1000"
                step="10"
                value={csRoomWidthCm}
                onChange={(e) => setCyberSpaceConfig({ csRoomWidthCm: parseInt(e.target.value) })}
                className="flex-1 h-1.5 bg-blue-900/80 rounded-lg appearance-none cursor-pointer accent-blue-400 hover:accent-blue-300 transition-all"
              />
              <span className="w-10 text-blue-300 font-bold text-xs text-right font-mono">{csRoomWidthCm}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 text-blue-400/80 font-bold text-xs text-center leading-4">L</span>
              <input
                type="range"
                min="200"
                max="1000"
                step="10"
                value={csRoomLengthCm}
                onChange={(e) => setCyberSpaceConfig({ csRoomLengthCm: parseInt(e.target.value) })}
                className="flex-1 h-1.5 bg-blue-900/80 rounded-lg appearance-none cursor-pointer accent-blue-400 hover:accent-blue-300 transition-all"
              />
              <span className="w-10 text-blue-300 font-bold text-xs text-right font-mono">{csRoomLengthCm}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
