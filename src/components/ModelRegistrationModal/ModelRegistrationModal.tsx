import { Icon } from "@iconify/react";
import InteractiveGridEditor, { type GridMerge } from "./InteractiveGridEditor";
import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../../store/useStore";
import type {
  CustomModelType,
  CardWidthType,
  EquipmentViewSide,
  EquipmentVariant,
} from "../../types/equipment";
import { CardRegistrationForm } from "./CardRegistrationForm";
import { EquipmentAssemblyModal } from "../EquipmentAssemblyModal";
import { CardThumbnail } from "../CardThumbnail";
import { cardDefinitions, equipmentModels, loadBaseEquipmentSvgRaw, getCardsForModel } from "../../utils/cardAssets";
import { DEVICE_TEMPLATES } from "../../utils/deviceTemplates";
import { getDeviceViewSides, resolveDeviceImage, resolveDeviceSvgContent } from "../../utils/deviceAssets";
import { generateComposedSvgAsync } from "../../hooks/useSvgComposer";
import { convertSvgToPngAsync } from "../../utils/imageUtils";

const DELETE_ICON_STYLE: React.CSSProperties = {
  width: 14,
  height: 14,
};

/** SVG raw text에서 width/height 추출 */
function parseSvgDimensions(svgRaw: string): { width: number; height: number } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgRaw, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) return { width: 800, height: 200 };

  const vb = svg.getAttribute("viewBox");
  if (vb) {
    const parts = vb.split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { width: parts[2], height: parts[3] };
    }
  }
  const w = parseFloat(svg.getAttribute("width") || "0");
  const h = parseFloat(svg.getAttribute("height") || "0");
  if (w > 0 && h > 0) return { width: w, height: h };
  return { width: 800, height: 200 };
}

/** SVG raw text를 안전하게 축소 렌더링 */
function SvgPreview({ svgRaw, maxHeight = 500 }: { svgRaw: string; maxHeight?: number }) {
  const sanitized = useMemo(() => {
    // width/height를 100%로 치환하여 반응형 렌더링
    return svgRaw
      .replace(/width="[^"]*"/, 'width="100%"')
      .replace(/height="[^"]*"/, `height="${maxHeight}px"`)
      .replace(/<svg/, '<svg style="max-width:984px;max-height:' + maxHeight + 'px"');
  }, [svgRaw, maxHeight]);

  return (
    <div
      className="mrm-svg-preview"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}

/** 기본 섀시 SVG 위에 카드 영역 좌표를 오버레이로 표시하는 미리보기 */
function ChassisPreviewWithOverlay({
  svgRaw,
  cardArea,
  colWidths,
  rowHeights: rowHeightsNum,
  merges,
  onDrawEnd,
  onGridChange,
  onSave
}: {
  svgRaw: string;
  cardArea: { x: number; y: number; width: number; height: number; columns: number; columnWidth: number };
  colWidths: number[];
  rowHeights: number[];
  merges: GridMerge[];
  onDrawEnd?: (rect: { x: number; y: number; width: number; height: number }) => void;
  onGridChange?: (data: { colWidths: number[]; rowHeights: number[]; merges: GridMerge[]; baseX?: number; baseY?: number }) => void;
  onSave?: () => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPt, setStartPt] = useState({ x: 0, y: 0 });
  const [currentPt, setCurrentPt] = useState({ x: 0, y: 0 });

  const svgInfo = useMemo(() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgRaw, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return { viewBox: "0 0 800 200" };
    let vb = svg.getAttribute("viewBox");
    if (!vb) {
      const w = parseFloat(svg.getAttribute("width") || "800") || 800;
      const h = parseFloat(svg.getAttribute("height") || "200") || 200;
      vb = `0 0 ${w} ${h}`;
    }
    return { viewBox: vb };
  }, [svgRaw]);

  const displaySvg = useMemo(() => {
    return svgRaw
      .replace(/width="[^"]*"/, 'width="100%"')
      .replace(/\sheight="[^"]*"/, '')
      .replace(/<svg/, '<svg style="max-width:984px;max-height:580px;height:auto;display:block"');
  }, [svgRaw]);

  const getSvgPoint = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const transformed = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    return { x: transformed.x, y: transformed.y };
  };

  const [toolbarNode, setToolbarNode] = useState<HTMLElement | null>(null);

  const hasGrid = colWidths.length > 0 && rowHeightsNum.length > 0 && cardArea.width > 0 && cardArea.height > 0;

  const handlePointerDown = (e: React.PointerEvent) => {
    // Don't draw if clicking on grid editor elements
    if (hasGrid) return;
    const pt = getSvgPoint(e);
    setIsDrawing(true);
    setStartPt(pt);
    setCurrentPt(pt);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    setCurrentPt(getSvgPoint(e));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    (e.target as Element).releasePointerCapture(e.pointerId);

    const x = Math.min(startPt.x, currentPt.x);
    const y = Math.min(startPt.y, currentPt.y);
    const width = Math.abs(currentPt.x - startPt.x);
    const height = Math.abs(currentPt.y - startPt.y);

    if (width > 5 && height > 5 && onDrawEnd) {
      onDrawEnd({ x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) });
    }
  };

  const drawRect = isDrawing ? {
    x: Math.min(startPt.x, currentPt.x),
    y: Math.min(startPt.y, currentPt.y),
    width: Math.abs(currentPt.x - startPt.x),
    height: Math.abs(currentPt.y - startPt.y)
  } : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div className="mrm-svg-preview mrm-svg-preview--chassis" style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', position: 'relative' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '984px', display: 'flex', justifyContent: 'center' }}>
          <div dangerouslySetInnerHTML={{ __html: displaySvg }} style={{ width: '100%' }} />
          <svg
            ref={svgRef}
            viewBox={svgInfo.viewBox}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              overflow: 'visible',
              pointerEvents: 'auto',
              cursor: hasGrid ? 'default' : 'crosshair',
              zIndex: 10
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {/* Drawing mode rect */}
            {isDrawing && drawRect && (
              <rect
                x={drawRect.x}
                y={drawRect.y}
                width={drawRect.width}
                height={drawRect.height}
                fill="rgba(0,200,255,0.2)"
                stroke="rgba(0,200,255,1)"
                strokeWidth="2"
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {/* Interactive grid editor */}
            {hasGrid && onGridChange && (
              <InteractiveGridEditor
                svgRef={svgRef}
                baseX={cardArea.x}
                baseY={cardArea.y}
                colWidths={colWidths}
                rowHeights={rowHeightsNum}
                merges={merges}
                toolbarContainer={toolbarNode}
                onGridChange={onGridChange}
                onSave={onSave}
              />
            )}
          </svg>
        </div>

        {/* Guidance Message */}
        {!hasGrid && !isDrawing && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0,0,0,0.65)',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: '8px',
            pointerEvents: 'none',
            fontSize: '14px',
            fontWeight: '600',
            backdropFilter: 'blur(4px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
          }}>
            이미지에 드래그하여 섀시 영역을 그려주세요
          </div>
        )}
      </div>
      <div ref={setToolbarNode} className="interactive-grid-toolbar-container" style={{ padding: "4px 0" }} />
    </div>
  );
}


export const ModelRegistrationModal: React.FC = () => {
  const isOpen = useStore((s) => s.modelRegistrationModalOpen);
  const setOpen = useStore((s) => s.setModelRegistrationModalOpen);
  const customModels = useStore((s) => s.customModels);
  const customCards = useStore((s) => s.customCards);
  const addCustomModel = useStore((s) => s.addCustomModel);
  const updateCustomModel = useStore((s) => s.updateCustomModel);
  const removeCustomModel = useStore((s) => s.removeCustomModel);
  const addCustomCard = useStore((s) => s.addCustomCard);
  const deletedDefaultTemplates = useStore((s) => s.deletedDefaultTemplates);
  const removeDefaultTemplate = useStore((s) => s.removeDefaultTemplate);

  // Tabs: "register" | "list"
  const [activeTab, setActiveTab] = useState<"register" | "list">("list");

  interface AvailableCard {
    id: string;
    name: string;
    svgUrl?: string;
    svgRaw?: string;
    widthType: CardWidthType;
    svgWidth: number;
    svgHeight: number;
    isBuiltIn: boolean;
  }

  const allAvailableCards = useMemo<AvailableCard[]>(() => {
    const builtInMapped: AvailableCard[] = cardDefinitions.map((c) => ({
      id: c.cardFileName,
      name: c.cardType,
      svgUrl: c.svgUrl,
      widthType: c.widthType,
      svgWidth: c.svgWidth,
      svgHeight: c.svgHeight,
      isBuiltIn: true,
    }));
    const customMapped: AvailableCard[] = customCards.map((c) => ({
      id: c.cardId,
      name: c.cardName,
      svgRaw: c.cardSvgRaw,
      widthType: c.widthType,
      svgWidth: c.svgWidth,
      svgHeight: c.svgHeight,
      isBuiltIn: false,
    }));
    return [...builtInMapped, ...customMapped];
  }, [customCards]);

  // Form state
  const [modelName, setModelName] = useState("");
  const [vendor, setVendor] = useState("Cisco");
  const [unit, setUnit] = useState<number>(1);
  const [modelType, setModelType] = useState<CustomModelType>("normal");
  const [modelSvgRaw, setModelSvgRaw] = useState<string | null>(null);
  const [modelSvgFileName, setModelSvgFileName] = useState("");
  const [useDualView, setUseDualView] = useState(false);
  const [rearSvgRaw, setRearSvgRaw] = useState<string | null>(null);
  const [rearSvgFileName, setRearSvgFileName] = useState("");
  const [defaultViewSide, setDefaultViewSide] = useState<EquipmentViewSide>("front");
  const [baseChassisRaw, setBaseChassisRaw] = useState<string | null>(null);
  const [baseChassisFileName, setBaseChassisFileName] = useState("");
  const chassisOriginalFileRef = useRef<File | null>(null);
  const [variants, setVariants] = useState<EquipmentVariant[]>([]);
  const [isAssemblyOpen, setIsAssemblyOpen] = useState(false);
  const [editingVariantIndex, setEditingVariantIndex] = useState<number | null>(null);

  // List Thumb Tooltip
  const [hoveredListThumb, setHoveredListThumb] = useState<{ pngRaw?: string | null, svgRaw?: string | null, imgUrl?: string | null, name: string } | null>(null);
  const [hoveredListThumbPos, setHoveredListThumbPos] = useState({ x: 0, y: 0 });
  // Card area config (card-based models) — string 기반으로 자유로운 편집 지원
  const [caXStr, setCaXStr] = useState("0");
  const [caYStr, setCaYStr] = useState("0");
  const [caWidthStr, setCaWidthStr] = useState("860");
  const [caHeightStr, setCaHeightStr] = useState("200");
  const [caColumnsStr, setCaColumnsStr] = useState("2");
  const [caColWidthStr, setCaColWidthStr] = useState("430");
  const [caRowCountStr, setCaRowCountStr] = useState("4");

  // Row heights (card-based models)
  const [rowHeights, setRowHeights] = useState<string[]>([]);
  const [uniformRowHeight, setUniformRowHeight] = useState("46");

  // Row columns (행별 열 수)
  const [rowColumnsArr, setRowColumnsArr] = useState<string[]>([]);
  const [uniformRowColumns, setUniformRowColumns] = useState("2");

  // Row gaps (행 간 간격 - margin)
  const [rowGapsArr, setRowGapsArr] = useState<string[]>([]);
  const [uniformRowGap, setUniformRowGap] = useState("0");

  // Interactive grid state
  const [gridColWidths, setGridColWidths] = useState<number[]>([]);
  const [gridRowHeights, setGridRowHeights] = useState<number[]>([]);
  const [gridMerges, setGridMerges] = useState<GridMerge[]>([]);

  // Editing mode
  const [editingModelId, setEditingModelId] = useState<string | null>(null);

  // Assigned cards
  const [assignedCardIds, setAssignedCardIds] = useState<string[]>([]);

  // Computed numeric values (safe parsing)
  const caX = parseFloat(caXStr) || 0;
  const caY = parseFloat(caYStr) || 0;
  const caWidth = parseFloat(caWidthStr) || 0;
  const caHeight = parseFloat(caHeightStr) || 0;
  const caColumns = parseInt(caColumnsStr) || 1;
  const caColWidth = parseFloat(caColWidthStr) || 0;
  const caRowCount = parseInt(caRowCountStr) || 0;

  // 행별 열 수에서 최대 열 수 계산
  const maxColumns = useMemo(() => {
    if (rowColumnsArr.length === 0) return caColumns;
    const vals = rowColumnsArr.map((c) => parseInt(c) || caColumns);
    return Math.max(...vals, 1);
  }, [rowColumnsArr, caColumns]);

  // 행 수 (사용자 설정 우선)
  const defaultRowHeight = 46;

  // Auto-generate missing variant PNGs
  useEffect(() => {
    let isCancelled = false;

    // Only run if there is a missing png AND we have the necessary base data
    if (variants.length > 0 && variants.some(v => !v.variantPngRaw) && (baseChassisRaw || modelSvgRaw)) {
      const generateMissingPngs = async () => {
        let changed = false;
        const newVariants = [...variants];
        for (let i = 0; i < newVariants.length; i++) {
          if (isCancelled) return;
          const v = newVariants[i];
          if (!v.variantPngRaw) {
            try {
              const dims = parseSvgDimensions(modelSvgRaw || baseChassisRaw || "");
              const parsedRowHeights = rowHeights.map((h) => parseFloat(h) || defaultRowHeight);
              const parsedRowColumns = rowColumnsArr.map((c) => parseInt(c) || caColumns);
              const parsedRowGaps = rowGapsArr.map((g) => parseFloat(g) || 0);
              const effectiveMaxCols = parsedRowColumns.length > 0 ? Math.max(...parsedRowColumns, 1) : caColumns;
              const effectiveColWidth = caWidth / effectiveMaxCols;

              const composed = await generateComposedSvgAsync(
                modelName.trim(),
                {
                  modelId: editingModelId || "temp",
                  modelName: modelName.trim(),
                  rackUnit: `${unit}U`,
                  baseSvgUrl: baseChassisFileName || "",
                  baseEquipmentViewSvgRaw: baseChassisRaw || "",
                  equipmentSize: { width: dims.width, height: dims.height },
                  cardArea: { x: caX, y: caY, width: caWidth, height: caHeight, columns: effectiveMaxCols, columnWidth: effectiveColWidth },
                  _rowHeights: parsedRowHeights,
                  _rowColumns: parsedRowColumns,
                  _rowGaps: parsedRowGaps,
                  gridMerges: gridMerges,
                  gridColWidths: gridColWidths,
                  gridRowHeights: gridRowHeights,
                } as any,
                v.insertedCards,
                [],
                "front"
              );
              if (composed && !isCancelled) {
                const png = await convertSvgToPngAsync(composed, dims.width || 860, dims.height || 200);
                if (png && !isCancelled) {
                  newVariants[i] = { ...v, variantPngRaw: png };
                  changed = true;
                }
              }
            } catch (err) {
              console.error("Failed to generate missing variant PNG", err);
            }
          }
        }
        if (changed && !isCancelled) {
          setVariants(newVariants);
        }
      };

      generateMissingPngs();
    }

    return () => {
      isCancelled = true;
    };
  }, [
    variants, baseChassisRaw, modelSvgRaw, modelName, editingModelId, unit, baseChassisFileName,
    caX, caY, caWidth, caHeight, rowHeights, rowColumnsArr, rowGapsArr, caColumns, gridMerges, gridColWidths, gridRowHeights
  ]);

  const computedRowCount = caRowCount;
  const isChassisDrawn = gridColWidths.length > 0 && gridRowHeights.length > 0 && caWidth > 0 && caHeight > 0;

  // rowHeights & rowColumns 자동 초기화: 행 수 변경 시 배열 크기 동기화
  const syncRowHeights = useCallback((newRowCount: number) => {
    setRowHeights((prev) => {
      if (prev.length === newRowCount) return prev;
      const result: string[] = [];
      for (let i = 0; i < newRowCount; i++) {
        result.push(prev[i] ?? String(defaultRowHeight));
      }
      return result;
    });
    setRowColumnsArr((prev) => {
      if (prev.length === newRowCount) return prev;
      const result: string[] = [];
      for (let i = 0; i < newRowCount; i++) {
        result.push(prev[i] ?? caColumnsStr);
      }
      return result;
    });
    // 간격은 행 수 - 1 만큼 (마지막 행 아래에는 간격 불필요)
    const gapCount = Math.max(0, newRowCount - 1);
    setRowGapsArr((prev) => {
      if (prev.length === gapCount) return prev;
      const result: string[] = [];
      for (let i = 0; i < gapCount; i++) {
        result.push(prev[i] ?? "0");
      }
      return result;
    });
  }, [caColumnsStr]);

  // Sub-modal state
  const [isCardRegOpen, setIsCardRegOpen] = useState(false);
  const [showExistingPicker, setShowExistingPicker] = useState(false);

  // Errors & Toast
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // 툴팁(호버) 상태
  const [hoveredTooltipCard, setHoveredTooltipCard] = useState<AvailableCard | null>(null);
  const [hoveredTooltipPos, setHoveredTooltipPos] = useState({ x: 0, y: 0 });

  const handleCardMouseMove = (e: React.MouseEvent, card: AvailableCard) => {
    setHoveredTooltipCard(card);
    setHoveredTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const handleCardMouseLeave = () => {
    setHoveredTooltipCard(null);
  };

  const modelFileRef = useRef<HTMLInputElement>(null);
  const rearFileRef = useRef<HTMLInputElement>(null);
  const chassisFileRef = useRef<HTMLInputElement>(null);

  // Display name preview
  const displayName = useMemo(() => {
    if (!modelName.trim()) return "";
    return `[${unit}U] ${modelName.trim()}`;
  }, [modelName, unit]);

  // Reset form
  const resetForm = useCallback(() => {
    setModelName("");
    setVendor("Nokia");
    setUnit(1);
    setModelType("normal");
    setModelSvgRaw(null);
    setModelSvgFileName("");
    setUseDualView(false);
    setRearSvgRaw(null);
    setRearSvgFileName("");
    setDefaultViewSide("front");
    setBaseChassisRaw(null);
    setBaseChassisFileName("");
    setCaXStr("0");
    setCaYStr("0");
    setCaWidthStr("860");
    setCaHeightStr("200");
    setCaColumnsStr("2");
    setCaColWidthStr("430");
    setCaRowCountStr("4");
    setRowHeights([]);
    setUniformRowHeight("46");
    setRowColumnsArr([]);
    setUniformRowColumns("2");
    setRowGapsArr([]);
    setUniformRowGap("0");
    setGridColWidths([]);
    setGridRowHeights([]);
    setGridMerges([]);
    setAssignedCardIds([]);
    setVariants([]);
    setErrors({});
    setEditingModelId(null);
  }, []);

  // Load model into form for editing
  const loadModelForEdit = useCallback(async (modelId: string) => {
    const model = customModels.find((m) => m.modelId === modelId);
    if (!model) return;
    setEditingModelId(modelId);
    setModelName(model.modelName);
    setVendor(model.vendor || "Nokia");
    setUnit(model.unit);
    setModelType(model.modelType);
    setModelSvgRaw(model.modelSvgRaw);
    setModelSvgFileName("(기존 파일)");
    setUseDualView(!!model.rearSvgRaw);
    setRearSvgRaw(model.rearSvgRaw || null);
    setRearSvgFileName(model.rearSvgRaw ? "(기존 파일)" : "");
    setDefaultViewSide(model.defaultViewSide || "front");

    let baseRaw = model.baseEquipmentViewSvgRaw || null;
    let baseFileName = baseRaw ? "(기존 파일)" : "";
    if (!baseRaw && model.modelType === "card-based") {
      const eqModel = equipmentModels.find(m => m.modelName === model.modelName);
      if (eqModel && eqModel.baseSvgUrl) {
        const raw = await loadBaseEquipmentSvgRaw(eqModel.baseSvgUrl);
        if (raw) {
          baseRaw = raw;
          baseFileName = eqModel.baseSvgUrl;
        }
      }
    }

    setBaseChassisRaw(baseRaw);
    setBaseChassisFileName(baseFileName);
    if (model.cardArea) {
      setCaXStr(String(model.cardArea.x));
      setCaYStr(String(model.cardArea.y));
      setCaWidthStr(String(model.cardArea.width));
      setCaHeightStr(String(model.cardArea.height));
      setCaColumnsStr(String(model.cardArea.columns));
      setCaColWidthStr(String(model.cardArea.columnWidth));
    }
    if (model.rowHeights && model.rowHeights.length > 0) {
      setCaRowCountStr(String(model.rowHeights.length));
      setRowHeights(model.rowHeights.map(String));
    } else if (model.cardArea) {
      const count = Math.floor(model.cardArea.height / defaultRowHeight);
      setCaRowCountStr(String(count));
      setRowHeights(Array.from({ length: count }, () => String(defaultRowHeight)));
    }
    // 행별 열 수 로드
    if (model.rowColumns && model.rowColumns.length > 0) {
      setRowColumnsArr(model.rowColumns.map(String));
    } else if (model.cardArea) {
      const count = model.rowHeights?.length || Math.floor(model.cardArea.height / defaultRowHeight);
      setRowColumnsArr(Array.from({ length: count }, () => String(model.cardArea!.columns)));
    }
    // 행 간 간격 로드
    if (model.rowGaps && model.rowGaps.length > 0) {
      setRowGapsArr(model.rowGaps.map(String));
    } else {
      const rCount = model.rowHeights?.length || (model.cardArea ? Math.floor(model.cardArea.height / defaultRowHeight) : 0);
      setRowGapsArr(Array.from({ length: Math.max(0, rCount - 1) }, () => "0"));
    }
    // Initialize grid state from model data
    if (model.cardArea) {
      const rh = model.rowHeights || [];
      const rc = model.rowColumns || [];
      const maxCols = rc.length > 0 ? Math.max(...rc, 1) : model.cardArea.columns;
      const colW = model.cardArea.width / maxCols;
      setGridColWidths(model.gridColWidths && model.gridColWidths.length > 0 ? [...model.gridColWidths] : Array.from({ length: maxCols }, () => colW));
      setGridRowHeights(model.gridRowHeights && model.gridRowHeights.length > 0 ? [...model.gridRowHeights] : (rh.length > 0 ? [...rh] : [model.cardArea.height]));
      setGridMerges(model.gridMerges || []);
    } else {
      setGridColWidths([]);
      setGridRowHeights([]);
      setGridMerges([]);
    }
    setAssignedCardIds(model.assignedCardIds || []);
    setVariants(model.variants || []);
    setErrors({});
    setActiveTab("register");
  }, [customModels]);

  const showToastMsg = useCallback(
    (message: string, type: "success" | "error") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
    },
    [],
  );

  const processImageFile = useCallback((file: File, setRaw: (val: string) => void, setFileName: (val: string) => void, setError: (err: string | undefined) => void, forceW?: number, forceH?: number) => {
    const name = file.name.toLowerCase();
    if (name.endsWith(".svg")) {
      const reader = new FileReader();
      reader.onload = () => {
        let svgRaw = reader.result as string;
        if (forceW && forceH) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(svgRaw, "image/svg+xml");
          const svg = doc.querySelector("svg");
          if (svg) {
            svg.setAttribute("width", String(forceW));
            svg.setAttribute("height", String(forceH));
            if (!svg.hasAttribute("viewBox")) {
              svg.setAttribute("viewBox", `0 0 ${forceW} ${forceH}`);
            }
            svg.setAttribute("preserveAspectRatio", "none");
            svgRaw = new XMLSerializer().serializeToString(doc);
          }
        }
        setRaw(svgRaw);
        setFileName(file.name);
        setError(undefined);
      };
      reader.readAsText(file);
    } else if (name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".webp")) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const img = new Image();
        img.onload = () => {
          const w = forceW || img.width || 800;
          const h = forceH || img.height || 200;
          const svgRaw = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><image href="${dataUrl}" width="${w}" height="${h}" preserveAspectRatio="none" /></svg>`;
          setRaw(svgRaw);
          setFileName(file.name);
          setError(undefined);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    } else {
      setError("SVG, PNG, JPG 파일만 지원합니다.");
    }
  }, []);

  // File handlers
  const processModelFile = useCallback((file?: File) => {
    if (!file) return;
    processImageFile(file, setModelSvgRaw, setModelSvgFileName, (err) => setErrors((p) => { const n = { ...p }; if (err) n.modelFile = err; else delete n.modelFile; return n; }));
  }, [processImageFile]);

  const handleModelFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      processModelFile(e.target.files?.[0]);
    },
    [processModelFile]
  );

  const processChassisFile = useCallback((file?: File) => {
    if (!file) return;
    chassisOriginalFileRef.current = file;
    // Reset grid variables when a new image is uploaded
    setCaXStr("0");
    setCaYStr("0");
    setCaWidthStr("0");
    setCaHeightStr("0");
    setGridColWidths([]);
    setGridRowHeights([]);
    setGridMerges([]);
    setRowHeights([]);
    setRowColumnsArr([]);
    setRowGapsArr([]);
    
    processImageFile(
      file,
      setBaseChassisRaw,
      setBaseChassisFileName,
      (err) => setErrors((p) => { const n = { ...p }; if (err) n.chassisFile = err; else delete n.chassisFile; return n; }),
      984,
      unit * 96
    );
  }, [processImageFile, unit]);

  // Re-process chassis image when unit changes
  useEffect(() => {
    const file = chassisOriginalFileRef.current;
    if (!file || !baseChassisRaw) return;
    processImageFile(
      file,
      setBaseChassisRaw,
      setBaseChassisFileName,
      () => { },
      984,
      unit * 96
    );
  }, [unit]);

  const handleChassisFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      processChassisFile(e.target.files?.[0]);
    },
    [processChassisFile]
  );

  const processRearFile = useCallback((file?: File) => {
    if (!file) return;
    processImageFile(file, setRearSvgRaw, setRearSvgFileName, (err) => setErrors((p) => { const n = { ...p }; if (err) n.rearFile = err; else delete n.rearFile; return n; }));
  }, [processImageFile]);

  const handleRearFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      processRearFile(e.target.files?.[0]);
    },
    [processRearFile]
  );

  // Card management
  const handleAddNewCard = useCallback(
    (card: {
      cardName: string;
      cardSvgRaw: string;
      svgWidth: number;
      svgHeight: number;
      widthType: CardWidthType;
    }) => {
      const cardId = addCustomCard({
        ...card,
        createdAt: new Date().toISOString(),
      });
      setAssignedCardIds((prev) => [...prev, cardId]);
      showToastMsg(`카드 "${card.cardName}" 등록 완료`, "success");
    },
    [addCustomCard, showToastMsg],
  );

  const handleSelectExistingCard = useCallback((cardId: string) => {
    setAssignedCardIds((prev) => {
      if (prev.includes(cardId)) return prev.filter((id) => id !== cardId);
      return [...prev, cardId];
    });
  }, []);

  const handleRemoveAssignedCard = useCallback((cardId: string) => {
    setAssignedCardIds((prev) => prev.filter((id) => id !== cardId));
  }, []);

  const isUnchanged = useMemo(() => {
    if (!editingModelId) return false;
    const model = customModels.find(m => m.modelId === editingModelId);
    if (!model) return false;

    if (modelName.trim() !== model.modelName) return false;
    if (vendor !== (model.vendor || "Nokia")) return false;
    if (unit !== model.unit) return false;
    if (modelType !== model.modelType) return false;
    if (modelSvgRaw !== (model.modelSvgRaw || null)) return false;
    if (useDualView !== !!model.rearSvgRaw) return false;
    if (rearSvgRaw !== (model.rearSvgRaw || null)) return false;
    if (defaultViewSide !== (model.defaultViewSide || "front")) return false;

    if (modelType === "card-based") {
      const prevCa = model.cardArea || { x: 0, y: 0, width: 860, height: 200, columns: 2, columnWidth: 430 };
      if (caXStr !== String(prevCa.x)) return false;
      if (caYStr !== String(prevCa.y)) return false;
      if (caWidthStr !== String(prevCa.width)) return false;
      if (caHeightStr !== String(prevCa.height)) return false;
      if (caColumnsStr !== String(prevCa.columns)) return false;
      if (caColWidthStr !== String(prevCa.columnWidth)) return false;

      const rCount = model.rowHeights?.length || (model.cardArea ? Math.floor(model.cardArea.height / 50) : 0);

      const prevRh = model.rowHeights ? model.rowHeights.map(String) : Array.from({ length: rCount }, () => "50");
      if (JSON.stringify(rowHeights) !== JSON.stringify(prevRh)) return false;

      const prevRc = model.rowColumns ? model.rowColumns.map(String) : Array.from({ length: rCount }, () => String(prevCa.columns));
      if (JSON.stringify(rowColumnsArr) !== JSON.stringify(prevRc)) return false;

      const prevRg = model.rowGaps ? model.rowGaps.map(String) : Array.from({ length: Math.max(0, rCount - 1) }, () => "0");
      if (JSON.stringify(rowGapsArr) !== JSON.stringify(prevRg)) return false;

      if (JSON.stringify(variants) !== JSON.stringify(model.variants || [])) return false;
      if (JSON.stringify(assignedCardIds) !== JSON.stringify(model.assignedCardIds || [])) return false;
    }

    return true;
  }, [
    editingModelId, customModels, modelName, vendor, unit, modelType, modelSvgRaw,
    useDualView, rearSvgRaw, defaultViewSide, caXStr, caYStr, caWidthStr, caHeightStr, caColumnsStr, caColWidthStr,
    rowHeights, rowColumnsArr, rowGapsArr, variants, assignedCardIds
  ]);

  // Submit
  const handleSubmit = useCallback(async () => {
    const newErrors: Record<string, string> = {};
    if (!modelName.trim()) newErrors.modelName = "모델명을 입력하세요.";
    if (unit < 1 || unit > 48) newErrors.unit = "1~48 사이의 값을 입력하세요.";
    if (modelType !== "card-based" && !modelSvgRaw) newErrors.modelFile = "모델 이미지 파일을 업로드하세요.";
    if (modelType !== "card-based" && useDualView && !rearSvgRaw) newErrors.rearFile = "뒷면 이미지 파일을 업로드하세요.";
    if (modelType === "card-based" && !baseChassisRaw) {
      newErrors.chassisFile = "기본 섀시 이미지 파일을 업로드하세요.";
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    const dims = parseSvgDimensions(modelSvgRaw!);
    const parsedRowHeights = rowHeights.map((h) => parseFloat(h) || defaultRowHeight);
    const parsedRowColumns = rowColumnsArr.map((c) => parseInt(c) || caColumns);
    const parsedRowGaps = rowGapsArr.map((g) => parseFloat(g) || 0);
    // columnWidth는 최대 열 수 기준으로 자동 계산
    const effectiveMaxCols = parsedRowColumns.length > 0 ? Math.max(...parsedRowColumns, 1) : caColumns;
    const effectiveColWidth = caWidth / effectiveMaxCols;

    let finalModelSvgRaw = modelSvgRaw || "";
    let finalModelPngRaw: string | undefined = undefined;
    if (modelType === "card-based") {
      const defaultVariant = variants.find(v => v.isDefault) || variants[0];
      if (defaultVariant) {
        try {
          const composed = await generateComposedSvgAsync(
            modelName.trim(),
            {
              modelId: editingModelId || "temp",
              modelName: modelName.trim(),
              rackUnit: `${unit}U`,
              baseSvgUrl: baseChassisFileName || "",
              baseEquipmentViewSvgRaw: baseChassisRaw || "",
              equipmentSize: { width: dims.width, height: dims.height },
              cardArea: { x: caX, y: caY, width: caWidth, height: caHeight, columns: effectiveMaxCols, columnWidth: effectiveColWidth },
              _rowHeights: parsedRowHeights,
              _rowColumns: parsedRowColumns,
              _rowGaps: parsedRowGaps,
              gridMerges: gridMerges,
              gridColWidths: gridColWidths,
              gridRowHeights: gridRowHeights,
            } as any,
            defaultVariant.insertedCards,
            [],
            "front"
          );
          if (composed) {
            finalModelSvgRaw = composed;
            setModelSvgRaw(composed);
            try {
              finalModelPngRaw = await convertSvgToPngAsync(composed, dims.width || 860, dims.height || 200);
            } catch (err) {
              console.error("Failed to generate PNG on submit", err);
            }
          }
        } catch (err) {
          console.error("Failed to generate composed SVG on submit", err);
        }
      }
    }

    if (!finalModelPngRaw && finalModelSvgRaw) {
      try {
        finalModelPngRaw = await convertSvgToPngAsync(finalModelSvgRaw, dims.width || 860, dims.height || 200);
      } catch (err) {
        console.error("Failed to generate fallback PNG on submit", err);
      }
    }

    const payload: Omit<import("../../types/equipment").CustomEquipmentModel, "modelId"> = {
      modelName: modelName.trim(),
      vendor: vendor,
      unit,
      displayName: `[${unit}U] ${modelName.trim()}`,
      modelSvgRaw: finalModelSvgRaw,
      modelPngRaw: finalModelPngRaw,
      rearSvgRaw: useDualView ? rearSvgRaw || undefined : undefined,
      defaultViewSide: useDualView ? defaultViewSide : "front",
      modelType,
      baseEquipmentViewSvgRaw: modelType === "card-based" ? baseChassisRaw || undefined : undefined,
      cardArea:
        modelType === "card-based"
          ? {
            x: caX,
            y: caY,
            width: caWidth,
            height: caHeight,
            columns: effectiveMaxCols,
            columnWidth: effectiveColWidth,
          }
          : undefined,
      rowHeights: undefined,
      rowColumns: undefined,
      rowGaps: undefined,
      gridMerges: modelType === "card-based" && gridMerges.length > 0 ? gridMerges : undefined,
      gridColWidths: modelType === "card-based" && gridColWidths.length > 0 ? gridColWidths : undefined,
      gridRowHeights: modelType === "card-based" && gridRowHeights.length > 0 ? gridRowHeights : undefined,
      equipmentSize: { width: dims.width, height: dims.height },
      assignedCardIds: modelType === "card-based" ? assignedCardIds : [],
      variants: modelType === "card-based" ? variants : undefined,
      createdAt: editingModelId ? customModels.find((m) => m.modelId === editingModelId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
    };

    if (editingModelId) {
      updateCustomModel(editingModelId, payload);
      showToastMsg(`모델 "${displayName}" 수정 완료!`, "success");
    } else {
      addCustomModel(payload);
      showToastMsg(`모델 "${displayName}" 등록 완료!`, "success");
    }
    resetForm();
    setActiveTab("list");
  }, [
    modelName,
    vendor,
    unit,
    modelSvgRaw,
    useDualView,
    rearSvgRaw,
    defaultViewSide,
    modelType,
    baseChassisRaw,
    caX, caY, caWidth, caHeight, caColumns,
    rowHeights,
    rowColumnsArr,
    rowGapsArr,
    gridMerges,
    gridColWidths,
    gridRowHeights,
    assignedCardIds,
    editingModelId,
    customModels,
    addCustomModel,
    updateCustomModel,
    displayName,
    showToastMsg,
    resetForm,
    variants,
  ]);

  // Delete model
  const handleDeleteModel = useCallback(
    (modelId: string) => {
      removeCustomModel(modelId);
      showToastMsg("모델이 삭제되었습니다.", "success");
    },
    [removeCustomModel, showToastMsg],
  );

  // Assigned card details
  const assignedCardDetails = useMemo(() => {
    return assignedCardIds
      .map((id) => allAvailableCards.find((c) => c.id === id))
      .filter((c): c is AvailableCard => c !== undefined);
  }, [assignedCardIds, allAvailableCards]);

  // Available existing cards (not yet assigned)
  const availableCards = useMemo(() => {
    return allAvailableCards;
  }, [allAvailableCards]);

  if (!isOpen) return null;

  return createPortal(
    <div className="mrm-overlay" onClick={() => setOpen(false)}>
      <div className="mrm-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="mrm-header">
          <h2>
            <div className="icon-box">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
            </div>
            장비 모델 관리
          </h2>
          <button
            className="mrm-close"
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Navigation for Register View */}
        {activeTab === "register" && (
          <div style={{ padding: "16px 28px 0" }}>
            <button
              className="comm-btn comm-btn-secondary comm-btn-sm"
              onClick={() => {
                setActiveTab("list");
                setEditingModelId(null);
              }}
              style={{ gap: 6, display: "inline-flex", alignItems: "center" }}
            >
              <Icon icon="material-symbols:arrow-back" style={{ width: 16, height: 16 }} />
              목록으로 돌아가기
            </button>
          </div>
        )}

        {activeTab === "register" ? (
          <>
            {/* Body: Registration Form */}
            <div className="mrm-body">
              {/* Basic Info */}
              <div className="mrm-section">
                <div className="mrm-section-title">
                  기본 정보
                  <span className="badge">필수</span>
                </div>

                <div className="mrm-form-grid" style={{ gridTemplateColumns: "1.2fr 0.8fr 1fr 1.5fr" }}>
                  <div className="mrm-field">
                    <label>
                      모델명<span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      value={modelName}
                      onChange={(e) => setModelName(e.target.value)}
                      placeholder="예: 7250 IXR-6"
                    />
                    {errors.modelName && (
                      <span className="error-hint">{errors.modelName}</span>
                    )}
                  </div>

                  <div className="mrm-field">
                    <label>
                      Rack Unit (U)<span className="required">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={48}
                      value={unit}
                      onChange={(e) => setUnit(parseInt(e.target.value) || 1)}
                    />
                    {errors.unit && (
                      <span className="error-hint">{errors.unit}</span>
                    )}
                  </div>

                  <div className="mrm-field">
                    <label>
                      제조사<span className="mrm-required">*</span>
                    </label>
                    <select
                      className="comm-input"
                      value={vendor}
                      onChange={(e) => setVendor(e.target.value)}
                    >
                      <option value="" disabled>제조사를 선택하세요</option>
                      {[
                        "AXGATE",
                        "Cisco",
                        "Ciena",
                        "Coweaver",
                        "Dasan",
                        "Dell",
                        "Edgecore",
                        "Juniper",
                        "Nokia",
                        "Rebellions",
                        "Supermicro",
                        "Ubiquoss",
                        "Woorinet"
                      ].map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>

                  <div className="mrm-field">
                    <label>
                      폼 팩터<span className="required">*</span>
                    </label>
                    <div className="mrm-type-selector compact">
                      <div
                        className={`mrm-type-card compact ${modelType === "normal" ? "active" : ""}`}
                        onClick={() => setModelType("normal")}
                      >
                        <div className="type-icon">📦</div>
                        <div className="type-info">
                          <div className="type-name">고정형</div>
                          <div className="type-desc">단일 바디 장비</div>
                        </div>
                      </div>
                      <div
                        className={`mrm-type-card compact ${modelType === "card-based" ? "active" : ""}`}
                        onClick={() => setModelType("card-based")}
                      >
                        <div className="type-icon">🗂️</div>
                        <div className="type-info">
                          <div className="type-name">섀시형</div>
                          <div className="type-desc">장비(섀시+카드)</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Model SVG Upload */}
              {modelType !== "card-based" && (
                <div className="mrm-section">
                  <div className="mrm-section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      모델 파일 업로드
                      <span className="badge">SVG</span>
                    </div>
                    {modelSvgRaw && !useDualView && (
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button type="button" onClick={() => modelFileRef.current?.click()} style={{ padding: "4px 10px", fontSize: "12px", borderRadius: "4px", background: "var(--bg-tertiary)", border: "1px solid var(--border-medium)", color: "var(--text-secondary)", cursor: "pointer" }}>변경</button>
                        <button type="button" onClick={() => { setModelSvgRaw(null); setModelSvgFileName(""); }} style={{ padding: "4px 10px", fontSize: "12px", borderRadius: "4px", background: "var(--severity-critical)", border: "none", color: "#fff", cursor: "pointer" }}>삭제</button>
                      </div>
                    )}
                  </div>

                  <input
                    type="file"
                    accept=".svg,.png,.jpg,.jpeg,.webp"
                    ref={modelFileRef}
                    style={{ display: "none" }}
                    onChange={handleModelFileChange}
                  />
                  <input
                    type="file"
                    accept=".svg,.png,.jpg,.jpeg,.webp"
                    ref={rearFileRef}
                    style={{ display: "none" }}
                    onChange={handleRearFileChange}
                  />

                  <div className="mrm-upload-mode-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={useDualView}
                        onChange={(e) => {
                          setUseDualView(e.target.checked);
                          if (!e.target.checked) {
                            setDefaultViewSide("front");
                            setErrors((p) => {
                              const next = { ...p };
                              delete next.rearFile;
                              return next;
                            });
                          }
                        }}
                      />
                      앞면/뒷면 이미지 사용
                    </label>
                    <span>
                      서버처럼 후면 포트 확인이 필요한 모델은 뒷면 SVG를 함께 등록하세요.
                    </span>
                  </div>

                  {!useDualView ? (
                    <>
                      {!modelSvgRaw && (
                        <div
                          className="mrm-file-upload"
                          onClick={() => modelFileRef.current?.click()}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            processModelFile(e.dataTransfer.files?.[0]);
                          }}
                        >
                          <div className="upload-icon">📁</div>
                          <div className="upload-text">
                            장비 모델 이미지 파일을 업로드하세요
                          </div>
                          <div className="upload-hint">
                            클릭하거나 파일을 선택하세요
                          </div>
                        </div>
                      )}
                      {errors.modelFile && (
                        <span className="error-hint" style={{ marginTop: 4, display: "block" }}>
                          {errors.modelFile}
                        </span>
                      )}

                      {modelSvgRaw && <SvgPreview svgRaw={modelSvgRaw} />}
                    </>
                  ) : (
                    <div className="mrm-dual-upload-grid">
                      <div className={`mrm-side-panel ${defaultViewSide === "front" ? "is-default" : ""}`}>
                        <div className="mrm-side-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ fontWeight: 600 }}>앞면</div>
                          {modelSvgRaw && (
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button type="button" onClick={() => modelFileRef.current?.click()} style={{ padding: "4px 10px", fontSize: "12px", borderRadius: "4px", background: "var(--bg-tertiary)", border: "1px solid var(--border-medium)", color: "var(--text-secondary)", cursor: "pointer" }}>변경</button>
                              <button type="button" onClick={() => { setModelSvgRaw(null); setModelSvgFileName(""); }} style={{ padding: "4px 10px", fontSize: "12px", borderRadius: "4px", background: "var(--severity-critical)", border: "none", color: "#fff", cursor: "pointer" }}>삭제</button>
                            </div>
                          )}
                        </div>
                        {!modelSvgRaw && (
                          <div
                            className="mrm-file-upload mrm-file-upload--compact"
                            onClick={() => modelFileRef.current?.click()}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              processModelFile(e.dataTransfer.files?.[0]);
                            }}
                          >
                            <div className="upload-text">앞면 SVG 업로드</div>
                            <div className="upload-hint">장비 전면 이미지</div>
                          </div>
                        )}
                        {errors.modelFile && (
                          <span className="error-hint" style={{ marginTop: 4, display: "block" }}>
                            {errors.modelFile}
                          </span>
                        )}
                        {modelSvgRaw && (
                          <div className="mrm-side-preview">
                            <SvgPreview svgRaw={modelSvgRaw} maxHeight={220} />
                          </div>
                        )}
                      </div>

                      <div className={`mrm-side-panel ${defaultViewSide === "rear" ? "is-default" : ""}`}>
                        <div className="mrm-side-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ fontWeight: 600 }}>뒷면</div>
                          {rearSvgRaw && (
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button type="button" onClick={() => rearFileRef.current?.click()} style={{ padding: "4px 10px", fontSize: "12px", borderRadius: "4px", background: "var(--bg-tertiary)", border: "1px solid var(--border-medium)", color: "var(--text-secondary)", cursor: "pointer" }}>변경</button>
                              <button type="button" onClick={() => { setRearSvgRaw(null); setRearSvgFileName(""); }} style={{ padding: "4px 10px", fontSize: "12px", borderRadius: "4px", background: "var(--severity-critical)", border: "none", color: "#fff", cursor: "pointer" }}>삭제</button>
                            </div>
                          )}
                        </div>
                        {!rearSvgRaw && (
                          <div
                            className="mrm-file-upload mrm-file-upload--compact"
                            onClick={() => rearFileRef.current?.click()}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              processRearFile(e.dataTransfer.files?.[0]);
                            }}
                          >
                            <div className="upload-text">뒷면 SVG 업로드</div>
                            <div className="upload-hint">장비 후면 이미지</div>
                          </div>
                        )}
                        {errors.rearFile && (
                          <span className="error-hint" style={{ marginTop: 4, display: "block" }}>
                            {errors.rearFile}
                          </span>
                        )}
                        {rearSvgRaw && (
                          <div className="mrm-side-preview">
                            <SvgPreview svgRaw={rearSvgRaw} maxHeight={220} />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Card-based Configuration */}
              {modelType === "card-based" && (
                <>
                  {/* Base Chassis SVG */}
                  <div className="mrm-section">
                    <div className="mrm-section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        기본 섀시 (Base Equipment View)
                        <span className="badge">카드 기반</span>
                      </div>
                      {baseChassisRaw && (
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button type="button" onClick={() => chassisFileRef.current?.click()} style={{ padding: "4px 10px", fontSize: "12px", borderRadius: "4px", background: "var(--bg-tertiary)", border: "1px solid var(--border-medium)", color: "var(--text-secondary)", cursor: "pointer" }}>변경</button>
                          <button
                            type="button"
                            onClick={() => {
                              setBaseChassisRaw(null);
                              setBaseChassisFileName("");
                              setCaXStr("0");
                              setCaYStr("0");
                              setCaWidthStr("0");
                              setCaHeightStr("0");
                              setCaColumnsStr("1");
                              setCaColWidthStr("0");
                              setCaRowCountStr("1");
                              setRowHeights([]);
                              setUniformRowHeight("46");
                              setRowColumnsArr([]);
                              setUniformRowColumns("1");
                              setRowGapsArr([]);
                              setUniformRowGap("0");
                              setGridColWidths([]);
                              setGridRowHeights([]);
                              setGridMerges([]);
                            }}
                            style={{ padding: "4px 10px", fontSize: "12px", borderRadius: "4px", background: "var(--severity-critical)", border: "none", color: "#fff", cursor: "pointer" }}
                          >
                            삭제
                          </button>
                        </div>
                      )}
                    </div>

                    <input
                      type="file"
                      accept=".svg,.png,.jpg,.jpeg,.webp"
                      ref={chassisFileRef}
                      style={{ display: "none" }}
                      onChange={handleChassisFileChange}
                    />
                    {!baseChassisRaw && (
                      <div
                        className="mrm-file-upload"
                        onClick={() => chassisFileRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          processChassisFile(e.dataTransfer.files?.[0]);
                        }}
                      >
                        <div className="upload-icon">🖼️</div>
                        <div className="upload-text">
                          기본 섀시 이미지 파일을 업로드하세요
                        </div>
                        <div className="upload-hint">
                          카드가 삽입되는 빈 장비 바디
                        </div>
                      </div>
                    )}
                    {errors.chassisFile && (
                      <span className="error-hint" style={{ marginTop: 4, display: "block" }}>
                        {errors.chassisFile}
                      </span>
                    )}

                    {baseChassisRaw && (
                      <ChassisPreviewWithOverlay
                        svgRaw={baseChassisRaw}
                        cardArea={{ x: caX, y: caY, width: caWidth, height: caHeight, columns: caColumns, columnWidth: caColWidth }}
                        colWidths={gridColWidths}
                        rowHeights={gridRowHeights}
                        merges={gridMerges}
                        onDrawEnd={(rect) => {
                          setCaXStr(String(rect.x));
                          setCaYStr(String(rect.y));
                          setCaWidthStr(String(rect.width));
                          setCaHeightStr(String(rect.height));
                          // Initialize grid with default 2 cols × 4 rows
                          const cols = 2;
                          const rows = 4;
                          setGridColWidths(Array.from({ length: cols }, () => Math.round(rect.width / cols)));
                          setGridRowHeights(Array.from({ length: rows }, () => Math.round(rect.height / rows)));
                          setGridMerges([]);
                          setCaColumnsStr(String(cols));
                          setCaRowCountStr(String(rows));
                        }}
                        onGridChange={(data) => {
                          setGridColWidths(data.colWidths);
                          setGridRowHeights(data.rowHeights);
                          setGridMerges(data.merges);
                          if (data.baseX !== undefined) setCaXStr(String(Math.round(data.baseX)));
                          if (data.baseY !== undefined) setCaYStr(String(Math.round(data.baseY)));
                          // Sync back to legacy state
                          setCaColumnsStr(String(data.colWidths.length));
                          setCaRowCountStr(String(data.rowHeights.length));
                          setCaWidthStr(String(Math.round(data.colWidths.reduce((a, b) => a + b, 0))));
                          setCaHeightStr(String(Math.round(data.rowHeights.reduce((a, b) => a + b, 0))));
                          setRowHeights(data.rowHeights.map(String));
                          setRowColumnsArr(data.rowHeights.map(() => String(data.colWidths.length)));
                        }}
                        onSave={() => {
                          showToastMsg("카드 영역 및 기본 섀시 정보가 임시 저장되었습니다.", "success");
                        }}
                      />
                    )}
                  </div>

                  {/* Legacy Card Area Configuration (Coordinates) removed as requested */}

                  {/* Card Assignment */}
                  <div className="mrm-section">
                    <div className="mrm-section-title">카드 할당</div>

                    <div className="mrm-card-config">
                      {/* Assigned cards */}
                      <div className="mrm-card-list">
                        {assignedCardDetails.length > 0 ? (
                          assignedCardDetails.map((card) => (
                            <div
                              key={card.id}
                              className="mrm-card-item"
                              onMouseMove={(e) => handleCardMouseMove(e, card)}
                              onMouseLeave={handleCardMouseLeave}
                            >
                              <div className="card-preview" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <CardThumbnail
                                  svgUrl={card.isBuiltIn ? card.svgUrl : undefined}
                                  svgRaw={!card.isBuiltIn ? card.svgRaw : undefined}
                                  alt={card.name}
                                  style={{ width: "100%", height: "48px", objectFit: "contain" }}
                                />
                              </div>
                              <div className="card-info">
                                <div className="card-name">{card.name}</div>
                                <div className="card-meta">
                                  {card.widthType.toUpperCase()} · {card.svgWidth}×{card.svgHeight}px
                                </div>
                              </div>
                              <button
                                className="card-remove"
                                onClick={() => handleRemoveAssignedCard(card.id)}
                                title="할당 해제"
                                aria-label="할당 해제"
                              >
                                <Icon icon="material-symbols:close-rounded" className="icon" style={DELETE_ICON_STYLE} />
                              </button>
                            </div>
                          ))
                        ) : (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              height: "100%",
                              color: "var(--text-tertiary)",
                              fontSize: "12px",
                            }}
                          >
                            할당된 카드가 없습니다. 아래 버튼으로 카드를 추가하세요.
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="mrm-sub-actions">
                        <button
                          className="mrm-btn-sm"
                          onClick={() => setIsCardRegOpen(true)}
                        >
                          + 새 카드 등록
                        </button>
                        {availableCards.length > 0 && (
                          <button
                            className="mrm-btn-sm"
                            onClick={() => setShowExistingPicker(!showExistingPicker)}
                          >
                            {showExistingPicker ? "목록 닫기" : "기존 카드에서 선택"}
                          </button>
                        )}
                      </div>

                      {/* Existing Card Picker */}
                      {showExistingPicker && availableCards.length > 0 && (
                        <div className="mrm-existing-cards">
                          {availableCards.map((card) => {
                            const isSelected = assignedCardIds.includes(card.id);
                            return (
                              <div
                                key={card.id}
                                className={`mrm-existing-card ${isSelected ? "selected" : ""}`}
                                onClick={() => handleSelectExistingCard(card.id)}
                                onMouseMove={(e) => handleCardMouseMove(e, card)}
                                onMouseLeave={handleCardMouseLeave}
                              >
                                <div
                                  style={{
                                    height: 48,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    overflow: "hidden",
                                    borderRadius: 4,
                                    background: "var(--bg-tertiary)",
                                  }}
                                >
                                  <CardThumbnail
                                    svgUrl={card.isBuiltIn ? card.svgUrl : undefined}
                                    svgRaw={!card.isBuiltIn ? card.svgRaw : undefined}
                                    alt={card.name}
                                    style={{ width: "100%", height: "48px", objectFit: "contain" }}
                                  />
                                </div>
                                <div className="ec-name">{card.name}</div>
                                <div className="ec-meta">
                                  {card.widthType.toUpperCase()} · {card.svgWidth}×{card.svgHeight}
                                </div>
                                {isSelected && (
                                  <div
                                    style={{
                                      fontSize: 10,
                                      color: "#22c55e",
                                      fontWeight: 700,
                                      marginTop: 2,
                                    }}
                                  >
                                    ✓ 선택됨
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Type/Variant Configuration */}
                  <div className="mrm-section">
                    <div className="mrm-section-title">
                      타입 관리
                      <span className="badge">미리 구성된 모델 옵션</span>
                    </div>
                    <div style={{ padding: "16px", border: "1px solid var(--border-weak)", borderRadius: "10px", background: "var(--bg-secondary)" }}>
                      <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "12px", lineHeight: 1.5 }}>
                        이 섀시 모델을 선택했을 때 자동으로 할당될 카드 구성을 미리 정의합니다.
                        기본타입 외에 A타입, B타입 등을 추가할 수 있으며, 등록 후 '새 장비 등록' 메뉴에서 개별 모델로 선택할 수 있습니다.
                      </p>

                      <div className="mrm-models-list" style={{ marginBottom: "16px", marginTop: "4px" }}>
                        {variants.map((v, i) => (
                          <div key={v.variantId || i} className="mrm-model-row">
                            <span className="model-type-tag card-based">
                              {v.isDefault ? "기본" : "추가"}
                            </span>
                            <div className="model-thumb">
                              {v.variantPngRaw ? (
                                <img src={v.variantPngRaw} alt={v.variantName} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                              ) : (
                                <div
                                  style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
                                  dangerouslySetInnerHTML={{
                                    __html: modelSvgRaw || baseChassisRaw || ""
                                  }}
                                />
                              )}
                            </div>
                            <div className="model-info-wrapper">
                              <div className="model-info-header">
                                <div className="model-info">
                                  <div className="model-display-name">
                                    {v.variantName}
                                  </div>
                                  <div className="model-meta">
                                    <span>{v.insertedCards?.length || 0}개 카드 장착됨</span>
                                  </div>
                                </div>
                              </div>
                              <div className="model-actions">
                                <button
                                  type="button"
                                  className="action-icon-btn edit-btn"
                                  onClick={() => { setEditingVariantIndex(i); setIsAssemblyOpen(true); }}
                                  title="타입 수정"
                                  aria-label="타입 수정"
                                >
                                  <Icon icon="material-symbols:edit" style={{ width: 16, height: 16 }} />
                                </button>
                                <button
                                  type="button"
                                  className="action-icon-btn delete-btn"
                                  onClick={() => setVariants(prev => prev.filter((_, idx) => idx !== i))}
                                  title="타입 삭제"
                                  aria-label="타입 삭제"
                                >
                                  <Icon icon="material-symbols:delete" style={{ width: 16, height: 16 }} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {variants.length === 0 && (
                        <div style={{ padding: "20px", textAlign: "center", color: "var(--text-tertiary)", fontSize: "13px", background: "var(--bg-primary)", borderRadius: "6px", border: "1px dashed var(--border-medium)", marginBottom: "16px" }}>
                          구성된 타입이 없습니다. 새 타입을 추가해주세요.
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={!baseChassisRaw || !isChassisDrawn}
                        onClick={() => {
                          setEditingVariantIndex(null);
                          setIsAssemblyOpen(true);
                        }}
                        style={{
                          width: "100%", padding: "10px", borderRadius: "6px",
                          background: "var(--theme-primary)", color: "#fff", fontWeight: 600, border: "none",
                          opacity: (!baseChassisRaw || !isChassisDrawn) ? 0.5 : 1,
                          cursor: (!baseChassisRaw || !isChassisDrawn) ? "not-allowed" : "pointer"
                        }}
                      >
                        + 새 타입 추가
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="mrm-actions">
              <button className="mrm-btn secondary" onClick={() => { resetForm(); setActiveTab("list"); }}>
                취소
              </button>
              <button
                className="mrm-btn primary"
                disabled={
                  isUnchanged ||
                  !modelName.trim() ||
                  (modelType !== "card-based" && !modelSvgRaw) ||
                  (modelType !== "card-based" && useDualView && !rearSvgRaw) ||
                  (modelType === "card-based" && !baseChassisRaw)
                }
                onClick={handleSubmit}
              >
                저장
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Body: Registered Models List */}
            <div className="mrm-body">
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{
                  fontSize: 12, fontWeight: 700, color: "var(--text-tertiary)",
                  textTransform: "uppercase", letterSpacing: "0.05em",
                  padding: "8px 0 6px",
                }}>
                  기본 장비 모델 ({DEVICE_TEMPLATES.filter((t) => !deletedDefaultTemplates.includes(t.modelName)).length})
                </div>
                <button
                  className="comm-btn comm-btn-primary comm-btn-md"
                  onClick={() => {
                    resetForm();
                    setActiveTab("register");
                  }}
                  style={{ gap: 6, display: "inline-flex", alignItems: "center" }}
                >
                  <Icon icon="material-symbols:add" style={{ width: 16, height: 16 }} />
                  새 모델 등록
                </button>
              </div>
              {/* Default (Built-in) Models */}
              <div style={{ marginBottom: 8 }}>
                <div className="mrm-models-list">
                  {DEVICE_TEMPLATES.filter((t) => !deletedDefaultTemplates.includes(t.modelName)).map((tmpl) => {
                    const overrideModel = customModels.find((m) => m.modelName === tmpl.modelName);
                    const eqModel = equipmentModels.find((m) => m.modelName === tmpl.modelName);
                    const isCardBased = !!overrideModel || !!eqModel;
                    const displayUnit = overrideModel ? overrideModel.unit : tmpl.uSize;
                    let displayThumbPng = overrideModel ? overrideModel.modelPngRaw : null;
                    let displayThumb = overrideModel
                      ? (overrideModel.defaultViewSide === "rear" && overrideModel.rearSvgRaw ? overrideModel.rearSvgRaw : (overrideModel.modelSvgRaw || overrideModel.baseEquipmentViewSvgRaw))
                      : null;
                    
                    if (overrideModel && overrideModel.variants) {
                      const defaultVariant = overrideModel.variants.find(v => v.variantName === "기본타입");
                      if (defaultVariant && defaultVariant.variantPngRaw) {
                        displayThumbPng = defaultVariant.variantPngRaw;
                        displayThumb = null;
                      }
                    }

                    const imgUrl = (!displayThumb && !displayThumbPng) ? resolveDeviceImage(tmpl.modelName) : null;
                    const variantCount = overrideModel?.variants?.length || 0;
                    return (
                      <div key={`default-${tmpl.modelName}`} className="mrm-model-row">
                        <span className={`model-type-tag ${isCardBased ? "card-based" : "normal"}`}>
                          {isCardBased ? "섀시형" : "고정형"}
                        </span>
                        <div
                          className="model-thumb"
                          onMouseEnter={(e) => {
                            setHoveredListThumb({ pngRaw: displayThumbPng, svgRaw: displayThumb, imgUrl, name: tmpl.modelName });
                            setHoveredListThumbPos({ x: e.clientX, y: e.clientY });
                          }}
                          onMouseMove={(e) => {
                            setHoveredListThumbPos({ x: e.clientX, y: e.clientY });
                          }}
                          onMouseLeave={() => {
                            setHoveredListThumb(null);
                          }}
                        >
                          {displayThumbPng ? (
                            <img src={displayThumbPng} alt={tmpl.modelName} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                          ) : displayThumb ? (
                            <div dangerouslySetInnerHTML={{ __html: displayThumb }} style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }} />
                          ) : imgUrl ? (
                            <img src={imgUrl} alt={tmpl.modelName} />
                          ) : (
                            <span style={{ fontSize: 18, color: "var(--text-tertiary)" }}>🖥️</span>
                          )}
                        </div>
                        <div className="model-info-wrapper">
                          <div className="model-info-header">
                            <div className="model-info">
                              <div className="model-display-name">
                                [{displayUnit}U] {tmpl.modelName} {overrideModel && <span style={{ fontSize: 10, padding: "2px 6px", background: "var(--theme-primary)", color: "#fff", borderRadius: 4, marginLeft: 6 }}>수정됨</span>}
                              </div>
                              <div className="model-meta">
                                <span>{displayUnit}U</span>
                                <span>·</span>
                                <span>{tmpl.vendor}</span>
                                <span>·</span>
                                <span>{tmpl.type}</span>
                                {isCardBased && overrideModel && (
                                  <>
                                    <span>·</span>
                                    <span>타입 {variantCount}개</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="model-actions">
                            <button
                              className="action-icon-btn edit-btn"
                              onClick={async () => {
                                if (overrideModel) {
                                  // Load the overridden model for editing
                                  loadModelForEdit(overrideModel.modelId);
                                  return;
                                }

                                // 기본 장비를 편집 폼에 로드 (SVG 이미지 + 카드 영역 설정 포함)
                                setModelName(tmpl.modelName);
                                setVendor(tmpl.vendor || "Nokia");
                                setUnit(tmpl.uSize);
                                setErrors({});
                                setEditingModelId(null);
                                setUseDualView(false);
                                setRearSvgRaw(null);
                                setRearSvgFileName("");
                                setDefaultViewSide("front");
                                setActiveTab("register");

                                // 카드 기반 모델 여부 확인
                                const eqModel = equipmentModels.find(
                                  (m) => m.modelName === tmpl.modelName
                                );
                                if (eqModel) {
                                  setModelType("card-based");

                                  if (eqModel.rows && eqModel.rows.length > 0) {
                                    // ── rows 기반 모델 (IXR-6, IXR-10): rows에서 카드 영역 역산 ──
                                    const firstRow = eqModel.rows[0];
                                    const lastRow = eqModel.rows[eqModel.rows.length - 1];
                                    const computedX = firstRow.x;
                                    const computedY = firstRow.y;
                                    const computedW = firstRow.width;
                                    const computedH = (lastRow.y + lastRow.height) - firstRow.y;
                                    const computedCols = firstRow.columns;
                                    const computedColW = Math.round(computedW / computedCols);

                                    setCaXStr(String(computedX));
                                    setCaYStr(String(computedY));
                                    setCaWidthStr(String(computedW));
                                    setCaHeightStr(String(computedH));
                                    setCaColumnsStr(String(computedCols));
                                    setCaColWidthStr(String(computedColW));

                                    // 행 수 & 행 높이 & 행별 열 수 & 행 간 간격
                                    const rCount = eqModel.rows.length;
                                    setCaRowCountStr(String(rCount));
                                    setRowHeights(eqModel.rows.map((r) => String(r.height)));
                                    setRowColumnsArr(eqModel.rows.map((r) => String(r.columns)));
                                    // rows Y좌표 차이로 간격 계산
                                    const gaps: string[] = [];
                                    for (let ri = 0; ri < rCount - 1; ri++) {
                                      const currentEnd = eqModel.rows[ri].y + eqModel.rows[ri].height;
                                      const nextStart = eqModel.rows[ri + 1].y;
                                      gaps.push(String(Math.max(0, nextStart - currentEnd)));
                                    }
                                    setRowGapsArr(gaps);
                                  } else if (eqModel.cardArea) {
                                    // ── cardArea 기반 모델 (R4, R6, R6d, R6dl) ──
                                    setCaXStr(String(eqModel.cardArea.x));
                                    setCaYStr(String(eqModel.cardArea.y));
                                    setCaWidthStr(String(eqModel.cardArea.width));
                                    setCaHeightStr(String(eqModel.cardArea.height));
                                    setCaColumnsStr(String(eqModel.cardArea.columns));
                                    setCaColWidthStr(String(eqModel.cardArea.columnWidth));

                                    // slots에서 고유 행 높이 추출, 없으면 기본값으로 계산
                                    if (eqModel.slots && eqModel.slots.length > 0) {
                                      const rowMap = new Map<number, number>();
                                      for (const s of eqModel.slots) {
                                        if (!rowMap.has(s.row) || s.height > (rowMap.get(s.row) || 0)) {
                                          rowMap.set(s.row, s.height);
                                        }
                                      }
                                      const sortedRows = [...rowMap.entries()].sort((a, b) => a[0] - b[0]);
                                      setCaRowCountStr(String(sortedRows.length));
                                      setRowHeights(sortedRows.map(([, h]) => String(h)));
                                      setRowColumnsArr(Array.from({ length: sortedRows.length }, () => String(eqModel.cardArea!.columns)));
                                      // slots 기반: 행 간 Y좌표 차이로 간격 계산
                                      const slotGaps: string[] = [];
                                      const sortedRowKeys = sortedRows.map(([k]) => k);
                                      for (let ri = 0; ri < sortedRowKeys.length - 1; ri++) {
                                        const curRow = eqModel.slots!.filter((s) => s.row === sortedRowKeys[ri]);
                                        const nextRow = eqModel.slots!.filter((s) => s.row === sortedRowKeys[ri + 1]);
                                        if (curRow.length > 0 && nextRow.length > 0) {
                                          const curEnd = Math.max(...curRow.map((s) => s.y + s.height));
                                          const nextStart = Math.min(...nextRow.map((s) => s.y));
                                          slotGaps.push(String(Math.max(0, nextStart - curEnd)));
                                        } else {
                                          slotGaps.push("0");
                                        }
                                      }
                                      setRowGapsArr(slotGaps);
                                    } else {
                                      const rCount = Math.max(1, Math.floor(eqModel.cardArea.height / 46));
                                      setCaRowCountStr(String(rCount));
                                      setRowHeights(Array.from({ length: rCount }, () => "46"));
                                      setRowColumnsArr(Array.from({ length: rCount }, () => String(eqModel.cardArea!.columns)));
                                      setRowGapsArr(Array.from({ length: Math.max(0, rCount - 1) }, () => "0"));
                                    }
                                  }

                                  // 섀시 SVG 로드
                                  if (eqModel.baseSvgUrl) {
                                    const chassisSvg = await loadBaseEquipmentSvgRaw(eqModel.baseSvgUrl);
                                    if (chassisSvg) {
                                      setBaseChassisRaw(chassisSvg);
                                      setBaseChassisFileName(eqModel.baseSvgUrl);
                                    }
                                  }
                                } else {
                                  setModelType("normal");
                                  setBaseChassisRaw(null);
                                  setBaseChassisFileName("");
                                  setCaRowCountStr("0");
                                  setRowHeights([]);
                                  setRowColumnsArr([]);
                                  setRowGapsArr([]);
                                }

                                // 카드 할당: 카드 기반 모델이면 호환 카드를 자동 할당
                                if (eqModel) {
                                  const compatibleCards = getCardsForModel(eqModel);
                                  setAssignedCardIds(compatibleCards.map((c) => c.cardFileName));
                                } else {
                                  setAssignedCardIds([]);
                                }

                                // 모델 SVG 로드
                                const svgContent = await resolveDeviceSvgContent(tmpl.modelName);
                                if (svgContent) {
                                  setModelSvgRaw(svgContent);
                                  setModelSvgFileName(`[${tmpl.uSize}U] ${tmpl.modelName}.svg`);
                                } else {
                                  setModelSvgRaw(null);
                                  setModelSvgFileName("");
                                }

                                const sides = getDeviceViewSides(tmpl.modelName);
                                if (sides.includes("rear")) {
                                  const rearSvgContent = await resolveDeviceSvgContent(tmpl.modelName, "rear");
                                  setUseDualView(!!rearSvgContent);
                                  setRearSvgRaw(rearSvgContent || null);
                                  setRearSvgFileName(rearSvgContent ? `[${tmpl.uSize}U] ${tmpl.modelName} back.svg` : "");
                                }
                              }}
                              title="모델 수정"
                              aria-label="모델 수정"
                            >
                              <Icon icon="material-symbols:edit" style={{ width: 16, height: 16 }} />
                            </button>
                            <button
                              className="action-icon-btn delete-btn"
                              onClick={() => {
                                if (overrideModel) {
                                  updateCustomModel(overrideModel.modelId, {
                                    modelSvgRaw: undefined as any,
                                    modelPngRaw: undefined as any,
                                    rearSvgRaw: undefined as any,
                                    baseEquipmentViewSvgRaw: undefined as any,
                                  });
                                  showToastMsg(`기본 모델 "[${tmpl.uSize}U] ${tmpl.modelName}" 이미지가 초기화되었습니다 (카드 영역 및 타입은 유지됨)`, "success");
                                } else {
                                  removeDefaultTemplate(tmpl.modelName);
                                  showToastMsg(`기본 모델 "[${tmpl.uSize}U] ${tmpl.modelName}" 숨김 처리됨`, "success");
                                }
                              }}
                              title={overrideModel ? "수정 내용 초기화" : "기본 모델 숨기기"}
                              aria-label={overrideModel ? "수정 내용 초기화" : "기본 모델 숨기기"}
                            >
                              <Icon icon="material-symbols:delete" style={{ width: 16, height: 16 }} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Custom Models */}
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)",
                  textTransform: "uppercase", letterSpacing: "0.05em",
                  padding: "8px 0 6px", borderBottom: "1px solid var(--border-weak)",
                  marginBottom: 8,
                }}>
                  커스텀 모델 ({customModels.filter(m => !DEVICE_TEMPLATES.some(t => t.modelName === m.modelName)).length})
                </div>
                {customModels.filter(m => !DEVICE_TEMPLATES.some(t => t.modelName === m.modelName)).length > 0 ? (
                  <div className="mrm-models-list">
                    {customModels.filter(m => !DEVICE_TEMPLATES.some(t => t.modelName === m.modelName)).map((model) => (
                      <div key={model.modelId} className="mrm-model-row">
                        <span className={`model-type-tag ${model.modelType}`}>
                          {model.modelType === "normal" ? "고정형" : "섀시형"}
                        </span>
                        <div
                          className="model-thumb"
                          onMouseEnter={(e) => {
                            let svgFallback = (model.defaultViewSide === "rear" && model.rearSvgRaw ? model.rearSvgRaw : (model.modelSvgRaw || model.baseEquipmentViewSvgRaw)) || undefined;
                            let pngFallback = model.modelPngRaw;
                            if (model.variants) {
                              const defaultVariant = model.variants.find(v => v.variantName === "기본타입");
                              if (defaultVariant && defaultVariant.variantPngRaw) {
                                pngFallback = defaultVariant.variantPngRaw;
                                svgFallback = undefined;
                              }
                            }
                            setHoveredListThumb({ pngRaw: pngFallback, svgRaw: svgFallback, name: model.modelName });
                            setHoveredListThumbPos({ x: e.clientX, y: e.clientY });
                          }}
                          onMouseMove={(e) => {
                            setHoveredListThumbPos({ x: e.clientX, y: e.clientY });
                          }}
                          onMouseLeave={() => {
                            setHoveredListThumb(null);
                          }}
                        >
                          {(() => {
                            let pngRaw = model.modelPngRaw;
                            let svgRaw = (model.defaultViewSide === "rear" && model.rearSvgRaw ? model.rearSvgRaw : (model.modelSvgRaw || model.baseEquipmentViewSvgRaw)) || "";
                            if (model.variants) {
                              const defaultVariant = model.variants.find(v => v.variantName === "기본타입");
                              if (defaultVariant && defaultVariant.variantPngRaw) {
                                pngRaw = defaultVariant.variantPngRaw;
                                svgRaw = "";
                              }
                            }
                            if (pngRaw) {
                              return <img src={pngRaw} alt={model.modelName} style={{ width: "100%", height: "100%", objectFit: "contain" }} />;
                            }
                            return (
                              <div
                                style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
                                dangerouslySetInnerHTML={{ __html: svgRaw }}
                              />
                            );
                          })()}
                        </div>
                        <div className="model-info-wrapper">
                          <div className="model-info-header">
                            <div className="model-info">
                              <div className="model-display-name">
                                {model.displayName}
                              </div>
                              <div className="model-meta">
                                <span>{model.unit}U</span>
                                <span>·</span>
                                <span>
                                  {model.equipmentSize
                                    ? `${model.equipmentSize.width}×${model.equipmentSize.height}px`
                                    : ""}
                                </span>
                                {model.modelType === "card-based" && (
                                  <>
                                    <span>·</span>
                                    <span>타입 {model.variants?.length || 0}개</span>
                                  </>
                                )}
                                {model.rearSvgRaw && (
                                  <>
                                    <span>·</span>
                                    <span>양면/{model.defaultViewSide === "rear" ? "뒷면 기본" : "앞면 기본"}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="model-actions">
                            <button
                              className="action-icon-btn edit-btn"
                              onClick={() => loadModelForEdit(model.modelId)}
                              title="모델 수정"
                              aria-label="모델 수정"
                            >
                              <Icon icon="material-symbols:edit" style={{ width: 16, height: 16 }} />
                            </button>
                            <button
                              className="action-icon-btn delete-btn"
                              onClick={() => handleDeleteModel(model.modelId)}
                              title="커스텀 모델 삭제"
                              aria-label="커스텀 모델 삭제"
                            >
                              <Icon icon="material-symbols:delete" style={{ width: 16, height: 16 }} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "30px 0",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      등록된 커스텀 모델이 없습니다. "새 모델 등록" 탭에서 추가하세요.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {hoveredTooltipCard && (
          <div
            style={{
              position: "fixed",
              left: hoveredTooltipPos.x + 15,
              top: hoveredTooltipPos.y + 15,
              zIndex: 100000,
              background: "var(--bg-secondary)",
              padding: "8px",
              borderRadius: "8px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
              pointerEvents: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: hoveredTooltipCard.widthType === "full" ? "800px" : "400px",
              maxWidth: "80vw"
            }}
          >
            <CardThumbnail
              svgUrl={hoveredTooltipCard.isBuiltIn ? hoveredTooltipCard.svgUrl : undefined}
              svgRaw={!hoveredTooltipCard.isBuiltIn ? hoveredTooltipCard.svgRaw : undefined}
              alt={hoveredTooltipCard.name}
              style={{ width: "100%", height: "auto", objectFit: "contain" }}
            />
          </div>
        )}
      </div>

      {/* Card Registration Sub-Modal */}
      <CardRegistrationForm
        open={isCardRegOpen}
        onClose={() => setIsCardRegOpen(false)}
        onSave={handleAddNewCard}
        maxColumns={maxColumns}
      />

      {/* Equipment Assembly Sub-Modal for Type configuration */}
      {isAssemblyOpen && (
        <EquipmentAssemblyModal
          open={isAssemblyOpen}
          onClose={() => setIsAssemblyOpen(false)}
          initialModelName={modelName || "새 장비"}
          inlineModel={{
            modelId: "temp",
            modelName: modelName || "새 장비",
            unit: unit,
            rackUnit: `${unit}U`,
            modelSvgRaw: baseChassisRaw || "",
            baseEquipmentViewSvgRaw: baseChassisRaw || "",
            baseSvgUrl: baseChassisFileName || "",
            modelType: "card-based",
            equipmentSize: parseSvgDimensions(baseChassisRaw || ""),
            assignedCardIds: assignedCardIds,
            cardArea: { x: caX, y: caY, width: caWidth, height: caHeight, columns: caColumns, columnWidth: caColWidth },
            _rowHeights: rowHeights.map(r => parseFloat(r) || defaultRowHeight),
            _rowColumns: rowColumnsArr.map(c => parseInt(c) || caColumns),
            _rowGaps: rowGapsArr.map(g => parseFloat(g) || 0),
            gridMerges: gridMerges,
            gridColWidths: gridColWidths,
            gridRowHeights: gridRowHeights
          } as any}
          initialCards={editingVariantIndex !== null ? variants[editingVariantIndex].insertedCards : []}
          onSave={async (res) => {
            let variantName = prompt("타입 이름을 입력하세요 (예: 기본타입, A타입)", editingVariantIndex !== null ? variants[editingVariantIndex].variantName : (variants.length === 0 ? "기본타입" : "A타입"));
            if (!variantName) return false;
            
            variantName = variantName.trim();
            const nameExists = variants.some((v, idx) => v.variantName === variantName && idx !== editingVariantIndex);
            if (nameExists) {
              alert(`"${variantName}" 타입이 이미 존재합니다. 다른 이름을 사용해주세요.`);
              return false;
            }

            const next = [...variants];
            if (editingVariantIndex !== null) {
              next[editingVariantIndex] = { ...next[editingVariantIndex], variantName, insertedCards: res.cards };
            } else {
              next.push({ variantId: `var-${Date.now()}`, variantName, isDefault: next.length === 0, insertedCards: res.cards });
            }
            setVariants(next);

            // Auto-save to store
              const dims = parseSvgDimensions(modelSvgRaw || "");
              const parsedRowHeights = rowHeights.map((h) => parseFloat(h) || defaultRowHeight);
              const parsedRowColumns = rowColumnsArr.map((c) => parseInt(c) || caColumns);
              const parsedRowGaps = rowGapsArr.map((g) => parseFloat(g) || 0);
              const effectiveMaxCols = parsedRowColumns.length > 0 ? Math.max(...parsedRowColumns, 1) : caColumns;
              const effectiveColWidth = caWidth / effectiveMaxCols;

              let finalModelSvgRaw = modelType === "card-based" ? "" : modelSvgRaw || "";
              let finalModelPngRaw: string | undefined = undefined;

              if (modelType === "card-based") {
                const generateVariantImage = async (variant: any) => {
                  try {
                    const composed = await generateComposedSvgAsync(
                      modelName.trim(),
                      {
                        modelId: editingModelId || "temp",
                        modelName: modelName.trim(),
                        rackUnit: `${unit}U`,
                        baseSvgUrl: baseChassisFileName || "",
                        baseEquipmentViewSvgRaw: baseChassisRaw || "",
                        equipmentSize: { width: dims.width, height: dims.height },
                        cardArea: { x: caX, y: caY, width: caWidth, height: caHeight, columns: effectiveMaxCols, columnWidth: effectiveColWidth },
                        _rowHeights: parsedRowHeights,
                        _rowColumns: parsedRowColumns,
                        _rowGaps: parsedRowGaps,
                        gridMerges: gridMerges,
                        gridColWidths: gridColWidths,
                        gridRowHeights: gridRowHeights,
                      } as any,
                      variant.insertedCards,
                      [],
                      "front"
                    );
                    if (composed) {
                      const png = await convertSvgToPngAsync(composed, dims.width || 860, dims.height || 200);
                      return { svg: composed, png };
                    }
                  } catch (err) {
                    console.error("Failed to generate variant image", err);
                  }
                  return null;
                };

                const savedVariantIndex = editingVariantIndex !== null ? editingVariantIndex : next.length - 1;
                const savedVariant = next[savedVariantIndex];
                const savedRes = await generateVariantImage(savedVariant);
                if (savedRes) {
                  savedVariant.variantPngRaw = savedRes.png;
                }

                const defaultVariant = next.find(v => v.isDefault) || next[0];
                let defaultRes = savedRes;
                if (defaultVariant && defaultVariant.variantId !== savedVariant.variantId) {
                  defaultRes = await generateVariantImage(defaultVariant);
                  if (defaultRes) {
                    defaultVariant.variantPngRaw = defaultRes.png;
                  }
                } else if (defaultVariant && defaultVariant.variantId === savedVariant.variantId && savedRes) {
                  defaultVariant.variantPngRaw = savedRes.png;
                }

                setVariants([...next]);

                if (defaultRes) {
                  finalModelSvgRaw = defaultRes.svg;
                  setModelSvgRaw(defaultRes.svg);
                  finalModelPngRaw = defaultRes.png;
                }
              }

              if (!finalModelPngRaw && finalModelSvgRaw) {
                try {
                  finalModelPngRaw = await convertSvgToPngAsync(finalModelSvgRaw, dims.width || 860, dims.height || 200);
                } catch (err) {
                  console.error("Failed to generate fallback PNG on variant save", err);
                }
              }

              const payload: Omit<import("../../types/equipment").CustomEquipmentModel, "modelId"> = {
                modelName: modelName.trim(),
                vendor: vendor,
                unit,
                displayName: `[${unit}U] ${modelName.trim()}`,
                modelSvgRaw: finalModelSvgRaw,
                modelPngRaw: finalModelPngRaw,
                rearSvgRaw: useDualView ? rearSvgRaw || undefined : undefined,
                defaultViewSide: useDualView ? defaultViewSide : "front",
                modelType,
                baseEquipmentViewSvgRaw: modelType === "card-based" ? baseChassisRaw || undefined : undefined,
                cardArea: modelType === "card-based" ? { x: caX, y: caY, width: caWidth, height: caHeight, columns: effectiveMaxCols, columnWidth: effectiveColWidth } : undefined,
                rowHeights: undefined,
                rowColumns: undefined,
                rowGaps: undefined,
                gridMerges: modelType === "card-based" && gridMerges.length > 0 ? gridMerges : undefined,
                gridColWidths: modelType === "card-based" && gridColWidths.length > 0 ? gridColWidths : undefined,
                gridRowHeights: modelType === "card-based" && gridRowHeights.length > 0 ? gridRowHeights : undefined,
                equipmentSize: { width: dims.width, height: dims.height },
                assignedCardIds: modelType === "card-based" ? assignedCardIds : [],
                variants: modelType === "card-based" ? next : undefined,
                createdAt: editingModelId ? (customModels.find((m) => m.modelId === editingModelId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
              };

              if (editingModelId) {
                updateCustomModel(editingModelId, payload);
                showToastMsg(`타입 "${variantName}" 저장 및 모델 적용 완료!`, "success");
              } else {
                const existing = customModels.find(m => m.modelName === payload.modelName);
                if (existing) {
                  updateCustomModel(existing.modelId, payload);
                  setEditingModelId(existing.modelId);
                  showToastMsg(`타입 "${variantName}" 저장 및 모델 적용 완료!`, "success");
                } else {
                  const newId = addCustomModel(payload);
                  setEditingModelId(newId);
                  showToastMsg(`타입 "${variantName}" 저장 및 모델 적용 완료!`, "success");
                }
              }
            setIsAssemblyOpen(false);
          }}
        />
      )}

      {hoveredListThumb && (
        <div
          style={{
            position: "fixed",
            left: hoveredListThumbPos.x + 15,
            top: hoveredListThumbPos.y + 15,
            zIndex: 100000,
            background: "var(--bg-secondary)",
            padding: "8px",
            borderRadius: "8px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "500px",
            maxWidth: "80vw"
          }}
        >
          {hoveredListThumb.pngRaw ? (
            <img src={hoveredListThumb.pngRaw} alt={hoveredListThumb.name} style={{ width: "100%", height: "auto", objectFit: "contain" }} />
          ) : hoveredListThumb.svgRaw ? (
            <div dangerouslySetInnerHTML={{ __html: hoveredListThumb.svgRaw }} style={{ width: "100%", height: "auto", display: "flex", alignItems: "center", justifyContent: "center" }} />
          ) : hoveredListThumb.imgUrl ? (
            <img src={hoveredListThumb.imgUrl} alt={hoveredListThumb.name} style={{ width: "100%", height: "auto", objectFit: "contain" }} />
          ) : (
            <span style={{ fontSize: 24, color: "var(--text-tertiary)" }}>🖥️</span>
          )}
        </div>
      )}

      {/* Toast */}
      {toast &&
        createPortal(
          <div className={`mrm-toast ${toast.type}`}>{toast.message}</div>,
          document.body,
        )}
    </div>,
    document.body,
  );
};
