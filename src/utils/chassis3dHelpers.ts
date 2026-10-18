import { Shape, Path, ShapeGeometry, PlaneGeometry, BufferAttribute } from "three";
import type { Device } from "../types";
import type { EquipmentModel, CustomEquipmentModel } from "../types/equipment";
import { getColSpan } from "../types/equipment";
import { equipmentModels } from "./cardAssets";
import { getEffectiveCards } from "./sampleUtils";

export const CARD_ROW_HEIGHT = 46;

/**
 * 특정 UV 영역을 갖는 완벽한 사각형 PlaneGeometry를 생성합니다.
 * (Earcut 삼각분할을 거치지 않으므로 대각선 찢어짐이나 왜곡이 0% 발생하지 않음)
 */
export function createSubPlaneGeometry(
  w: number,
  h: number,
  uMin: number,
  uMax: number,
  vMin: number,
  vMax: number
): PlaneGeometry {
  const geom = new PlaneGeometry(w, h);
  const uvs = new Float32Array([
    uMin, vMax, // v0: 좌상 (-w/2,  h/2)
    uMax, vMax, // v1: 우상 ( w/2,  h/2)
    uMin, vMin, // v2: 좌하 (-w/2, -h/2)
    uMax, vMin, // v3: 우하 ( w/2, -h/2)
  ]);
  geom.setAttribute("uv", new BufferAttribute(uvs, 2));
  geom.computeVertexNormals();
  return geom;
}

export interface SlotRect {
  slotId?: string;
  positionIndex: number;
  row?: number;
  col?: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Slot3D {
  slotId?: string;
  positionIndex: number;
  x3d: number;
  y3d: number;
  w3d: number;
  h3d: number;
}

export type ChassisModelLayout = EquipmentModel & {
  _rowHeights?: number[];
  _rowGaps?: number[];
  _rowColumns?: number[];
  rowHeights?: number[];
  rowGaps?: number[];
  rowColumns?: number[];
};

/**
 * 섀시 모델 정의를 찾습니다.
 */
export function findChassisEquipmentModel(
  modelName: string,
  customModels: CustomEquipmentModel[]
): ChassisModelLayout | undefined {
  const custom = customModels.find(
    (m) =>
      m.modelName === modelName ||
      m.modelName.toLowerCase() === modelName.toLowerCase() ||
      (m.variants &&
        m.variants.some((v) => `${m.modelName} ${v.variantName}`.toLowerCase() === modelName.toLowerCase()))
  );
  if (custom) return custom as unknown as ChassisModelLayout;

  return equipmentModels.find(
    (m) => m.modelName === modelName || m.modelName.toLowerCase() === modelName.toLowerCase()
  ) as ChassisModelLayout | undefined;
}

/**
 * 섀시 모델의 모든 슬롯(2D SVG 좌표계) 목록을 산출합니다.
 */
export function getChassisAllSlots(model: ChassisModelLayout): SlotRect[] {
  // 1. 명시적 slots 정의가 있는 경우
  if (model.slots && model.slots.length > 0) {
    const areaX = model.cardArea?.x ?? 0;
    const areaY = model.cardArea?.y ?? 0;
    return model.slots.map((s, idx) => ({
      slotId: s.slotId,
      positionIndex: idx,
      row: s.row,
      col: s.col,
      x: areaX + s.x,
      y: areaY + s.y,
      width: s.width,
      height: s.height,
    }));
  }

  // 2. rows 정의가 있는 경우
  if (model.rows && model.rows.length > 0) {
    const slots: SlotRect[] = [];
    let pIdx = 0;
    for (const row of model.rows) {
      for (const sub of row.subSlots) {
        slots.push({
          slotId: sub.slotId,
          positionIndex: pIdx++,
          row: row.row,
          x: row.x + sub.x,
          y: row.y + sub.y,
          width: sub.width,
          height: sub.height,
        });
      }
    }
    return slots;
  }

  // 3. cardArea 기반 그리드
  const cardArea = model.cardArea;
  if (!cardArea) return [];

  // 3-A. gridColWidths / gridRowHeights (그리드 에디터 기반)
  if (model.gridColWidths && model.gridRowHeights && model.gridColWidths.length > 0 && model.gridRowHeights.length > 0) {
    const slots: SlotRect[] = [];
    const covered = new Set<string>();

    if (model.gridMerges) {
      for (const merge of model.gridMerges) {
        for (let r = merge.r; r < merge.r + merge.rs; r++) {
          for (let c = merge.c; c < merge.c + merge.cs; c++) {
            if (r === merge.r && c === merge.c) continue;
            covered.add(`${r},${c}`);
          }
        }
      }
    }

    let currentY = cardArea.y;
    for (let r = 0; r < model.gridRowHeights.length; r++) {
      const rowH = model.gridRowHeights[r] || CARD_ROW_HEIGHT;
      const rowGap = model._rowGaps?.[r] ?? 0;
      let currentX = cardArea.x;

      for (let c = 0; c < model.gridColWidths.length; c++) {
        const colW = model.gridColWidths[c] || 0;
        if (!covered.has(`${r},${c}`)) {
          const merge = model.gridMerges?.find((m) => m.r === r && m.c === c);
          let slotW = colW;
          let slotH = rowH;
          if (merge) {
            slotW = 0;
            for (let mc = merge.c; mc < merge.c + merge.cs; mc++) slotW += model.gridColWidths![mc] || 0;
            slotH = 0;
            for (let mr = merge.r; mr < merge.r + merge.rs; mr++) {
              slotH += model.gridRowHeights![mr] || 0;
              if (mr < merge.r + merge.rs - 1) slotH += model._rowGaps?.[mr] ?? 0;
            }
          }

          slots.push({
            positionIndex: r * model.gridColWidths.length + c,
            row: r,
            col: c,
            x: currentX,
            y: currentY,
            width: slotW,
            height: slotH,
          });
        }
        currentX += colW;
      }
      currentY += rowH + rowGap;
    }
    return slots;
  }

  // 3-B. _rowHeights / _rowGaps 커스텀 행
  const customRowCount = Math.max(
    model._rowHeights?.length ?? 0,
    model._rowColumns?.length ?? 0,
    model._rowGaps?.length ? model._rowGaps.length + 1 : 0
  );

  if (customRowCount > 0) {
    const slots: SlotRect[] = [];
    let yOffset = 0;
    let globalIndex = 0;
    for (let r = 0; r < customRowCount; r++) {
      const rowH = model._rowHeights?.[r] ?? CARD_ROW_HEIGHT;
      const cols = model._rowColumns?.[r] ?? cardArea.columns ?? 1;
      const colW = cardArea.width / cols;
      for (let c = 0; c < cols; c++) {
        slots.push({
          positionIndex: globalIndex++,
          row: r,
          col: c,
          x: cardArea.x + c * colW,
          y: cardArea.y + yOffset,
          width: colW,
          height: rowH,
        });
      }
      yOffset += rowH + (model._rowGaps?.[r] ?? 0);
    }
    return slots;
  }

  // 3-C. 균일 그리드
  const cols = cardArea.columns || 1;
  const colW = cardArea.columnWidth || cardArea.width / cols;
  const numRows = Math.max(1, Math.floor(cardArea.height / CARD_ROW_HEIGHT));
  const slots: SlotRect[] = [];
  let globalIndex = 0;
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < cols; c++) {
      slots.push({
        positionIndex: globalIndex++,
        row: r,
        col: c,
        x: cardArea.x + c * colW,
        y: cardArea.y + r * CARD_ROW_HEIGHT,
        width: colW,
        height: CARD_ROW_HEIGHT,
      });
    }
  }
  return slots;
}
/**
 * 장비에 장착된 카드 목록을 기반으로 비어 있는 슬롯(Unpopulated Slots) 목록과
 * 실제 장착된 카드들의 확장된 3D 점유 사각형 목록을 반환합니다.
 * (vfull 카드는 세로 전체, full 카드는 가로 전체를 3D에서도 풀로 채움)
 */
export function getChassisEmptySlots(
  device: Device,
  customModels: CustomEquipmentModel[]
): {
  model: ChassisModelLayout | undefined;
  emptySlots: SlotRect[];
  allSlots: SlotRect[];
  occupiedSlots: SlotRect[];
} {
  const model = findChassisEquipmentModel(device.modelName || "", customModels);
  if (!model) {
    return { model: undefined, emptySlots: [], allSlots: [], occupiedSlots: [] };
  }

  const allSlots = getChassisAllSlots(model);
  if (allSlots.length === 0) {
    return { model, emptySlots: [], allSlots: [], occupiedSlots: [] };
  }

  const effectiveCards = getEffectiveCards(device, customModels);
  const cardArea = model.cardArea;

  // 1. 실제 장착된 카드들의 2D 바운딩 박스 (SlotRect) 계산 (vfull / full 확장 적용)
  const occupiedSlots: SlotRect[] = [];

  for (let cIdx = 0; cIdx < effectiveCards.length; cIdx++) {
    const card = effectiveCards[cIdx];
    let cardX = 0;
    let cardY = 0;
    let cardW = 0;
    let cardH = 0;
    let found = false;

    // A. model.slots 매핑
    if (model.slots && card.slotId) {
      const slotDef = model.slots.find((s) => s.slotId === card.slotId);
      if (slotDef) {
        const areaX = cardArea?.x ?? 0;
        const areaY = cardArea?.y ?? 0;
        cardX = areaX + slotDef.x;
        cardY = areaY + slotDef.y;
        cardW = slotDef.width;
        cardH = slotDef.height;
        found = true;
      }
    }
    // B. model.rows 매핑
    else if (model.rows && card.rowId && card.slotId) {
      const rowDef = model.rows.find((r) => r.rowId === card.rowId);
      if (rowDef) {
        const subDef = rowDef.subSlots.find((s) => s.slotId === card.slotId);
        if (subDef) {
          cardX = rowDef.x + subDef.x;
          cardY = rowDef.y + subDef.y;
          cardW = subDef.width;
          cardH = subDef.height;
          found = true;
        }
      }
    }
    // C. cardArea 기반 그리드 매핑
    else if (cardArea && card.positionIndex !== undefined) {
      const baseSlot = allSlots.find((s) => s.positionIndex === card.positionIndex);
      if (baseSlot) {
        cardX = baseSlot.x;
        cardY = baseSlot.y;
        cardW = baseSlot.width;
        cardH = baseSlot.height;
        found = true;
      } else {
        const cols = cardArea.columns || 1;
        const colW = cardArea.columnWidth || cardArea.width / cols;
        const row = Math.floor(card.positionIndex / cols);
        const col = card.positionIndex % cols;
        cardX = cardArea.x + col * colW;
        cardY = cardArea.y + row * CARD_ROW_HEIGHT;
        cardW = colW;
        cardH = CARD_ROW_HEIGHT;
        found = true;
      }

      const defaultCols = cardArea.columns || 1;
      const colSpan = getColSpan(card.widthType, defaultCols);

      const isSlotHorizontal = cardW > cardH;
      const isVFull = card.widthType === "vfull" || (card.cardType ? card.cardType.includes("vfull") : false);
      const isFull = (card.widthType === "full" || (card.cardType ? card.cardType.includes("-full") : false)) && !isVFull;

      // [FULL 카드 3D 확장: 가로 전체 채움]
      if (isFull) {
        cardX = cardArea.x;
        cardW = cardArea.width;
      } else if (colSpan > 1) {
        cardW = cardW * colSpan;
      } else if (isVFull) {
        // [VFULL 카드 3D 확장: 세로 전체 채움 혹은 눕힌 경우 가로 전체 채움]
        if (isSlotHorizontal) {
          cardX = cardArea.x;
          cardW = cardArea.width;
        } else {
          cardY = cardArea.y;
          cardH = cardArea.height;
        }
      }
    }

    if (found && cardW > 0 && cardH > 0) {
      occupiedSlots.push({
        slotId: card.slotId ?? `card-rect-${cIdx}`,
        positionIndex: card.positionIndex ?? cIdx,
        x: cardX,
        y: cardY,
        width: cardW,
        height: cardH,
      });
    }
  }

  // 2. allSlots 중에서 어떤 점유 카드 사각형과도 겹치지 않는 슬롯만 emptySlots로 분류
  const emptySlots: SlotRect[] = [];

  for (const slot of allSlots) {
    const slotCenterX = slot.x + slot.width / 2;
    const slotCenterY = slot.y + slot.height / 2;

    const isCovered = occupiedSlots.some((cardRect) => {
      return (
        slotCenterX >= cardRect.x - 0.5 &&
        slotCenterX <= cardRect.x + cardRect.width + 0.5 &&
        slotCenterY >= cardRect.y - 0.5 &&
        slotCenterY <= cardRect.y + cardRect.height + 0.5
      );
    });

    if (!isCovered) {
      emptySlots.push(slot);
    }
  }

  return { model, emptySlots, allSlots, occupiedSlots };
}

/**
 * 2D SVG 슬롯 목록을 3D 중심 기준 로컬 좌표계로 변환합니다.
 */
export function convertSlotsTo3D(
  slots: SlotRect[],
  deviceWidth: number,
  deviceHeight: number,
  svgW: number,
  svgH: number
): Slot3D[] {
  const halfW = deviceWidth / 2;
  const halfH = deviceHeight / 2;

  return slots.map((s) => {
    const normX = s.x / svgW;
    const normY = s.y / svgH;
    const normW = s.width / svgW;
    const normH = s.height / svgH;

    const w3d = normW * deviceWidth;
    const h3d = normH * deviceHeight;
    const x3d = -halfW + normX * deviceWidth + w3d / 2;
    // SVG는 위에서 아래(+Y 방향), 3D는 아래에서 위(+Y 방향)
    const y3d = halfH - normY * deviceHeight - h3d / 2;

    return {
      slotId: s.slotId,
      positionIndex: s.positionIndex,
      x3d,
      y3d,
      w3d,
      h3d,
    };
  });
}

/**
 * 연속으로 인접해 있는 빈 슬롯들을 단일 사각형 구멍으로 병합합니다.
 * (슬롯 간의 불필요한 흰색 분할선을 제거하고 Three.js 삼각분할 오류를 원천 방지)
 */
export function mergeEmptySlots(slots: Slot3D[]): Slot3D[] {
  if (slots.length <= 1) return slots;

  // 1. 행(Y)별로 그룹화 (동일 수평 라인에 있는 슬롯들)
  const rows = new Map<number, Slot3D[]>();
  const Y_TOLERANCE = 0.005; // 5mm 오차 허용

  for (const s of slots) {
    let matchedKey: number | null = null;
    for (const key of rows.keys()) {
      if (Math.abs(s.y3d - key) < Y_TOLERANCE) {
        matchedKey = key;
        break;
      }
    }
    if (matchedKey !== null) {
      rows.get(matchedKey)!.push(s);
    } else {
      rows.set(s.y3d, [s]);
    }
  }

  const mergedList: Slot3D[] = [];

  for (const [, rowSlots] of rows) {
    // X 좌표 기준 정렬
    rowSlots.sort((a, b) => a.x3d - b.x3d);

    let current = { ...rowSlots[0] };

    for (let i = 1; i < rowSlots.length; i++) {
      const next = rowSlots[i];
      const currentRight = current.x3d + current.w3d / 2;
      const nextLeft = next.x3d - next.w3d / 2;

      // 두 슬롯이 가로로 맞닿아 있거나 거의 인접(5mm 이내)해 있고 높이가 비슷하면 병합
      if (Math.abs(currentRight - nextLeft) < 0.005 && Math.abs(current.h3d - next.h3d) < 0.005) {
        const newLeft = current.x3d - current.w3d / 2;
        const newRight = next.x3d + next.w3d / 2;
        const newWidth = newRight - newLeft;
        current.x3d = newLeft + newWidth / 2;
        current.w3d = newWidth;
        current.h3d = Math.max(current.h3d, next.h3d);
      } else {
        mergedList.push(current);
        current = { ...next };
      }
    }
    mergedList.push(current);
  }

  return mergedList;
}

/**
 * 빈 슬롯 부분에 구멍(Holes)이 뚫린 Three.js ShapeGeometry를 생성하고,
 * 1:1 UV 좌표를 바인딩하여 반환합니다.
 */
export function createChassisFrontShapeGeometry(
  deviceWidth: number,
  deviceHeight: number,
  emptySlots3D: Slot3D[]
): ShapeGeometry {
  const halfW = deviceWidth / 2;
  const halfH = deviceHeight / 2;

  const shape = new Shape();
  // 외곽 사각형 (시계 반대 방향 CCW)
  shape.moveTo(-halfW, -halfH);
  shape.lineTo(halfW, -halfH);
  shape.lineTo(halfW, halfH);
  shape.lineTo(-halfW, halfH);
  shape.closePath();

  // 인접한 빈 슬롯들을 하나로 병합하여 슬롯 간의 흰색선 제거 및 Earcut 삼각분할 안정화
  const mergedEmptySlots = mergeEmptySlots(emptySlots3D);

  // 병합된 빈 영역 구멍들 (시계 방향 CW)
  mergedEmptySlots.forEach((slot) => {
    // 인접 구멍과의 교차를 피하고 외곽 베젤을 침범하지 않도록 정확한 크기 적용
    const w = Math.max(0.001, slot.w3d);
    const h = Math.max(0.001, slot.h3d);

    const x0 = slot.x3d - w / 2;
    const x1 = slot.x3d + w / 2;
    const y0 = slot.y3d - h / 2;
    const y1 = slot.y3d + h / 2;

    const hole = new Path();
    hole.moveTo(x0, y0);
    hole.lineTo(x0, y1);
    hole.lineTo(x1, y1);
    hole.lineTo(x1, y0);
    hole.closePath();
    shape.holes.push(hole);
  });

  const geom = new ShapeGeometry(shape);
  const pos = geom.attributes.position;
  const uvs = new Float32Array(pos.count * 2);

  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    // px: [-halfW, halfW] -> [0, 1]
    // py: [-halfH, halfH] -> [0, 1]
    uvs[i * 2] = (px + halfW) / deviceWidth;
    uvs[i * 2 + 1] = (py + halfH) / deviceHeight;
  }

  geom.setAttribute("uv", new BufferAttribute(uvs, 2));
  geom.computeVertexNormals();

  return geom;
}
