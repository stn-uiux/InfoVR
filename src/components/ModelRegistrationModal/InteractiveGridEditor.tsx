import React, { useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";

export interface GridMerge {
  r: number;
  c: number;
  rs: number; // rowSpan
  cs: number; // colSpan
}

interface InteractiveGridEditorProps {
  svgRef: React.RefObject<SVGSVGElement | null>;
  baseX: number;
  baseY: number;
  colWidths: number[];
  rowHeights: number[];
  rowGaps?: number[];
  merges: GridMerge[];
  toolbarContainer?: HTMLElement | null;
  onGridChange: (data: {
    colWidths: number[];
    rowHeights: number[];
    rowGaps?: number[];
    merges: GridMerge[];
    baseX?: number;
    baseY?: number;
  }) => void;
  onSave?: () => void;
}

function getSvgPoint(
  svgEl: SVGSVGElement,
  clientX: number,
  clientY: number
): { x: number; y: number } {
  const pt = svgEl.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svgEl.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const transformed = pt.matrixTransform(ctm.inverse());
  return { x: transformed.x, y: transformed.y };
}

/** Check if a cell (r,c) is covered by a merge (but not the anchor) */
function isCellCoveredByMerge(
  r: number,
  c: number,
  merges: GridMerge[]
): boolean {
  for (const m of merges) {
    if (r === m.r && c === m.c) continue; // anchor cell itself
    if (r >= m.r && r < m.r + m.rs && c >= m.c && c < m.c + m.cs) return true;
  }
  return false;
}

/** Get the merge that owns cell (r,c), or null */
function getMergeAt(
  r: number,
  c: number,
  merges: GridMerge[]
): GridMerge | null {
  for (const m of merges) {
    if (r >= m.r && r < m.r + m.rs && c >= m.c && c < m.c + m.cs) return m;
  }
  return null;
}

/** Get pixel position of column c start */
function colX(c: number, colWidths: number[], baseX: number): number {
  let x = baseX;
  for (let i = 0; i < c; i++) x += colWidths[i];
  return x;
}

/** Get pixel position of row r start */
function rowY(r: number, rowHeights: number[], baseY: number, rowGaps?: number[]): number {
  let y = baseY;
  for (let i = 0; i < r; i++) {
    y += rowHeights[i];
    if (rowGaps && rowGaps[i]) {
      y += rowGaps[i];
    }
  }
  return y;
}

function getTotalH(rowHeights: number[], rowGaps?: number[]): number {
  let h = rowHeights.reduce((a, b) => a + b, 0);
  if (rowGaps) {
    for (let i = 0; i < rowHeights.length - 1; i++) {
      if (rowGaps[i]) h += rowGaps[i];
    }
  }
  return h;
}

/** Check if selected cells form a valid rectangle */
function getSelectionRect(
  selected: Set<string>
): { minR: number; maxR: number; minC: number; maxC: number } | null {
  if (selected.size === 0) return null;
  let minR = Infinity,
    maxR = -Infinity,
    minC = Infinity,
    maxC = -Infinity;
  for (const key of selected) {
    const [r, c] = key.split("-").map(Number);
    minR = Math.min(minR, r);
    maxR = Math.max(maxR, r);
    minC = Math.min(minC, c);
    maxC = Math.max(maxC, c);
  }
  // Check that all cells in the rectangle are selected
  const expectedCount = (maxR - minR + 1) * (maxC - minC + 1);
  if (selected.size !== expectedCount) return null;
  return { minR, maxR, minC, maxC };
}

export default function InteractiveGridEditor({
  svgRef,
  baseX,
  baseY,
  colWidths,
  rowHeights,
  rowGaps,
  merges,
  toolbarContainer,
  onGridChange,
  onSave,
}: InteractiveGridEditorProps) {
    const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [dragType, setDragType] = useState<"col" | "row" | "move" | "edge-t" | "edge-b" | "edge-l" | "edge-r" | null>(null);
  const [dragIndex, setDragIndex] = useState(0);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [dragStartGrid, setDragStartGrid] = useState({ baseX: 0, baseY: 0, colWidths: [] as number[], rowHeights: [] as number[] });
  const isDragging = useRef(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; r: number } | null>(null);

  const [invScale, setInvScale] = useState(1);

  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  React.useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const updateScale = () => {
      const vb = svg.viewBox.baseVal;
      if (!vb || vb.width === 0 || vb.height === 0) return;
      const rect = svg.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const scaleX = rect.width / vb.width;
        const scaleY = rect.height / vb.height;
        const scale = Math.min(scaleX, scaleY);
        setInvScale(1 / scale);
      }
    };

    updateScale();
    const resizeObserver = new ResizeObserver(() => {
      updateScale();
    });
    resizeObserver.observe(svg);

    return () => resizeObserver.disconnect();
  }, [svgRef]);

  const rows = rowHeights.length;
  const cols = colWidths.length;
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  const totalH = getTotalH(rowHeights, rowGaps);

  // ── Divider dragging ──
  // ── Divider & Edge & Move dragging ──
  const handleDragStart = useCallback(
    (e: React.PointerEvent, type: "col" | "row" | "move" | "edge-t" | "edge-b" | "edge-l" | "edge-r", index: number = 0) => {
      e.stopPropagation();
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;

      isDragging.current = true;
      setDragType(type);
      setDragIndex(index);
      setDragStartGrid({ baseX, baseY, colWidths: [...colWidths], rowHeights: [...rowHeights] });

      const pt = getSvgPoint(svg, e.clientX, e.clientY);
      setDragStartPos({ x: pt.x, y: pt.y });

      (e.target as Element).setPointerCapture(e.pointerId);
    },
    [svgRef, baseX, baseY, colWidths, rowHeights]
  );

  const handleDragMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current || !dragType) return;
      const svg = svgRef.current;
      if (!svg) return;

      const pt = getSvgPoint(svg, e.clientX, e.clientY);
      const dx = pt.x - dragStartPos.x;
      const dy = pt.y - dragStartPos.y;
      const MIN_SIZE = 10;
      const vb = svg.viewBox.baseVal;
      const maxW = vb && vb.width > 0 ? vb.width : 800;
      const maxH = vb && vb.height > 0 ? vb.height : 200;

      if (dragType === "move") {
        const totalW = colWidths.reduce((a, b) => a + b, 0);
        const totalH = getTotalH(rowHeights, rowGaps);
        let newX = dragStartGrid.baseX + dx;
        let newY = dragStartGrid.baseY + dy;
        
        if (newX < 0) newX = 0;
        if (newY < 0) newY = 0;
        if (newX + totalW > maxW) newX = maxW - totalW;
        if (newY + totalH > maxH) newY = maxH - totalH;

        onGridChange({
          colWidths, rowHeights, merges,
          baseX: newX,
          baseY: newY
        });
        return;
      }

      if (dragType.startsWith("edge-")) {
        const totalW = dragStartGrid.colWidths.reduce((a, b) => a + b, 0);
        const totalH = getTotalH(dragStartGrid.rowHeights, rowGaps);
        let newBaseX = dragStartGrid.baseX;
        let newBaseY = dragStartGrid.baseY;
        let newW = totalW;
        let newH = totalH;

        if (dragType === "edge-r") {
          newW = Math.max(MIN_SIZE * colWidths.length, totalW + dx);
          if (newBaseX + newW > maxW) newW = maxW - newBaseX;
        } else if (dragType === "edge-b") {
          newH = Math.max(MIN_SIZE * rowHeights.length, totalH + dy);
          if (newBaseY + newH > maxH) newH = maxH - newBaseY;
        } else if (dragType === "edge-l") {
          newW = Math.max(MIN_SIZE * colWidths.length, totalW - dx);
          let potentialBaseX = dragStartGrid.baseX + (totalW - newW);
          if (potentialBaseX < 0) {
            potentialBaseX = 0;
            newW = totalW + dragStartGrid.baseX; // Expand to the max possible on the left
          }
          newBaseX = potentialBaseX;
        } else if (dragType === "edge-t") {
          newH = Math.max(MIN_SIZE * rowHeights.length, totalH - dy);
          let potentialBaseY = dragStartGrid.baseY + (totalH - newH);
          if (potentialBaseY < 0) {
            potentialBaseY = 0;
            newH = totalH + dragStartGrid.baseY;
          }
          newBaseY = potentialBaseY;
        }
        
        if (dragType === "edge-r" || dragType === "edge-l") {
          const scale = newW / totalW;
          onGridChange({ 
            colWidths: dragStartGrid.colWidths.map(w => Math.round(w * scale)), 
            rowHeights, merges,
            baseX: newBaseX
          });
        } else {
          const baseH = dragStartGrid.rowHeights.reduce((a, b) => a + b, 0);
          const totalGaps = totalH - baseH;
          const scale = baseH > 0 ? Math.max(0.1, newH - totalGaps) / baseH : 1;
          onGridChange({ 
            colWidths, 
            rowHeights: dragStartGrid.rowHeights.map(h => Math.round(h * scale)), 
            merges,
            baseY: newBaseY
          });
        }
        return;
      }

      const delta = dragType === "col" ? dx : dy;
      const i = dragIndex;
      let newColWidths = [...colWidths];
      let newRowHeights = [...rowHeights];

      if (dragType === "col") {
        const sizes = [...dragStartGrid.colWidths];
        const selectedCols = new Set<number>();
        selectedCells.forEach(k => selectedCols.add(Number(k.split('-')[1])));
        
        let targetSize = -1;
        if (selectedCols.size > 1) {
          if (selectedCols.has(i)) targetSize = Math.max(MIN_SIZE, sizes[i] + delta);
          else if (selectedCols.has(i + 1)) targetSize = Math.max(MIN_SIZE, sizes[i + 1] - delta);
        }
        
        if (targetSize !== -1) {
          newColWidths = sizes.map((s, c) => selectedCols.has(c) ? Math.round(targetSize) : s);
        } else {
          const newA = sizes[i] + delta;
          const newB = sizes[i + 1] - delta;
          if (newA >= MIN_SIZE && newB >= MIN_SIZE) {
            sizes[i] = Math.round(newA);
            sizes[i + 1] = Math.round(newB);
            newColWidths = sizes;
          }
        }
      } else {
        const sizes = [...dragStartGrid.rowHeights];
        const selectedRows = new Set<number>();
        selectedCells.forEach(k => selectedRows.add(Number(k.split('-')[0])));
        
        let targetSize = -1;
        if (selectedRows.size > 1) {
          if (selectedRows.has(i)) targetSize = Math.max(MIN_SIZE, sizes[i] + delta);
          else if (selectedRows.has(i + 1)) targetSize = Math.max(MIN_SIZE, sizes[i + 1] - delta);
        }
        
        if (targetSize !== -1) {
          newRowHeights = sizes.map((s, r) => selectedRows.has(r) ? Math.round(targetSize) : s);
        } else {
          const newA = sizes[i] + delta;
          const newB = sizes[i + 1] - delta;
          if (newA >= MIN_SIZE && newB >= MIN_SIZE) {
            sizes[i] = Math.round(newA);
            sizes[i + 1] = Math.round(newB);
            newRowHeights = sizes;
          }
        }
      }

      onGridChange({ colWidths: newColWidths, rowHeights: newRowHeights, merges });
    },
    [dragType, dragIndex, dragStartPos, dragStartGrid, svgRef, colWidths, rowHeights, merges, selectedCells, onGridChange]
  );

  const handleDragEnd = useCallback(
    (e: React.PointerEvent) => {
      isDragging.current = false;
      if (dragType === "move") {
        const svg = svgRef.current;
        if (svg) {
          const pt = getSvgPoint(svg, e.clientX, e.clientY);
          const dx = pt.x - dragStartPos.x;
          const dy = pt.y - dragStartPos.y;
          // If moved less than 3px, treat as click and let onClick handle it
          // Wait, onClick fires independently of onPointerUp, but setting dragType null here might interfere if we need it.
        }
      }
      setDragType(null);
      (e.target as Element).releasePointerCapture(e.pointerId);
    },
    [dragType, dragStartPos, svgRef]
  );

  // ── Cell selection ──
  const handleCellClick = useCallback(
    (r: number, c: number, e: React.MouseEvent) => {
      e.stopPropagation();
      const key = `${r}-${c}`;
      setSelectedCells((prev) => {
        const next = new Set(prev);
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          if (next.has(key)) next.delete(key);
          else next.add(key);
        } else {
          if (next.size === 1 && next.has(key)) {
            next.clear();
          } else {
            next.clear();
            next.add(key);
          }
        }
        return next;
      });
    },
    []
  );

  const handleContextMenu = useCallback((e: React.MouseEvent, r: number) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, r });
  }, []);

  // ── Merge ──
  const handleMerge = useCallback(() => {
    const rect = getSelectionRect(selectedCells);
    if (!rect) return;
    const { minR, maxR, minC, maxC } = rect;
    if (minR === maxR && minC === maxC) return;

    const newMerges = merges.filter((m) => {
      return !(
        m.r >= minR &&
        m.r + m.rs - 1 <= maxR &&
        m.c >= minC &&
        m.c + m.cs - 1 <= maxC
      );
    });

    newMerges.push({
      r: minR,
      c: minC,
      rs: maxR - minR + 1,
      cs: maxC - minC + 1,
    });

    onGridChange({ colWidths, rowHeights, merges: newMerges });
    setSelectedCells(new Set());
  }, [selectedCells, merges, colWidths, rowHeights, onGridChange]);

  // ── Split ──
  const handleSplit = useCallback(() => {
    if (selectedCells.size !== 1) return;
    const [key] = selectedCells;
    const [r, c] = key.split("-").map(Number);
    const merge = getMergeAt(r, c, merges);
    if (!merge) return;

    const newMerges = merges.filter((m) => m !== merge);
    onGridChange({ colWidths, rowHeights, merges: newMerges });
    setSelectedCells(new Set());
  }, [selectedCells, merges, colWidths, rowHeights, onGridChange]);

  // ── Add row ──
  const handleAddRow = useCallback(() => {
    const totalH = getTotalH(rowHeights, rowGaps) || 46;
    const newCount = rowHeights.length + 1;
    const newH = Array.from({ length: newCount }, () => Math.round(totalH / newCount));
    onGridChange({ colWidths, rowHeights: newH, merges });
  }, [colWidths, rowHeights, merges, onGridChange]);

  // ── Add column ──
  const handleAddCol = useCallback(() => {
    const totalW = colWidths.reduce((a, b) => a + b, 0) || 100;
    const newCount = colWidths.length + 1;
    const newW = Array.from({ length: newCount }, () => Math.round(totalW / newCount));
    onGridChange({ colWidths: newW, rowHeights, merges });
  }, [colWidths, rowHeights, merges, onGridChange]);

  // ── Delete row ──
  const handleDeleteRow = useCallback(() => {
    if (rowHeights.length <= 1) return;
    const totalH = getTotalH(rowHeights, rowGaps);
    const newCount = rowHeights.length - 1;
    const newH = Array.from({ length: newCount }, () => Math.round(totalH / newCount));
    
    const lastRow = rowHeights.length - 1;
    const newMerges = merges
      .filter((m) => m.r < lastRow)
      .map((m) => {
        if (m.r + m.rs - 1 >= lastRow) {
          return { ...m, rs: lastRow - m.r };
        }
        return m;
      })
      .filter((m) => m.rs > 0);
    onGridChange({ colWidths, rowHeights: newH, merges: newMerges });
    setSelectedCells(new Set());
  }, [colWidths, rowHeights, merges, onGridChange]);

  // ── Delete column ──
  const handleDeleteCol = useCallback(() => {
    if (colWidths.length <= 1) return;
    const totalW = colWidths.reduce((a, b) => a + b, 0);
    const newCount = colWidths.length - 1;
    const newW = Array.from({ length: newCount }, () => Math.round(totalW / newCount));
    
    const lastCol = colWidths.length - 1;
    const newMerges = merges
      .filter((m) => m.c < lastCol)
      .map((m) => {
        if (m.c + m.cs - 1 >= lastCol) {
          return { ...m, cs: lastCol - m.c };
        }
        return m;
      })
      .filter((m) => m.cs > 0);
    onGridChange({ colWidths: newW, rowHeights, merges: newMerges });
    setSelectedCells(new Set());
  }, [colWidths, rowHeights, merges, onGridChange]);

  // Compute which merge button to show
  const selectionRect = getSelectionRect(selectedCells);
  const canMerge =
    selectionRect !== null &&
    (selectionRect.maxR > selectionRect.minR || selectionRect.maxC > selectionRect.minC);
  const canSplit = (() => {
    if (selectedCells.size !== 1) return false;
    const [key] = selectedCells;
    const [r, c] = key.split("-").map(Number);
    const m = getMergeAt(r, c, merges);
    return m !== null && (m.rs > 1 || m.cs > 1);
  })();

  // ── Render cells ──
  const cellRects: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (isCellCoveredByMerge(r, c, merges)) continue;
      const merge = getMergeAt(r, c, merges);
      const rs = merge ? merge.rs : 1;
      const cs = merge ? merge.cs : 1;

      const x = colX(c, colWidths, baseX);
      const y = rowY(r, rowHeights, baseY, rowGaps);
      let w = 0;
      for (let ci = c; ci < c + cs && ci < cols; ci++) w += colWidths[ci];
      let h = 0;
      for (let ri = r; ri < r + rs && ri < rows; ri++) h += rowHeights[ri];

      const key = `${r}-${c}`;
      const isSelected = selectedCells.has(key);
      let mergeSelected = isSelected;
      if (merge) {
        for (let ri = merge.r; ri < merge.r + merge.rs; ri++) {
          for (let ci = merge.c; ci < merge.c + merge.cs; ci++) {
            if (selectedCells.has(`${ri}-${ci}`)) mergeSelected = true;
          }
        }
      }

      cellRects.push(
        <rect
          key={`cell-${r}-${c}`}
          x={x}
          y={y}
          width={w}
          height={h}
          fill={mergeSelected ? "rgba(0,200,255,0.25)" : "rgba(0,200,255,0.06)"}
          stroke={mergeSelected ? "rgba(0,200,255,1)" : "rgba(0,200,255,0.5)"}
          strokeWidth={mergeSelected ? "2" : "1"}
          strokeDasharray={merge ? "none" : "4 2"}
          vectorEffect="non-scaling-stroke"
          style={{ cursor: "move" }}
          onPointerDown={(e) => handleDragStart(e, "move")}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onClick={(e) => handleCellClick(r, c, e)}
        />
      );

      // Cell label (dimensions)
      const cellText = (merge && (merge.rs > 1 || merge.cs > 1)) ? `${merge.rs}×${merge.cs} · ${Math.round(w)}×${Math.round(h)}` : `${Math.round(w)}×${Math.round(h)}`;
      const approxW = cellText.length * 6.5 * invScale + 12 * invScale;
      cellRects.push(
        <g key={`cell-label-${r}-${c}`} style={{ pointerEvents: "none" }}>
          <rect
            x={x + w / 2 - approxW / 2}
            y={y + h / 2 - 8 * invScale}
            width={approxW}
            height={18 * invScale}
            fill="rgba(0,0,0,0.6)"
            rx={4 * invScale}
          />
          <text
            x={x + w / 2}
            y={y + h / 2 + 4.5 * invScale}
            textAnchor="middle"
            fill="rgba(0,200,255,0.9)"
            fontSize={10 * invScale}
            fontWeight="600"
            fontFamily="sans-serif"
          >
            {cellText}
          </text>
        </g>
      );
    }
  }

  // ── Render vertical dividers (column) ──
  const HANDLE_WIDTH = 8;
  const colDividers: React.ReactNode[] = [];
  for (let c = 0; c < cols - 1; c++) {
    const x = colX(c + 1, colWidths, baseX);
    const lineSegments = [];
    for (let r = 0; r < rows; r++) {
      const m1 = getMergeAt(r, c, merges);
      const m2 = getMergeAt(r, c + 1, merges);
      if (m1 && m2 && m1 === m2) {
        continue; // skip line inside merge
      }
      const yStart = rowY(r, rowHeights, baseY, rowGaps);
      const yEnd = yStart + rowHeights[r];
      lineSegments.push(
        <line
          key={`col-div-seg-${c}-${r}`}
          x1={x}
          y1={yStart}
          x2={x}
          y2={yEnd}
          stroke="rgba(0,200,255,0.5)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: "none" }}
        />
      );
    }
    colDividers.push(
      <React.Fragment key={`col-div-${c}`}>
        {lineSegments}
        <rect
          x={x - HANDLE_WIDTH / 2}
          y={baseY}
          width={HANDLE_WIDTH}
          height={totalH}
          fill="transparent"
          style={{ cursor: "col-resize" }}
          onPointerDown={(e) => handleDragStart(e, "col", c)}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
        />
      </React.Fragment>
    );
  }

  // ── Render horizontal dividers (row) ──
  const rowDividers: React.ReactNode[] = [];
  for (let r = 0; r < rows - 1; r++) {
    const y = rowY(r, rowHeights, baseY, rowGaps) + rowHeights[r];
    const lineSegments = [];
    for (let c = 0; c < cols; c++) {
      const m1 = getMergeAt(r, c, merges);
      const m2 = getMergeAt(r + 1, c, merges);
      if (m1 && m2 && m1 === m2) {
        continue; // skip line inside merge
      }
      const xStart = colX(c, colWidths, baseX);
      const xEnd = xStart + colWidths[c];
      lineSegments.push(
        <line
          key={`row-div-seg-${r}-${c}`}
          x1={xStart}
          y1={y}
          x2={xEnd}
          y2={y}
          stroke="rgba(0,200,255,0.5)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: "none" }}
        />
      );
    }
    rowDividers.push(
      <React.Fragment key={`row-div-${r}`}>
        {lineSegments}
        <rect
          x={baseX}
          y={y - HANDLE_WIDTH / 2}
          width={totalW}
          height={HANDLE_WIDTH}
          fill="transparent"
          style={{ cursor: "row-resize" }}
          onPointerDown={(e) => handleDragStart(e, "row", r)}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onContextMenu={(e) => handleContextMenu(e, r)}
        />
      </React.Fragment>
    );
  }

    // ── Edge Resize Handles ──
  const HANDLE_EDGE = 12; // Thicker handle for easier dragging
  const edgeHandles = (
    <g>
      <rect x={baseX} y={baseY - HANDLE_EDGE/2} width={totalW} height={HANDLE_EDGE} fill="transparent" style={{ cursor: "ns-resize" }} onPointerDown={(e) => handleDragStart(e, "edge-t")} onPointerMove={handleDragMove} onPointerUp={handleDragEnd} />
      <rect x={baseX} y={baseY + totalH - HANDLE_EDGE/2} width={totalW} height={HANDLE_EDGE} fill="transparent" style={{ cursor: "ns-resize" }} onPointerDown={(e) => handleDragStart(e, "edge-b")} onPointerMove={handleDragMove} onPointerUp={handleDragEnd} />
      <rect x={baseX - HANDLE_EDGE/2} y={baseY} width={HANDLE_EDGE} height={totalH} fill="transparent" style={{ cursor: "ew-resize" }} onPointerDown={(e) => handleDragStart(e, "edge-l")} onPointerMove={handleDragMove} onPointerUp={handleDragEnd} />
      <rect x={baseX + totalW - HANDLE_EDGE/2} y={baseY} width={HANDLE_EDGE} height={totalH} fill="transparent" style={{ cursor: "ew-resize" }} onPointerDown={(e) => handleDragStart(e, "edge-r")} onPointerMove={handleDragMove} onPointerUp={handleDragEnd} />
    </g>
  );

  // ── Outer border ──
  const outerBorder = (
    <rect
      x={baseX}
      y={baseY}
      width={totalW}
      height={totalH}
      fill="none"
      stroke="rgba(0,200,255,0.8)"
      strokeWidth="2"
      vectorEffect="non-scaling-stroke"
      rx="2"
      style={{ pointerEvents: "none" }}
    />
  );

  // ── Info label ──
  const infoText = `카드 영역 (${cols}열×${rows}행)${merges.length > 0 ? ` · 병합 ${merges.length}개` : ""} | 크기: ${Math.round(totalW)}×${Math.round(totalH)} | 좌표: X:${Math.round(baseX)} Y:${Math.round(baseY)}`;
  const approxInfoW = infoText.length * 6.5 * invScale + 12 * invScale;
  const infoLabel = (
    <g style={{ pointerEvents: "none" }}>
      <rect
        x={baseX + 2 * invScale}
        y={baseY - 20 * invScale}
        width={approxInfoW}
        height={18 * invScale}
        fill="rgba(0,0,0,0.6)"
        rx={4 * invScale}
      />
      <text
        x={baseX + 8 * invScale}
        y={baseY - 6.5 * invScale}
        fill="rgba(0,200,255,0.9)"
        fontSize={10 * invScale}
        fontWeight="700"
        fontFamily="sans-serif"
      >
        {infoText}
      </text>
    </g>
  );

  // ── Tooltip for resizing & moving ──
  let tooltipX = 0;
  let tooltipY = 0;
  let tooltipText = "";
  let tooltipWidth = 110;

  if (dragType === "col") {
    tooltipX = colX(dragIndex + 1, colWidths, baseX) + 48 * invScale;
    tooltipY = baseY - 12 * invScale;
    tooltipText = `${Math.round(colWidths[dragIndex])}px / ${Math.round(colWidths[dragIndex + 1])}px`;
    tooltipWidth = 80;
  } else if (dragType === "row") {
    tooltipX = baseX + totalW / 2;
    tooltipY = rowY(dragIndex, rowHeights, baseY, rowGaps) + rowHeights[dragIndex] - 12 * invScale;
    tooltipText = `${Math.round(rowHeights[dragIndex])}px / ${Math.round(rowHeights[dragIndex + 1])}px`;
    tooltipWidth = 80;
  } else if (dragType === "move") {
    tooltipX = baseX + totalW / 2;
    tooltipY = baseY - 12 * invScale;
    tooltipText = `X: ${Math.round(baseX)} / Y: ${Math.round(baseY)}`;
  } else if (dragType?.startsWith("edge-")) {
    tooltipX = baseX + totalW / 2;
    tooltipY = baseY - 12 * invScale;
    tooltipText = `W: ${Math.round(totalW)} / H: ${Math.round(totalH)}`;
  }

  const resizeTooltip = (isDragging.current && dragType !== null && tooltipText) ? (
    <g style={{ pointerEvents: "none" }}>
      <rect
        x={tooltipX - (tooltipWidth * invScale) / 2}
        y={tooltipY - 14 * invScale}
        width={tooltipWidth * invScale}
        height={20 * invScale}
        fill="rgba(0,0,0,0.75)"
        rx={4 * invScale}
      />
      <text
        x={tooltipX}
        y={tooltipY - 4 * invScale}
        fill="#fff"
        fontSize={11 * invScale}
        fontWeight="bold"
        fontFamily="sans-serif"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ pointerEvents: "none" }}
      >
        {tooltipText}
      </text>
    </g>
  ) : null;

  const btnStyle: React.CSSProperties = {
    padding: "3px 8px",
    fontSize: "11px",
    fontWeight: 600,
    color: "#e0e0e0",
    background: "rgba(40,40,50,0.85)",
    border: "1px solid rgba(100,100,120,0.5)",
    borderRadius: "4px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    lineHeight: "1.4",
  };

  // ── Render Gap Overlays ──
  const gapOverlays: React.ReactNode[] = [];
  if (rowGaps) {
    for (let r = 0; r < rows; r++) {
      const gap = rowGaps[r];
      if (gap) {
        const yBottom = rowY(r, rowHeights, baseY, rowGaps) + rowHeights[r];
        if (gap > 0) {
          gapOverlays.push(
            <g key={`gap-overlay-${r}`}>
              <rect
                x={baseX}
                y={yBottom}
                width={totalW}
                height={gap}
                fill="rgba(255, 165, 0, 0.2)"
                stroke="orange"
                strokeWidth="1.5"
                strokeDasharray="4 2"
                style={{ pointerEvents: "auto", cursor: "context-menu" }}
                onContextMenu={(e) => handleContextMenu(e, r)}
              />
              <rect
                x={baseX + totalW + 2 * invScale}
                y={yBottom + gap / 2 - 8 * invScale}
                width={65 * invScale}
                height={18 * invScale}
                fill="rgba(0,0,0,0.6)"
                rx={4 * invScale}
                style={{ pointerEvents: "none" }}
              />
              <text
                x={baseX + totalW + 6 * invScale}
                y={yBottom + gap / 2 + 5 * invScale}
                textAnchor="start"
                fill="orange"
                fontSize={11 * invScale}
                fontWeight="bold"
                style={{ pointerEvents: "none" }}
              >
                간격 {gap}px
              </text>
            </g>
          );
        } else {
          const absGap = Math.abs(gap);
          gapOverlays.push(
            <g key={`gap-overlay-${r}`}>
              <rect
                x={baseX}
                y={yBottom - absGap}
                width={totalW}
                height={absGap}
                fill="rgba(255, 0, 0, 0.2)"
                stroke="red"
                strokeWidth="1.5"
                strokeDasharray="4 2"
                style={{ pointerEvents: "auto", cursor: "context-menu" }}
                onContextMenu={(e) => handleContextMenu(e, r)}
              />
              <rect
                x={baseX + totalW + 2 * invScale}
                y={yBottom - absGap / 2 - 8 * invScale}
                width={65 * invScale}
                height={18 * invScale}
                fill="rgba(0,0,0,0.6)"
                rx={4 * invScale}
                style={{ pointerEvents: "none" }}
              />
              <text
                x={baseX + totalW + 6 * invScale}
                y={yBottom - absGap / 2 + 5 * invScale}
                textAnchor="start"
                fill="red"
                fontSize={11 * invScale}
                fontWeight="bold"
                style={{ pointerEvents: "none" }}
              >
                겹침 {absGap}px
              </text>
            </g>
          );
        }
      }
    }
  }

  const renderContextMenu = () => {
    if (!contextMenu) return null;
    return createPortal(
      <div
        style={{
          position: "fixed",
          top: contextMenu.y,
          left: contextMenu.x,
          background: "var(--panel-bg, #1a202c)",
          border: "1px solid var(--border-medium, #4a5568)",
          borderRadius: "8px",
          padding: "8px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: "4px"
        }}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <button
          className="comm-btn comm-btn-sm comm-btn-secondary"
          onClick={() => {
            const currentGap = rowGaps ? rowGaps[contextMenu.r] || 0 : 0;
            const input = window.prompt(`[행 ${contextMenu.r + 1} 아래 간격 설정 (px)]\n양수: 간격 추가, 음수: 겹침 허용`, currentGap.toString());
            if (input !== null) {
              const val = parseInt(input, 10);
              if (!isNaN(val)) {
                const newGaps = rowGaps ? [...rowGaps] : new Array(rowHeights.length).fill(0);
                newGaps[contextMenu.r] = val;
                onGridChange({ colWidths, rowHeights, merges, rowGaps: newGaps });
              }
            }
            setContextMenu(null);
          }}
        >
          간격 설정 (Gap)
        </button>
      </div>,
      document.body
    );
  };

  return (
    <>
      <g className="interactive-grid-editor" shapeRendering="geometricPrecision">
        {cellRects}
        {colDividers}
        {rowDividers}
        {gapOverlays}
        {outerBorder}
        {edgeHandles}
        {infoLabel}
        {resizeTooltip}
      </g>

      {/* HTML toolbar via Portal */}
      {toolbarContainer && createPortal(
        <div
          style={{
            display: "flex",
            width: "100%",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "4px",
              flexWrap: "wrap",
              justifyContent: "flex-start",
            }}
          >
            <button onClick={handleAddRow} style={btnStyle} title="행 추가">
            ＋ 행
          </button>
          <button onClick={handleAddCol} style={btnStyle} title="열 추가">
            ＋ 열
          </button>
          <button
            onClick={handleDeleteRow}
            style={{ ...btnStyle, opacity: rowHeights.length <= 1 ? 0.4 : 1 }}
            disabled={rowHeights.length <= 1}
            title="마지막 행 삭제"
          >
            － 행
          </button>
          <button
            onClick={handleDeleteCol}
            style={{ ...btnStyle, opacity: colWidths.length <= 1 ? 0.4 : 1 }}
            disabled={colWidths.length <= 1}
            title="마지막 열 삭제"
          >
            － 열
          </button>
          <span style={{ width: "1px", background: "rgba(0,0,0,0.1)", margin: "2px 6px" }} />
          <button
            onClick={handleMerge}
            style={{
              ...btnStyle,
              opacity: canMerge ? 1 : 0.4,
              cursor: canMerge ? "pointer" : "not-allowed",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px"
            }}
            disabled={!canMerge}
            title="선택 셀 병합 (Shift+클릭으로 여러 셀 선택)"
          >
            <Icon icon="material-symbols:square-outline-rounded" width="14" height="14" />
            병합
          </button>
          <button
            onClick={handleSplit}
            style={{
              ...btnStyle,
              opacity: canSplit ? 1 : 0.4,
              cursor: canSplit ? "pointer" : "not-allowed",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px"
            }}
            disabled={!canSplit}
            title="병합된 셀 나누기"
          >
            <Icon icon="material-symbols:grid-on-outline" width="14" height="14" />
            나누기
          </button>
          </div>
          <button
            className="comm-btn comm-btn-primary comm-btn-sm"
            onClick={(e) => {
              e.preventDefault();
              if (onSave) onSave();
            }}
            style={{ marginLeft: "auto" }}
            title="현재 카드 영역 및 기본 섀시 정보 저장"
          >
            저장
          </button>
        </div>,
        toolbarContainer
      )}
      {renderContextMenu()}
    </>
  );
}
