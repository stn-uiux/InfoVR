/**
 * DeviceSvgPreview — 재사용 가능한 장비 SVG 프리뷰 + 모듈 설정 컴포넌트
 *
 * DeviceModal과 RegistrationFormModal에서 공통으로 사용.
 * SVG 합성(베이스 + 카드 + 모듈) 및 포트 클릭 → 모듈 팝오버 처리.
 */
import { useEffect, useState, useMemo, useRef, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { equipmentModels, loadCardSvgRaw, loadBaseEquipmentSvgRaw } from "../../utils/cardAssets";
import { resolveDeviceSvgContent } from "../../utils/deviceAssets";
import { getColSpan, type InsertedCard, type InsertedModule, type EquipmentModel, type EquipmentViewSide } from "../../types/equipment";
import { moduleDefinitions } from "../../utils/moduleAssets";
import { getElementBBox, prefixSvgIds, isPortId, filterPortElements, PORT_SELECTOR, resolvePortId } from "../../utils/svgUtils";
import { useStore } from "../../store/useStore";
import { drawBlankSlots } from "../../hooks/useSvgComposer";

const CARD_ROW_HEIGHT = 46;
type PreviewEquipmentModel = EquipmentModel & { 
  _rowHeights?: number[]; 
  _rowGaps?: number[]; 
  _rowColumns?: number[];
  gridMerges?: { r: number; c: number; rs: number; cs: number }[];
  gridColWidths?: number[];
  gridRowHeights?: number[];
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

function getCardPaintOrder(card: InsertedCard, model: PreviewEquipmentModel): number {
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

// ── 합성 캐시 ──
const _previewCache = new Map<string, string>();

export interface DeviceSvgPreviewProps {
  modelName?: string;
  insertedCards?: InsertedCard[];
  insertedModules?: InsertedModule[];
  onModuleChange?: (modules: InsertedModule[]) => void;
  /** true이면 포트 클릭으로 모듈 편집 가능 */
  editable?: boolean;
  maxWidth?: string;
  viewSide?: EquipmentViewSide;
}

export const DeviceSvgPreview = memo(({
  modelName,
  insertedCards = [],
  insertedModules = [],
  onModuleChange,
  editable = true,
  maxWidth = "100%",
  viewSide = "front",
}: DeviceSvgPreviewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardsKey = insertedCards.map(c => c.instanceId).join(',');
  const modulesKey = useMemo(() =>
    insertedModules
      .map(m => `${m.portId}:${m.moduleType}:${m.hitboxId || ""}`)
      .sort()
      .join(","),
    [insertedModules]
  );
  const customModels = useStore((s) => s.customModels);

  const allEquipmentModels = useMemo(() => {
    const customMapped: PreviewEquipmentModel[] = [];
    customModels
      .filter((m) => m.modelType === "card-based")
      .forEach((m) => {
        const defaultTemplate = equipmentModels.find(em => em.modelName === m.modelName);
        const baseProps = {
          modelId: m.modelId,
          rackUnit: `${m.unit}U`,
          baseSvgUrl: `custom-model-base-${m.modelId}`,
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
    return [...customMapped, ...equipmentModels];
  }, [customModels]);

  const equipModel = useMemo(() => allEquipmentModels.find(m => m.modelName === modelName), [allEquipmentModels, modelName]);
  const modelLayoutKey = useMemo(() => {
    if (!equipModel) return "";
    const model = equipModel as PreviewEquipmentModel;
    return JSON.stringify({
      cardArea: model.cardArea,
      rowHeights: model._rowHeights,
      rowGaps: model._rowGaps,
      rowColumns: model._rowColumns,
    });
  }, [equipModel]);
  const cacheKey = `${modelName}::${viewSide}::${modelLayoutKey}::${cardsKey}::${modulesKey}`;

  const [composedHtml, setComposedHtml] = useState<string>(() => _previewCache.get(cacheKey) || "");

  const currentRowHeights = useMemo(() => {
    if (!equipModel) return undefined;
    return (equipModel as { _rowHeights?: number[] })._rowHeights;
  }, [equipModel]);

  const currentRowGaps = useMemo(() => {
    if (!equipModel) return undefined;
    return (equipModel as { _rowGaps?: number[] })._rowGaps;
  }, [equipModel]);

  const currentRowColumns = useMemo(() => {
    if (!equipModel) return undefined;
    return (equipModel as { _rowColumns?: number[] })._rowColumns;
  }, [equipModel]);

  // 모델/면/구성 변경 시 현재 캐시 키 기준으로 HTML 상태를 동기화합니다.
  useEffect(() => {
    setComposedHtml(_previewCache.get(cacheKey) || "");
  }, [cacheKey]);

  const [cardSvgMap, setCardSvgMap] = useState<Map<string, string>>(new Map());

  // 카드 SVG 로딩 - 필요한 모든 카드 SVG가 로드될 때까지 실행
  useEffect(() => {
    if (insertedCards.length === 0) {
      if (cardSvgMap.size > 0) setCardSvgMap(new Map());
      return;
    }

    const uniqueFns = [...new Set(insertedCards.map(c => c.cardFileName))];
    const missingFns = uniqueFns.filter(fn => !cardSvgMap.has(fn));

    if (missingFns.length === 0) return;

    let isMounted = true;
    Promise.all(missingFns.map(async fn => {
      const raw = await loadCardSvgRaw(fn);
      return [fn, raw] as const;
    })).then(results => {
      if (!isMounted) return;
      setCardSvgMap(prev => {
        const next = new Map(prev);
        results.forEach(([fn, raw]) => {
          if (raw) next.set(fn, raw);
        });
        return next;
      });
    });

    return () => { isMounted = false; };
  }, [cardsKey, cardSvgMap.size]); // cardsKey가 변경되거나 맵 크기가 변할 때 체크

  // SVG 합성
  useEffect(() => {
    if (!modelName) return;
    // 모든 카드가 로드되었는지 확인
    const allCardsLoaded = insertedCards.every(c => cardSvgMap.has(c.cardFileName));

    // 모듈이 없고 모든 카드가 로드된 상태에서 유효한 캐시 히트일 때만 캐시 사용
    if (allCardsLoaded && insertedModules.length === 0 && _previewCache.has(cacheKey)) {
      const cached = _previewCache.get(cacheKey)!;
      if (composedHtml !== cached) setComposedHtml(cached);
      return;
    }
    let isMounted = true;
    const compose = async () => {
      try {
        // 모듈러 장비인지 확인 (카드가 있거나, 장비 모델에 슬롯 구조가 정의되어 있는 경우)
        const isModularDevice = viewSide === "front" && (
          insertedCards.length > 0 || 
          Boolean(equipModel && (equipModel.cardArea || equipModel.slots || equipModel.rows))
        );

        let baseSvg: string | undefined;
        if (isModularDevice && equipModel?.baseSvgUrl && equipModel.baseSvgUrl.startsWith("custom-model-base-")) {
          baseSvg = await loadBaseEquipmentSvgRaw(equipModel.baseSvgUrl);
        } else {
          const targetModelName = isModularDevice && equipModel?.baseSvgUrl
            ? equipModel.baseSvgUrl.replace(/\.svg$/i, "").replace(/^\[\d+U\]\s*/, "")
            : modelName;
          baseSvg = await resolveDeviceSvgContent(targetModelName, viewSide);
        }
        if (!isMounted) return;
        if (!baseSvg) {
          setComposedHtml("");
          return;
        }
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
        if (maxWidth) {
          baseSvgEl.style.maxWidth = maxWidth;
        }
        baseSvgEl.style.display = "block";

        if (isModularDevice) {
           drawBlankSlots(baseSvgEl, baseDoc, equipModel as any);
        }

        // 카드 합성
        const orderedCards = equipModel
          ? [...insertedCards].sort((a, b) => getCardPaintOrder(a, equipModel as PreviewEquipmentModel) - getCardPaintOrder(b, equipModel as PreviewEquipmentModel))
          : insertedCards;
        for (const card of orderedCards) {
          const raw = cardSvgMap.get(card.cardFileName);
          if (!raw || !equipModel) continue;
          const cardDoc = parser.parseFromString(raw, "image/svg+xml");
          const cardSvgEl = cardDoc.querySelector("svg");
          if (!cardSvgEl) continue;

          let x: number = 0, y: number = 0, cardW: number = 0, cardH: number = 0;
          const pModel = equipModel as PreviewEquipmentModel;
          if (pModel.slots && card.slotId) {
            const slotDef = pModel.slots.find(s => s.slotId === card.slotId);
            if (!slotDef || !pModel.cardArea) continue;
            x = pModel.cardArea.x + slotDef.x; y = pModel.cardArea.y + slotDef.y;
            cardW = slotDef.width; cardH = slotDef.height;
          } else if (pModel.rows && card.rowId && card.slotId) {
            const rowDef = pModel.rows.find(r => r.rowId === card.rowId);
            if (!rowDef) continue;
            const subDef = rowDef.subSlots.find(s => s.slotId === card.slotId);
            if (!subDef) continue;
            x = rowDef.x + subDef.x; y = rowDef.y + subDef.y; cardW = subDef.width; cardH = subDef.height;
          } else if (pModel.cardArea) {
            if (pModel.gridColWidths && pModel.gridRowHeights && pModel.gridColWidths.length > 0 && pModel.gridRowHeights.length > 0) {
              const covered = new Set<string>();
              if (pModel.gridMerges) {
                for (const merge of pModel.gridMerges) {
                  for (let r = merge.r; r < merge.r + merge.rs; r++) {
                    for (let c = merge.c; c < merge.c + merge.cs; c++) {
                      if (r === merge.r && c === merge.c) continue;
                      covered.add(`${r},${c}`);
                    }
                  }
                }
              }
              let found = false;
              let currentY = pModel.cardArea.y;
              for (let r = 0; r < pModel.gridRowHeights.length; r++) {
                const rowH = pModel.gridRowHeights[r] || CARD_ROW_HEIGHT;
                const rowGap = pModel._rowGaps?.[r] ?? 0;
                let currentX = pModel.cardArea.x;
                for (let c = 0; c < pModel.gridColWidths.length; c++) {
                  const colW = pModel.gridColWidths[c] || 0;
                  const idx = getGridPositionIndex(r, c, pModel.cardArea.columns, currentRowColumns);
                  if (idx === card.positionIndex && !covered.has(`${r},${c}`)) {
                    const merge = pModel.gridMerges?.find((m: any) => m.r === r && m.c === c);
                    let slotW = colW;
                    let slotH = rowH;
                    if (merge) {
                      slotW = 0;
                      for (let mc = merge.c; mc < merge.c + merge.cs; mc++) slotW += pModel.gridColWidths![mc] || 0;
                      slotH = 0;
                      for (let mr = merge.r; mr < merge.r + merge.rs; mr++) {
                        slotH += pModel.gridRowHeights![mr] || 0;
                        if (mr < merge.r + merge.rs - 1) slotH += pModel._rowGaps?.[mr] ?? 0;
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
                pModel.cardArea.columns,
                currentRowColumns,
              );
              const rowColumnWidth = pModel.cardArea.width / rowColumns;
              x = pModel.cardArea.x + col * rowColumnWidth;
              if ((currentRowHeights && currentRowHeights.length > 0) || (currentRowGaps && currentRowGaps.length > 0)) {
                let yOff = 0;
                for (let r = 0; r < row; r++) {
                  yOff += (currentRowHeights?.[r] ?? CARD_ROW_HEIGHT);
                  yOff += currentRowGaps?.[r] ?? 0;
                }
                y = pModel.cardArea.y + yOff;
                cardH = currentRowHeights?.[row] ?? CARD_ROW_HEIGHT;
              } else {
                y = pModel.cardArea.y + row * CARD_ROW_HEIGHT;
                cardH = CARD_ROW_HEIGHT;
              }
              const colSpan = getColSpan(card.widthType, rowColumns);
              cardW = rowColumnWidth * colSpan;
            }
          } else continue;

          const vb = cardSvgEl.getAttribute("viewBox");
          const parts = vb ? vb.split(/\s+/).map(Number) : [0, 0, 100, 20];
          const origW = parts[2] || 100; const origH = parts[3] || 20;
          const instancePrefix = card.instanceId || `card-${card.positionIndex}`;
          prefixSvgIds(cardSvgEl, instancePrefix);

          const cardGroup = baseDoc.createElementNS("http://www.w3.org/2000/svg", "g");
          cardGroup.setAttribute("transform", `translate(${x}, ${y}) scale(${cardW / origW}, ${cardH / origH})`);
          cardGroup.setAttribute("data-card-instance", instancePrefix);

          // 포트 히트박스 속성 처리
          cardSvgEl.querySelectorAll(".port-hitbox").forEach(hb => {
            const localPort = hb.getAttribute("data-local-port");
            if (!localPort) return;

            // 사용자의 제안대로 type + port 조합으로 고유 식별자 생성
            const portType = hb.getAttribute("data-port-type") || hb.getAttribute("data-porttype") || "";
            const uniquePortKey = portType ? `${portType}-${localPort}` : localPort;

            const realPortNumber = `${card.shelfNo}/${card.slotNo}/${uniquePortKey}`;
            hb.setAttribute("data-port-number", realPortNumber);
            hb.setAttribute("data-card-instance", instancePrefix);
          });

          while (cardSvgEl.firstChild) {
            const child = baseDoc.adoptNode(cardSvgEl.firstChild);
            cardGroup.appendChild(child);
          }
          baseSvgEl.appendChild(cardGroup);
        }

        // 전체 포트에 대해 모듈 합성
        const rawPortEls = Array.from(baseSvgEl.querySelectorAll(PORT_SELECTOR));
        const allPortEls = filterPortElements(rawPortEls);

        const hitboxesByPortId = new Map<string, SVGElement[]>();
        allPortEls.forEach(hb => {
          // XML 직렬화 과정에서 유실되지 않도록 style 속성을 setAttribute로 강제 주입 (첫 렌더링 시 검은색 영역 노출 방지)
          hb.setAttribute("style", `fill: transparent; stroke: none; pointer-events: all; cursor: ${editable ? "pointer" : "default"};`);
          hb.setAttribute("pointer-events", "all");

          const portId = resolvePortId(hb);
          if (!portId) return;
          if (!hitboxesByPortId.has(portId)) hitboxesByPortId.set(portId, []);
          hitboxesByPortId.get(portId)!.push(hb);
        });

        // 삽입된 모든 모듈 렌더링
        insertedModules.forEach((mod) => {
          const hbs = hitboxesByPortId.get(mod.portId);
          if (!hbs || hbs.length === 0) return;

          const moduleDef = moduleDefinitions.find(m => m.svgFileName === mod.moduleSvgFileName);
          if (moduleDef) {
            const modType = mod.moduleType.toLowerCase();
            let targetHb = hbs[0];

            if (hbs.length > 1) {
              // 1순위: 클릭했던 정확한 hitboxId 우선 매칭
              if (mod.hitboxId) {
                const exactHb = hbs.find(hb => hb.id === mod.hitboxId);
                if (exactHb) {
                  targetHb = exactHb;
                } else {
                  // hitboxId 매칭 실패 시 fallback (모듈 타입 기반)
                  const exactMatch = hbs.find(hb => {
                    const hbType = (hb.getAttribute("data-port-name") || hb.getAttribute("data-port-type") || "").toLowerCase();
                    if (modType === "sfp" && (hbType === "sfp" || hbType === "qsfp" || hbType === "qsfp28")) return true;
                    if (modType === "ethernet" && (hbType === "port" || hbType === "ethernet")) return true;
                    return false;
                  });
                  if (exactMatch) targetHb = exactMatch;
                }
              } else {
                // 이전 방식 fallback (명시적 hitboxId가 없을 때)
                const exactMatch = hbs.find(hb => {
                  const hbType = (hb.getAttribute("data-port-name") || hb.getAttribute("data-port-type") || "").toLowerCase();
                  if (modType === "sfp" && (hbType === "sfp" || hbType === "qsfp" || hbType === "qsfp28")) return true;
                  if (modType === "ethernet" && (hbType === "port" || hbType === "ethernet")) return true;
                  return false;
                });
                if (exactMatch) targetHb = exactMatch;
              }
            }

            const bbox = getElementBBox(targetHb);
            const sf = 1.2;
            const fw = bbox.w * sf, fh = bbox.h * sf;
            const fx = bbox.x - (fw - bbox.w) / 2, fy = bbox.y - (fh - bbox.h) / 2;

            const img = baseDoc.createElementNS("http://www.w3.org/2000/svg", "image");
            img.setAttribute("href", moduleDef.svgUrl);
            img.setAttribute("x", fx.toString()); img.setAttribute("y", fy.toString());
            img.setAttribute("width", fw.toString()); img.setAttribute("height", fh.toString());
            img.setAttribute("preserveAspectRatio", "none");
            img.setAttribute("class", "inserted-module");
            // 스타일과 속성 모두에 pointer-events: none 설정하여 이벤트를 절대 방해하지 않게 함
            img.setAttribute("pointer-events", "none");
            img.style.pointerEvents = "none";

            // 이미지 삽입 후, 히트박스를 이미지 뒤(DOM 순서상 나중)로 다시 옮겨서 렌더링상 최상단 보장
            const parent = targetHb.parentNode;
            if (parent) {
              parent.insertBefore(img, targetHb);
              // targetHb를 다시 appendChild 하여 이미지보다 뒤에 오게 함 (렌더링은 위에 됨)
              parent.appendChild(targetHb);
            }
          }
        });

        const finalHtml = new XMLSerializer().serializeToString(baseDoc);

        // 모든 카드가 정상적으로 로드된 경우에만 캐시 저장
        if (allCardsLoaded && insertedModules.length === 0) {
          _previewCache.set(cacheKey, finalHtml);
        }

        if (isMounted) setComposedHtml(finalHtml);
      } catch (e) { console.error("DeviceSvgPreview compose error:", e); }
    };
    compose();
    return () => { isMounted = false; };
  }, [modelName, cardsKey, modulesKey, equipModel, cardSvgMap, cacheKey, currentRowHeights, currentRowGaps, currentRowColumns, viewSide]);

  // 모듈 팝오버 상태
  const [popover, setPopover] = useState<{ portId: string; portType: string; hitboxId?: string; x: number; y: number } | null>(null);

  // SVG 스타일 + 포트 인터랙션
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !composedHtml) return;

    const svgEl = container.querySelector("svg");
    if (svgEl) {
      if (!svgEl.getAttribute('viewBox')) {
        const w = svgEl.getAttribute('width') || '984';
        const h = svgEl.getAttribute('height') || '200';
        svgEl.setAttribute('viewBox', `0 0 ${parseInt(w, 10)} ${parseInt(h, 10)}`);
      }
      container.style.transform = "none";
      svgEl.style.width = "100%";
      svgEl.style.height = "auto";
      svgEl.style.maxWidth = maxWidth;
      svgEl.style.display = "block";
    }
    container.querySelectorAll("title").forEach(t => t.textContent = "");

    // 포트 요소 수집
    const rawPortEls = Array.from(container.querySelectorAll(PORT_SELECTOR));
    const allPortEls = filterPortElements(rawPortEls);

    allPortEls.forEach(el => {
      el.setAttribute("style", `fill: transparent; stroke: none; pointer-events: all; cursor: ${editable ? "pointer" : "default"};`);
      el.setAttribute("pointer-events", "all");
    });

    if (!editable) return;

    // hover 처리
    let hoveredEl: SVGElement | null = null;
    let origFill = "", origStroke = "", origStrokeWidth = "";

    const getTooltip = () => {
      // 1. 컨테이너 내부 툴팁 시도
      let tt = container.querySelector(".port-tooltip") as HTMLElement | null;
      if (tt) return tt;
      // 2. 부모 형제 요소에서 찾기 (현재 구조)
      tt = container.parentElement?.querySelector(".port-tooltip") as HTMLElement | null;
      if (tt) return tt;
      // 3. 더 상위 모달 컨텐츠에서 찾기 (안전책)
      return container.closest(".modal-content, .device-registration-modal")?.querySelector(".port-tooltip") as HTMLElement | null;
    };

    const resetHover = () => {
      const tooltip = getTooltip();
      if (hoveredEl) {
        hoveredEl.style.fill = origFill; hoveredEl.style.stroke = origStroke; hoveredEl.style.strokeWidth = origStrokeWidth;
        hoveredEl = null;
      }
      if (tooltip) tooltip.style.display = "none";
    };

    const findPortEl = (e: MouseEvent): SVGElement | null => {
      const target = e.target as SVGElement;
      const portEl = target.closest<SVGElement>(PORT_SELECTOR);
      if (portEl && portEl.id && !isPortId(portEl.id) && !portEl.classList.contains("port-hitbox")) return null;
      return portEl;
    };

    const handleMouseOver = (e: MouseEvent) => {
      const portEl = findPortEl(e);
      if (!portEl) { resetHover(); return; }
      if (hoveredEl && hoveredEl !== portEl) resetHover();
      if (hoveredEl !== portEl) {
        hoveredEl = portEl;
        origFill = portEl.style.fill; origStroke = portEl.style.stroke; origStrokeWidth = portEl.style.strokeWidth;
        portEl.style.fill = "rgba(0, 229, 255, 0.25)";
        portEl.style.stroke = "rgba(0, 229, 255, 0.7)";
        portEl.style.strokeWidth = "1.5px";
      }

      const tooltip = getTooltip();
      if (tooltip) {
        const realPortNumber = portEl.getAttribute("data-port-number");
        const localPort = portEl.getAttribute("data-local-port");
        const portType = portEl.getAttribute("data-port-type") || "PORT";
        const portId = realPortNumber || portEl.id || localPort || "";
        const displayId = portId.replace(/^.*port-/, "").replace(/^p/, "");

        tooltip.innerHTML = `
          <div style="font-weight:700; font-size:13px; margin-bottom:4px; color:#80deea;">${portType.toUpperCase()} ${displayId}</div>
          ${editable ? `<div style="font-size:11px; color:#e0f7fa; opacity:0.8;">Click to manage module</div>` : ""}
        `;
        tooltip.style.display = "block";
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const tooltip = getTooltip();
      if (tooltip) {
        tooltip.style.left = `${e.clientX}px`;
        tooltip.style.top = `${e.clientY - 10}px`;
        tooltip.style.transform = "translate(-50%, -100%)";
      }
    };

    const handleMouseOut = () => resetHover();

    const handleClick = (e: MouseEvent) => {
      e.stopPropagation();
      const portEl = findPortEl(e);
      if (!portEl) return;
      const portId = resolvePortId(portEl);
      if (!portId) return;
      const portType = portEl.getAttribute("data-port-type") || "port";
      const rect = portEl.getBoundingClientRect();
      setPopover({ portId, portType, hitboxId: portEl.id, x: rect.left + rect.width / 2, y: rect.top });
    };

    container.addEventListener("mouseover", handleMouseOver);
    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseout", handleMouseOut);
    container.addEventListener("click", handleClick);

    return () => {
      container.removeEventListener("mouseover", handleMouseOver);
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseout", handleMouseOut);
      container.removeEventListener("click", handleClick);
    };
  }, [composedHtml, editable, maxWidth]);

  // 팝오버 외부 클릭 닫기
  useEffect(() => {
    if (!popover) return;
    const handle = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".module-popover")) return;
      const portEl = target.closest<SVGElement>(PORT_SELECTOR);
      if (portEl && (portEl.classList.contains("port-hitbox") || isPortId(portEl.id) || portEl.getAttribute("data-local-port"))) {
        return;
      }
      setPopover(null);
    };
    const timer = setTimeout(() => window.addEventListener("click", handle, { capture: true }), 50);
    return () => { clearTimeout(timer); window.removeEventListener("click", handle, { capture: true }); };
  }, [popover]);

  const handleInsertModule = useCallback((portId: string, moduleType: InsertedModule["moduleType"], hitboxId?: string) => {
    const moduleDef = moduleDefinitions.find(m => m.moduleType === moduleType);
    if (!moduleDef) return;
    const newModule: InsertedModule = { portId, moduleType, moduleSvgFileName: moduleDef.svgFileName, hitboxId };
    const updated = [...insertedModules.filter(m => m.portId !== portId), newModule];
    onModuleChange?.(updated);
    setPopover(null);
  }, [insertedModules, onModuleChange]);

  const handleRemoveModule = useCallback((portId: string, hitboxId?: string) => {
    onModuleChange?.(insertedModules.filter(m => hitboxId ? m.hitboxId !== hitboxId : m.portId !== portId));
    setPopover(null);
  }, [insertedModules, onModuleChange]);

  const existingModule = popover ? insertedModules.find(m => m.portId === popover.portId) : null;

  if (!modelName) return null;

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div ref={containerRef} style={{ position: "relative", width: "100%", minWidth: 0 }} dangerouslySetInnerHTML={composedHtml ? { __html: composedHtml } : undefined} />

      <div className="port-tooltip" style={{
        position: "fixed", pointerEvents: "none", display: "none",
        backgroundColor: "rgba(4, 15, 33, 0.95)",
        color: "#e0f7fa",
        padding: "6px 12px",
        borderRadius: "4px",
        fontSize: "12px",
        zIndex: 10001,
        border: "1px solid rgba(0, 229, 255, 0.5)",
        boxShadow: "0 0 10px rgba(0, 229, 255, 0.2)",
        backdropFilter: "blur(4px)",
      }} />

      {/* 모듈 팝오버 */}
      {/* 모듈 팝오버 - Portal로 렌더링하여 잘림 방지 */}
      {popover && editable && createPortal(
        <div
          className="module-popover"
          onClick={e => e.stopPropagation()}
          style={{
            position: "fixed",
            left: popover.x,
            top: popover.y + 30, // 포트 아래쪽에 표시
            transform: "translateX(-50%)",
            backgroundColor: "rgba(10, 20, 40, 0.98)",
            border: "1px solid rgba(0, 229, 255, 0.4)",
            borderRadius: "12px", padding: "12px", zIndex: 11000,
            display: "flex", flexDirection: "column", gap: "8px",
            minWidth: "180px",
            boxShadow: "0 12px 48px rgba(0, 0, 0, 0.7), 0 0 24px rgba(0, 229, 255, 0.2)",
            backdropFilter: "blur(16px)", animation: "eam-fi .15s ease-out",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: "700", color: "#80deea", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px" }}>
            {popover.portType.toUpperCase()} — 모듈 선택
          </div>
          {existingModule && (
            <div style={{
              fontSize: "11px", color: "#a5d6a7", padding: "4px 8px", borderRadius: "6px",
              backgroundColor: "rgba(76, 175, 80, 0.12)", border: "1px solid rgba(76, 175, 80, 0.25)", marginBottom: "2px"
            }}>
              현재: {existingModule.moduleType === "ethernet" ? "Ethernet" : "SFP"}
            </div>
          )}
          <div style={{ display: "flex", gap: "6px" }}>
            {moduleDefinitions.map(md => (
              <button key={md.moduleType} onClick={() => handleInsertModule(popover.portId, md.moduleType)}
                style={{
                  flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
                  padding: "8px 6px", borderRadius: "8px",
                  border: existingModule?.moduleType === md.moduleType ? "1px solid #00e5ff" : "1px solid rgba(255,255,255,0.1)",
                  background: existingModule?.moduleType === md.moduleType ? "rgba(0, 229, 255, 0.1)" : "rgba(255,255,255,0.04)",
                  cursor: "pointer", color: "#e0f7fa", fontSize: "11px", fontWeight: "600", transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(0, 229, 255, 0.12)"; e.currentTarget.style.borderColor = "rgba(0, 229, 255, 0.5)"; }}
                onMouseLeave={e => {
                  if (existingModule?.moduleType !== md.moduleType) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                  }
                }}
              >
                <img src={md.svgUrl} alt={md.displayName} style={{ width: 28, height: 22, objectFit: "contain" }} />
                {md.displayName}
              </button>
            ))}
          </div>
          {existingModule && (
            <button onClick={() => handleRemoveModule(popover.portId, popover.hitboxId)}
              style={{
                padding: "6px 12px", borderRadius: "6px",
                border: "1px solid rgba(239, 68, 68, 0.4)", background: "rgba(239, 68, 68, 0.08)",
                color: "#ef4444", cursor: "pointer", fontSize: "11px", fontWeight: "600", transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.08)"; }}
            >
              모듈 제거
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
});
