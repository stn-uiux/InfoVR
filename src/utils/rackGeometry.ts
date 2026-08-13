import type { Orientation, Rack, ImportedModel } from "../types";
import { RACK_DEPTH, GRID_SPACING } from "../components/constants";

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
  orientation: Orientation,
): { effectiveWidth: number; effectiveDepth: number } => {
  const isRotated = orientation === 90 || orientation === 270;
  return {
    effectiveWidth: isRotated ? RACK_DEPTH : width,
    effectiveDepth: isRotated ? width : RACK_DEPTH,
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
