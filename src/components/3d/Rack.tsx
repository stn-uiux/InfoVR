import { useState, useEffect, useMemo, useRef, useCallback, forwardRef, Suspense, memo, useDeferredValue } from "react";
import { useTexture, Billboard, Html, Edges } from "@react-three/drei";
import { type ThreeEvent, useThree, useFrame } from "@react-three/fiber";
import { BoxGeometry, CanvasTexture, Color, DoubleSide, BackSide, Euler, Mesh, MeshStandardMaterial, Object3D, Plane, RepeatWrapping, Vector3, Group, MathUtils } from 'three';
import { useStore } from "../../store/useStore";
import { getEffectiveCards } from "../../utils/sampleUtils";
import type { AppState } from "../../store/useStore";
import { useTheme } from "../../contexts/ThemeContext";
import type { Rack as RackType, Device } from "../../types";
import { ErrorMarker } from "./ErrorMarker";
import { U_HEIGHT, GRID_SPACING, DEVICE_DEPTH } from "../layout/constants";
import { getHighestError } from "../../utils/errorHelpers";
import { resolveDeviceImage, isChassisModel } from "../../utils/deviceAssets";
import { DEFAULT_CHASSIS_CARDS } from "../../utils/defaultChassisCards";
import { ChassisRecessedFaceplate } from "./ChassisRecessedFaceplate";

// ─── Phase 1-A: 모듈 레벨 공유 Geometry (모든 Rack이 재사용) ───
const SHARED_GEO = {
  topBottom: new BoxGeometry(1, 0.03, 1),
  cornerPost: new BoxGeometry(0.02, 1, 0.02),
  hBrace: new BoxGeometry(1, 0.02, 0.02),
  frontRail: new BoxGeometry(0.03, 1, 0.03),
  backRail: new BoxGeometry(0.02, 1, 0.02),
  rearBezel: new BoxGeometry(1, 1, 0.01),
  doorHBar: new BoxGeometry(1, 0.04, 0.02),
  doorVBar: new BoxGeometry(0.04, 1, 0.02),
  interactBox: new BoxGeometry(1, 1, 1),
};

// ─── Phase 1-B: perforatedTexture 모듈 레벨 캐시 ───
const _perforatedCache = new Map<number, CanvasTexture>();
function getPerforatedTexture(rackSize: number): CanvasTexture {
  if (_perforatedCache.has(rackSize)) return _perforatedCache.get(rackSize)!;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  const density = 40;
  const panelW = 1.0 - 0.04;
  const panelH = rackSize * U_HEIGHT + 0.1 - 0.06;
  const railV = 0.08;
  const railW = 0.08;
  const innerW = panelW - railV * 2;
  const innerH = panelH - railW * 2;
  tex.repeat.set(innerW * density, innerH * density);
  _perforatedCache.set(rackSize, tex);
  return tex;
}

// We no longer need selectedRackIdBeforePointerDown because interactBox becomes invisible 
// when the rack is selected, preventing click event bubbling conflicts entirely.

type RackProps = RackType;

export const Rack = memo(({
  rackId,
  rackTitle,
  rackSize,
  width: rackWidth,
  position,
  devices,
  mapId,
  orientation: orientationProp,
  isBidirectional,
  rackDepth,
}: RackProps) => {
  const [hoveredSide, setHoveredSide] = useState<"front" | "rear" | null>(null);
  // Boolean selectors: only re-render when THIS rack's selection state changes
  const isSelected = useStore((state: AppState) => state.selectedRackId === rackId);
  const selectedRackSide = useStore((state: AppState) => state.selectedRackSide);
  const isHovered = useStore((state: AppState) => state.hoveredRackId === rackId);
  const isFocused = useStore((state: AppState) => state.focusedRackId === rackId);
  const isObstructing = useStore((state: AppState) => state.obstructingRackIds.includes(rackId));
  const isEditMode = useStore((state: AppState) => state.isEditMode);
  const { theme } = useTheme();

  const isInternalFocused = isSelected || isFocused;

  // Local subscription for drag state to prevent global re-renders
  const isInternalDragging = useStore((state: AppState) => state.draggingRackId === rackId);
  const dragPosition = useStore((state: AppState) => state.draggingRackId === rackId ? state.dragPosition : null);

  const isDarkMode = theme === "dark";
  // Use orientation from props directly instead of searching store.racks
  const orientation = orientationProp ?? 180;

  const { raycaster, mouse, camera } = useThree();
  const floorPlane = useMemo(
    () => new Plane(new Vector3(0, 1, 0), 0),
    [],
  );
  const tempPoint = useMemo(() => new Vector3(), []);

  // Phase 1-B: 캐시된 perforatedTexture 사용
  const perforatedTexture = useMemo(() => getPerforatedTexture(rackSize), [rackSize]);

  const height = rackSize * U_HEIGHT + 0.1;
  const width = rackWidth;
  const depth = (rackDepth || 100) / 100; // cm to m

  // Theme-based colors
  const frameColor = isSelected
    ? "#FFFFFF" // White highlight for selected
    : isHovered
      ? isDarkMode
        ? "#616a7d" // 중간 밝기의 쿨그레이 (기본 #2e313b와 선택 #FFFFFF의 중간)
        : "#6e727a" // 중간 밝기의 그레이 (기본 #333333과 선택 #FFFFFF의 중간)
      : isDarkMode
        ? "#2e313b" // Darker than background
        : "#333333";
  const railColor = isDarkMode ? "#aab0be" : "#888";
  const rearPanelColor = isDarkMode ? "#24272e" : "#111";

  // Convert orientation to radians with proper mapping:
  // North (0°) should face -Z world (180° rotation)
  // East (90°) should face +X world (90° rotation)
  // South (180°) should face +Z world (0° rotation)
  // West (270°) should face -X world (270° rotation)
  // Formula: (180 - orientation)
  const rotationRad = ((180 - (orientation ?? 0)) * Math.PI) / 180;

  const groupRef = useRef<Group>(null);
  const doorRef = useRef<Group>(null);
  const isFirstRender = useRef(true);

  // Declarative animation - Purely reactive to props/state
  const currentTargetPos = useMemo(() =>
    isInternalDragging && dragPosition
      ? [dragPosition[0], height / 2 + 0.4, dragPosition[1]]
      : [position[0] * GRID_SPACING, height / 2, position[1] * GRID_SPACING]
    , [isInternalDragging, dragPosition, position, height]);

  useFrame((_, delta) => {
    // 1. First-frame direct sync to prevent visible jump/slide on mount
    if (isFirstRender.current) {
      if (groupRef.current) {
        groupRef.current.position.set(currentTargetPos[0], currentTargetPos[1], currentTargetPos[2]);
        groupRef.current.rotation.y = rotationRad;
        groupRef.current.scale.setScalar(1);
      }
      if (doorRef.current) {
        doorRef.current.rotation.y = isInternalFocused ? -Math.PI / 2 : 0;
      }
      isFirstRender.current = false;
      return;
    }

    // 2. groupRef animation interpolation
    if (groupRef.current) {
      if (isInternalDragging) {
        groupRef.current.position.set(currentTargetPos[0], currentTargetPos[1], currentTargetPos[2]);
        groupRef.current.scale.setScalar(1.05);
      } else {
        groupRef.current.position.x = MathUtils.damp(groupRef.current.position.x, currentTargetPos[0], 12, delta);
        groupRef.current.position.y = MathUtils.damp(groupRef.current.position.y, currentTargetPos[1], 12, delta);
        groupRef.current.position.z = MathUtils.damp(groupRef.current.position.z, currentTargetPos[2], 12, delta);

        groupRef.current.scale.x = MathUtils.damp(groupRef.current.scale.x, 1, 12, delta);
        groupRef.current.scale.y = MathUtils.damp(groupRef.current.scale.y, 1, 12, delta);
        groupRef.current.scale.z = MathUtils.damp(groupRef.current.scale.z, 1, 12, delta);
      }
      groupRef.current.rotation.y = MathUtils.damp(groupRef.current.rotation.y, rotationRad, 12, delta);
    }

    // 3. doorRef animation interpolation
    if (doorRef.current) {
      const targetDoorRotation = isInternalFocused ? -Math.PI / 2 : 0;
      doorRef.current.rotation.y = MathUtils.damp(doorRef.current.rotation.y, targetDoorRotation, 8, delta);
    }
  });

  const shouldBlockRackEvent = (e: ThreeEvent<PointerEvent | MouseEvent>): boolean => {
    const state = useStore.getState();
    if (state.isGizmoHovered) return true;

    // 1. Gizmo helper check
    const hitGizmoHelper = e.intersections.some((hit) => {
      let obj: Object3D | null = hit.object;
      let isInner = false;
      let isGizmo = false;
      while (obj) {
        if (obj.userData?.isInnerContent) isInner = true;
        if (obj.userData?.isGizmoHelper || obj.userData?.isGizmo) isGizmo = true;
        obj = obj.parent;
      }
      return isGizmo && !isInner;
    });
    if (hitGizmoHelper) return true;

    // 2. Model container priority check
    // 뷰 모드에서는 오직 사용자 인터랙션이 있는 모델(CCTV, 온습도계)만 랙 호버/클릭을 우선 차단하고,
    // 투명한 자동문이나 가벽, 책상 등의 일반 모델은 랙 이벤트를 가로막지 않도록 함
    for (const hit of e.intersections) {
      if (hit.object === e.eventObject) break;
      let obj: Object3D | null = hit.object;
      let shouldYieldToModel = false;
      while (obj) {
        if (obj.userData && obj.userData.isModelContainer) {
          if (state.isEditMode) {
            shouldYieldToModel = true;
          } else {
            const modelId = obj.userData.modelId;
            const model = state.importedModels.find((m) => m.id === modelId);
            if (model) {
              const isCctv =
                model.builtinType === "CCTV" ||
                model.fileName?.toLowerCase().includes("cctv") ||
                model.name?.toLowerCase().includes("cctv");
              const isThermoHygro =
                model.builtinType === "ThermoHygro" ||
                model.fileName?.toLowerCase().includes("thermo_hygro") ||
                model.name?.toLowerCase().includes("온습도") ||
                model.name?.toLowerCase().includes("thermo");
              if (isCctv || isThermoHygro) {
                shouldYieldToModel = true;
              }
            }
          }
          break;
        }
        obj = obj.parent;
      }
      if (shouldYieldToModel) return true;
    }

    // 3. Closest interactBox check - prevent click/hover passing through to racks behind
    const firstRackHit = e.intersections.find(
      (hit) => (hit.object as Mesh).geometry === SHARED_GEO.interactBox
    );
    if (firstRackHit && firstRackHit.object !== e.eventObject) return true;

    return false;
  };

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return; // Only process left click
    if (isObstructing) return;
    if (shouldBlockRackEvent(e)) return;

    e.stopPropagation();
    const { setDragging, updateDragPosition, isEditMode } =
      useStore.getState();

    if (!isEditMode) return;

    // Use the camera we already have from the top-level useThree() hook
    raycaster.setFromCamera(mouse, camera);
    if (raycaster.ray.intersectPlane(floorPlane, tempPoint)) {
      const rackWorldX = position[0] * GRID_SPACING;
      const rackWorldZ = position[1] * GRID_SPACING;

      // Offset = ClickedFloorPoint - RackCenter
      const offset: [number, number] = [
        tempPoint.x - rackWorldX,
        tempPoint.z - rackWorldZ,
      ];

      setDragging(true, rackId, offset);
      updateDragPosition([rackWorldX, rackWorldZ]);
      document.body.style.cursor = "grabbing";
    }
  };

  const handleHover = (e: ThreeEvent<PointerEvent>, side?: "front" | "rear") => {
    if (shouldBlockRackEvent(e)) return;
    e.stopPropagation();

    if (side) setHoveredSide(side);
    const state = useStore.getState();
    const isSelected = state.selectedRackId === rackId;
    if (!isSelected) {
      if (state.hoveredRackId !== rackId) {
        setHoveredRack(rackId);
      }
      if (!state.isDragging) {
        document.body.style.cursor = state.isEditMode ? "grab" : "pointer";
      }
    }
  };

  const setHoveredRack = useStore((state: AppState) => state.setHoveredRack);
  const isGlobalDragging = useStore((state: AppState) => state.isDragging);

  const initialPos = useMemo(() => [position[0] * GRID_SPACING, height / 2, position[1] * GRID_SPACING], [position, height]);
  const initialRot = useMemo(() => [0, rotationRad, 0], [rotationRad]);

  const racks = useStore((state: AppState) => state.racks);
  const nodeRacks = useMemo(() => racks.filter(r => r.mapId === mapId), [racks, mapId]);

  const snappedGhostPosition = useMemo(() => {
    if (!isInternalDragging || !dragPosition) return null;

    let gridX = dragPosition[0] / GRID_SPACING;
    let gridZ = dragPosition[1] / GRID_SPACING;

    const SNAP_THRESHOLD = 0.5;
    const worldX = dragPosition[0];
    const worldZ = dragPosition[1];
    let finalGridX = gridX;
    let finalGridZ = gridZ;

    let xSnapped = false;
    for (const other of nodeRacks) {
      if (other.rackId === rackId) continue;

      const otherDepth = (other.rackDepth || 100) / 100;
      const myFrontZ = worldZ + depth / 2;
      const otherFrontZ = other.position[1] * GRID_SPACING + otherDepth / 2;

      // X-axis snap (Side by Side - Align by Front Face)
      if (Math.abs(myFrontZ - otherFrontZ) <= 0.2) {
        const otherWorldX = other.position[0] * GRID_SPACING;
        const gap = Math.abs(worldX - otherWorldX) - (width + other.width) / 2;
        if (gap >= -0.1 && gap < SNAP_THRESHOLD) {
          const direction = worldX > otherWorldX ? 1 : -1;
          const RACK_GAP = 0.01;
          const snappedWorldX = otherWorldX + (direction * (other.width + width)) / 2 + (direction * RACK_GAP);
          finalGridX = snappedWorldX / GRID_SPACING;
          finalGridZ = (otherFrontZ - depth / 2) / GRID_SPACING;
          xSnapped = true;
          break;
        }
      }
    }

    if (!xSnapped) {
      for (const other of nodeRacks) {
        if (other.rackId === rackId) continue;
        const otherWorldX = other.position[0] * GRID_SPACING;
        if (Math.abs(worldX - otherWorldX) > (width + other.width) / 2 + 0.1) continue;

        const otherDepth = (other.rackDepth || 100) / 100;
        const otherWorldZ = other.position[1] * GRID_SPACING;
        const zGap = Math.abs(worldZ - otherWorldZ) - (depth + otherDepth) / 2;
        if (zGap >= -0.1 && zGap < SNAP_THRESHOLD) {
          const direction = worldZ > otherWorldZ ? 1 : -1;
          const snappedWorldZ = otherWorldZ + (direction * (depth + otherDepth)) / 2;
          finalGridZ = snappedWorldZ / GRID_SPACING;
          finalGridX = other.position[0];
          break;
        }
      }
    }

    return [finalGridX * GRID_SPACING, finalGridZ * GRID_SPACING];
  }, [isInternalDragging, dragPosition, nodeRacks, rackId, width, depth]);

  return (
    <>
      {snappedGhostPosition && (
        <group position={[snappedGhostPosition[0], 0.005, snappedGhostPosition[1]]} rotation={[-Math.PI / 2, 0, rotationRad]}>
          <mesh>
            <planeGeometry args={[width, depth]} />
            <meshBasicMaterial color={isDarkMode ? "#ef4444" : "#dc2626"} transparent opacity={0.15} depthWrite={false} />
            <Edges scale={1.0} threshold={15} color={isDarkMode ? "#f87171" : "#ef4444"} />
          </mesh>
        </group>
      )}
      <group
        ref={groupRef}
        visible={!isObstructing}
        raycast={isObstructing ? () => null : Object3D.prototype.raycast}
        position={initialPos as unknown as Vector3}
        rotation={initialRot as unknown as Euler}
        scale={[1, 1, 1]}
      >
        {/* 1. STRUCTURAL FRAME (Main Skeleton) */}
        <group>
          {/* Main Enclosure (Solid frame with better corner joins) */}
          {/* Top */}
          <mesh position={[0, height / 2 - 0.015, 0]} geometry={SHARED_GEO.topBottom} scale={[width, 1, depth]}>
            <meshStandardMaterial
              color={frameColor}
              roughness={0.6}
              metalness={0.9}
            />
          </mesh>
          {/* Bottom */}
          <mesh position={[0, -height / 2 + 0.015, 0]} geometry={SHARED_GEO.topBottom} scale={[width, 1, depth]}>
            <meshStandardMaterial
              color={frameColor}
              roughness={0.6}
              metalness={0.9}
            />
          </mesh>
          {/* Left Side – corner posts only (no full-depth wall, so perforated holes reveal interior) */}
          <mesh position={[-width / 2 + 0.01, 0, depth / 2 - 0.01]} geometry={SHARED_GEO.cornerPost} scale={[1, height, 1]}>
            <meshStandardMaterial
              color={frameColor}
              roughness={0.6}
              metalness={0.9}
            />
          </mesh>
          <mesh position={[-width / 2 + 0.01, 0, -depth / 2 + 0.01]} geometry={SHARED_GEO.cornerPost} scale={[1, height, 1]}>
            <meshStandardMaterial
              color={frameColor}
              roughness={0.6}
              metalness={0.9}
            />
          </mesh>
          {/* Right Side – corner posts only */}
          <mesh position={[width / 2 - 0.01, 0, depth / 2 - 0.01]} geometry={SHARED_GEO.cornerPost} scale={[1, height, 1]}>
            <meshStandardMaterial
              color={frameColor}
              roughness={0.6}
              metalness={0.9}
            />
          </mesh>
          <mesh position={[width / 2 - 0.01, 0, -depth / 2 + 0.01]} geometry={SHARED_GEO.cornerPost} scale={[1, height, 1]}>
            <meshStandardMaterial
              color={frameColor}
              roughness={0.6}
              metalness={0.9}
            />
          </mesh>

          {/* ── LEFT SIDE PANEL ── */}
          <PerforatedPanel xOff={-width / 2} rotY={-Math.PI / 2} panelW={depth - 0.04} panelH={height - 0.06} color={frameColor} texture={perforatedTexture} />

          {/* ── RIGHT SIDE PANEL ── */}
          <PerforatedPanel xOff={width / 2} rotY={Math.PI / 2} panelW={depth - 0.04} panelH={height - 0.06} color={frameColor} texture={perforatedTexture} />

          <group position={[0, 0, 0]}>
            {/* Internal Structural Bracing - Horizontal rails at the back */}
            <mesh position={[0, height / 2 - 0.15, -depth / 2 + 0.1]} geometry={SHARED_GEO.hBrace} scale={[width - 0.04, 1, 1]}>
              <meshStandardMaterial color={frameColor} roughness={0.8} />
            </mesh>
            <mesh position={[0, -height / 2 + 0.15, -depth / 2 + 0.1]} geometry={SHARED_GEO.hBrace} scale={[width - 0.04, 1, 1]}>
              <meshStandardMaterial color={frameColor} roughness={0.8} />
            </mesh>

            {/* Vertical Mounting Rails (Front) - 사이드 쪽으로 밀착, 앞쪽으로 전진 배치 */}
            <mesh position={[-width / 2 + 0.025, 0, depth / 2 - 0.045]} geometry={SHARED_GEO.frontRail} scale={[1, height - 0.08, 1]}>
              <meshStandardMaterial
                color={railColor}
                metalness={1}
                roughness={0.2}
              />
            </mesh>
            <mesh position={[width / 2 - 0.025, 0, depth / 2 - 0.045]} geometry={SHARED_GEO.frontRail} scale={[1, height - 0.08, 1]}>
              <meshStandardMaterial
                color={railColor}
                metalness={1}
                roughness={0.2}
              />
            </mesh>

            {/* Vertical Support Rails (Back) - 사이드 쪽으로 밀착 배치 */}
            <mesh position={[-width / 2 + 0.025, 0, -depth / 2 + 0.08]} geometry={SHARED_GEO.backRail} scale={[1, height - 0.08, 1]}>
              <meshStandardMaterial color={railColor} roughness={0.3} metalness={0.9} />
            </mesh>
            <mesh position={[width / 2 - 0.025, 0, -depth / 2 + 0.08]} geometry={SHARED_GEO.backRail} scale={[1, height - 0.08, 1]}>
              <meshStandardMaterial color={railColor} roughness={0.3} metalness={0.9} />
            </mesh>
          </group>
        </group>

        {/* 2. REAR PANEL (Solid opaque plate – no perforation) */}
        <group position={[0, 0, -depth / 2 + 0.02]}>
          {/* Panel Bezel / Frame */}
          <mesh position={[0, 0, -0.005]} geometry={SHARED_GEO.rearBezel} scale={[width - 0.02, height - 0.04, 1]}>
            <meshStandardMaterial color={frameColor} roughness={0.7} />
          </mesh>
          {/* Solid Rear Plate */}
          <mesh position={[0, 0, 0.001]}>
            <planeGeometry args={[width - 0.08, height - 0.1]} />
            <meshStandardMaterial
              color={rearPanelColor}
              roughness={0.9}
              metalness={0.6}
              side={DoubleSide}
            />
          </mesh>
        </group>

        {/* 3. FRONT HINGED DOOR (Hollow Frame + Glass) */}
        <group
          ref={doorRef}
          position={[-width / 2, 0, depth / 2]} // Pivot at exact left edge
        >
          {/* Door Frame Border - Top */}
          <mesh position={[width / 2, height / 2 - 0.02, 0.01]} geometry={SHARED_GEO.doorHBar} scale={[width, 1, 1]}>
            <meshStandardMaterial
              color={frameColor}
              roughness={0.7}
              metalness={0.8}
            />
          </mesh>
          {/* Door Frame Border - Bottom */}
          <mesh position={[width / 2, -height / 2 + 0.02, 0.01]} geometry={SHARED_GEO.doorHBar} scale={[width, 1, 1]}>
            <meshStandardMaterial
              color={frameColor}
              roughness={0.7}
              metalness={0.8}
            />
          </mesh>
          {/* Door Frame Border - Left */}
          <mesh position={[0.02, 0, 0.01]} geometry={SHARED_GEO.doorVBar} scale={[1, height - 0.08, 1]}>
            <meshStandardMaterial
              color={frameColor}
              roughness={0.7}
              metalness={0.8}
            />
          </mesh>
          {/* Door Frame Border - Right */}
          <mesh position={[width - 0.02, 0, 0.01]} geometry={SHARED_GEO.doorVBar} scale={[1, height - 0.08, 1]}>
            <meshStandardMaterial
              color={frameColor}
              roughness={0.7}
              metalness={0.8}
            />
          </mesh>

          {/* Glass Center Panel - Optimized to MeshStandardMaterial */}
          <mesh position={[width / 2, 0, 0.01]}>
            <planeGeometry args={[width - 0.08, height - 0.08]} />
            <meshStandardMaterial
              transparent
              opacity={0.1}
              color="#000000"
              roughness={0}
              metalness={0.5}
            />
          </mesh>
        </group>

        {isBidirectional ? (
          <group>
            {/* Front Interact Box */}
            <mesh
              visible={!(isSelected && !isEditMode && selectedRackSide === "front")}
              userData={{ isRackInteractBox: true, rackId, rackSide: "front" }}
              raycast={isObstructing ? () => null : Mesh.prototype.raycast}
              geometry={SHARED_GEO.interactBox}
              scale={[width, height, depth / 2]}
              position={[0, 0, depth / 4]}
              onPointerDown={isObstructing ? undefined : handlePointerDown}
              onClick={isObstructing ? undefined : (e) => {
                if (e.delta > 15) return;
                (e as any).stoppedByRack = true;
                if (shouldBlockRackEvent(e)) return;
                e.stopPropagation();

                const state = useStore.getState();
                const isAlreadySelected = state.selectedRackId === rackId;
                if (!isAlreadySelected || state.selectedRackSide !== "front") {
                  state.selectRack(rackId, "front");
                  if (!state.isEditMode) state.focusRack(rackId);
                }
              }}
              onPointerOver={isObstructing ? undefined : (e) => handleHover(e, "front")}
              onPointerMove={isObstructing ? undefined : (e) => handleHover(e, "front")}
              onPointerOut={isObstructing ? undefined : () => {
                setHoveredSide(null);
                const state = useStore.getState();
                if (state.hoveredRackId === rackId) {
                  setHoveredRack(null);
                  if (document.body.style.cursor === "grab" || document.body.style.cursor === "pointer") {
                    document.body.style.cursor = "auto";
                  }
                }
              }}
            >
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>

            {/* Rear Interact Box */}
            <mesh
              visible={!(isSelected && !isEditMode && selectedRackSide === "rear")}
              userData={{ isRackInteractBox: true, rackId, rackSide: "rear" }}
              raycast={isObstructing ? () => null : Mesh.prototype.raycast}
              geometry={SHARED_GEO.interactBox}
              scale={[width, height, depth / 2]}
              position={[0, 0, -depth / 4]}
              onPointerDown={isObstructing ? undefined : handlePointerDown}
              onClick={isObstructing ? undefined : (e) => {
                if (e.delta > 15) return;
                (e as any).stoppedByRack = true;
                if (shouldBlockRackEvent(e)) return;
                e.stopPropagation();

                const state = useStore.getState();
                const isAlreadySelected = state.selectedRackId === rackId;
                if (!isAlreadySelected || state.selectedRackSide !== "rear") {
                  state.selectRack(rackId, "rear");
                  if (!state.isEditMode) state.focusRack(rackId);
                }
              }}
              onPointerOver={isObstructing ? undefined : (e) => handleHover(e, "rear")}
              onPointerMove={isObstructing ? undefined : (e) => handleHover(e, "rear")}
              onPointerOut={isObstructing ? undefined : () => {
                setHoveredSide(null);
                const state = useStore.getState();
                if (state.hoveredRackId === rackId) {
                  setHoveredRack(null);
                  if (document.body.style.cursor === "grab" || document.body.style.cursor === "pointer") {
                    document.body.style.cursor = "auto";
                  }
                }
              }}
            >
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
        ) : (
          <mesh
            visible={!(isSelected && !isEditMode)}
            userData={{ isRackInteractBox: true, rackId, rackSide: "front" }}
            raycast={isObstructing ? () => null : Mesh.prototype.raycast}
            geometry={SHARED_GEO.interactBox}
            scale={[width, height, depth]}
            onPointerDown={isObstructing ? undefined : handlePointerDown}
            onClick={isObstructing ? undefined : (e) => {
              if (e.delta > 15) return; // Ignore drag
              (e as any).stoppedByRack = true;
              if (shouldBlockRackEvent(e)) return;
              e.stopPropagation();

              const state = useStore.getState();
              const isAlreadySelected = state.selectedRackId === rackId;
              if (!isAlreadySelected || state.selectedRackSide !== "front") {
                state.selectRack(rackId, "front"); // default to front for unidirectional
                if (!state.isEditMode) {
                  state.focusRack(rackId);
                }
              }
            }}
            onPointerOver={isObstructing ? undefined : (e) => handleHover(e)}
            onPointerMove={isObstructing ? undefined : (e) => handleHover(e)}
            onPointerOut={isObstructing ? undefined : () => {
              const state = useStore.getState();
              if (state.hoveredRackId === rackId) {
                setHoveredRack(null);
                if (
                  document.body.style.cursor === "grab" ||
                  document.body.style.cursor === "pointer"
                ) {
                  document.body.style.cursor = "auto";
                }
              }
            }}
          >
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        )}

        {/* 랙 호버 시 은은한 볼륨 하이라이트 및 네온 엣지 아웃라인 */}
        {isHovered && !isSelected && (
          <mesh
            position={
              isBidirectional && hoveredSide
                ? [0, 0, hoveredSide === "rear" ? -depth / 4 : depth / 4]
                : [0, 0, 0]
            }
            raycast={() => null}
          >
            <boxGeometry
              args={
                isBidirectional && hoveredSide
                  ? [width + 0.004, height + 0.004, depth / 2 + 0.004]
                  : [width + 0.004, height + 0.004, depth + 0.004]
              }
            />
            <meshBasicMaterial
              color={isDarkMode ? "#38bdf8" : "#2563eb"}
              transparent
              opacity={0.12}
              depthWrite={false}
            />
            <Edges
              scale={1.0}
              threshold={15}
              color={isDarkMode ? "#38bdf8" : "#2563eb"}
              lineWidth={3}
              raycast={() => null}
            />
          </mesh>
        )}

        {/* 선택된 랙 내부 빈 공간 클릭 시 뒤쪽 랙으로 광선이 관통하여 원치 않게 선택되는 문제 방어 */}
        {isSelected && !isEditMode && (
          <mesh
            position={[0, 0, 0]}
            onClick={(e) => {
              if (e.delta > 15) return; // 드래그 무시
              (e as unknown as { stoppedByRack: boolean }).stoppedByRack = true;
              e.stopPropagation();
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              if (document.body.style.cursor === "pointer") {
                document.body.style.cursor = "auto";
              }
            }}
            onPointerMove={(e) => {
              e.stopPropagation();
            }}
          >
            <boxGeometry args={[width - 0.02, height - 0.02, depth - 0.02]} />
            <meshBasicMaterial side={BackSide} transparent opacity={0} depthWrite={false} />
          </mesh>
        )}

        {/* Phase 1: 호버 태그 — DOM 마운트 비용 방지 대신 수백 개의 Html 컴포넌트가 프레임을 저하시키는 것을 방지하기 위해 isHovered 상태에서만 렌더링 */}
        <Billboard position={[0, height / 2 + 0.15, 0]} visible={isHovered}>
          {isHovered && (
            <Html center zIndexRange={[0, 10]} style={{ pointerEvents: "none" }}>
              <div
                style={{
                  background: isDarkMode
                    ? "rgba(23, 24, 28, 0.85)"
                    : "rgba(255, 255, 255, 0.9)",
                  color: isDarkMode ? "#ebedef" : "#202226",
                  padding: "4px 12px",
                  borderRadius: "16px",
                  fontSize: "12px",
                  fontWeight: 600,
                  border: isDarkMode
                    ? isSelected
                      ? "1px solid #FFFFFF"
                      : "1px solid rgba(56, 189, 248, 0.6)"
                    : isSelected
                      ? "1px solid #1a73e8"
                      : "1px solid rgba(37, 99, 235, 0.5)",
                  boxShadow: isDarkMode
                    ? isSelected
                      ? "0 4px 15px rgba(0, 0, 0, 0.4)"
                      : "0 0 12px rgba(56, 189, 248, 0.35), 0 4px 15px rgba(0, 0, 0, 0.4)"
                    : isSelected
                      ? "0 4px 12px rgba(0, 0, 0, 0.1)"
                      : "0 0 10px rgba(37, 99, 235, 0.25), 0 4px 12px rgba(0, 0, 0, 0.1)",
                  whiteSpace: "nowrap",
                  backdropFilter: "blur(8px)",
                  pointerEvents: "none",
                  userSelect: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontFamily: "Inter, system-ui, sans-serif",
                }}
              >
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: isDarkMode
                      ? isSelected
                        ? "#FFFFFF"
                        : "#38bdf8"
                      : isSelected
                        ? "#1a73e8"
                        : "#2563eb",
                    boxShadow: isDarkMode
                      ? isSelected ? "none" : "0 0 6px #38bdf8"
                      : isSelected ? "none" : "0 0 4px #2563eb",
                    display: "inline-block",
                  }}
                />
                <span>{`${rackSize}U`}</span>
                <span style={{ opacity: 0.4 }}>|</span>
                <span>
                  {rackTitle || `Rack ${rackId.slice(0, 4).toUpperCase()}`}
                </span>
              </div>
            </Html>
          )}
        </Billboard>

        {isInternalFocused && !isEditMode && (
          <group position={[0, 0, depth / 2 - 0.02]}>
            {/* Top Blue LED Line (Core) - Made very thin */}
            <mesh position={[0, height / 2 - 0.03, 0]}>
              <boxGeometry args={[width - 0.08, 0.005, 0.005]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            {/* Top Blue Glow Lights extracted to GlobalFocusLights */}

            {/* Bottom Blue LED Line (Core) */}
            <mesh position={[0, -height / 2 + 0.03, 0]}>
              <boxGeometry args={[width - 0.08, 0.005, 0.005]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            {/* Bottom Blue Glow Lights extracted to GlobalFocusLights */}
          </group>
        )}

        <group position={[0, 0, depth / 2 - 0.07]} key={`devices-${isSelected}`}>
          {/* Main White Light extracted to GlobalFocusLights */}
          {devices.map((device) => (
            <MemoDeviceMesh
              key={device.itemId}
              device={device}
              rackHeight={height}
              rackWidth={width}
              rackId={rackId}
              isObstructing={isObstructing}
              rackTitle={rackTitle}
              rackDepth={depth}
            />
          ))}
        </group>
        {/* Only mount ErrorMarker when rack has error devices and NOT in edit mode */}
        {!isEditMode && devices.some((d) => d.portStates?.some((p) => p.status === "error")) && (
          <ErrorMarker
            rack={{
              rackId,
              rackSize,
              position,
              devices,
              width,
              mapId,
            }}
          />
        )}
      </group>
    </>
  );
});

// Phase 1: PerforatedPanel — IIFE 제거, memo 컴포넌트로 분리
const PerforatedPanel = memo(({ xOff, rotY, panelW, panelH, color, texture }: {
  xOff: number; rotY: number; panelW: number; panelH: number; color: string; texture: CanvasTexture;
}) => (
  <group position={[xOff, 0, 0]} rotation={[0, rotY, 0]}>
    <mesh>
      <planeGeometry args={[panelW, panelH]} />
      <meshStandardMaterial
        color={color}
        roughness={0.7}
        metalness={0.8}
        alphaMap={texture}
        transparent
        alphaTest={0.5}
        side={DoubleSide}
        depthWrite={false}
      />
    </mesh>
  </group>
));

// Phase 1: MemoDeviceMesh — onSelect를 내부에서 안정화
const MemoDeviceMesh = memo(({ device, rackHeight, rackWidth, rackId, isObstructing, rackTitle, rackDepth }: {
  device: Device; rackHeight: number; rackWidth: number; rackId: string; isObstructing: boolean; rackTitle?: string; rackDepth?: number;
}) => {
  const onSelect = useCallback(() => {
    const { focusRack, selectDevice, isEditMode, selectedRackId } = useStore.getState();
    if (isEditMode) return;
    if (selectedRackId === rackId) {
      selectDevice(device.itemId);
    } else {
      focusRack(rackId);
    }
  }, [rackId, device.itemId]);

  return (
    <DeviceMesh
      device={device}
      rackHeight={rackHeight}
      rackWidth={rackWidth}
      onSelect={onSelect}
      isObstructing={isObstructing}
      rackTitle={rackTitle}
      rackId={rackId}
      rackDepth={rackDepth}
    />
  );
});

const EMPTY_ARRAY: any[] = [];

const DeviceMesh = ({
  device,
  rackHeight,
  rackWidth,
  onSelect,
  isObstructing,
  rackTitle,
  rackId,
  isRackFocused,
  rackDepth = 1.0,
}: {
  device: Device;
  rackHeight: number;
  rackWidth: number;
  onSelect: () => void;
  isObstructing?: boolean;
  rackTitle?: string;
  rackId: string;
  isRackFocused?: boolean;
  rackDepth?: number;
}) => {
  const meshRef = useRef<Mesh>(null);
  const faceplateRef = useRef<Mesh>(null);
  const highlightedDeviceId = useStore((s) => s.highlightedDeviceId);
  const isHighlighted = highlightedDeviceId === device.itemId || (device.deviceId && highlightedDeviceId === device.deviceId);
  const [isDeviceHovered, setIsDeviceHovered] = useState(false);

  const deviceH = device.size * U_HEIGHT;
  const bottomY = -rackHeight / 2;
  const yOffset = (device.position - 1) * U_HEIGHT;
  const centerY = bottomY + yOffset + deviceH / 2 + 0.05;
  const deviceWidth = rackWidth - 0.06;

  const isEditMode = useStore((s) => s.isEditMode);

  const { hasError, errorColor } = useMemo(() => {
    if (isEditMode) return { hasError: false, errorColor: null };
    const err = getHighestError(device.portStates);
    return {
      hasError: err !== null,
      errorColor: err?.color ?? null,
    };
  }, [device.portStates, isEditMode]);

  // 에러 + 선택 + 호버 모두 애니메이션(또는 발광) 필요
  const needsAnimation = isHighlighted || isDeviceHovered || (hasError && !!errorColor);

  // Cache Color objects to avoid per-frame allocation
  const highlightColor = useMemo(() => new Color("#4dabf7"), []);
  const blackColor = useMemo(() => new Color("#000000"), []);

  // Reset emissive once when animation stops (instead of every frame)
  useEffect(() => {
    if (!needsAnimation) {
      const bodyMat = meshRef.current?.material;
      const faceMat = faceplateRef.current?.material;

      const resetMat = (m: any) => {
        if (!m) return;
        if (Array.isArray(m)) {
          m.forEach(resetMat);
        } else if (m instanceof MeshStandardMaterial) {
          m.emissive.copy(blackColor);
          m.emissiveIntensity = 0;
          if (!m.userData?.isFrontTransparent) {
            m.opacity = 1.0;
          }
        }
      };

      resetMat(bodyMat);
      resetMat(faceMat);
    }
  }, [needsAnimation, blackColor]);

  // Phase 1-C: early return 패턴으로 빈 함수 호출 오버헤드 제거
  useFrame((state) => {
    if (!needsAnimation) return;
    state.invalidate();
    const clock = state.clock;

    const bodyMat = meshRef.current?.material;
    const faceMat = faceplateRef.current?.material;

    const setMatEmissive = (m: any, col: Color | string, intensity: number) => {
      if (!m) return;
      if (Array.isArray(m)) {
        m.forEach((sub) => setMatEmissive(sub, col, intensity));
      } else if (m instanceof MeshStandardMaterial) {
        if (typeof col === "string") {
          m.emissive.set(col);
        } else {
          m.emissive.copy(col);
        }
        m.emissiveIntensity = intensity;
      }
    };

    if (hasError && errorColor) {
      const intensity =
        0.5 + Math.sin(clock.getElapsedTime() * Math.PI * 3) * 0.5;

      setMatEmissive(bodyMat, errorColor, intensity * 0.375);
      setMatEmissive(faceMat, errorColor, intensity * 0.875);
    } else if (isHighlighted) {
      const pulse =
        0.5 + Math.sin(clock.getElapsedTime() * Math.PI * 1.6) * 0.5;

      setMatEmissive(bodyMat, highlightColor, pulse * 4);
      setMatEmissive(faceMat, highlightColor, pulse * 4);
    } else if (isDeviceHovered) {
      // Hovered device uses outline only, not material glow.
      setMatEmissive(bodyMat, blackColor, 0);
      setMatEmissive(faceMat, blackColor, 0);
    }
  });

  const customModels = useStore((s) => s.customModels);

  const thumbUrl = useMemo(
    () => {
      // 1. Per-device override (if any)
      if (device.devicePngRaw) {
        return device.devicePngRaw;
      }
      // 2. Custom variant thumbnail
      const customModel = customModels.find(m => m.modelName === device.modelName);
      if (customModel && customModel.modelPngRaw) {
        return customModel.modelPngRaw;
      }
      // 3. Fallback to default static image (which includes chassis-thumbnails)
      return resolveDeviceImage(device.modelName, device.defaultViewSide || "front");
    },
    [device.defaultViewSide, device.modelName, device.devicePngRaw, customModels],
  );

  const resolvedUrl = useDeferredValue(thumbUrl);

  const actualDepth = Math.min(DEVICE_DEPTH, rackDepth - 0.1);
  const validDepth = Math.max(actualDepth, 0.1);
  const deviceZCenter = 0.06 - validDepth / 2;

  const isChassis = isChassisModel(device.modelName || "");

  const chassisBodyMaterials = useMemo(() => {
    if (!isChassis) return null;
    const standardMat = new MeshStandardMaterial({
      color: "#c8d2df",
      roughness: 0.36,
      metalness: 0.7,
    });
    const frontTransparentMat = new MeshStandardMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    frontTransparentMat.userData = { isFrontTransparent: true };

    // Three.js BoxGeometry material order: [+X, -X, +Y, -Y, +Z (Front), -Z (Back)]
    return [
      standardMat,
      standardMat,
      standardMat,
      standardMat,
      frontTransparentMat,
      standardMat,
    ];
  }, [isChassis]);

  return (
    <group
      position={[0, centerY, deviceZCenter]}
      onClick={(e) => {
        if (isObstructing) return;
        if (e.delta > 5) return; // Ignore if it was a drag

        if (useStore.getState().isGizmoHovered) return;
        const hitGizmoHelper = e.intersections.some((hit) => {
          let obj: Object3D | null = hit.object;
          while (obj) {
            if (obj.userData?.isGizmoHelper || obj.userData?.isGizmo) return true;
            obj = obj.parent;
          }
          return false;
        });
        if (hitGizmoHelper) return;

        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={(e) => {
        if (isObstructing) return;
        const state = useStore.getState();
        if (state.isGizmoHovered) return;
        if (state.selectedRackId !== rackId) return;
        if (state.isEditMode) return;

        const hitGizmoHelper = e.intersections.some((hit) => {
          let obj: Object3D | null = hit.object;
          while (obj) {
            if (obj.userData?.isGizmoHelper || obj.userData?.isGizmo) return true;
            obj = obj.parent;
          }
          return false;
        });
        if (hitGizmoHelper) return;

        e.stopPropagation();
        setIsDeviceHovered(true);
        state.setHoveredDevice({
          device,
          x: e.clientX,
          y: e.clientY,
          rackTitle: rackTitle || `Rack ${rackId.substring(0, 4).toUpperCase()}`,
          rackId,
        });
        document.body.style.cursor = "pointer";
      }}
      onPointerMove={(e) => {
        if (isObstructing) return;
        const state = useStore.getState();
        if (state.isGizmoHovered) return;
        if (state.selectedRackId !== rackId) return;
        if (state.isEditMode) return;

        const hitGizmoHelper = e.intersections.some((hit) => {
          let obj: Object3D | null = hit.object;
          while (obj) {
            if (obj.userData?.isGizmoHelper || obj.userData?.isGizmo) return true;
            obj = obj.parent;
          }
          return false;
        });
        if (hitGizmoHelper) {
          const { hoveredDevice, setHoveredDevice } = state;
          if (hoveredDevice?.device.itemId === device.itemId) {
            setIsDeviceHovered(false);
            setHoveredDevice(null);
          }
          return;
        }

        e.stopPropagation();

        // R3F 렌더링 최적화/캐싱으로 인해 onPointerOver가 누락되는 경우를 대비해
        // onPointerMove에서도 hover 상태를 강제로 복구해줍니다.
        if (!isDeviceHovered) {
          setIsDeviceHovered(true);
          document.body.style.cursor = "pointer";
        }

        state.setHoveredDevice({
          device,
          x: e.clientX,
          y: e.clientY,
          rackTitle: rackTitle || `Rack ${rackId.substring(0, 4).toUpperCase()}`,
          rackId,
        });
      }}
      onPointerOut={(e) => {
        if (useStore.getState().selectedRackId !== rackId) return;
        e.stopPropagation();
        setIsDeviceHovered(false);
        const { hoveredDevice, setHoveredDevice } = useStore.getState();
        if (hoveredDevice?.device.itemId === device.itemId) {
          setHoveredDevice(null);
        }
        if (document.body.style.cursor === "pointer") {
          document.body.style.cursor = "auto";
        }
      }}
    >
      {(() => {
        const content = (
          <>
            <mesh ref={meshRef} material={chassisBodyMaterials || undefined}>
              <boxGeometry args={[deviceWidth, deviceH - 0.005, validDepth]} />
              {!chassisBodyMaterials && (
                <meshStandardMaterial
                  color="#666e79"
                  roughness={0.36}
                  metalness={0.7}
                />
              )}
              {isDeviceHovered && meshRef.current?.geometry && (
                <Edges
                  geometry={meshRef.current.geometry}
                  scale={1.01}
                  threshold={0.1}
                  color="#5ee0ff"
                  lineWidth={4}
                />
              )}
            </mesh>

            <group position={[0, 0, validDepth / 2 + 0.001]}>
              {resolvedUrl ? (
                <Suspense
                  fallback={
                    isChassis ? (
                      <ChassisRecessedFaceplate
                        device={device}
                        url={thumbUrl || ""}
                        width={deviceWidth}
                        height={deviceH - 0.005}
                        validDepth={validDepth}
                        hasError={hasError}
                      />
                    ) : (
                      <ImageFaceplate
                        url={thumbUrl || ""}
                        width={deviceWidth}
                        height={deviceH - 0.005}
                        hasError={hasError}
                      />
                    )
                  }
                >
                  {isChassis ? (
                    <ChassisRecessedFaceplate
                      device={device}
                      url={resolvedUrl}
                      width={deviceWidth}
                      height={deviceH - 0.005}
                      validDepth={validDepth}
                      ref={faceplateRef}
                      hasError={hasError}
                    />
                  ) : (
                    <ImageFaceplate
                      url={resolvedUrl}
                      width={deviceWidth}
                      height={deviceH - 0.005}
                      ref={faceplateRef}
                      hasError={hasError}
                    />
                  )}
                </Suspense>
              ) : (
                <DeviceFaceplate
                  type={device.type}
                  width={deviceWidth}
                  height={deviceH - 0.005}
                  ref={faceplateRef}
                  hasError={hasError}
                  errorColor={errorColor}
                />
              )}
            </group>
          </>
        );

        return content;
      })()}
    </group>
  );
};

// Phase 3: memo로 래핑하여 동일 url/size에 대한 불필요한 텍스처 리렌더 방지
const ImageFaceplate = memo(forwardRef<
  Mesh,
  {
    url: string;
    width: number;
    height: number;
    hasError?: boolean;
  }
>(({ url, width, height, hasError }, ref) => {
  const texture = useTexture(url);
  return (
    <mesh position={[0, 0, 0]} ref={ref}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial
        map={texture}
        color={hasError ? [0.8, 0.8, 0.8] : [2.5, 2.5, 2.5]}
        bumpMap={texture}
        bumpScale={10}
        toneMapped={false}
      />
    </mesh>
  );
}));

const DeviceFaceplate = forwardRef<
  Mesh,
  {
    type: Device["type"];
    width: number;
    height: number;
    hasError?: boolean;
    errorColor?: string | null;
  }
>(({ type, width, height, hasError, errorColor }, ref) => {
  const isServer = type === "Server";
  const isRouter = type === "Router";
  const isSwitch = type === "Switch";

  return (
    <group>
      <mesh ref={ref}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          color="#1a1a1a"
          roughness={0.8}
        />
      </mesh>

      <mesh position={[-width / 2 + 0.04, 0, 0.001]}>
        <circleGeometry args={[0.006, 16]} />
        <meshBasicMaterial
          color={hasError && errorColor ? errorColor : "#00ff00"}
        />
      </mesh>
      <mesh position={[-width / 2 + 0.06, 0, 0.001]}>
        <circleGeometry args={[0.006, 16]} />
        <meshBasicMaterial
          color={
            hasError && errorColor
              ? errorColor
              : isServer
                ? "#00ff00"
                : "#ffaa00"
          }
        />
      </mesh>

      {isSwitch && (
        <group position={[0.05, 0, 0.001]}>
          {Array.from({ length: 12 }).map((_, i) => (
            <mesh
              key={i}
              position={[-0.15 + (i % 6) * 0.06, i < 6 ? 0.01 : -0.01, 0]}
            >
              <planeGeometry args={[0.04, 0.015]} />
              <meshStandardMaterial color="#000" />
            </mesh>
          ))}
        </group>
      )}
      {isRouter && (
        <group position={[0.05, 0, 0.001]}>
          <mesh position={[-0.1, 0, 0]}>
            <boxGeometry args={[0.08, height * 0.5, 0.01]} />
            <meshStandardMaterial color="#333" />
          </mesh>
          <mesh position={[0.1, 0, 0]}>
            <boxGeometry args={[0.08, height * 0.5, 0.01]} />
            <meshStandardMaterial color="#333" />
          </mesh>
        </group>
      )}
      {isServer && (
        <group position={[0.05, 0, 0.001]}>
          {Array.from({ length: 4 }).map((_, i) => (
            <mesh key={i} position={[-0.15 + i * 0.1, 0, 0]}>
              <boxGeometry args={[0.08, height * 0.8, 0.005]} />
              <meshStandardMaterial color="#333" />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
});
