/**
 * useSvgComposer – SVG 합성 로직 커스텀 훅
 *
 * 장비 본체 SVG + 카드 SVG + 모듈 SVG를 합성하여 최종 HTML 문자열을 반환합니다.
 * 캐싱을 통해 재열기 시 즉시 렌더링합니다.
 */
import { useEffect, useState, useMemo } from 'react';
import { equipmentModels, loadCardSvgRaw, loadCardSvgRawSync, loadBaseEquipmentSvgRaw } from '../utils/cardAssets';
import { resolveDeviceSvgContent } from '../utils/deviceAssets';
import { moduleDefinitions } from '../utils/moduleAssets';
import { useStore } from '../store/useStore';
import { generatePortMap, buildPortStatusMapFromPortStates, applyPortStatuses } from '../utils/portUtils';
import { getElementBBox, prefixSvgIds, filterPortElements, PORT_SELECTOR, resolvePortId } from '../utils/svgUtils';
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

const CARD_ROW_HEIGHT = 46;
type ComposerEquipmentModel = EquipmentModel & { _rowHeights?: number[]; _rowGaps?: number[]; _rowColumns?: number[] };

function getRowColumnCount(row: number, defaultColumns: number, customRowColumns?: number[]): number {
  return Math.max(1, customRowColumns?.[row] ?? defaultColumns);
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

/** 합성된 SVG HTML 모듈 레벨 캐시 (재열기 시 즉시 렌더링) */
const _composedHtmlCache = new Map<string, string>();

export interface SvgComposerResult {
  composedHtml: string;
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
  const cardsKey = insertedCards.map(c => c.instanceId).join(',');
  const modulesKey = useMemo(() =>
    insertedModules
      .map(m => `${m.portId}-${m.moduleType}-${m.hitboxId || ""}`)
      .sort()
      .join(","),
    [insertedModules]
  );
  const customModels = useStore((s) => s.customModels);

  const allEquipmentModels = useMemo(() => {
    const customMapped: ComposerEquipmentModel[] = customModels
      .filter((m) => m.modelType === "card-based")
      .map((m) => ({
        modelId: m.modelId,
        modelName: m.modelName,
        rackUnit: `${m.unit}U`,
        baseSvgUrl: `custom-model-base-${m.modelId}`,
        equipmentSize: m.equipmentSize,
        cardArea: m.cardArea,
        _rowHeights: m.rowHeights,
        _rowGaps: m.rowGaps,
        _rowColumns: m.rowColumns,
      }));
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
  const _cacheKey = `${modelName}::${viewSide}::${modelLayoutKey}::${cardsKey}::${modulesKey}`;

  const [composedHtml, setComposedHtml] = useState<string>(() =>
    _composedHtmlCache.get(_cacheKey) || ""
  );

  // _cacheKey 변경 시 캐시 히트를 즉시 반영
  useEffect(() => {
    const cached = _composedHtmlCache.get(_cacheKey);
    if (cached) setComposedHtml(cached);
    else setComposedHtml("");
  }, [_cacheKey]);

  const isModularDevice = viewSide === "front" && !!equipModel && insertedCards.length > 0;

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
    if (!isModularDevice || cardSvgMap.size > 0) return;
    let isMounted = true;
    const uniqueFileNames = [...new Set(insertedCards.map((c) => c.cardFileName))];
    Promise.all(
      uniqueFileNames.map(async (fn) => {
        const raw = await loadCardSvgRaw(fn);
        return [fn, raw] as const;
      })
    ).then((results) => {
      if (!isMounted) return;
      const map = new Map<string, string>();
      for (const [fn, raw] of results) { if (raw) map.set(fn, raw); }
      setCardSvgMap(map);
    });
    return () => { isMounted = false; };
  }, [isModularDevice, cardsKey]);

  // ─── 포트 맵 ───
  const generatedPorts = useMemo<GeneratedPort[]>(() => {
    if (!isModularDevice || cardSvgMap.size === 0) return [];
    const ports = generatePortMap(insertedCards, cardSvgMap);
    const statusMap = buildPortStatusMapFromPortStates(portStates);
    return applyPortStatuses(ports, statusMap);
  }, [isModularDevice, insertedCards, cardSvgMap, portStates]);



  const generatedPortMap = useMemo(() =>
    new Map(generatedPorts.map(p => [p.realPortNumber, p])),
    [generatedPorts]
  );

  // ─── SVG 합성 ───
  useEffect(() => {
    let isMounted = true;

    const compose = async () => {
      try {
        let baseSvg: string | undefined;
        if (isModularDevice && equipModel?.baseSvgUrl && equipModel.baseSvgUrl.startsWith("custom-model-base-")) {
          baseSvg = await loadBaseEquipmentSvgRaw(equipModel.baseSvgUrl);
        } else {
          const targetModelName = isModularDevice && equipModel?.baseSvgUrl
            ? equipModel.baseSvgUrl.replace(/\.svg$/i, "").replace(/^\[\d+U\]\s*/, "")
            : modelName;
          baseSvg = await resolveDeviceSvgContent(targetModelName, viewSide);
        }
        if (!isMounted || !baseSvg) return;

        const parser = new DOMParser();
        const baseDoc = parser.parseFromString(baseSvg, "image/svg+xml");
        const baseSvgEl = baseDoc.querySelector("svg");
        if (!baseSvgEl) { setComposedHtml(baseSvg); return; }

        if (!baseSvgEl.getAttribute('viewBox')) {
          const w = baseSvgEl.getAttribute('width') || '984';
          const h = baseSvgEl.getAttribute('height') || '200';
          baseSvgEl.setAttribute('viewBox', `0 0 ${parseInt(w, 10)} ${parseInt(h, 10)}`);
        }
        baseSvgEl.setAttribute("width", "100%");
        baseSvgEl.setAttribute("height", "auto");
        baseSvgEl.setAttribute("style", "max-width:880px;display:block;");

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

          if (isModularDevice) {
            if (portId) {
              const gp = generatedPortMap.get(portId);
              if (gp && gp.status !== "normal") {
                const color = PORT_STATUS_COLORS[gp.status] || "transparent";
                styleStr = `fill: ${color}33; stroke: ${color}; stroke-width: 1.5px;`;
              }
            }
          }

          styleStr += " pointer-events: all; cursor: pointer;";
          el.setAttribute("style", styleStr);
        });

        const finalHtml = new XMLSerializer().serializeToString(baseDoc);
        _composedHtmlCache.set(_cacheKey, finalHtml);
        if (isMounted) setComposedHtml(finalHtml);
      } catch (e) {
        console.error("Compose Error:", e);
      }
    };

    compose();
    return () => { isMounted = false; };
  }, [modelName, cardsKey, equipModel, isModularDevice, cardSvgMap, modulesKey, _cacheKey, generatedPortMap, insertedCards, insertedModules, viewSide]);

  return { composedHtml, isModularDevice, generatedPorts, generatedPortMap };
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

    let x: number, y: number, cardW: number, cardH: number;

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
