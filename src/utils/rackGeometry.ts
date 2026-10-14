import type { Orientation, Rack, ImportedModel } from "../types";
import { GRID_SPACING, U_HEIGHT } from "../components/layout/constants";
import { Vector3 } from "three";

/**
 * Get the front-facing direction vector for a given rack orientation.
 * Returns unit vector { x, z } indicating which direction the front door faces.
 *
 * Orientation mapping:
 *   0°   (North) → front faces -Z → { x: 0, z: -1 }
 *   90°  (East)  → front faces +X → { x: 1, z:  0 }
 *   180° (South) → front faces +Z → { x: 0, z:  1 }
 *   270° (West)  → front faces -X → { x:-1, z:  0 }
 */
export const getFrontDirection = (
  orientation: Orientation,
): { x: number; z: number } => {
  switch (orientation) {
    case 0:
      return { x: 0, z: -1 };
    case 90:
      return { x: 1, z: 0 };
    case 180:
      return { x: 0, z: 1 };
    case 270:
      return { x: -1, z: 0 };
    default:
      return { x: 0, z: 1 };
  }
};

/**
 * Get the effective width and depth of a rack considering its rotation.
 * When rotated 90° or 270°, width and depth swap.
 */
export const getEffectiveDimensions = (
  width: number,
  depth: number,
  orientation: Orientation,
): { effectiveWidth: number; effectiveDepth: number } => {
  const isRotated = orientation === 90 || orientation === 270;
  return {
    effectiveWidth: isRotated ? depth : width,
    effectiveDepth: isRotated ? width : depth,
  };
};

/**
 * Calculates the dynamic dimensions (in meters) of the room based on placed racks and models,
 * padding them by a minimum distance, and comparing against a minimum fallback width/length.
 */
export const calculateDynamicRoomSize = (
  racks: Rack[],
  importedModels: ImportedModel[],
  activeNodeId: string | null,
  minWidthCm: number,
  minLengthCm: number,
  csCustomSpaceSize?: boolean
): { width: number; length: number } => {
  if (csCustomSpaceSize) {
    return {
      width: minWidthCm / 100,
      length: minLengthCm / 100
    };
  }

  let maxAbsX = 0;
  let maxAbsZ = 0;

  racks.forEach(rack => {
    if (rack.mapId !== activeNodeId) return;

    const w = rack.orientation === 90 || rack.orientation === 270 ? 1.0 : rack.width;
    const d = rack.orientation === 90 || rack.orientation === 270 ? rack.width : 1.0; 
    const x = rack.position[0] * GRID_SPACING;
    const z = rack.position[1] * GRID_SPACING;
    maxAbsX = Math.max(maxAbsX, Math.abs(x) + w / 2);
    maxAbsZ = Math.max(maxAbsZ, Math.abs(z) + d / 2);
  });

  importedModels?.forEach(model => {
    const x = model.position[0];
    const z = model.position[2];
    const sX = model.scale[0] * 1.5; // rough bounding assumption
    const sZ = model.scale[2] * 1.5;
    maxAbsX = Math.max(maxAbsX, Math.abs(x) + sX / 2);
    maxAbsZ = Math.max(maxAbsZ, Math.abs(z) + sZ / 2);
  });

  const MIN_PADDING = 2.0;
  const dynamicWidth = maxAbsX > 0 ? (maxAbsX + MIN_PADDING) * 2 : 0;
  const dynamicLength = maxAbsZ > 0 ? (maxAbsZ + MIN_PADDING) * 2 : 0;

  return {
    width: Math.max(minWidthCm / 100, dynamicWidth),
    length: Math.max(minLengthCm / 100, dynamicLength)
  };
};

export interface ThermoHygroSnapTarget {
  position: [number, number, number];
  rotation: [number, number, number];
  rackId: string;
  rackTitle?: string;
  side: "left" | "right";
  distance: number;
}

/**
 * 에디트모드에서 온습도계를 랙 가까이 가져갈 때,
 * 가까운 랙의 최상단 좌측끝 / 우측끝(1cm 오프셋)으로 스냅할 위치 및 회전각을 계산합니다.
 */
export const findThermoHygroRackSnap = (
  currentPosition: [number, number, number],
  racks: Rack[],
  activeMapId?: string | null,
  thWidth = 0.35,
  thHeight = 0.13,
  thDepth = 0.04,
  snapThreshold = 0.75 // 75cm 이내 접근 시 스냅
): ThermoHygroSnapTarget | null => {
  const curPos = new Vector3(...currentPosition);
  let closestSnap: ThermoHygroSnapTarget | null = null;
  let minDistance = snapThreshold;

  for (const rack of racks) {
    if (activeMapId && rack.mapId && rack.mapId !== activeMapId) continue;

    const rackW = rack.width;
    const rackD = (rack.rackDepth || 100) / 100;
    const rackH = rack.rackSize * U_HEIGHT + 0.1;
    const rackCenterX = rack.position[0] * GRID_SPACING;
    const rackCenterZ = rack.position[1] * GRID_SPACING;
    const rotationRad = ((180 - (rack.orientation ?? 0)) * Math.PI) / 180;

    // 1cm(0.01m) 오프셋 기준:
    // 랙 상단 표면(Y)에서 1cm 위로 거치: rackH + 0.01 + thHeight / 2
    // 랙 전면(Z)에서 1cm 안쪽: rackD / 2 - 0.01 - thDepth / 2
    const localY = rackH + 0.01 + thHeight / 2;
    const localZ = rackD / 2 - 0.01 - thDepth / 2;

    const sides: Array<"left" | "right"> = ["left", "right"];

    for (const side of sides) {
      // 좌측끝: 랙 좌측 모서리(-rackW/2)에서 안쪽으로 1cm 떨어진 곳
      // 우측끝: 랙 우측 모서리(+rackW/2)에서 안쪽으로 1cm 떨어진 곳
      const localX =
        side === "left"
          ? -rackW / 2 + 0.01 + thWidth / 2
          : rackW / 2 - 0.01 - thWidth / 2;

      // 랙의 회전 각도(rotationRad)를 적용하여 월드 오프셋 계산
      const offset = new Vector3(localX, 0, localZ);
      offset.applyAxisAngle(new Vector3(0, 1, 0), rotationRad);

      const snapWorldPos = new Vector3(
        rackCenterX + offset.x,
        localY,
        rackCenterZ + offset.z,
      );

      const horizDist = Math.hypot(
        curPos.x - snapWorldPos.x,
        curPos.z - snapWorldPos.z
      );
      const vertDist = Math.abs(curPos.y - snapWorldPos.y);
      const dist3d = curPos.distanceTo(snapWorldPos);

      // 3D 거리 75cm 이내이거나, 수평 65cm + 수직 85cm 이내 접근 시 스냅
      const isCandidate = dist3d < snapThreshold || (horizDist < 0.65 && vertDist < 0.85);

      if (isCandidate && dist3d < minDistance) {
        minDistance = dist3d;
        closestSnap = {
          position: [snapWorldPos.x, snapWorldPos.y, snapWorldPos.z],
          rotation: [0, rotationRad, 0],
          rackId: rack.rackId,
          rackTitle: rack.rackTitle,
          side,
          distance: dist3d,
        };
      }
    }
  }

  return closestSnap;
};
