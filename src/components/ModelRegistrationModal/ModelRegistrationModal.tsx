import { Icon } from "@iconify/react";
﻿import React, { useState, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../../store/useStore";
import type {
  CustomModelType,
  CardWidthType,
  EquipmentViewSide,
} from "../../types/equipment";
import { CardRegistrationForm } from "./CardRegistrationForm";
import { cardDefinitions, equipmentModels, loadBaseEquipmentSvgRaw, getCardsForModel } from "../../utils/cardAssets";
import { DEVICE_TEMPLATES } from "../../utils/deviceTemplates";
import { getDeviceViewSides, resolveDeviceImage, resolveDeviceSvgContent } from "../../utils/deviceAssets";

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
function SvgPreview({ svgRaw, maxHeight = 180 }: { svgRaw: string; maxHeight?: number }) {
  const sanitized = useMemo(() => {
    // width/height를 100%로 치환하여 반응형 렌더링
    return svgRaw
      .replace(/width="[^"]*"/, 'width="100%"')
      .replace(/height="[^"]*"/, `height="${maxHeight}px"`)
      .replace(/<svg/, '<svg style="max-width:100%;max-height:' + maxHeight + 'px"');
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
  rowCount,
  rowHeights,
  rowColumns,
  rowGaps,
  defaultRowH,
}: {
  svgRaw: string;
  cardArea: { x: number; y: number; width: number; height: number; columns: number; columnWidth: number };
  rowCount: number;
  rowHeights: string[];
  rowColumns: string[];
  rowGaps: string[];
  defaultRowH: number;
}) {
  const overlayedSvg = useMemo(() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgRaw, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return svgRaw;

    const getSvgBounds = () => {
      const vb = svg.getAttribute("viewBox");
      if (vb) {
        const parts = vb.split(/[\s,]+/).map(Number);
        if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
          return { minX: parts[0], minY: parts[1], maxX: parts[0] + parts[2], maxY: parts[1] + parts[3] };
        }
      }

      const width = parseFloat(svg.getAttribute("width") || "800") || 800;
      const height = parseFloat(svg.getAttribute("height") || "200") || 200;
      return { minX: 0, minY: 0, maxX: width, maxY: height };
    };

    let rowCursor = 0;
    let rowMinY = 0;
    let rowMaxY = 0;
    for (let i = 0; i < rowCount; i += 1) {
      const h = parseFloat(rowHeights[i]) || defaultRowH;
      const gap = i > 0 ? (parseFloat(rowGaps[i - 1]) || 0) : 0;
      rowCursor += gap;
      rowMinY = Math.min(rowMinY, rowCursor);
      rowCursor += h;
      rowMaxY = Math.max(rowMaxY, rowCursor);
    }
    const overlayTop = Math.min(0, rowMinY);
    const overlayBottom = Math.max(cardArea.height, rowMaxY);
    const overlayHeight = overlayBottom - overlayTop;
    const padding = 18;
    const bounds = getSvgBounds();
    const minX = Math.min(bounds.minX, cardArea.x - padding);
    const minY = Math.min(bounds.minY, cardArea.y + overlayTop - padding);
    const maxX = Math.max(bounds.maxX, cardArea.x + cardArea.width + padding + 72);
    const maxY = Math.max(bounds.maxY, cardArea.y + overlayBottom + padding);
    const viewWidth = maxX - minX;
    const viewHeight = maxY - minY;
    svg.setAttribute("viewBox", `${minX} ${minY} ${viewWidth} ${viewHeight}`);
    svg.setAttribute("width", String(viewWidth));
    svg.setAttribute("height", String(viewHeight));
    svg.setAttribute("overflow", "visible");

    // 오버레이 그룹 생성
    const g = doc.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "card-area-overlay");
    g.setAttribute("shape-rendering", "geometricPrecision");

    const applyOverlayStroke = (el: SVGElement) => {
      el.setAttribute("vector-effect", "non-scaling-stroke");
      el.setAttribute("stroke-linecap", "square");
    };

    if (cardArea.width > 0 && cardArea.height > 0) {
      // 카드 영역 사각형
      const rect = doc.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", String(cardArea.x));
      rect.setAttribute("y", String(cardArea.y + overlayTop));
      rect.setAttribute("width", String(cardArea.width));
      rect.setAttribute("height", String(overlayHeight));
      rect.setAttribute("fill", "rgba(0,200,255,0.08)");
      rect.setAttribute("stroke", "rgba(0,200,255,0.7)");
      rect.setAttribute("stroke-width", "2");
      rect.setAttribute("stroke-dasharray", "6 3");
      rect.setAttribute("rx", "2");
      applyOverlayStroke(rect);
      g.appendChild(rect);

      // 행 구분선 + 행별 열 구분선 + 간격
      let yOff = 0;
      for (let i = 0; i < rowCount; i++) {
        const h = parseFloat(rowHeights[i]) || defaultRowH;
        const gap = i > 0 ? (parseFloat(rowGaps[i - 1]) || 0) : 0;
        if (gap !== 0) {
          const gapY = cardArea.y + (gap > 0 ? yOff : yOff + gap);
          const gapHeight = Math.abs(gap);
          const gapRect = doc.createElementNS("http://www.w3.org/2000/svg", "rect");
          gapRect.setAttribute("x", String(cardArea.x));
          gapRect.setAttribute("y", String(gapY));
          gapRect.setAttribute("width", String(cardArea.width));
          gapRect.setAttribute("height", String(gapHeight));
          gapRect.setAttribute("fill", gap > 0 ? "rgba(255,193,7,0.22)" : "rgba(239,68,68,0.24)");
          gapRect.setAttribute("stroke", gap > 0 ? "rgba(255,193,7,0.9)" : "rgba(248,113,113,0.95)");
          gapRect.setAttribute("stroke-width", "1.5");
          gapRect.setAttribute("stroke-dasharray", "4 2");
          applyOverlayStroke(gapRect);
          g.appendChild(gapRect);

          const gapText = doc.createElementNS("http://www.w3.org/2000/svg", "text");
          gapText.setAttribute("x", String(cardArea.x + cardArea.width + 6));
          gapText.setAttribute("y", String(gapY + Math.max(9, gapHeight / 2 + 3)));
          gapText.setAttribute("fill", gap > 0 ? "rgba(255,214,102,0.95)" : "rgba(252,165,165,0.98)");
          gapText.setAttribute("font-size", "10");
          gapText.setAttribute("font-weight", "700");
          gapText.setAttribute("font-family", "sans-serif");
          gapText.textContent = gap > 0 ? `간격 ${gap}px` : `겹침 ${Math.abs(gap)}px`;
          g.appendChild(gapText);

          yOff += gap; // 이전 행과의 간격/겹침
        }
        const cols = parseInt(rowColumns[i]) || cardArea.columns;
        const colW = cardArea.width / cols;

        // 이 행의 열 구분선
        for (let c = 1; c < cols; c++) {
          const cx = cardArea.x + c * colW;
          const line = doc.createElementNS("http://www.w3.org/2000/svg", "line");
          line.setAttribute("x1", String(cx));
          line.setAttribute("y1", String(cardArea.y + yOff));
          line.setAttribute("x2", String(cx));
          line.setAttribute("y2", String(cardArea.y + yOff + h));
          line.setAttribute("stroke", "rgba(0,200,255,0.35)");
          line.setAttribute("stroke-width", "1");
          applyOverlayStroke(line);
          g.appendChild(line);
        }

        yOff += h;
        if (i < rowCount - 1) {
          const line = doc.createElementNS("http://www.w3.org/2000/svg", "line");
          line.setAttribute("x1", String(cardArea.x));
          line.setAttribute("y1", String(cardArea.y + yOff));
          line.setAttribute("x2", String(cardArea.x + cardArea.width));
          line.setAttribute("y2", String(cardArea.y + yOff));
          line.setAttribute("stroke", "rgba(0,200,255,0.35)");
          line.setAttribute("stroke-width", "1");
          applyOverlayStroke(line);
          g.appendChild(line);
        }
      }

      // 라벨
      const maxCols = rowColumns.length > 0
        ? Math.max(...rowColumns.map((c) => parseInt(c) || cardArea.columns))
        : cardArea.columns;
      const text = doc.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", String(cardArea.x + 5));
      text.setAttribute("y", String(cardArea.y + 12));
      text.setAttribute("fill", "rgba(0,200,255,0.9)");
      text.setAttribute("font-size", "10");
      text.setAttribute("font-weight", "700");
      text.setAttribute("font-family", "sans-serif");
      text.textContent = `카드 영역 (최대${maxCols}열×${rowCount}행)`;
      g.appendChild(text);
    }

    svg.appendChild(g);
    return new XMLSerializer().serializeToString(svg);
  }, [svgRaw, cardArea, rowCount, rowHeights, rowColumns, rowGaps, defaultRowH]);

  const displaySvg = useMemo(() => {
    return overlayedSvg
      .replace(/width="[^"]*"/, 'width="100%"')
      .replace(/height="[^"]*"/, 'height="auto"')
      .replace(/<svg/, '<svg style="max-width:100%;display:block"');
  }, [overlayedSvg]);

  return (
    <div
      className="mrm-svg-preview mrm-svg-preview--chassis"
      dangerouslySetInnerHTML={{ __html: displaySvg }}
    />
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
  const [activeTab, setActiveTab] = useState<"register" | "list">("register");

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
  const computedRowCount = caRowCount;

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
    setAssignedCardIds([]);
    setErrors({});
    setEditingModelId(null);
  }, []);

  // Load model into form for editing
  const loadModelForEdit = useCallback((modelId: string) => {
    const model = customModels.find((m) => m.modelId === modelId);
    if (!model) return;
    setEditingModelId(modelId);
    setModelName(model.modelName);
    setUnit(model.unit);
    setModelType(model.modelType);
    setModelSvgRaw(model.modelSvgRaw);
    setModelSvgFileName("(기존 파일)");
    setUseDualView(!!model.rearSvgRaw);
    setRearSvgRaw(model.rearSvgRaw || null);
    setRearSvgFileName(model.rearSvgRaw ? "(기존 파일)" : "");
    setDefaultViewSide(model.defaultViewSide || "front");
    setBaseChassisRaw(model.baseEquipmentViewSvgRaw || null);
    setBaseChassisFileName(model.baseEquipmentViewSvgRaw ? "(기존 파일)" : "");
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
    setAssignedCardIds(model.assignedCardIds || []);
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

  // File handlers
  const handleModelFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.name.toLowerCase().endsWith(".svg")) {
        setErrors((p) => ({ ...p, modelFile: "SVG 파일만 지원합니다." }));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setModelSvgRaw(reader.result as string);
        setModelSvgFileName(file.name);
        setErrors((p) => {
          const next = { ...p };
          delete next.modelFile;
          return next;
        });
      };
      reader.readAsText(file);
    },
    [],
  );

  const handleChassisFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.name.toLowerCase().endsWith(".svg")) {
        setErrors((p) => ({ ...p, chassisFile: "SVG 파일만 지원합니다." }));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setBaseChassisRaw(reader.result as string);
        setBaseChassisFileName(file.name);
      };
      reader.readAsText(file);
    },
    [],
  );

  const handleRearFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.name.toLowerCase().endsWith(".svg")) {
        setErrors((p) => ({ ...p, rearFile: "SVG 파일만 지원합니다." }));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setRearSvgRaw(reader.result as string);
        setRearSvgFileName(file.name);
        setErrors((p) => {
          const next = { ...p };
          delete next.rearFile;
          return next;
        });
      };
      reader.readAsText(file);
    },
    [],
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

  // Submit
  const handleSubmit = useCallback(() => {
    const newErrors: Record<string, string> = {};
    if (!modelName.trim()) newErrors.modelName = "모델명을 입력하세요.";
    if (unit < 1 || unit > 48) newErrors.unit = "1~48 사이의 값을 입력하세요.";
    if (!modelSvgRaw) newErrors.modelFile = "모델 SVG 파일을 업로드하세요.";
    if (useDualView && !rearSvgRaw) newErrors.rearFile = "뒷면 SVG 파일을 업로드하세요.";
    if (modelType === "card-based" && !baseChassisRaw) {
      newErrors.chassisFile = "기본 섀시 SVG 파일을 업로드하세요.";
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

    const payload: Omit<import("../../types/equipment").CustomEquipmentModel, "modelId"> = {
      modelName: modelName.trim(),
      unit,
      displayName: `[${unit}U] ${modelName.trim()}`,
      modelSvgRaw: modelSvgRaw!,
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
      rowHeights: modelType === "card-based" && parsedRowHeights.length > 0 ? parsedRowHeights : undefined,
      rowColumns: modelType === "card-based" && parsedRowColumns.length > 0 ? parsedRowColumns : undefined,
      rowGaps: modelType === "card-based" && parsedRowGaps.some((g) => g !== 0) ? parsedRowGaps : undefined,
      equipmentSize: { width: dims.width, height: dims.height },
      assignedCardIds: modelType === "card-based" ? assignedCardIds : [],
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
  }, [
    modelName,
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
    assignedCardIds,
    editingModelId,
    customModels,
    addCustomModel,
    updateCustomModel,
    displayName,
    showToastMsg,
    resetForm,
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

        {/* Tabs */}
        <div style={{ padding: "16px 28px 0" }}>
          <div className="mrm-tabs">
            <button
              className={`mrm-tab ${activeTab === "register" ? "active" : ""}`}
              onClick={() => setActiveTab("register")}
            >
              {editingModelId ? "✏️ 모델 수정" : "새 모델 등록"}
            </button>
            <button
              className={`mrm-tab ${activeTab === "list" ? "active" : ""}`}
              onClick={() => setActiveTab("list")}
            >
              등록된 모델 ({DEVICE_TEMPLATES.filter((t) => !deletedDefaultTemplates.includes(t.modelName)).length + customModels.length})
            </button>
          </div>
        </div>

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

                <div className="mrm-form-grid">
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
                </div>

                {/* Display Name Preview */}
                {displayName && (
                  <div className="mrm-display-preview" style={{ marginTop: 16 }}>
                    <span className="preview-label">표시 이름 →</span>
                    <span className="preview-value">{displayName}</span>
                  </div>
                )}
              </div>

              {/* Model Type */}
              <div className="mrm-section">
                <div className="mrm-section-title">모델 타입</div>
                <div className="mrm-type-selector">
                  <div
                    className={`mrm-type-card ${modelType === "normal" ? "active" : ""}`}
                    onClick={() => setModelType("normal")}
                  >
                    <div className="type-icon">📦</div>
                    <div className="type-name">일반 장비</div>
                    <div className="type-desc">
                      단일 바디 장비<br />
                      모델 파일만 필요
                    </div>
                  </div>
                  <div
                    className={`mrm-type-card ${modelType === "card-based" ? "active" : ""}`}
                    onClick={() => setModelType("card-based")}
                  >
                    <div className="type-icon">🗂️</div>
                    <div className="type-name">카드 기반 장비</div>
                    <div className="type-desc">
                      카드 삽입 가능한 장비<br />
                      섀시 + 카드 구성
                    </div>
                  </div>
                </div>
              </div>

              {/* Model SVG Upload */}
              <div className="mrm-section">
                <div className="mrm-section-title">
                  모델 파일 업로드
                  <span className="badge">SVG</span>
                </div>

                <input
                  type="file"
                  accept=".svg"
                  ref={modelFileRef}
                  style={{ display: "none" }}
                  onChange={handleModelFileChange}
                />
                <input
                  type="file"
                  accept=".svg"
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
                    <div
                      className={`mrm-file-upload ${modelSvgRaw ? "has-file" : ""}`}
                      onClick={() => modelFileRef.current?.click()}
                    >
                      {modelSvgRaw ? (
                        <>
                          <div className="file-name">✓ {modelSvgFileName}</div>
                          <div className="upload-hint">클릭하여 변경</div>
                        </>
                      ) : (
                        <>
                          <div className="upload-icon">📁</div>
                          <div className="upload-text">
                            장비 모델 SVG 파일을 업로드하세요
                          </div>
                          <div className="upload-hint">
                            클릭하거나 파일을 선택하세요
                          </div>
                        </>
                      )}
                    </div>
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
                      <div className="mrm-side-title">
                        <label>
                          <input
                            type="radio"
                            checked={defaultViewSide === "front"}
                            onChange={() => setDefaultViewSide("front")}
                          />
                          앞면
                        </label>
                        {defaultViewSide === "front" && <span>기본</span>}
                      </div>
                      <div
                        className={`mrm-file-upload mrm-file-upload--compact ${modelSvgRaw ? "has-file" : ""}`}
                        onClick={() => modelFileRef.current?.click()}
                      >
                        {modelSvgRaw ? (
                          <>
                            <div className="file-name">✓ {modelSvgFileName}</div>
                            <div className="upload-hint">앞면 SVG 변경</div>
                          </>
                        ) : (
                          <>
                            <div className="upload-text">앞면 SVG 업로드</div>
                            <div className="upload-hint">장비 전면 이미지</div>
                          </>
                        )}
                      </div>
                      {errors.modelFile && (
                        <span className="error-hint" style={{ marginTop: 4, display: "block" }}>
                          {errors.modelFile}
                        </span>
                      )}
                      <div className="mrm-side-preview">
                        {modelSvgRaw ? <SvgPreview svgRaw={modelSvgRaw} maxHeight={220} /> : (
                          <div className="mrm-side-empty">앞면 SVG를 업로드하세요.</div>
                        )}
                      </div>
                    </div>

                    <div className={`mrm-side-panel ${defaultViewSide === "rear" ? "is-default" : ""}`}>
                      <div className="mrm-side-title">
                        <label>
                          <input
                            type="radio"
                            checked={defaultViewSide === "rear"}
                            disabled={!rearSvgRaw}
                            onChange={() => setDefaultViewSide("rear")}
                          />
                          뒷면
                        </label>
                        {defaultViewSide === "rear" && <span>기본</span>}
                      </div>
                      <div
                        className={`mrm-file-upload mrm-file-upload--compact ${rearSvgRaw ? "has-file" : ""}`}
                        onClick={() => rearFileRef.current?.click()}
                      >
                        {rearSvgRaw ? (
                          <>
                            <div className="file-name">✓ {rearSvgFileName}</div>
                            <div className="upload-hint">클릭하여 변경</div>
                          </>
                        ) : (
                          <>
                            <div className="upload-text">뒷면 SVG 업로드</div>
                            <div className="upload-hint">장비 후면 이미지</div>
                          </>
                        )}
                      </div>
                      {errors.rearFile && (
                        <span className="error-hint" style={{ marginTop: 4, display: "block" }}>
                          {errors.rearFile}
                        </span>
                      )}
                      <div className="mrm-side-preview">
                        {rearSvgRaw ? <SvgPreview svgRaw={rearSvgRaw} maxHeight={220} /> : (
                          <div className="mrm-side-empty">뒷면 SVG를 업로드하세요.</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Card-based Configuration */}
              {modelType === "card-based" && (
                <>
                  {/* Base Chassis SVG */}
                  <div className="mrm-section">
                    <div className="mrm-section-title">
                      기본 섀시 (Base Equipment View)
                      <span className="badge">카드 기반</span>
                    </div>

                    <input
                      type="file"
                      accept=".svg"
                      ref={chassisFileRef}
                      style={{ display: "none" }}
                      onChange={handleChassisFileChange}
                    />
                    <div
                      className={`mrm-file-upload ${baseChassisRaw ? "has-file" : ""}`}
                      onClick={() => chassisFileRef.current?.click()}
                    >
                      {baseChassisRaw ? (
                        <>
                          <div className="file-name">
                            ✓ {baseChassisFileName}
                          </div>
                          <div className="upload-hint">클릭하여 변경</div>
                        </>
                      ) : (
                        <>
                          <div className="upload-icon">🖼️</div>
                          <div className="upload-text">
                            기본 섀시 SVG 파일을 업로드하세요
                          </div>
                          <div className="upload-hint">
                            카드가 삽입되는 빈 장비 바디
                          </div>
                        </>
                      )}
                    </div>
                    {errors.chassisFile && (
                      <span className="error-hint" style={{ marginTop: 4, display: "block" }}>
                        {errors.chassisFile}
                      </span>
                    )}

                    {baseChassisRaw && (
                      <ChassisPreviewWithOverlay
                        svgRaw={baseChassisRaw}
                        cardArea={{ x: caX, y: caY, width: caWidth, height: caHeight, columns: caColumns, columnWidth: caColWidth }}
                        rowCount={computedRowCount}
                        rowHeights={rowHeights}
                        rowColumns={rowColumnsArr}
                        rowGaps={rowGapsArr}
                        defaultRowH={defaultRowHeight}
                      />
                    )}
                  </div>

                  {/* Card Area Configuration */}
                  <div className="mrm-section">
                    <div className="mrm-section-title">
                      카드 영역 설정
                      <span className="badge">좌표</span>
                    </div>

                    <div className="mrm-card-area-grid">
                      <div className="mrm-field">
                        <label>X 위치</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={caXStr}
                          onChange={(e) => setCaXStr(e.target.value)}
                        />
                      </div>
                      <div className="mrm-field">
                        <label>Y 위치</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={caYStr}
                          onChange={(e) => setCaYStr(e.target.value)}
                        />
                      </div>
                      <div className="mrm-field">
                        <label>너비</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={caWidthStr}
                          onChange={(e) => setCaWidthStr(e.target.value)}
                        />
                      </div>
                      <div className="mrm-field">
                        <label>높이</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={caHeightStr}
                          onChange={(e) => {
                            setCaHeightStr(e.target.value);
                          }}
                        />
                      </div>
                      <div className="mrm-field">
                        <label>행 수</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={caRowCountStr}
                          onChange={(e) => {
                            setCaRowCountStr(e.target.value);
                            const count = parseInt(e.target.value);
                            if (count > 0) syncRowHeights(count);
                          }}
                        />
                      </div>
                    </div>

                    {/* Row Configuration: 행별 높이 + 열 수 */}
                    {computedRowCount > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <div style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          marginBottom: 8,
                        }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                            행별 설정 ({computedRowCount}행)
                          </div>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={uniformRowHeight}
                              onChange={(e) => setUniformRowHeight(e.target.value)}
                              style={{
                                width: 44, height: 28, padding: "0 4px",
                                border: "1px solid var(--border-medium)",
                                borderRadius: 6, fontSize: 11,
                                background: "var(--bg-tertiary)", color: "var(--text-primary)",
                                textAlign: "center",
                              }}
                              placeholder="높이"
                              title="높이 통일값"
                            />
                            <input
                              type="text"
                              inputMode="numeric"
                              value={uniformRowColumns}
                              onChange={(e) => setUniformRowColumns(e.target.value)}
                              style={{
                                width: 44, height: 28, padding: "0 4px",
                                border: "1px solid var(--border-medium)",
                                borderRadius: 6, fontSize: 11,
                                background: "var(--bg-tertiary)", color: "var(--text-primary)",
                                textAlign: "center",
                              }}
                              placeholder="열 수"
                              title="열 수 통일값"
                            />
                            <input
                              type="text"
                              inputMode="decimal"
                              value={uniformRowGap}
                              onChange={(e) => setUniformRowGap(e.target.value)}
                              style={{
                                width: 44, height: 28, padding: "0 4px",
                                border: "1px solid var(--border-medium)",
                                borderRadius: 6, fontSize: 11,
                                background: "var(--bg-tertiary)", color: "var(--text-primary)",
                                textAlign: "center",
                              }}
                              placeholder="간격"
                              title="간격 통일값"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const count = computedRowCount;
                                setRowHeights(Array.from({ length: count }, () => uniformRowHeight || "46"));
                                setRowColumnsArr(Array.from({ length: count }, () => uniformRowColumns || "2"));
                                setRowGapsArr(Array.from({ length: Math.max(0, count - 1) }, () => uniformRowGap || "0"));
                              }}
                              style={{
                                height: 28, padding: "0 10px", fontSize: 11, fontWeight: 600,
                                border: "1px solid var(--border-medium)", borderRadius: 6,
                                background: "var(--bg-tertiary)", color: "var(--text-primary)",
                                cursor: "pointer", whiteSpace: "nowrap",
                              }}
                            >
                              전체 통일
                            </button>
                          </div>
                        </div>
                        {/* Column Headers */}
                        <div style={{
                          display: "grid", gridTemplateColumns: "32px 1fr 1fr 1fr 1fr",
                          gap: 6, marginBottom: 4,
                        }}>
                          <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 700, textAlign: "center" }}></span>
                          <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 700, textAlign: "center" }}>높이</span>
                          <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 700, textAlign: "center" }}>열 수</span>
                          <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 700, textAlign: "center" }}>열 너비</span>
                          <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontWeight: 700, textAlign: "center" }}>간격</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {Array.from({ length: computedRowCount }).map((_, i) => {
                            const rowCols = parseInt(rowColumnsArr[i]) || caColumns;
                            const rowColWidth = caWidth > 0 && rowCols > 0 ? Math.round(caWidth / rowCols) : 0;
                            const isLastRow = i === computedRowCount - 1;
                            return (
                              <div key={i} style={{
                                display: "grid", gridTemplateColumns: "32px 1fr 1fr 1fr 1fr",
                                gap: 6, alignItems: "center",
                              }}>
                                <span style={{
                                  fontSize: 11, color: "var(--text-tertiary)", fontWeight: 600,
                                  textAlign: "center",
                                }}>R{i + 1}</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={rowHeights[i] ?? String(defaultRowHeight)}
                                  onChange={(e) => {
                                    setRowHeights((prev) => {
                                      const next = [...prev];
                                      while (next.length <= i) next.push(String(defaultRowHeight));
                                      next[i] = e.target.value;
                                      return next;
                                    });
                                  }}
                                  style={{
                                    width: "100%", height: 30, padding: "0 8px",
                                    border: "1px solid var(--border-weak)",
                                    borderRadius: 6, fontSize: 12,
                                    background: "var(--bg-primary)", color: "var(--text-primary)",
                                    textAlign: "center",
                                  }}
                                />
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={rowColumnsArr[i] ?? caColumnsStr}
                                  onChange={(e) => {
                                    setRowColumnsArr((prev) => {
                                      const next = [...prev];
                                      while (next.length <= i) next.push(caColumnsStr);
                                      next[i] = e.target.value;
                                      return next;
                                    });
                                  }}
                                  style={{
                                    width: "100%", height: 30, padding: "0 8px",
                                    border: "1px solid var(--border-weak)",
                                    borderRadius: 6, fontSize: 12,
                                    background: "var(--bg-primary)", color: "var(--text-primary)",
                                    textAlign: "center",
                                  }}
                                />
                                <div style={{
                                  height: 30, display: "flex", alignItems: "center",
                                  justifyContent: "center", fontSize: 12,
                                  color: "var(--text-tertiary)",
                                  background: "var(--bg-tertiary)", borderRadius: 6,
                                  border: "1px solid var(--border-weak)",
                                }}>
                                  {rowColWidth}px
                                </div>
                                {isLastRow ? (
                                  <div style={{
                                    height: 30, display: "flex", alignItems: "center",
                                    justifyContent: "center", fontSize: 11,
                                    color: "var(--text-tertiary)", opacity: 0.4,
                                  }}>
                                    —
                                  </div>
                                ) : (
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={rowGapsArr[i] ?? "0"}
                                    onChange={(e) => {
                                      setRowGapsArr((prev) => {
                                        const next = [...prev];
                                        while (next.length <= i) next.push("0");
                                        next[i] = e.target.value;
                                        return next;
                                      });
                                    }}
                                    style={{
                                      width: "100%", height: 30, padding: "0 8px",
                                      border: "1px solid var(--border-weak)",
                                      borderRadius: 6, fontSize: 12,
                                      background: "var(--bg-primary)", color: "var(--text-primary)",
                                      textAlign: "center",
                                    }}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Assignment */}
                  <div className="mrm-section">
                    <div className="mrm-section-title">카드 할당</div>

                    <div className="mrm-card-config">
                      {/* Assigned cards */}
                      <div className="mrm-card-list">
                        {assignedCardDetails.length > 0 ? (
                          assignedCardDetails.map((card) => (
                            <div key={card.id} className="mrm-card-item">
                              <div className="card-preview" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {card.isBuiltIn ? (
                                  <img
                                    src={card.svgUrl}
                                    alt={card.name}
                                    style={{ width: "60px", height: "30px", objectFit: "contain" }}
                                  />
                                ) : (
                                  <div
                                    dangerouslySetInnerHTML={{
                                      __html: card.svgRaw
                                        ? card.svgRaw
                                          .replace(/width="[^"]*"/, 'width="60"')
                                          .replace(/height="[^"]*"/, 'height="30"')
                                        : "",
                                    }}
                                  />
                                )}
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
                                <Icon icon="material-symbols:delete" className="icon" style={DELETE_ICON_STYLE} />
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
                              >
                                <div
                                  style={{
                                    height: 30,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    overflow: "hidden",
                                    borderRadius: 4,
                                    background: "var(--bg-tertiary)",
                                  }}
                                >
                                  {card.isBuiltIn ? (
                                    <img
                                      src={card.svgUrl}
                                      alt={card.name}
                                      style={{ width: "100%", height: "30px", objectFit: "contain" }}
                                    />
                                  ) : (
                                    <div
                                      style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}
                                      dangerouslySetInnerHTML={{
                                        __html: card.svgRaw
                                          ? card.svgRaw
                                            .replace(/width="[^"]*"/, 'width="100%"')
                                            .replace(/height="[^"]*"/, 'height="30"')
                                          : "",
                                      }}
                                    />
                                  )}
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
                </>
              )}
            </div>

            {/* Footer */}
            <div className="mrm-actions">
              {editingModelId && (
                <button className="mrm-btn secondary" onClick={() => { resetForm(); }}>
                  신규 등록으로 전환
                </button>
              )}
              <button className="mrm-btn secondary" onClick={() => { resetForm(); setOpen(false); }}>
                취소
              </button>
              <button
                className="mrm-btn primary"
                disabled={!modelName.trim() || !modelSvgRaw || (useDualView && !rearSvgRaw)}
                onClick={handleSubmit}
              >
                {editingModelId ? "모델 수정" : "모델 등록"}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Body: Registered Models List */}
            <div className="mrm-body">
              {/* Default (Built-in) Models */}
              <div style={{ marginBottom: 8 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)",
                  textTransform: "uppercase", letterSpacing: "0.05em",
                  padding: "8px 0 6px", borderBottom: "1px solid var(--border-weak)",
                  marginBottom: 8,
                }}>
                  기본 장비 모델 ({DEVICE_TEMPLATES.filter((t) => !deletedDefaultTemplates.includes(t.modelName)).length})
                </div>
                <div className="mrm-models-list">
                  {DEVICE_TEMPLATES.filter((t) => !deletedDefaultTemplates.includes(t.modelName)).map((tmpl) => {
                    const imgUrl = resolveDeviceImage(tmpl.modelName);
                    return (
                      <div key={`default-${tmpl.modelName}`} className="mrm-model-row">
                        <div
                          className="model-thumb"
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "center",
                            width: 80, height: 40, background: "var(--bg-tertiary)",
                            borderRadius: 6, overflow: "hidden",
                          }}
                        >
                          {imgUrl ? (
                            <img
                              src={imgUrl}
                              alt={tmpl.modelName}
                              style={{ width: "100%", height: "100%", objectFit: "contain" }}
                            />
                          ) : (
                            <span style={{ fontSize: 18, color: "var(--text-tertiary)" }}>🖥️</span>
                          )}
                        </div>
                        <div className="model-info">
                          <div className="model-display-name">
                            [{tmpl.uSize}U] {tmpl.modelName}
                          </div>
                          <div className="model-meta">
                            <span>{tmpl.uSize}U</span>
                            <span>·</span>
                            <span>{tmpl.vendor}</span>
                            <span>·</span>
                            <span>{tmpl.type}</span>
                          </div>
                        </div>
                        <span className="model-type-tag" style={{
                          background: "rgba(59,130,246,0.15)", color: "rgb(96,165,250)",
                        }}>
                          기본
                        </span>
                        <button
                          className="mrm-btn-sm"
                          onClick={async () => {
                            // 기본 장비를 편집 폼에 로드 (SVG 이미지 + 카드 영역 설정 포함)
                            setModelName(tmpl.modelName);
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
                              showToastMsg("기본 모델 정보와 이미지를 폼에 로드했습니다.", "success");
                            } else {
                              setModelSvgRaw(null);
                              setModelSvgFileName("");
                              showToastMsg("기본 모델 정보를 로드했습니다. SVG 파일을 업로드해주세요.", "success");
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
                          style={{ fontSize: 11, padding: "4px 10px", marginRight: 4 }}
                        >
                          ✏️ 수정
                        </button>
                        <button
                          className="card-remove"
                          onClick={() => {
                            removeDefaultTemplate(tmpl.modelName);
                            showToastMsg(`기본 모델 "[${tmpl.uSize}U] ${tmpl.modelName}" 삭제됨`, "success");
                          }}
                          title="모델 삭제"
                          aria-label="모델 삭제"
                        >
                          <Icon icon="material-symbols:delete" className="icon" style={DELETE_ICON_STYLE} />
                        </button>
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
                  커스텀 모델 ({customModels.length})
                </div>
                {customModels.length > 0 ? (
                  <div className="mrm-models-list">
                    {customModels.map((model) => (
                      <div key={model.modelId} className="mrm-model-row">
                        <div
                          className="model-thumb"
                          dangerouslySetInnerHTML={{
                            __html: (model.defaultViewSide === "rear" && model.rearSvgRaw ? model.rearSvgRaw : model.modelSvgRaw)
                              .replace(/width="[^"]*"/, 'width="80"')
                              .replace(/height="[^"]*"/, 'height="40"'),
                          }}
                        />
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
                                <span>카드 {model.assignedCardIds.length}개</span>
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
                        <span className={`model-type-tag ${model.modelType}`}>
                          {model.modelType === "normal" ? "일반" : "카드 기반"}
                        </span>
                        <button
                          className="mrm-btn-sm"
                          onClick={() => loadModelForEdit(model.modelId)}
                          title="모델 수정"
                          style={{ fontSize: 11, padding: "4px 10px", marginRight: 4 }}
                        >
                          ✏️ 수정
                        </button>
                        <button
                          className="card-remove"
                          onClick={() => handleDeleteModel(model.modelId)}
                          title="모델 삭제"
                          aria-label="모델 삭제"
                        >
                          <Icon icon="material-symbols:delete" className="icon" style={DELETE_ICON_STYLE} />
                        </button>
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
      </div>

      {/* Card Registration Sub-Modal */}
      <CardRegistrationForm
        open={isCardRegOpen}
        onClose={() => setIsCardRegOpen(false)}
        onSave={handleAddNewCard}
        maxColumns={maxColumns}
      />

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
