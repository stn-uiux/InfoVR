/**
 * Card Asset Resolver
 *
 * Vite import.meta.glob으로 카드 SVG를 동적 로드.
 * 지원 카드 패턴:
 *   - "R-series-{n}-{half|full}.svg"  → R4/R6 전용 카드
 *   - "CPIOM-{widthType}.svg"         → CPIOM 전용 카드 (R6d/R6dl)
 *   - "MDAs-{n}-{half|full}.svg"      → MDAs 카드 (R6d/R6dl)
 */

import type {
  CardDefinition,
  CardWidthType,
  EquipmentModel,
} from "../types/equipment";
import { useStore } from "../store/useStore";

// ── 카드 SVG: img 태그용 URL 가져오기 (라이브러리 미리보기) ────────────────
const cardUrlModules = import.meta.glob<{ default: string }>(
  "../assets/card/R-series-*.svg",
  { eager: true },
);
const cpiomUrlModules = import.meta.glob<{ default: string }>(
  "../assets/card/CPIOM-*.svg",
  { eager: true },
);
const mdasUrlModules = import.meta.glob<{ default: string }>(
  "../assets/card/MDAs-*.svg",
  { eager: true },
);
const dualUrlModules = import.meta.glob<{ default: string }>(
  "../assets/card/Dual-CPMs-*.svg",
  { eager: true },
);
const immUrlModules = import.meta.glob<{ default: string }>(
  "../assets/card/IMM-*.svg",
  { eager: true },
);
const psuUrlModules = import.meta.glob<{ default: string }>(
  "../assets/card/PSU-*.svg",
  { eager: true },
);
const ixrUrlModules = { ...dualUrlModules, ...immUrlModules, ...psuUrlModules };

// ── 카드 SVG: raw text (인라인 SVG 렌더링용) ────────────────────────────
const cardRawModules = import.meta.glob<{ default: string }>(
  "../assets/card/R-series-*.svg",
  { query: "?raw" },
);
const cpiomRawModules = import.meta.glob<{ default: string }>(
  "../assets/card/CPIOM-*.svg",
  { query: "?raw" },
);
const mdasRawModules = import.meta.glob<{ default: string }>(
  "../assets/card/MDAs-*.svg",
  { query: "?raw" },
);
const dualRawModules = import.meta.glob<{ default: string }>(
  "../assets/card/Dual-CPMs-*.svg",
  { query: "?raw" },
);
const immRawModules = import.meta.glob<{ default: string }>(
  "../assets/card/IMM-*.svg",
  { query: "?raw" },
);
const psuRawModules = import.meta.glob<{ default: string }>(
  "../assets/card/PSU-*.svg",
  { query: "?raw" },
);
const ixrRawModules = { ...dualRawModules, ...immRawModules, ...psuRawModules };

// ── Base 장비 SVG: raw text ─────────────────────────────────────────────
const baseEquipRawModules = import.meta.glob<{ default: string }>(
  "../assets/card/*.svg",
  { query: "?raw" },
);

const baseEquipUrlModules = import.meta.glob<{ default: string }>(
  ["../assets/card/*.svg", "../assets/card/*.png", "../assets/card/*.jpg", "../assets/card/*.jpeg"],
  { eager: true },
);

/** 파일명에서 widthType 추출 */
function parseWidthType(filename: string): CardWidthType {
  if (filename.includes("-vfull")) return "vfull";
  if (filename.includes("-full")) return "full";
  return "half";
}

/** 파일명에서 cardType 추출 (e.g. "R-series-1-half.svg" → "R-series-1") */
function parseCardType(filename: string): string {
  return filename.replace(/\.(svg|png|jpe?g)$/i, "").replace(/-(half|full|vfull)$/, "");
}

/** SVG URL에서 width/height 추출 (SVG 컨텐츠에서) */
function parseSvgDimensionsFromUrl(url: string): {
  width: number;
  height: number;
} {
  // 기본값: half=430x46, full=860x46
  const isFullWidth = url.includes("-full");
  return {
    width: isFullWidth ? 860 : 430,
    height: 46,
  };
}

// ── 카드 정의 빌드 ─────────────────────────────────────────────────────
const _cardDefinitions: CardDefinition[] = [];

// --- R-series 카드 ---
for (const [path, mod] of Object.entries(cardUrlModules)) {
  const filename = path.split("/").pop() ?? "";
  if (!filename.startsWith("R-series-")) continue;

  const widthType = parseWidthType(filename);
  const cardType = parseCardType(filename);
  const dims = parseSvgDimensionsFromUrl(filename);

  _cardDefinitions.push({
    cardFileName: filename,
    cardType,
    svgUrl: mod.default,
    widthType,
    svgWidth: dims.width,
    svgHeight: dims.height,
  });
}

// --- CPIOM 카드 ---
for (const [path, mod] of Object.entries(cpiomUrlModules)) {
  const filename = path.split("/").pop() ?? "";
  if (!filename.startsWith("CPIOM-")) continue;

  const widthType: CardWidthType = "full";
  const cardType = filename.replace(/\.svg$/i, ""); // e.g. "CPIOM-full"

  _cardDefinitions.push({
    cardFileName: filename,
    cardType,
    svgUrl: mod.default,
    widthType,
    cardGroup: "cpiom",
    cardSizeType: "cpiom-828x72",
    svgWidth: 828,
    svgHeight: 72,
  });
}

// --- MDAs 카드 ---
for (const [path, mod] of Object.entries(mdasUrlModules)) {
  const filename = path.split("/").pop() ?? "";
  if (!filename.startsWith("MDAs-")) continue;

  const widthType = parseWidthType(filename);
  const cardType = parseCardType(filename); // e.g. "MDAs-1"

  const isHalf = widthType === "half";
  _cardDefinitions.push({
    cardFileName: filename,
    cardType,
    svgUrl: mod.default,
    widthType,
    cardGroup: "standard",
    cardSizeType: isHalf ? "half-414x77" : "full-828x80",
    svgWidth: isHalf ? 414 : 828,
    svgHeight: 77,
  });
}

// --- IXR 전용 카드 ---
for (const [path, mod] of Object.entries(ixrUrlModules)) {
  const filename = path.split("/").pop() ?? "";
  const cardType = filename.replace(/\.svg$/i, "");
  let widthType: CardWidthType = "half";

  if (filename.includes("-full")) {
    widthType = "full";
  } else if (filename.includes("-sixth")) {
    widthType = "sixth";
  }

  _cardDefinitions.push({
    cardFileName: filename,
    cardType,
    svgUrl: mod.default,
    widthType,
    cardGroup: "ixr",
    svgWidth: 492,
    svgHeight: 116,
  });
}

// --- 1830 / 1850 / 7705 Cards ---
for (const [path, mod] of Object.entries(baseEquipUrlModules)) {
  const filename = path.split("/").pop() ?? "";
  if (filename.startsWith("[")) continue; // Skip chassis backgrounds
  if (!filename.startsWith("1830") && !filename.startsWith("1850") && !filename.startsWith("7705")) continue;

  const cardType = filename.replace(/\.(svg|png|jpe?g)$/i, "");
  let widthType: CardWidthType = "1";
  let svgWidth = 430;
  let svgHeight = 46;

  if (filename.includes("-vfull")) {
    widthType = "vfull";
  } else if (filename.includes("full")) {
    widthType = "full";
    svgWidth = 860;
  }

  if (filename.includes("1830-PSS-12X-center")) {
    svgWidth = 52;
    svgHeight = 840;
  } else if (filename.includes("1850-TSS-320-center")) {
    svgWidth = 78;
    svgHeight = 738;
  } else if (filename.includes("1850-TSS-320H-center")) {
    svgWidth = 101;
    svgHeight = 738;
  } else if (filename.includes("1830-PSS-32-10")) {
    svgWidth = 52;
    svgHeight = 369;
  } else if (filename.includes("1850-TSS-side3_blank")) {
    svgWidth = 46;
    svgHeight = 218;
  }

  _cardDefinitions.push({
    cardFileName: filename,
    cardType,
    svgUrl: mod.default,
    widthType,
    cardGroup: "standard",
    svgWidth,
    svgHeight,
  });
}

// 정렬: half → full, 이름순
_cardDefinitions.sort((a, b) => {
  if (a.widthType !== b.widthType) {
    return a.widthType === "half" ? -1 : 1;
  }
  return a.cardFileName.localeCompare(b.cardFileName, undefined, {
    numeric: true,
  });
});

export const cardDefinitions: CardDefinition[] = _cardDefinitions;

/**
 * R6 전용 카드 파일명 목록 (R4 등 다른 모델에서는 사용 불가)
 * R-series-9-full.svg는 860×46이지만 R6 full slot (860×71) 전용.
 */
const R6_ONLY_CARD_FILENAMES = new Set(["R-series-9-full.svg"]);

/**
 * 모델에 맞는 카드 목록 필터링.
 * - slots 모델: 슬롯 accepts/allowedCardGroups에 매칭되는 카드만 반환
 * - uniform grid 모델: R6 전용 카드 제외
 */
export function getCardsForModel(
  model: EquipmentModel & { assignedCardIds?: string[] },
  allCards: CardDefinition[] = cardDefinitions,
): CardDefinition[] {
  if (model.assignedCardIds && model.assignedCardIds.length > 0) {
    return allCards.filter((cd) => model.assignedCardIds!.includes(cd.cardFileName) || model.assignedCardIds!.includes(cd.cardType));
  }

  if (model.slots) {
    // 모든 슬롯의 accepts와 allowedCardGroups 합산
    const allAccepts = new Set<string>();
    const allGroups = new Set<string>();
    model.slots.forEach((s) => {
      s.accepts.forEach((a) => allAccepts.add(a));
      s.allowedCardGroups?.forEach((g) => allGroups.add(g));
    });

    return allCards.filter((cd) => {
      // cardSizeType이 있으면 그걸로, 없으면 widthType으로 매칭
      const sizeKey = cd.cardSizeType || cd.widthType;
      const sizeOk = allAccepts.has(sizeKey);
      // cardGroup이 있으면 그걸로, 없으면 그룹 필터 스킵
      const groupOk =
        !allGroups.size || !cd.cardGroup || cd.cardGroup === "custom" || allGroups.has(cd.cardGroup);
      return sizeOk && groupOk;
    });
  }
  if (model.rows) {
    // row-based 모델: IXR 전용 카드만 허용
    return allCards.filter((cd) => cd.cardGroup === "ixr");
  }
  // uniform grid 모델: R6 전용 카드 제외, CPIOM/MDAs도 제외
  return allCards.filter(
    (cd) => !R6_ONLY_CARD_FILENAMES.has(cd.cardFileName) && (!cd.cardGroup || cd.cardGroup === "custom"), // R-series 카드 및 커스텀 카드 허용
  );
}

/** 카드 SVG raw text 메모리 캐시 */
const _cardSvgRawCache = new Map<string, string>();

// ── O(1) Map Lookups for SVGs ──────────────────────────────────────────────
const _cardRawModuleMap = new Map<string, () => Promise<{ default: string }>>();
const _baseEquipRawModuleMap = new Map<string, () => Promise<{ default: string }>>();
const _baseEquipUrlModuleMap = new Map<string, string>();

function initMaps() {
  const allCardSources = { ...cardRawModules, ...cpiomRawModules, ...mdasRawModules, ...ixrRawModules, ...baseEquipRawModules };
  for (const [path, importFn] of Object.entries(allCardSources)) {
    const fn = path.split("/").pop() ?? "";
    _cardRawModuleMap.set(fn, importFn);
  }
  for (const [path, importFn] of Object.entries(baseEquipRawModules)) {
    const fn = path.split("/").pop() ?? "";
    _baseEquipRawModuleMap.set(fn, importFn);
  }
  for (const [path, mod] of Object.entries(baseEquipUrlModules)) {
    const fn = path.split("/").pop() ?? "";
    _baseEquipUrlModuleMap.set(fn, mod.default);
  }
}
initMaps();

/**
 * 카드 SVG raw text 로드 (인라인 렌더링용)
 * 캐시 히트 시 즉시 반환, 미스 시 O(1) Map 룩업으로 동적 로드
 */
export async function loadCardSvgRaw(
  cardFileName: string,
): Promise<string | undefined> {
  const cached = _cardSvgRawCache.get(cardFileName);
  if (cached) return cached;

  if (cardFileName.startsWith("custom-card-")) {
    const cardId = cardFileName.replace("custom-card-", "");
    try {
      const { customCards } = useStore.getState();
      const customCard = customCards.find((c) => c.cardId === cardId);
      if (customCard) {
        _cardSvgRawCache.set(cardFileName, customCard.cardSvgRaw);
        return customCard.cardSvgRaw;
      }
    } catch (err) {
      console.error("Failed to load custom card SVG from store:", err);
    }
    return undefined;
  }

  if (cardFileName.toLowerCase().match(/\.(png|jpe?g)$/)) {
    const pngUrl = _baseEquipUrlModuleMap.get(cardFileName);
    if (pngUrl) {
      const cd = _cardDefinitions.find(c => c.cardFileName === cardFileName);
      const w = cd ? cd.svgWidth : 430;
      const h = cd ? cd.svgHeight : 46;
      const html = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <image href="${pngUrl}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" />
</svg>`;
      _cardSvgRawCache.set(cardFileName, html);
      return html;
    }
  }

  const importFn = _cardRawModuleMap.get(cardFileName);
  if (importFn) {
    try {
      const mod = await importFn();
      _cardSvgRawCache.set(cardFileName, mod.default);
      return mod.default;
    } catch (err) {
      console.error("Failed to load card SVG:", cardFileName, err);
      return undefined;
    }
  }
  return undefined;
}

/** 카드 SVG raw text 동기 캐시 조회 (캐시 미스 시 undefined) */
export function loadCardSvgRawSync(
  cardFileName: string,
): string | undefined {
  return _cardSvgRawCache.get(cardFileName);
}

/**
 * Base 장비 SVG raw text 로드
 */
export async function loadBaseEquipmentSvgRaw(
  baseSvgUrl: string,
): Promise<string | undefined> {
  if (baseSvgUrl.startsWith("custom-model-base-")) {
    const modelId = baseSvgUrl.replace("custom-model-base-", "");
    try {
      const { customModels } = useStore.getState();
      const model = customModels.find((m) => m.modelId === modelId);
      if (model) {
        return model.baseEquipmentViewSvgRaw || model.modelSvgRaw;
      }
    } catch (err) {
      console.error("Failed to load custom base equipment SVG from store:", err);
    }
    return undefined;
  }

  if (baseSvgUrl.toLowerCase().match(/\.(png|jpe?g)$/)) {
    const pngUrl = _baseEquipUrlModuleMap.get(baseSvgUrl);
    if (pngUrl) {
      const eqModel = equipmentModels.find(m => m.baseSvgUrl === baseSvgUrl);
      const w = eqModel?.equipmentSize?.width || 984;
      const h = eqModel?.equipmentSize?.height || 200;
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <image href="${pngUrl}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" />
</svg>`;
    }
  }

  const importFn = _baseEquipRawModuleMap.get(baseSvgUrl);
  if (importFn) {
    try {
      const mod = await importFn();
      return mod.default;
    } catch (err) {
      console.error("Failed to load base equipment SVG:", baseSvgUrl, err);
      return undefined;
    }
  }
  return undefined;
}

/**
 * Base 장비 SVG URL (img 태그용)
 */
export function getBaseEquipmentSvgUrl(baseSvgUrl: string): string | undefined {
  return _baseEquipUrlModuleMap.get(baseSvgUrl);
}

// ── 장비 모델 목록 ─────────────────────────────────────────────────────

// --- Factory Functions for Equipment Rows ---
function createR6FullSlot(row: number, y: number) {
  return { slotId: `row-${row}-full`, row, col: 1, x: 0, y, width: 860, height: 71, slotType: "full-860x71", accepts: ["full"] };
}
function createR6HalfSlots(row: number, y: number) {
  return [
    { slotId: `row-${row}-left`, row, col: 1, x: 0, y, width: 430, height: 46, slotType: "half-430x46", accepts: ["half"] },
    { slotId: `row-${row}-right`, row, col: 2, x: 430, y, width: 430, height: 46, slotType: "half-430x46", accepts: ["half"] },
  ];
}

function createR6dFullSlot(row: number, y: number) {
  return { slotId: `r6d-row-${row}-full`, row, x: 0, y, width: 828, height: 77, slotType: "full-828x77", allowedCardGroups: ["standard"], accepts: ["full-828x80"] };
}
function createR6dHalfSlots(row: number, y: number) {
  return [
    { slotId: `r6d-row-${row}-left`, row, col: 1, x: 0, y, width: 414, height: 77, slotType: "half-414x77", allowedCardGroups: ["standard"], accepts: ["half-414x77"] },
    { slotId: `r6d-row-${row}-right`, row, col: 2, x: 414, y, width: 414, height: 77, slotType: "half-414x77", allowedCardGroups: ["standard"], accepts: ["half-414x77"] },
  ];
}

function createR6dlStandardRow(row: number, y: number) {
  return { slotId: `r6dl-row-${row}`, row, x: 0, y, width: 828, height: 80, slotType: "full-828x80", allowedCardGroups: ["standard"], accepts: ["full-828x80"] };
}
function createR6dlCpiomRow(row: number, y: number) {
  return { slotId: `r6dl-row-${row}`, row, x: 0, y, width: 828, height: 72, slotType: "full-828x72", allowedCardGroups: ["cpiom"], accepts: ["cpiom-828x72"] };
}

function createIxrStandardRow(prefix: string, row: number, y: number, overlapY: number) {
  return {
    rowId: `${prefix}-row-${row}`,
    row,
    x: 0,
    y,
    width: 984,
    height: 116,
    overlapY,
    columns: 2,
    subSlots: [
      { slotId: `${prefix}-r${row}-full`, x: 0, y: 0, width: 984, height: 116 },
      { slotId: `${prefix}-r${row}-c1`, x: 0, y: 0, width: 492, height: 116 },
      { slotId: `${prefix}-r${row}-c2`, x: 492, y: 0, width: 492, height: 116 },
    ],
  };
}

function createIxrCpmRow(prefix: string, row: number, y: number, overlapY: number) {
  return {
    rowId: `${prefix}-row-${row}`,
    row,
    x: 0,
    y,
    width: 984,
    height: 102,
    overlapY,
    columns: 6,
    subSlots: Array.from({ length: 6 }).map((_, i) => ({
      slotId: `${prefix}-r${row}-c${i + 1}`,
      x: i * 164,
      y: 0,
      width: 164,
      height: 102,
    })),
  };
}

export const equipmentModels: EquipmentModel[] = [
  {
    modelId: "7250-ixr-r4",
    modelName: "7250 IXR-R4",
    baseSvgUrl: "[2U] 7250 IXR-R4-CARD.svg",
    equipmentSize: { width: 984, height: 192 },
    cardArea: {
      x: 104,
      y: 4,
      width: 860,
      height: 184,
      columns: 2,
      columnWidth: 430,
    },
  },
  {
    modelId: "7250-ixr-r6",
    modelName: "7250 IXR-R6",
    baseSvgUrl: "[3U] 7250 IXR-R6-CARD.svg",
    equipmentSize: { width: 984, height: 288 },
    cardArea: {
      x: 104,
      y: 4,
      width: 860,
      height: 280,
      columns: 2,
      columnWidth: 430,
    },
  },
  {
    modelId: "7250-ixr-r6d",
    modelName: "7250 IXR-R6d",
    rackUnit: "4U",
    baseSvgUrl: "[4U] 7250 IXR-R6d-CARD.svg",
    equipmentSize: { width: 984, height: 384 },
    cardArea: {
      x: 136,
      y: 2,
      width: 828,
      height: 375,
      columns: 2,
      columnWidth: 414,
    },
    _rowHeights: [72, 72, 77, 77, 77],
    _rowGaps: [0, 0, 0, 0, 0],
  },
  {
    modelId: "7250-ixr-r6dl",
    modelName: "7250 IXR-R6dl",
    rackUnit: "7U",
    baseSvgUrl: "[7U] 7250 IXR-R6dl-CARD.svg",
    equipmentSize: { width: 984, height: 672 },
    cardArea: {
      x: 136,
      y: 22,
      width: 828,
      height: 624,
      columns: 2,
      columnWidth: 414,
    },
    _rowHeights: [72, 72, 77, 77, 77, 77, 77, 77],
    _rowGaps: [5, 5, 5, 5, 5, 5, 5, 5],
  },
  {
    modelId: "7250-ixr-6",
    modelName: "7250 IXR-6",
    rackUnit: "7U",
    baseSvgUrl: "7250-IXR-6-CARD.svg",

    equipmentSize: { width: 984, height: 672 },
    cardArea: {
      x: 108,
      y: 20,
      width: 866,
      height: 640,
      columns: 6,
      columnWidth: 144.33,
    },
    _rowHeights: [100, 100, 100, 100, 100, 100],
    _rowGaps: [0, 0, 0, 0, 0, 0],
  },
  {
    modelId: "7250-ixr-10",
    modelName: "7250 IXR-10",
    rackUnit: "13U",
    baseSvgUrl: "7250-IXR-10-CARD.svg",

    equipmentSize: { width: 984, height: 1248 },
    cardArea: {
      x: 108,
      y: 20,
      width: 866,
      height: 1216,
      columns: 6,
      columnWidth: 144.33,
    },
    _rowHeights: [110.5, 110.5, 110.5, 110.5, 110.5, 110.5, 110.5, 110.5, 110.5, 110.5, 110.5],
    _rowGaps: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  {
    modelId: "1850-tss-320h",
    modelName: "1850 TSS-320H",
    rackUnit: "14U",
    baseSvgUrl: "[14U] 1850-TSS-320H-CARD.png",
    equipmentSize: { width: 984, height: 1344 },
    cardArea: { x: 0, y: 0, width: 984, height: 1344, columns: 1, columnWidth: 984 },
  },
  {
    modelId: "1830-pss-12x",
    modelName: "1830 PSS-12X",
    rackUnit: "14U",
    baseSvgUrl: "[14U] 1830-PSS-12X-CARD.png",
    equipmentSize: { width: 984, height: 1344 },
    cardArea: { x: 0, y: 0, width: 984, height: 1344, columns: 1, columnWidth: 984 },
  },
  {
    modelId: "1850-tss-320",
    modelName: "1850 TSS-320",
    rackUnit: "12U",
    baseSvgUrl: "[12U] 1850-TSS-320-CARD.png",
    equipmentSize: { width: 984, height: 1152 },
    cardArea: { x: 0, y: 0, width: 984, height: 1152, columns: 1, columnWidth: 984 },
  },
  {
    modelId: "1830-pss-32",
    modelName: "1830 PSS-32",
    rackUnit: "12U",
    baseSvgUrl: "[12U] 1830-PSS-32-CARD.png",
    equipmentSize: { width: 984, height: 1152 },
    cardArea: { x: 0, y: 0, width: 984, height: 1152, columns: 1, columnWidth: 984 },
  },
  {
    modelId: "7705-sar-8",
    modelName: "7705 SAR-8",
    rackUnit: "2U",
    baseSvgUrl: "[2U] 7705 SAR-8-CARD.png",
    equipmentSize: { width: 984, height: 192 },
    cardArea: { x: 0, y: 0, width: 984, height: 192, columns: 1, columnWidth: 984 },
  },
];
