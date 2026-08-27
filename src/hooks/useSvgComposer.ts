/**
 * useSvgComposer – SVG 합성 로직 커스텀 훅
 *
 * 장비 본체 SVG + 카드 SVG + 모듈 SVG를 합성하여 최종 HTML 문자열을 반환합니다.
 * 캐싱을 통해 재열기 시 즉시 렌더링합니다.
 */
import { useEffect, useState, useMemo } from 'react';

// ─── WebP 생성 로딩 추적 (InitialLoader 연동용) ───
let pendingComposerTasks = 0;
const composerListeners = new Set<(count: number) => void>();
const incrementComposerTask = () => {
  pendingComposerTasks++;
  composerListeners.forEach(l => l(pendingComposerTasks));
};
const decrementComposerTask = () => {
  pendingComposerTasks = Math.max(0, pendingComposerTasks - 1);
  composerListeners.forEach(l => l(pendingComposerTasks));
};
export const useComposerTaskProgress = () => {
  const [count, setCount] = useState(pendingComposerTasks);
  useEffect(() => {
    composerListeners.add(setCount);
    return () => { composerListeners.delete(setCount); };
  }, []);
  return count;
};

// ─── 비동기 작업을 감싸서 안전하게 카운트를 증감시키는 유틸리티 ───
export const withComposerTask = async <T>(task: () => Promise<T>): Promise<T> => {
  incrementComposerTask();
  try {
    return await task();
  } finally {
    decrementComposerTask();
  }
};

import { equipmentModels, loadCardSvgRaw, loadCardSvgRawSync, loadBaseEquipmentSvgRaw } from '../utils/cardAssets';
import { resolveDeviceSvgContent, isChassisModel } from '../utils/deviceAssets';
import { moduleDefinitions } from '../utils/moduleAssets';
import { useStore } from '../store/useStore';
import { generatePortMap, buildPortStatusMapFromPortStates, applyPortStatuses } from '../utils/portUtils';
import { getElementBBox, prefixSvgIds, filterPortElements, PORT_SELECTOR, resolvePortId } from '../utils/svgUtils';
import { DEFAULT_CHASSIS_CARDS } from '../utils/defaultChassisCards';
import { getColSpan, type EquipmentModel, type GeneratedPort, type InsertedCard, type InsertedModule } from '../types/equipment';
import type { EquipmentViewSide } from '../types/equipment';
import type { PortState } from '../types';
import { ERROR_COLORS } from '../utils/errorHelpers';

const PORT_STATUS_COLORS: Record<string, string> = {
  normal: "transparent",
  critical: ERROR_COLORS.critical,
  warning: ERROR_COLORS.warning,
  disabled: "#666666",
};

const staticThumbnailsModules = import.meta.glob<{ default: string }>(
  "../utils/chassis-thumbnails/*.webp",
  { eager: true }
);

const staticThumbnailMap = new Map<string, string>();
for (const [path, mod] of Object.entries(staticThumbnailsModules)) {
  const filename = path.split("/").pop() ?? "";
  const baseName = filename.replace(/\.webp$/i, "").replace(/^\[\d+U\]\s*/, "").trim();
  staticThumbnailMap.set(baseName, mod.default);
}

const CARD_ROW_HEIGHT = 46;
type ComposerEquipmentModel = EquipmentModel & { 
  _rowHeights?: number[]; 
  _rowGaps?: number[]; 
  _rowColumns?: number[];
  gridMerges?: { r: number; c: number; rs: number; cs: number }[];
  gridColWidths?: number[];
  gridRowHeights?: number[];
  baseEquipmentViewSvgRaw?: string;
};

function getRowColumnCount(row: number, defaultColumns: number, customRowColumns?: number[]): number {
  return Math.max(1, customRowColumns?.[row] ?? defaultColumns);
}

function getGridPositionIndex(row: number, col: number, defaultColumns: number, customRowColumns?: number[]): number {
  if (!customRowColumns || customRowColumns.length === 0) return row * defaultColumns + col;
  let index = 0;
  for (let r = 0; r < row; r += 1) {
    index += getRowColumnCount(r, defaultColumns, customRowColumns);
  }
  return index + col;
}

function getGridPositionFromIndex(positionIndex: number, defaultColumns: number, customRowColumns?: number[]): { row: number; col: number; columns: number } {
  if (!customRowColumns?.length) {
    return {
      row: Math.floor(positionIndex / defaultColumns),
      col: positionIndex % defaultColumns,
      columns: defaultColumns,
    };
  }

  let remaining = positionIndex;
  for (let row = 0; row < customRowColumns.length; row += 1) {
    const columns = getRowColumnCount(row, defaultColumns, customRowColumns);
    if (remaining < columns) return { row, col: remaining, columns };
    remaining -= columns;
  }

  return {
    row: customRowColumns.length,
    col: remaining % defaultColumns,
    columns: defaultColumns,
  };
}

function getCardPaintOrder(card: InsertedCard, model: ComposerEquipmentModel): number {
  if (model.rows && card.rowId) {
    const rowIndex = model.rows.findIndex((row) => row.rowId === card.rowId);
    return rowIndex >= 0 ? rowIndex : 0;
  }
  if (model.slots && card.slotId) {
    const slot = model.slots.find((s) => s.slotId === card.slotId);
    return slot?.row ?? 0;
  }
  if (model.cardArea) {
    return getGridPositionFromIndex(card.positionIndex, model.cardArea.columns, model._rowColumns).row;
  }
  return 0;
}

// ── LRU 캐시 클래스 ──
class SimpleLRUCache<K, V> {
  private max: number;
  private map: Map<K, V>;
  private onEvict?: (key: K, value: V) => void;

  constructor(max: number, onEvict?: (key: K, value: V) => void) {
    this.max = max;
    this.map = new Map<K, V>();
    this.onEvict = onEvict;
  }

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    const val = this.map.get(key)!;
    this.map.delete(key);
    this.map.set(key, val);
    return val;
  }

  set(key: K, value: V): this {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.max) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
         const oldestVal = this.map.get(oldestKey)!;
         if (this.onEvict) this.onEvict(oldestKey, oldestVal);
         this.map.delete(oldestKey);
      }
    }
    this.map.set(key, value);
    return this;
  }

  delete(key: K): boolean {
    if (this.map.has(key)) {
      const val = this.map.get(key)!;
      if (this.onEvict) this.onEvict(key, val);
      return this.map.delete(key);
    }
    return false;
  }
}

// ── 합성 캐시 ──
const CACHE_SIZE = 50;
const _composedHtmlCache = new SimpleLRUCache<string, string>(CACHE_SIZE);
const _composingPromises = new Map<string, Promise<string>>(); // 임시 Promise는 Map 유지 (작업 후 삭제되므로 누수 없음)
const _blobUrlCache = new SimpleLRUCache<string, string>(CACHE_SIZE, (key, url) => {
  // 캐시가 방출(Evict)될 때 메모리 해제
  URL.revokeObjectURL(url);
});
const _webpUrlCache = new SimpleLRUCache<string, string>(CACHE_SIZE);

export interface SvgComposerResult {
  composedHtml: string;
  blobUrl?: string;
  webpUrl?: string;
  isModularDevice: boolean;
  generatedPorts: GeneratedPort[];
  generatedPortMap: Map<string, GeneratedPort>;
}

export function useSvgComposer(
  modelName: string | undefined,
  insertedCards: InsertedCard[],
  insertedModules: InsertedModule[],
  portStates: PortState[],
  viewSide: EquipmentViewSide = "front",
): SvgComposerResult {
  const cardsKey = useMemo(() => 
    insertedCards
      .map(c => `${c.cardFileName}@${c.slotId || c.rowId || c.positionIndex}`)
      .sort()
      .join(','),
    [insertedCards]
  );
  const modulesKey = useMemo(() =>
    insertedModules
      .map(m => `${m.portId}-${m.moduleType}-${m.hitboxId || ""}`)
      .sort()
      .join(","),
    [insertedModules]
  );

  const portsKey = useMemo(() => {
    return portStates
      .filter(p => p.status && p.status !== "normal")
      .map(p => `${p.portId || p.portNumber}=${p.status}`)
      .sort()
      .join(",");
  }, [portStates]);

  const customModels = useStore((s) => s.customModels);

  const allEquipmentModels = useMemo(() => {
    const customMapped: ComposerEquipmentModel[] = [];
    customModels
      .filter((m) => m.modelType === "card-based")
      .forEach((m) => {
        const defaultTemplate = equipmentModels.find(em => em.modelName === m.modelName);
        const baseProps = {
          modelId: m.modelId,
          rackUnit: `${m.unit}U`,
          baseSvgUrl: `custom-model-base-${m.modelId}`,
          baseEquipmentViewSvgRaw: m.modelSvgRaw,
          rearSvgRaw: m.rearSvgRaw,
          equipmentSize: m.equipmentSize || defaultTemplate?.equipmentSize,
          cardArea: m.cardArea || defaultTemplate?.cardArea,
          _rowHeights: m.rowHeights,
          _rowGaps: m.rowGaps,
          _rowColumns: m.rowColumns,
          gridMerges: m.gridMerges,
          gridColWidths: m.gridColWidths,
          gridRowHeights: m.gridRowHeights,
        };
        
        if (m.variants && m.variants.length > 0) {
          m.variants.forEach((v) => {
            const appendedName = v.variantName === "기본타입" ? m.modelName : `${m.modelName} ${v.variantName}`;
            customMapped.push({
              ...baseProps,
              modelName: appendedName,
            });
          });
        } else {
          customMapped.push({
            ...baseProps,
            modelName: m.modelName,
          });
        }
      });
    return [...customMapped, ...equipmentModels] as ComposerEquipmentModel[];
  }, [customModels]);

  const equipModel = useMemo(() =>
    allEquipmentModels.find(m => m.modelName === modelName),
    [allEquipmentModels, modelName]
  );

  const modelLayoutKey = useMemo(() => {
    if (!equipModel) return "";
    return JSON.stringify({
      cardArea: equipModel.cardArea,
      rowHeights: equipModel._rowHeights,
      rowGaps: equipModel._rowGaps,
      rowColumns: equipModel._rowColumns,
    });
  }, [equipModel]);
  const _cacheKey = `${modelName}::${viewSide}::${modelLayoutKey}::${cardsKey}::${modulesKey}::${portsKey}`;

  const [composedHtml, setComposedHtml] = useState<string>(() =>
    _composedHtmlCache.get(_cacheKey) || ""
  );

  const [webpUrl, setWebpUrl] = useState<string | undefined>(() =>
    _webpUrlCache.get(`webp::${_cacheKey}`)
  );

  // _cacheKey 변경 시 캐시 히트를 즉시 반영
  useEffect(() => {
    const cached = _composedHtmlCache.get(_cacheKey);
    if (cached) setComposedHtml(cached);
    else setComposedHtml("");

    setWebpUrl(_webpUrlCache.get(`webp::${_cacheKey}`));
  }, [_cacheKey]);

  const isModularDevice = useMemo(() => {
    return viewSide === "front" && (
      insertedCards.length > 0 || 
      Boolean(equipModel && (equipModel.cardArea || equipModel.slots || equipModel.rows))
    );
  }, [viewSide, insertedCards.length, equipModel]);

  // ─── 카드 SVG raw text 캐시 ───
  const [cardSvgMap, setCardSvgMap] = useState<Map<string, string>>(() => {
    if (!isModularDevice) return new Map();
    const uniqueFileNames = [...new Set(insertedCards.map((c) => c.cardFileName))];
    const syncMap = new Map<string, string>();
    for (const fn of uniqueFileNames) {
      const cached = loadCardSvgRawSync(fn);
      if (cached) syncMap.set(fn, cached);
    }
    return syncMap.size === uniqueFileNames.length ? syncMap : new Map();
  });

  // 카드 SVG async fallback
  useEffect(() => {
    if (!isModularDevice) return;
    const uniqueFileNames = [...new Set(insertedCards.map((c) => c.cardFileName))];
    
    // 이미 모두 로드되었는지 확인
    const allLoaded = uniqueFileNames.every(fn => cardSvgMap.has(fn));
    if (allLoaded) return;

    let isMounted = true;
    withComposerTask(async () => {
      const results = await Promise.all(
        uniqueFileNames.map(async (fn) => {
          const raw = await loadCardSvgRaw(fn);
          return [fn, raw] as const;
        })
      );
      if (!isMounted) return;
      setCardSvgMap(prev => {
        const next = new Map(prev);
        let changed = false;
        for (const [fn, raw] of results) { 
          if (raw && !next.has(fn)) {
            next.set(fn, raw);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }).catch(console.error);
    return () => { isMounted = false; };
  }, [isModularDevice, cardsKey]);

  const statusMap = useMemo(() => buildPortStatusMapFromPortStates(portStates), [portStates]);

  // ─── 포트 맵 ───
  const generatedPorts = useMemo<GeneratedPort[]>(() => {
    if (!isModularDevice || cardSvgMap.size === 0) return [];
    const ports = generatePortMap(insertedCards, cardSvgMap);
    return applyPortStatuses(ports, statusMap);
  }, [isModularDevice, insertedCards, cardSvgMap, statusMap]);



  const generatedPortMap = useMemo(() =>
    new Map(generatedPorts.map(p => [p.realPortNumber, p])),
    [generatedPorts]
  );

  // ─── SVG 합성 ───
  useEffect(() => {
    let isMounted = true;

    const compose = async () => {
      if (!modelName) return;
      if (isModularDevice && insertedCards.length > 0 && cardSvgMap.size === 0) {
        return;
      }
      try {
        const cached = _composedHtmlCache.get(_cacheKey);
        if (cached) {
          if (isMounted) setComposedHtml(cached);
          return;
        }

        let existingPromise = _composingPromises.get(_cacheKey);
        if (existingPromise) {
          const finalHtml = await existingPromise;
          if (isMounted) setComposedHtml(finalHtml);
          return;
        }

        const composePromise = (async () => {
          let baseSvg: string | undefined;
          if (viewSide === "rear") {
            baseSvg = await resolveDeviceSvgContent(modelName, viewSide);
          } else if (isModularDevice && equipModel?.baseSvgUrl && equipModel.baseSvgUrl.startsWith("custom-model-base-")) {
            baseSvg = await loadBaseEquipmentSvgRaw(equipModel.baseSvgUrl);
          } else {
            const targetModelName = isModularDevice && equipModel?.baseSvgUrl
              ? equipModel.baseSvgUrl.replace(/\.svg$/i, "").replace(/^\[\d+U\]\s*/, "")
              : modelName;
            baseSvg = await resolveDeviceSvgContent(targetModelName, viewSide);
          }
          if (!baseSvg) {
            console.error("No base SVG found for modelName:", modelName, "viewSide:", viewSide);
            throw new Error("No base SVG found");
          }

          const parser = new DOMParser();
          const baseDoc = parser.parseFromString(baseSvg, "image/svg+xml");
          const baseSvgEl = baseDoc.querySelector("svg");
          if (!baseSvgEl) return { finalHtml: baseSvg, baseComposedHtml: baseSvg };

        if (!baseSvgEl.getAttribute('viewBox')) {
          const w = baseSvgEl.getAttribute('width') || '984';
          const h = baseSvgEl.getAttribute('height') || '200';
          baseSvgEl.setAttribute('viewBox', `0 0 ${parseInt(w, 10)} ${parseInt(h, 10)}`);
        }
        // Three.js TextureLoader requires explicit width/height attributes, not percentages.
        // We use CSS to scale it responsively in the DOM.
        if (!baseSvgEl.getAttribute('width')) baseSvgEl.setAttribute('width', '984');
        if (!baseSvgEl.getAttribute('height')) baseSvgEl.setAttribute('height', '200');
        baseSvgEl.setAttribute("style", "max-width:100%; height:auto; display:block; margin: 0 auto;");

        // ─── 빈 슬롯 영역 배경 덮기 ───
        drawBlankSlots(baseSvgEl, baseDoc, equipModel);

        // ─── 베이스 SVG HTML (카드 합성 전) ───
        // 섀시형 모델의 공통 썸네일 생성을 위해 카드 합성 전 상태를 저장합니다.
        const baseComposedHtml = new XMLSerializer().serializeToString(baseDoc);

        // ─── 카드 합성 ───
        composeCards(baseSvgEl, baseDoc, parser, insertedCards, cardSvgMap, equipModel);

        // ─── 모듈 합성 ───
        composeModules(baseSvgEl, baseDoc, insertedModules);

        // ─── 포트 스타일 사전 초기화 (직렬화 전 메모리 트리에서 처리) ───
        const allPortEls = filterPortElements(
          Array.from(baseSvgEl.querySelectorAll(PORT_SELECTOR))
        );
        allPortEls.forEach((el) => {
          const portId = resolvePortId(el);

          let styleStr = "fill: transparent; stroke: none;";
          let appliedStatus = "normal";

          if (portId) {
            // 1. Check generatedPortMap (if it's a modular port)
            const gp = generatedPortMap.get(portId);
            if (gp && gp.status !== "normal") {
              appliedStatus = gp.status;
            } else {
              // 2. Fallback: check statusMap directly for base SVG ports or non-modular devices
              if (statusMap[portId] && statusMap[portId] !== "normal") {
                appliedStatus = statusMap[portId];
              } else {
                const matchingKey = Object.keys(statusMap).find(k => 
                  k === portId || 
                  k.endsWith(`/${portId}`) || 
                  k.endsWith(`-${portId}`) ||
                  k === `port-${portId}` ||
                  k.endsWith(`/port-${portId}`)
                );
                if (matchingKey && statusMap[matchingKey] !== "normal") {
                  appliedStatus = statusMap[matchingKey];
                }
              }
            }
          }

          if (appliedStatus !== "normal") {
            const color = PORT_STATUS_COLORS[appliedStatus] || "transparent";
            styleStr = `fill: ${color}33; stroke: ${color}; stroke-width: 1.5px;`;
          }

          styleStr += " pointer-events: all; cursor: pointer;";
          el.setAttribute("style", styleStr);
        });

        const finalHtml = new XMLSerializer().serializeToString(baseDoc);
        _composedHtmlCache.set(_cacheKey, finalHtml);
        return { finalHtml, baseComposedHtml };
        })();

        _composingPromises.set(_cacheKey, composePromise.then(res => res.finalHtml));
        
        try {
          const { finalHtml, baseComposedHtml } = await composePromise;
          if (isMounted) {
            setComposedHtml(finalHtml);
            setBaseHtmlForWebp(baseComposedHtml);
          }
        } finally {
          _composingPromises.delete(_cacheKey);
        }
      } catch (e) {
        console.error("Compose Error:", e);
      }
    };

    withComposerTask(compose).catch(console.error);
    return () => { isMounted = false; };
  }, [modelName, cardsKey, equipModel, isModularDevice, cardSvgMap, modulesKey, portsKey, _cacheKey, generatedPortMap, insertedCards, insertedModules, viewSide]);

  const [baseHtmlForWebp, setBaseHtmlForWebp] = useState<string>("");

  // ─── Blob URL 캐싱 ───
  const blobUrl = useMemo(() => {
    if (!composedHtml) return undefined;
    let url = _blobUrlCache.get(_cacheKey);
    if (!url) {
      const blob = new Blob([composedHtml], { type: 'image/svg+xml' });
      url = URL.createObjectURL(blob);
      _blobUrlCache.set(_cacheKey, url);
    }
    return url;
  }, [composedHtml, _cacheKey]);

  // ─── WebP 자동 생성 ───
  useEffect(() => {
    if (!equipModel || !modelName) return;
    
    const webpCacheKey = `webp::${_cacheKey}`;

    const cachedWebp = _webpUrlCache.get(webpCacheKey);
    if (cachedWebp) {
      setWebpUrl(cachedWebp);
      return;
    }

    if (modulesKey === "" && portsKey === "" && viewSide === "front") {
      const staticThumb = staticThumbnailMap.get(modelName);
      if (staticThumb) {
        const defaultEquipModel = equipmentModels.find(m => m.modelName === modelName);
        if (defaultEquipModel) {
          const defaultLayoutKey = JSON.stringify({
            cardArea: defaultEquipModel.cardArea,
            rowHeights: defaultEquipModel._rowHeights,
            rowGaps: defaultEquipModel._rowGaps,
            rowColumns: defaultEquipModel._rowColumns,
          });
          
          const defaultCards = DEFAULT_CHASSIS_CARDS[modelName] || [];
          const defaultCardsKey = defaultCards.map((c: any) => `${c.slotNo}-${c.cardFileName}`).sort().join("|");

          if (modelLayoutKey === defaultLayoutKey && (cardsKey === "" || cardsKey === defaultCardsKey)) {
            _webpUrlCache.set(webpCacheKey, staticThumb);
            setWebpUrl(staticThumb);
            return;
          }
        }
      }
    }

    let isMounted = true;
    
    withComposerTask(async () => {
      const { idbStorage } = await import("../utils/indexedDBStorage");
      const savedUrl = await idbStorage.getItem(webpCacheKey);
      
      if (!isMounted) return;
      
      if (savedUrl) {
        _webpUrlCache.set(webpCacheKey, savedUrl);
        setWebpUrl(savedUrl);
      } else {
        // 캐시에 없을 경우 새로 생성해야 함
        const targetHtml = composedHtml;
        const expectedHtml = _composedHtmlCache.get(_cacheKey);
        if (!targetHtml || targetHtml !== expectedHtml) return;


        // 캐시 오염을 방지하기 위해 WebP를 새로 생성하기 전에는 모든 카드의 SVG 데이터가 로드되었는지 확인합니다.
        const isAllCardsLoaded = insertedCards.every((card) => cardSvgMap.has(card.cardFileName));
        if (!isAllCardsLoaded) return;

        const { convertSvgToPngAsync } = await import("../utils/imageUtils");
        const url = await convertSvgToPngAsync(targetHtml, equipModel.equipmentSize?.width || 984, equipModel.equipmentSize?.height || 200);
        
        if (!isMounted) return;
        
        _webpUrlCache.set(webpCacheKey, url);
        idbStorage.setItem(webpCacheKey, url).catch(console.error);
        setWebpUrl(url);
      }
    }).catch(console.error);

    return () => { isMounted = false; };
  }, [composedHtml, baseHtmlForWebp, _cacheKey, equipModel, modelName, viewSide, insertedCards, cardSvgMap]);

  return { composedHtml, blobUrl, webpUrl, isModularDevice, generatedPorts, generatedPortMap };
}

// ─── 내부 합성 헬퍼 ───

function composeCards(
  baseSvgEl: SVGSVGElement,
  baseDoc: Document,
  parser: DOMParser,
  insertedCards: InsertedCard[],
  cardSvgMap: Map<string, string>,
  equipModel: ComposerEquipmentModel | undefined,
) {
  if (!equipModel) return;
  const orderedCards = [...insertedCards].sort(
    (a, b) => getCardPaintOrder(a, equipModel) - getCardPaintOrder(b, equipModel),
  );
  for (const card of orderedCards) {
    const raw = cardSvgMap.get(card.cardFileName);
    if (!raw) continue;

    const cardDoc = parser.parseFromString(raw, "image/svg+xml");
    const cardSvgEl = cardDoc.querySelector("svg");
    if (!cardSvgEl) continue;

    let x: number = 0, y: number = 0, cardW: number = 0, cardH: number = 0;

    if (equipModel.slots && card.slotId) {
      const slotDef = equipModel.slots.find((s) => s.slotId === card.slotId);
      if (!slotDef || !equipModel.cardArea) continue;
      x = equipModel.cardArea.x + slotDef.x;
      y = equipModel.cardArea.y + slotDef.y;
      cardW = slotDef.width;
      cardH = slotDef.height;
    } else if (equipModel.rows && card.rowId && card.slotId) {
      const rowDef = equipModel.rows.find((r) => r.rowId === card.rowId);
      if (!rowDef) continue;
      const subDef = rowDef.subSlots.find((s) => s.slotId === card.slotId);
      if (!subDef) continue;
      x = rowDef.x + subDef.x;
      y = rowDef.y + subDef.y;
      cardW = subDef.width;
      cardH = subDef.height;
    } else if (equipModel.cardArea) {
      if (equipModel.gridColWidths && equipModel.gridRowHeights && equipModel.gridColWidths.length > 0 && equipModel.gridRowHeights.length > 0) {
        const covered = new Set<string>();
        if (equipModel.gridMerges) {
          for (const merge of equipModel.gridMerges) {
            for (let r = merge.r; r < merge.r + merge.rs; r++) {
              for (let c = merge.c; c < merge.c + merge.cs; c++) {
                if (r === merge.r && c === merge.c) continue;
                covered.add(`${r},${c}`);
              }
            }
          }
        }
        let found = false;
        let currentY = equipModel.cardArea.y;
        for (let r = 0; r < equipModel.gridRowHeights.length; r++) {
          const rowH = equipModel.gridRowHeights[r] || CARD_ROW_HEIGHT;
          const rowGap = equipModel._rowGaps?.[r] ?? 0;
          let currentX = equipModel.cardArea.x;
          for (let c = 0; c < equipModel.gridColWidths.length; c++) {
            const colW = equipModel.gridColWidths[c] || 0;
            const idx = getGridPositionIndex(r, c, equipModel.cardArea.columns, equipModel._rowColumns);
            if (idx === card.positionIndex && !covered.has(`${r},${c}`)) {
              const merge = equipModel.gridMerges?.find((m: any) => m.r === r && m.c === c);
              let slotW = colW;
              let slotH = rowH;
              if (merge) {
                slotW = 0;
                for (let mc = merge.c; mc < merge.c + merge.cs; mc++) slotW += equipModel.gridColWidths![mc] || 0;
                slotH = 0;
                for (let mr = merge.r; mr < merge.r + merge.rs; mr++) {
                  slotH += equipModel.gridRowHeights![mr] || 0;
                  if (mr < merge.r + merge.rs - 1) slotH += equipModel._rowGaps?.[mr] ?? 0;
                }
              }
              x = currentX;
              y = currentY;
              cardW = slotW;
              cardH = slotH;
              found = true;
              break;
            }
            currentX += colW;
          }
          if (found) break;
          currentY += rowH + rowGap;
        }
        if (!found) continue;
      } else {
        const { row, col, columns: rowColumns } = getGridPositionFromIndex(
          card.positionIndex,
          equipModel.cardArea.columns,
          equipModel._rowColumns,
        );
        const rowColumnWidth = equipModel.cardArea.width / rowColumns;
        x = equipModel.cardArea.x + col * rowColumnWidth;
        const currentRowHeights = equipModel._rowHeights;
        const currentRowGaps = equipModel._rowGaps;
        if ((currentRowHeights && currentRowHeights.length > 0) || (currentRowGaps && currentRowGaps.length > 0)) {
          let yOff = 0;
          for (let r = 0; r < row; r++) {
            yOff += (currentRowHeights?.[r] ?? CARD_ROW_HEIGHT);
            yOff += currentRowGaps?.[r] ?? 0;
          }
          y = equipModel.cardArea.y + yOff;
          cardH = currentRowHeights?.[row] ?? CARD_ROW_HEIGHT;
        } else {
          y = equipModel.cardArea.y + row * CARD_ROW_HEIGHT;
          cardH = CARD_ROW_HEIGHT;
        }
        cardW = rowColumnWidth * getColSpan(card.widthType, rowColumns);
      }
    } else {
      continue;
    }

    const vb = cardSvgEl.getAttribute("viewBox");
    const parts = vb ? vb.split(/\s+/).map(Number) : [0, 0, 100, 20];
    const origW = parts[2] || 100;
    const origH = parts[3] || 20;

    const instancePrefix = card.instanceId || `card-${card.positionIndex}`;
    prefixSvgIds(cardSvgEl, instancePrefix);

    const cardGroup = baseDoc.createElementNS("http://www.w3.org/2000/svg", "g");
    const scaleX = cardW / origW;
    const scaleY = cardH / origH;
    cardGroup.setAttribute("transform", `translate(${x}, ${y}) scale(${scaleX}, ${scaleY})`);
    cardGroup.setAttribute("data-card-instance", instancePrefix);

    // 포트 히트박스 속성 처리
    cardSvgEl.querySelectorAll(".port-hitbox").forEach((hb) => {
      const localPort = hb.getAttribute("data-local-port");
      if (!localPort) return;

      const portType = hb.getAttribute("data-port-type") || hb.getAttribute("data-porttype") || "";
      const uniquePortKey = portType ? `${portType}-${localPort}` : localPort;
      const realPortNumber = `${card.shelfNo}/${card.slotNo}/${uniquePortKey}`;
      hb.setAttribute("data-port-number", realPortNumber);
      hb.setAttribute("data-card-instance", instancePrefix);
    });

    while (cardSvgEl.firstChild) {
      cardGroup.appendChild(cardSvgEl.firstChild);
    }
    baseSvgEl.appendChild(cardGroup);
  }
}

function composeModules(
  baseSvgEl: SVGSVGElement,
  baseDoc: Document,
  insertedModules: InsertedModule[],
) {
  // 전체 포트 엘리먼트 수집
  const allPortEls = filterPortElements(
    Array.from(baseSvgEl.querySelectorAll(PORT_SELECTOR))
  );

  allPortEls.forEach(el => {
    el.setAttribute("pointer-events", "all");
  });

  // portId → hitbox 맵핑
  const hitboxesByPortId = new Map<string, SVGElement[]>();
  allPortEls.forEach((hb) => {
    const portId = resolvePortId(hb);
    if (!portId) return;
    if (!hitboxesByPortId.has(portId)) hitboxesByPortId.set(portId, []);
    hitboxesByPortId.get(portId)!.push(hb);
  });

  // 각 모듈 렌더링
  insertedModules.forEach((module) => {
    const hbs = hitboxesByPortId.get(module.portId);
    if (!hbs || hbs.length === 0) return;

    const moduleDef = moduleDefinitions.find(m => m.svgFileName === module.moduleSvgFileName);
    if (!moduleDef) return;

    const targetHb = resolveTargetHitbox(hbs, module);
    const bbox = getElementBBox(targetHb);
    const scaleFactor = 1.2;
    const finalW = bbox.w * scaleFactor;
    const finalH = bbox.h * scaleFactor;
    const finalX = bbox.x - (finalW - bbox.w) / 2;
    const finalY = bbox.y - (finalH - bbox.h) / 2;

    const img = baseDoc.createElementNS("http://www.w3.org/2000/svg", "image");
    img.setAttribute("href", moduleDef.svgUrl);
    img.setAttribute("x", finalX.toString());
    img.setAttribute("y", finalY.toString());
    img.setAttribute("width", finalW.toString());
    img.setAttribute("height", finalH.toString());
    img.setAttribute("preserveAspectRatio", "none");
    img.setAttribute("class", "inserted-module");
    img.setAttribute("data-port-id", module.portId);
    img.setAttribute("pointer-events", "none");


    const parent = targetHb.parentNode;
    if (parent) {
      parent.insertBefore(img, targetHb);
      parent.appendChild(targetHb);
    }
  });
}

/** 복수 hitbox 중 올바른 타겟을 결정 */
function resolveTargetHitbox(hbs: SVGElement[], module: InsertedModule): SVGElement {
  if (hbs.length <= 1) return hbs[0];

  const modType = module.moduleType.toLowerCase();

  // 1순위: 정확한 hitboxId 매칭
  if (module.hitboxId) {
    const exact = hbs.find(hb => hb.id === module.hitboxId);
    if (exact) return exact;
  }

  // 2순위: 모듈 타입 기반 매칭
  const typeMatch = hbs.find(hb => {
    const hbType = (hb.getAttribute("data-port-name") || hb.getAttribute("data-port-type") || "").toLowerCase();
    if (modType === "sfp" && (hbType === "sfp" || hbType === "qsfp" || hbType === "qsfp28")) return true;
    if (modType === "ethernet" && (hbType === "port" || hbType === "ethernet")) return true;
    return false;
  });

  return typeMatch || hbs[0];
}

export function drawBlankSlots(
  baseSvgEl: SVGSVGElement,
  baseDoc: Document,
  equipModel: ComposerEquipmentModel | undefined
) {
  if (!equipModel) return;

  const drawRect = (x: number, y: number, w: number, h: number) => {
    const rect = baseDoc.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", x.toString());
    rect.setAttribute("y", y.toString());
    rect.setAttribute("width", w.toString());
    rect.setAttribute("height", h.toString());
    rect.setAttribute("fill", "transparent");
    rect.setAttribute("stroke", "none");
    rect.setAttribute("stroke-width", "0");
    baseSvgEl.appendChild(rect);
  };

  if (equipModel.slots) {
    for (const slot of equipModel.slots) {
      drawRect(
        (equipModel.cardArea?.x ?? 0) + slot.x,
        (equipModel.cardArea?.y ?? 0) + slot.y,
        slot.width,
        slot.height
      );
    }
  } else if (equipModel.rows) {
    for (const row of equipModel.rows) {
      for (const sub of row.subSlots) {
        drawRect(
          row.x + sub.x,
          row.y + sub.y,
          sub.width,
          sub.height
        );
      }
    }
  } else if (equipModel.cardArea) {
    const area = equipModel.cardArea;
    const numRows = (equipModel.gridRowHeights && equipModel.gridRowHeights.length > 0) ? equipModel.gridRowHeights.length : (equipModel._rowHeights?.length ?? Math.max(1, Math.floor(area.height / CARD_ROW_HEIGHT)));
    
    if (equipModel.gridRowHeights && equipModel.gridColWidths && equipModel.gridRowHeights.length > 0 && equipModel.gridColWidths.length > 0) {
      const covered = new Set<string>();
      
      if (equipModel.gridMerges) {
        for (const merge of equipModel.gridMerges) {
          let x = area.x;
          for (let c = 0; c < merge.c; c++) x += equipModel.gridColWidths[c] || 0;
          let y = area.y;
          for (let r = 0; r < merge.r; r++) {
            y += equipModel.gridRowHeights[r] || 0;
            y += equipModel._rowGaps?.[r] ?? 0;
          }
          
          let w = 0;
          for (let c = merge.c; c < merge.c + merge.cs; c++) w += equipModel.gridColWidths[c] || 0;
          let h = 0;
          for (let r = merge.r; r < merge.r + merge.rs; r++) {
            h += equipModel.gridRowHeights[r] || 0;
            if (r < merge.r + merge.rs - 1) h += equipModel._rowGaps?.[r] ?? 0;
          }
          
          drawRect(x, y, w, h);
          
          for (let r = merge.r; r < merge.r + merge.rs; r++) {
            for (let c = merge.c; c < merge.c + merge.cs; c++) {
              covered.add(`${r},${c}`);
            }
          }
        }
      }
      
      let currentY = area.y;
      for (let r = 0; r < numRows; r++) {
        const rowHeight = equipModel.gridRowHeights[r] || CARD_ROW_HEIGHT;
        const rowGap = equipModel._rowGaps?.[r] ?? 0;
        
        let currentX = area.x;
        for (let c = 0; c < equipModel.gridColWidths.length; c++) {
          const colWidth = equipModel.gridColWidths[c] || 0;
          
          if (!covered.has(`${r},${c}`)) {
            drawRect(currentX, currentY, colWidth, rowHeight);
          }
          
          currentX += colWidth;
        }
        currentY += rowHeight + rowGap;
      }
    } else {
      let currentY = area.y;
      for (let r = 0; r < numRows; r++) {
        const cols = getRowColumnCount(r, area.columns, equipModel._rowColumns);
        const colWidth = area.width / cols;
        const rowHeight = equipModel._rowHeights?.[r] ?? CARD_ROW_HEIGHT;
        const rowGap = equipModel._rowGaps?.[r] ?? 0;

        for (let c = 0; c < cols; c++) {
          drawRect(
            area.x + c * colWidth,
            currentY,
            colWidth,
            rowHeight
          );
        }
        currentY += rowHeight + rowGap;
      }
    }
  }
}

export async function generateComposedSvgAsync(
  modelName: string | undefined,
  equipModel: ComposerEquipmentModel | undefined,
  insertedCards: InsertedCard[],
  insertedModules: InsertedModule[] = [],
  viewSide: EquipmentViewSide = "front"
): Promise<string | null> {
  if (!equipModel) return null;
  const isModularDevice = viewSide === "front" && (insertedCards.length > 0 || Boolean(equipModel.cardArea || equipModel.slots || equipModel.rows));
  
  const cardSvgMap = new Map<string, string>();
  if (isModularDevice) {
    const uniqueFileNames = [...new Set(insertedCards.map((c) => c.cardFileName))];
    await Promise.all(uniqueFileNames.map(async (fn) => {
      const raw = await loadCardSvgRaw(fn);
      if (raw) cardSvgMap.set(fn, raw);
    }));
  }
  
  let baseSvg: string | undefined = equipModel.baseEquipmentViewSvgRaw;
  if (!baseSvg) {
    if (isModularDevice && equipModel.baseSvgUrl && equipModel.baseSvgUrl.startsWith("custom-model-base-")) {
      baseSvg = await loadBaseEquipmentSvgRaw(equipModel.baseSvgUrl);
    } else {
      const targetModelName = isModularDevice && equipModel.baseSvgUrl
        ? equipModel.baseSvgUrl.replace(/\.svg$/i, "").replace(/^\[\d+U\]\s*/, "")
        : modelName;
      if (targetModelName) {
        baseSvg = await resolveDeviceSvgContent(targetModelName, viewSide);
      }
    }
  }
  if (!baseSvg) return null;
  
  const parser = new DOMParser();
  const baseDoc = parser.parseFromString(baseSvg, "image/svg+xml");
  const baseSvgEl = baseDoc.querySelector("svg");
  if (!baseSvgEl) return baseSvg;
  
  if (!baseSvgEl.getAttribute('viewBox')) {
    const w = baseSvgEl.getAttribute('width') || '984';
    const h = baseSvgEl.getAttribute('height') || '200';
    baseSvgEl.setAttribute('viewBox', `0 0 ${parseInt(w, 10)} ${parseInt(h, 10)}`);
  }
  if (!baseSvgEl.getAttribute('width')) baseSvgEl.setAttribute('width', '984');
  if (!baseSvgEl.getAttribute('height')) baseSvgEl.setAttribute('height', '200');
  baseSvgEl.setAttribute("style", "max-width:100%; height:auto; display:block; margin: 0 auto;");
  
  const statusMap = buildPortStatusMapFromPortStates([]);

  drawBlankSlots(baseSvgEl, baseDoc, equipModel);
  composeCards(baseSvgEl, baseDoc, parser, insertedCards, cardSvgMap, equipModel);
  composeModules(baseSvgEl, baseDoc, insertedModules);
  
  const allPortEls = filterPortElements(Array.from(baseSvgEl.querySelectorAll(PORT_SELECTOR)));
  allPortEls.forEach((el) => {
    let styleStr = "fill: transparent; stroke: none;";
    styleStr += " pointer-events: all; cursor: pointer;";
    el.setAttribute("style", styleStr);
  });
  
  return new XMLSerializer().serializeToString(baseDoc);
}

export async function preloadAllChassisThumbnails() {
  const { equipmentModels } = await import("../utils/cardAssets");
  const { idbStorage } = await import("../utils/indexedDBStorage");
  const { convertSvgToPngAsync } = await import("../utils/imageUtils");
  
  for (const model of equipmentModels) {
    if (model.cardArea || model.slots || model.rows) {
      const modelLayoutKey = JSON.stringify({
        cardArea: model.cardArea,
        rowHeights: model._rowHeights,
        rowGaps: model._rowGaps,
        rowColumns: model._rowColumns,
      });
      const cacheKeyFront = `${model.modelName}::front::${modelLayoutKey}::::::`;
      const webpCacheKeyFront = `webp::${cacheKeyFront}`;

      const staticThumb = staticThumbnailMap.get(model.modelName);
      if (staticThumb) {
        _webpUrlCache.set(webpCacheKeyFront, staticThumb);
        continue;
      }
      
      const savedFront = await idbStorage.getItem(webpCacheKeyFront);
      if (!savedFront) {
        withComposerTask(async () => {
          try {
            const svgHtml = await generateComposedSvgAsync(model.modelName, model as any, [], [], "front");
            if (svgHtml) {
              const url = await convertSvgToPngAsync(svgHtml, model.equipmentSize?.width || 984, model.equipmentSize?.height || 200);
              await idbStorage.setItem(webpCacheKeyFront, url);
              _webpUrlCache.set(webpCacheKeyFront, url);
            }
          } catch (e) {
            console.error("Failed to preload chassis thumbnail:", e);
          }
        });
      }
    }
  }
}
