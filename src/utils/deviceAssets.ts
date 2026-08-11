/**
 * Device Asset Image Resolver
 *
 * Dynamically maps modelName → image URL using Vite's import.meta.glob.
 * Asset files in src/assets/ have the naming pattern: "[{uSize}U] {modelName}.png"
 *
 * SVG files with port path data are loaded as raw text (?raw) to avoid
 * network fetch and URL encoding issues with special chars in filenames.
 * SVG pattern: "[{uSize}U] {modelName}.svg" with <path id="port-N" ...>
 */

import { useStore } from "../store/useStore";
import type { EquipmentViewSide } from "../types/equipment";

// ── Custom Model Helpers ─────────────────────────────────────────────────────
const customSvgDataUrlCache = new Map<string, string>();

/** SVG raw text → data:image URL */
function svgRawToDataUrl(svgRaw: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgRaw)))}`;
}

/** customModels에서 modelName으로 검색 (런타임 store 조회) */
function findCustomModelByName(modelName: string) {
  try {
    const { customModels } = useStore.getState();
    return customModels.find(
      (m) => m.modelName === modelName || m.modelName.toLowerCase() === modelName.toLowerCase()
    );
  } catch {
    return undefined;
  }
}

function getLookupNames(modelName: string): string[] {
  return [modelName];
}

function getAssetKey(modelName: string, side: EquipmentViewSide): string {
  return `${modelName.toLowerCase()}::${side}`;
}

function parseAssetName(filename: string): { modelName: string; side: EquipmentViewSide } {
  const baseName = filename
    .replace(/\.(png|svg)$/i, "")
    .replace(/^\[\d+U\]\s*/, "")
    .trim();
  const sideMatch = baseName.match(/\s+(front|back|rear)$/i);
  if (!sideMatch) return { modelName: baseName, side: "front" };

  const side = sideMatch[1].toLowerCase() === "front" ? "front" : "rear";
  return {
    modelName: baseName.slice(0, sideMatch.index).trim(),
    side,
  };
}

// Eagerly import all PNG images from src/assets/
const assetModules = import.meta.glob<{ default: string }>(["../assets/*.png", "../assets/gwacheon/*.png"], {
  eager: true,
});

// Lazy import all SVG files from src/assets/ as raw text
// Using ?raw avoids fetch() and URL-encoding issues with special char filenames.
// By NOT specifying eager: true, these huge strings are put in separate chunks and loaded on demand.
const svgRawModules = import.meta.glob<{ default: string }>(
  ["../assets/*.svg", "../assets/gwacheon/*.svg", "../assets/card/*.svg"],
  {
    query: "?raw",
  }
);

// ── PNG: modelName → resolved URL ──────────────────────────────────────────
const deviceImageMap = new Map<string, string>();
const deviceImageSideMap = new Map<string, string>();
for (const [path, mod] of Object.entries(assetModules)) {
  const filename = path.split("/").pop() ?? "";
  const { modelName, side } = parseAssetName(filename);
  if (modelName && mod.default) {
    const key = getAssetKey(modelName, side);
    deviceImageSideMap.set(key, mod.default);
    if (side === "front") {
      deviceImageMap.set(modelName, mod.default);
      deviceImageMap.set(modelName.toLowerCase(), mod.default);
    }
  }
}

// ── SVG: modelName → Promise resolving to raw SVG text ─────────────────────
const deviceSvgPromiseMap = new Map<string, () => Promise<{ default: string }>>();
const deviceSvgSidePromiseMap = new Map<string, () => Promise<{ default: string }>>();

// ── SVG content cache (resolved raw text → 재열기 시 즉시 반환) ──────────────
const svgContentCache = new Map<string, string>();
for (const [path, importFn] of Object.entries(svgRawModules)) {
  const filename = path.split("/").pop() ?? "";
  const { modelName, side } = parseAssetName(filename);
  if (modelName) {
    deviceSvgSidePromiseMap.set(getAssetKey(modelName, side), importFn);
    if (side === "front") {
      deviceSvgPromiseMap.set(modelName, importFn);
      deviceSvgPromiseMap.set(modelName.toLowerCase(), importFn);
    }
  }
}

/**
 * Resolve a device PNG image URL from modelName.
 * Returns the Vite-resolved asset URL or undefined if not found.
 */
export const resolveDeviceImage = (
  modelName?: string,
  side: EquipmentViewSide = "front",
): string | undefined => {
  if (!modelName) return undefined;
  
  // 1. Try to find PNG URL from static assets
  for (const lookupName of getLookupNames(modelName)) {
    const sideUrl = deviceImageSideMap.get(getAssetKey(lookupName, side));
    if (sideUrl) return sideUrl;
    if (side === "front") {
      const staticUrl = deviceImageMap.get(lookupName) ?? deviceImageMap.get(lookupName.toLowerCase());
      if (staticUrl) return staticUrl;
    }
  }

  // 2. Fallback: 사용자 등록 모델 SVG → data URL
  const custom = findCustomModelByName(modelName);
  const svgRaw = side === "rear" ? custom?.rearSvgRaw : custom?.modelSvgRaw;
  if (svgRaw) {
    const cacheKey = `${modelName.toLowerCase()}::${side}`;
    let cached = customSvgDataUrlCache.get(cacheKey);
    if (!cached) {
      cached = svgRawToDataUrl(svgRaw);
      customSvgDataUrlCache.set(cacheKey, cached);
    }
    return cached;
  }

  return undefined;
};

/**
 * Dashboard thumbnails are generated as data URLs. Older built-in model metadata
 * may contain `/thumbnails/...` placeholders, but those files are not shipped.
 */
export const isUsableDashboardThumbnail = (url?: string): url is string => {
  if (!url) return false;
  return !url.startsWith("/thumbnails/");
};

/**
 * Resolve a device SVG raw text content from modelName.
 * Returns a Promise that resolves to the inline SVG string, or undefined.
 */
export const resolveDeviceSvgContent = async (
  modelName?: string,
  side: EquipmentViewSide = "front",
): Promise<string | undefined> => {
  if (!modelName) return undefined;

  // 캐시 히트 시 즉시 반환 (동적 import 스킵)
  const cacheKey = `${modelName.toLowerCase()}::${side}`;
  const cached = svgContentCache.get(cacheKey);
  if (cached) return cached;

  let importFn: (() => Promise<{ default: string }>) | undefined;
  for (const lookupName of getLookupNames(modelName)) {
    importFn =
      deviceSvgSidePromiseMap.get(getAssetKey(lookupName, side)) ||
      (side === "front"
        ? deviceSvgPromiseMap.get(lookupName) ?? deviceSvgPromiseMap.get(lookupName.toLowerCase())
        : undefined);
    if (importFn) break;
  }
  if (importFn) {
    try {
      const mod = await importFn();
      svgContentCache.set(cacheKey, mod.default);
      return mod.default;
    } catch (err) {
      console.error("Failed to load SVG for model:", modelName, err);
      return undefined;
    }
  }

  // Fallback: 사용자 등록 모델 SVG raw text
  const custom = findCustomModelByName(modelName);
  const svgRaw = side === "rear" ? custom?.rearSvgRaw : custom?.modelSvgRaw;
  if (svgRaw) {
    svgContentCache.set(cacheKey, svgRaw);
    return svgRaw;
  }

  return undefined;
};

/**
 * Check if a device SVG asset exists for the given modelName synchronously.
 */
export const hasDeviceSvgAsset = (
  modelName?: string,
  side: EquipmentViewSide = "front",
): boolean => {
  if (!modelName) return false;
  for (const lookupName of getLookupNames(modelName)) {
    if (deviceSvgSidePromiseMap.has(getAssetKey(lookupName, side))) return true;
    if (
      side === "front" &&
      (deviceSvgPromiseMap.has(lookupName) || deviceSvgPromiseMap.has(lookupName.toLowerCase()))
    ) return true;
  }
  // Fallback: 사용자 등록 모델 체크
  const custom = findCustomModelByName(modelName);
  return side === "rear" ? !!custom?.rearSvgRaw : !!custom?.modelSvgRaw;
};

export const getDeviceViewSides = (modelName?: string): EquipmentViewSide[] => {
  if (!modelName) return [];
  const sides: EquipmentViewSide[] = [];
  if (hasDeviceSvgAsset(modelName, "front")) sides.push("front");
  if (hasDeviceSvgAsset(modelName, "rear")) sides.push("rear");
  return sides;
};

/** Get all available model image entries (for debugging) */
export const getAvailableModelImages = (): string[] => {
  const combined = new Set<string>([
    ...Array.from(deviceImageMap.keys()),
    ...Array.from(deviceSvgPromiseMap.keys()),
  ]);
  return Array.from(combined).filter(
    (k) =>
      k !== k.toLowerCase() ||
      !combined.has(k.charAt(0).toUpperCase() + k.slice(1))
  );
};
