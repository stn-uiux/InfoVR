import { useCallback, useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { useStore } from "../../store/useStore";
import { Box3, MathUtils, PerspectiveCamera, Vector3, Vector2 } from 'three';
import { OrbitControls } from "three-stdlib";
import { U_HEIGHT, GRID_SPACING } from "../layout/constants";

export const CameraController = () => {
  const { camera, controls, invalidate } = useThree();
  const selectedRackId = useStore((state) => state.selectedRackId);
  const focusedRackId = useStore((state) => state.focusedRackId);

  const isEditMode = useStore((state) => state.isEditMode);
  const setPreFocusCameraState = useStore(
    (state) => state.setPreFocusCameraState,
  );

  const lastProcessedRackId = useRef<string | null>(null);
  const lastWasFocused = useRef<boolean>(false);
  const isInteracting = useRef<boolean>(false);

  const vTargetPos = useRef(new Vector3());
  const vTargetLookAt = useRef(new Vector3());
  const vTargetZoom = useRef(1);
  const pressedKeys = useRef(new Set<string>());
  const keyboardMove = useRef({
    forward: new Vector3(),
    right: new Vector3(),
    direction: new Vector3(),
  });

  // Use ref for animation flag to avoid React re-renders during interpolation
  const isAnimating = useRef(false);
  const animationDelayFrames = useRef(0);

  // Common function to set up animation to a rack
  const setupFocus = useCallback((
    targetRackId: string | null,
    isExplicitFocus: boolean,
  ) => {
    const currentState = useStore.getState();
    const storedSnapshot = currentState.preFocusCameraState;

    const handleLocalZoomOut = (prevRackId: string | null) => {
      const currentRacks = useStore.getState().racks;
      const prevRack = currentRacks.find((r) => r.rackId === prevRackId);

      if (prevRack) {
        const rackX = prevRack.position[0] * GRID_SPACING;
        const rackZ = prevRack.position[1] * GRID_SPACING;
        const rackHeight = prevRack.rackSize * U_HEIGHT + 0.1;

        const orientation = prevRack.orientation ?? 180;
        const orientationRad = ((180 - orientation) * Math.PI) / 180;
        const camDirX = Math.sin(orientationRad);
        const camDirZ = Math.cos(orientationRad);

        // Pull back and up matching the user's requested coordinates
        // Adjusted: Decreased pullBack to avoid opposite racks, and kept heightUp proportional to avoid high angles.
        const pullBack = 3.1;
        const heightUp = 3.25;

        vTargetLookAt.current.set(rackX, rackHeight * 0.5, rackZ);
        vTargetPos.current.set(
          rackX + camDirX * pullBack,
          rackHeight * 0.5 + heightUp,
          rackZ + camDirZ * pullBack
        );
        vTargetZoom.current = 1;
        isAnimating.current = true;
        invalidate();
      } else {
        useStore.getState().fitToScene();
      }
    };

    // If focus is specifically cleared (from non-null to null), and we have a snapshot, trigger restoration
    // BUT only if we're not about to focus a new rack (rack-to-rack transition)
    if (!isExplicitFocus && lastWasFocused.current && storedSnapshot) {
      // Check if a new focusedRackId is about to be set (rack-to-rack transition)
      if (!targetRackId) {
        const prevRackId = lastProcessedRackId.current;
        lastProcessedRackId.current = null;
        lastWasFocused.current = false;
        setPreFocusCameraState(null);

        handleLocalZoomOut(prevRackId);
        return;
      }
      // Rack-to-rack: don't restore, just update tracking and fall through to focus new rack
      lastWasFocused.current = false;
    }

    // Only process if the target rack or focus state actually changes
    if (
      targetRackId === lastProcessedRackId.current &&
      isExplicitFocus === lastWasFocused.current
    )
      return;

    const prevRackForGeneralDeselect = lastProcessedRackId.current;
    lastProcessedRackId.current = targetRackId;
    lastWasFocused.current = isExplicitFocus;

    if (!targetRackId) {
      // General return to base if focus is lost and we weren't just in explicit focus
      if (storedSnapshot) {
        setPreFocusCameraState(null);
      }
      handleLocalZoomOut(prevRackForGeneralDeselect);
      return;
    }

    const currentRacks = useStore.getState().racks;
    const rack = currentRacks.find((r) => r.rackId === targetRackId);
    if (!rack || !controls) return;

    const perspectiveCamera = camera as PerspectiveCamera;

    // Capture state ONLY if not already focused/selected
    if (!storedSnapshot && controls) {
      const orbitControls = controls as unknown as OrbitControls;
      setPreFocusCameraState({
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [
          orbitControls.target.x,
          orbitControls.target.y,
          orbitControls.target.z,
        ],
        zoom: camera.zoom,
      });
    }

    const rackX = rack.position[0] * GRID_SPACING;
    const rackZ = rack.position[1] * GRID_SPACING;
    const rackHeight = rack.rackSize * U_HEIGHT + 0.1;
    const rackWidth = 0.6;

    const fov = perspectiveCamera.fov;
    const aspect = window.innerWidth / window.innerHeight;
    const vFovRad = (fov * Math.PI) / 180;
    const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * aspect);

    const distHeight = rackHeight / 2 / Math.tan(vFovRad / 2);
    const distWidth = rackWidth / 2 / Math.tan(hFovRad / 2);

    // 낮은 랙일수록 하단 UI(캐러셀 등)에 가려지는 것을 방지하기 위해 줌 배율을 한 단계 늘립니다.
    const distanceMultiplier = rack.rackSize <= 32 ? 1.8 : 1.55;
    const baseDistance = Math.max(distHeight, distWidth) * distanceMultiplier;
    const distance = Math.max(baseDistance, 2.0);

    const targetCenterY = rackHeight * 0.5;
    vTargetLookAt.current.set(rackX, targetCenterY, rackZ);

    const orientation = rack.orientation ?? 180;
    const orientationRad = ((180 - orientation) * Math.PI) / 180;

    const camDirX = Math.sin(orientationRad);
    const camDirZ = Math.cos(orientationRad);

    // 카메라 유효 거리 설정
    const effectiveDistance = Math.max(distance, 1.8);

    // 정면에 가까운 뷰를 위해 카메라 기준 높이를 랙 중앙보다 살짝 위로 맞춥니다.
    // (OrbitControls의 maxPolarAngle 제한에 걸려 화면이 떨리는 현상 방지)
    const cameraHeight = rackHeight * 0.5 + 0.3;

    // 시선 중심점(LookAt) 역시 랙 중앙으로 둡니다.
    vTargetLookAt.current.set(rackX, rackHeight * 0.5, rackZ);

    let targetZoom = 1.0;
    const requiredBaseDistance = Math.max(distHeight, distWidth) * 1.4;
    if (effectiveDistance < requiredBaseDistance) {
      targetZoom = effectiveDistance / requiredBaseDistance;
    }

    const offsetX = camDirX * effectiveDistance;
    const offsetZ = camDirZ * effectiveDistance;

    vTargetPos.current.set(rackX + offsetX, cameraHeight, rackZ + offsetZ);
    vTargetZoom.current = targetZoom;

    isAnimating.current = true;
    invalidate();
    // 리액트가 랙을 숨길(unmount/invisible) 수 있도록 카메라 이동을 2프레임 지연시킵니다.
    animationDelayFrames.current = 2;
  }, [camera, controls, setPreFocusCameraState]);

  // Detect user interaction to stop fighting controls
  useEffect(() => {
    if (!controls) return;
    const orbit = controls as OrbitControls;
    const onStart = () => {
      isInteracting.current = true;
      isAnimating.current = false;
    };
    const onEnd = () => {
      isInteracting.current = false;
    };

    orbit.addEventListener("start", onStart);
    orbit.addEventListener("end", onEnd);
    return () => {
      orbit.removeEventListener("start", onStart);
      orbit.removeEventListener("end", onEnd);
    };
  }, [controls]);

  useEffect(() => {
    const movementKeys = new Set([
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
    ]);

    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tagName = target.tagName.toLowerCase();
      return (
        target.isContentEditable ||
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select"
      );
    };

    const canMoveCamera = (target: EventTarget | null) => {
      if (isEditableTarget(target)) return false;

      const state = useStore.getState();
      return (
        !state.isDragging &&
        !state.draggingModelId &&
        !state.deviceRegistrationModalOpen &&
        !state.importExportModalRackId &&
        !state.selectedDeviceId
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!movementKeys.has(event.key) || !canMoveCamera(event.target)) return;
      event.preventDefault();
      pressedKeys.current.add(event.key);
      isAnimating.current = false;
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!movementKeys.has(event.key)) return;
      pressedKeys.current.delete(event.key);
    };

    const handleBlur = () => {
      pressedKeys.current.clear();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  // Debug: Print camera info on Ctrl+D
  useEffect(() => {
    const handleDevKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        const orbitControls = controls as unknown as OrbitControls;
        console.log("=== Camera Debug Info ===");
        console.log("Position:", { x: camera.position.x, y: camera.position.y, z: camera.position.z });
        if (orbitControls) {
          console.log("Target (LookAt):", { x: orbitControls.target.x, y: orbitControls.target.y, z: orbitControls.target.z });
        }
        console.log("Zoom:", camera.zoom);
        console.log("=========================");
      }
    };
    window.addEventListener("keydown", handleDevKey);
    return () => window.removeEventListener("keydown", handleDevKey);
  }, [camera, controls]);

  const triggerFitToScene = useStore((state) => state.triggerFitToScene);
  const initialFitDone = useRef(false);

  useEffect(() => {
    const { racks, importedModels } = useStore.getState();
    if (initialFitDone.current) return;
    if (racks.length === 0 && importedModels.length === 0) return;
    initialFitDone.current = true;
    useStore.getState().fitToScene();
  }, [camera]);

  // Fit to scene logic
  useEffect(() => {
    if (triggerFitToScene === 0) return;

    const { racks, importedModels } = useStore.getState();
    if (racks.length === 0 && importedModels.length === 0) return;

    const bbox = new Box3();

    // Include Racks
    racks.forEach((rack) => {
      const rackX = rack.position[0] * GRID_SPACING;
      const rackZ = rack.position[1] * GRID_SPACING;
      const rackHeight = rack.rackSize * U_HEIGHT;
      const hw = (rack.width || 0.6) / 2;
      const hd = 0.3; // depth/2

      bbox.expandByPoint(new Vector3(rackX - hw, 0, rackZ - hd));
      bbox.expandByPoint(new Vector3(rackX + hw, rackHeight, rackZ + hd));
    });

    // Include Imported Models (exclude Light — they are above the scene and would skew framing)
    importedModels
      .filter((m) => m.builtinType !== "Light")
      .forEach((model) => {
        // Basic position inclusion.
        // Note: Ideally we would calculate actual mesh bounds, but position + some padding is a good start.
        // If the model is a builtin one like DigitalClock, we know its height is ~2m
        const pos = new Vector3(...model.position);
        bbox.expandByPoint(pos);
        bbox.expandByPoint(pos.clone().add(new Vector3(0, 2, 0))); // Add some height
      });

    if (bbox.isEmpty()) return;

    const center = new Vector3();
    bbox.getCenter(center);
    const size = new Vector3();
    bbox.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z);
    const perspectiveCamera = camera as PerspectiveCamera;
    const fov = perspectiveCamera.fov;

    // Fit calculation
    const distance = maxDim / (2 * Math.tan((fov * Math.PI) / 360));
    const padding = 1.1; // Reduced margin for a tighter fit
    const finalDistance = Math.max(distance * padding, 4); // Allow closer view

    vTargetLookAt.current.copy(center);
    // Position camera at a nice 45-degree angle
    vTargetPos.current.set(
      center.x + finalDistance * 0.7,
      center.y + finalDistance * 0.8,
      center.z + finalDistance * 0.7,
    );
    vTargetZoom.current = 1;

    isAnimating.current = true;
    lastProcessedRackId.current = null; // Ensure we can re-select models if needed
    invalidate();
  }, [triggerFitToScene, camera]);

  // Main interaction effect
  useEffect(() => {
    const targetId = focusedRackId || selectedRackId;
    const { isDragging } = useStore.getState();

    if (targetId && (focusedRackId || !isEditMode) && !isDragging) {
      setupFocus(targetId, !!focusedRackId);
    } else if (!targetId) {
      setupFocus(null, false);
    }
  }, [selectedRackId, focusedRackId, isEditMode, setupFocus]);

  useFrame((state, delta) => {
    const storeState = useStore.getState();
    const targetId = storeState.focusedRackId || storeState.selectedRackId;

    // React의 useEffect(setupFocus)가 아직 실행되지 않아 스토어 상태와 렌더링 상태가 불일치할 경우 
    // 잘못된 위치 기준으로 장애물을 판별하는 것을 막기 위해 프레임 업데이트를 스킵합니다.
    if (targetId !== lastProcessedRackId.current) {
      return;
    }

    if (pressedKeys.current.size > 0 && controls) {
      if (
        !storeState.isDragging &&
        !storeState.draggingModelId &&
        !storeState.deviceRegistrationModalOpen &&
        !storeState.importExportModalRackId &&
        !storeState.selectedDeviceId
      ) {
        const orbitControls = controls as unknown as OrbitControls;
        const { forward, right, direction } = keyboardMove.current;

        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();

        right.crossVectors(forward, camera.up).normalize();
        direction.set(0, 0, 0);

        if (pressedKeys.current.has("ArrowUp")) direction.y += 1;
        if (pressedKeys.current.has("ArrowDown")) direction.y -= 1;
        if (pressedKeys.current.has("ArrowLeft")) direction.sub(right);
        if (pressedKeys.current.has("ArrowRight")) direction.add(right);

        if (direction.lengthSq() > 0) {
          direction.normalize().multiplyScalar(15 * delta);
          camera.position.add(direction);
          orbitControls.target.add(direction);
          orbitControls.update();
        }
      }
    }

    // 동적 장애물 업데이트 (포커스 모드일 때 매 프레임 재계산)
    if (controls) {
      const storeState = useStore.getState();
      const activeTargetId = storeState.focusedRackId || (!storeState.isEditMode ? storeState.selectedRackId : null);
      if (activeTargetId) {
        const targetRack = storeState.racks.find(r => r.rackId === activeTargetId);

        if (targetRack) {
          // 목표 랙의 중심점
          const rackX = targetRack.position[0] * GRID_SPACING;
          const rackZ = targetRack.position[1] * GRID_SPACING;
          const rackHeight = targetRack.rackSize * U_HEIGHT + 0.1;
          const targetCenterY = rackHeight * 0.5;

          const obstructingIds: string[] = [];
          const obstructingModelIds: string[] = [];
          const allRacks = storeState.racks.filter(
            (r) => r.mapId === storeState.activeNodeId && r.rackId !== activeTargetId
          );

          for (const other of allRacks) {
            const otherX = other.position[0] * GRID_SPACING;
            const otherZ = other.position[1] * GRID_SPACING;

            const camPosToUse = isAnimating.current ? vTargetPos.current : camera.position;
            const camXZ = new Vector2(camPosToUse.x, camPosToUse.z);
            const targetXZ = new Vector2(rackX, rackZ);
            const dirXZ = new Vector2().subVectors(targetXZ, camXZ);
            const distToTargetXZ = dirXZ.length();
            if (distToTargetXZ === 0) continue;
            dirXZ.normalize();

            const otherXZ = new Vector2(otherX, otherZ);
            const vecToOtherXZ = new Vector2().subVectors(otherXZ, camXZ);
            const projSightXZ = vecToOtherXZ.dot(dirXZ);

            const otherHalfWidth = (other.width || 0.6) / 2;
            const otherHalfDepth = ((other.rackDepth || 100) / 100) / 2;
            const otherRadius = Math.sqrt(otherHalfWidth * otherHalfWidth + otherHalfDepth * otherHalfDepth) + 0.3;

            // 맞은편 또는 시야를 가리는 다른 랙이 카메라와 목표 랙 사이에 위치하는지 검사
            if (projSightXZ > -otherRadius && projSightXZ < distToTargetXZ - 0.2) {
              const perpSqXZ = Math.max(0, vecToOtherXZ.lengthSq() - projSightXZ * projSightXZ);
              const perpDistSightXZ = Math.sqrt(perpSqXZ);

              if (perpDistSightXZ < otherRadius + 0.4) {
                const ratio = Math.max(0, Math.min(1, projSightXZ / distToTargetXZ));
                const sightYAtRack = camPosToUse.y + ratio * (targetCenterY - camPosToUse.y);
                const otherHeight = other.rackSize * U_HEIGHT + 0.1;

                if (sightYAtRack < otherHeight + 0.5 || camPosToUse.y < otherHeight + 0.5) {
                  obstructingIds.push(other.rackId);
                }
              }
            }
          }

          // Imported Models Obstructing Logic (벽, 파티션 등 모든 3D 오브젝트)
          const allModels = storeState.importedModels;

          for (const other of allModels) {
            // CCTV와 온습도계는 랙을 가려도 화면에서 숨기지 않음
            const isCctv =
              other.builtinType === "CCTV" ||
              other.fileName?.toLowerCase().includes("cctv") ||
              other.name?.toLowerCase().includes("cctv");
            const isThermoHygro =
              other.builtinType === "ThermoHygro" ||
              other.fileName?.toLowerCase().includes("thermo_hygro") ||
              other.name?.toLowerCase().includes("온습도") ||
              other.name?.toLowerCase().includes("thermo");

            if (isCctv || isThermoHygro) continue;

            const otherX = other.position[0];
            const otherZ = other.position[2];

            const isWall = other.builtinType === "Wall";
            const isPartition = other.builtinType === "Partition";
            const wp = other.wallParams;
            const pp = other.partitionParams;

            const isDoor = other.builtinType === "DoorAuto" || other.fileName?.toLowerCase().includes("door");
            const isDesk = other.builtinType === "DeskOn" || other.builtinType === "DeskOff" || other.fileName?.toLowerCase().includes("desk");
            const isTable = other.builtinType === "TableSmall" || other.fileName?.toLowerCase().includes("table");

            const defaultW = isDoor ? 6.0 : isDesk ? 1.6 : isTable ? 1.8 : 2.0;
            const defaultH = isDoor ? 2.8 : isDesk ? 1.0 : isTable ? 0.8 : 2.0;
            const defaultD = isDoor ? 0.4 : isDesk ? 0.8 : isTable ? 0.9 : 1.5;

            const baseW = isWall ? (wp?.length ?? 1) : isPartition ? (pp?.length ?? 1) : (other.baseSize?.[0] ?? defaultW);
            const baseH = isWall ? (wp?.height ?? 2.5) : isPartition ? (pp?.height ?? 2) : (other.baseSize?.[1] ?? defaultH);
            const baseD = isWall ? (wp?.thickness ?? 0.2) : isPartition ? (pp?.thickness ?? 0.1) : (other.baseSize?.[2] ?? defaultD);

            const width = baseW * other.scale[0];
            const height = baseH * other.scale[1];
            const depth = baseD * other.scale[2];
            const radius = Math.sqrt(width * width + depth * depth) / 2 + 0.6; // 회전 무관 XZ 평면 바운딩 반경

            const camPosToUse = isAnimating.current ? vTargetPos.current : camera.position;
            const camXZ = new Vector2(camPosToUse.x, camPosToUse.z);
            const targetXZ = new Vector2(rackX, rackZ);
            const dirXZ = new Vector2().subVectors(targetXZ, camXZ);
            const distToTargetXZ = dirXZ.length();
            if (distToTargetXZ === 0) continue;
            dirXZ.normalize();

            const otherXZ = new Vector2(otherX, otherZ);
            const vecToOtherXZ = new Vector2().subVectors(otherXZ, camXZ);
            const projSightXZ = vecToOtherXZ.dot(dirXZ);

            if (projSightXZ > -radius && projSightXZ < distToTargetXZ - 0.2) {
              const perpSqXZ = Math.max(0, vecToOtherXZ.lengthSq() - projSightXZ * projSightXZ);
              const perpDistSightXZ = Math.sqrt(perpSqXZ);

              if (perpDistSightXZ < radius + 0.4) {
                const ratio = Math.max(0, Math.min(1, projSightXZ / distToTargetXZ));
                const sightYCenter = camPosToUse.y + ratio * (targetCenterY - camPosToUse.y);
                const sightYBottom = camPosToUse.y + ratio * (0 - camPosToUse.y);
                const sightYTop = camPosToUse.y + ratio * (rackHeight - camPosToUse.y);
                const modelBottom = other.position[1];
                const modelTop = modelBottom + height;

                // 시선이 모델의 수직 범위와 교차하거나(랙 상/하단 사이), 중심 시선이 모델 상단보다 아래를 지나는 경우 장애물로 판정
                const isSightBlocked =
                  (sightYBottom < modelTop + 0.3 && sightYTop > modelBottom - 0.2) ||
                  sightYCenter < modelTop + 0.4 ||
                  camPosToUse.y < modelTop + 0.5;

                if (isSightBlocked) {
                  obstructingModelIds.push(other.id);
                }
              }
            }
          }

          // 이동(애니메이션) 중에는 이미 숨겨진 랙이 잠깐 나타나는 깜빡임 현상을 방지하기 위해 합집합 유지
          let nextIds = obstructingIds;
          if (isAnimating.current) {
            nextIds = Array.from(new Set([...storeState.obstructingRackIds, ...obstructingIds]));
          }

          // 배열 동등성 비교 (순서 무관)
          const currentSorted = [...storeState.obstructingRackIds].sort();
          const nextSorted = nextIds.sort();

          if (currentSorted.length !== nextSorted.length || !currentSorted.every((id, i) => id === nextSorted[i])) {
            storeState.setObstructingRackIds(nextSorted);
          }

          let nextModelIds = obstructingModelIds;
          if (isAnimating.current) {
            nextModelIds = Array.from(new Set([...storeState.obstructingModelIds, ...obstructingModelIds]));
          }
          const currentSortedModels = [...storeState.obstructingModelIds].sort();
          const nextSortedModels = nextModelIds.sort();
          if (currentSortedModels.length !== nextSortedModels.length || !currentSortedModels.every((id, i) => id === nextSortedModels[i])) {
            storeState.setObstructingModelIds(nextSortedModels);
          }
        }
      } else if (storeState.obstructingRackIds.length > 0 || storeState.obstructingModelIds.length > 0) {
        // 포커스가 해제되어 랙 전체 보기(줌아웃) 상태일 때는 숨김 처리된 랙/모델을 모두 다시 나타나게 합니다.
        if (storeState.obstructingRackIds.length > 0) storeState.setObstructingRackIds([]);
        if (storeState.obstructingModelIds.length > 0) storeState.setObstructingModelIds([]);
      }
    }

    if (!isAnimating.current || !controls || isInteracting.current) return;
    state.invalidate();

    // 리액트가 상태를 감지하여 랙을 숨길 수 있도록 딜레이 적용
    if (animationDelayFrames.current > 0) {
      animationDelayFrames.current--;
      return;
    }

    const orbitControls = controls as unknown as OrbitControls;
    const alpha = 1 - Math.exp(-5 * delta); // 타겟팅 속도 조정 

    camera.position.lerp(vTargetPos.current, alpha);
    orbitControls.target.lerp(vTargetLookAt.current, alpha);

    if (Math.abs(state.camera.zoom - vTargetZoom.current) > 0.001) {
      state.camera.zoom = MathUtils.lerp(
        state.camera.zoom,
        vTargetZoom.current,
        alpha,
      );
      state.camera.updateProjectionMatrix();
    }

    orbitControls.update();

    if (state.events && state.events.update) {
      state.events.update();
    }

    const posDist = camera.position.distanceTo(vTargetPos.current);
    const targetDist = orbitControls.target.distanceTo(vTargetLookAt.current);

    if (posDist < 0.01 && targetDist < 0.01) {
      camera.position.copy(vTargetPos.current);
      orbitControls.target.copy(vTargetLookAt.current);
      state.camera.zoom = vTargetZoom.current;
      state.camera.updateProjectionMatrix();
      orbitControls.update();
      
      if (state.events && state.events.update) {
        state.events.update();
      }

      isAnimating.current = false;

      // Only clear snapshot if we are truly back at base (no selection, no focus)
      const freshState = useStore.getState();
      if (!freshState.selectedRackId && !freshState.focusedRackId) {
        setPreFocusCameraState(null);
      }
    }
  });

  return null;
};
