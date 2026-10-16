import { useEffect, useRef, useMemo, useState, Suspense } from "react";
import { type ThreeEvent, useThree, useFrame } from "@react-three/fiber";
import { useGLTF, Html, Billboard, PivotControls, Edges } from "@react-three/drei";
import {
  AdditiveBlending,
  Box3,
  CanvasTexture,
  Euler,
  Group,
  Matrix4,
  Mesh,
  Object3D,
  Quaternion,
  Raycaster,
  Vector3,
} from 'three';
import { Icon } from "@iconify/react";
import { useStore } from "../../store/useStore";
import type { ImportedModel, LightParams } from "../../types";
import {
  DEFAULT_WALL_PARAMS,
  DEFAULT_PARTITION_PARAMS,
  DEFAULT_LIGHT_PARAMS,
} from "../../utils/builtinModels";
import { DigitalClock } from "../layout/DigitalClock";
import { ThermoHygrometer } from "./ThermoHygrometer";
import { getThermoHygroById, getThermoHygroStatusMeta } from "../../utils/thermoHygroService";
import { getCctvById } from "../../utils/cctvService";
import { useTheme } from "../../contexts/ThemeContext";
import { getNodeSensorData } from "../layout/DashboardWidgets";
import { GltfErrorBoundary } from "./GltfErrorBoundary";
import { findThermoHygroRackSnap, type ThermoHygroSnapTarget } from "../../utils/rackGeometry";
import { racksContainerRef } from "./racksOcclusionRef";

const _occlusionRayDir = new Vector3();
const _occlusionTargetPos = new Vector3();
const _occlusionRaycaster = new Raycaster();

interface ToggleableControls {
  enabled: boolean;
}

interface ImportedModelMeshProps {
  model: ImportedModel;
}



/* ------------------------------------------------------------------ */
/*  Wall mesh — procedural box with parametric dimensions              */
/* ------------------------------------------------------------------ */
const WallMesh = ({ model }: { model: ImportedModel }) => {
  const params = model.wallParams ?? DEFAULT_WALL_PARAMS;
  return (
    <mesh position={[0, params.height / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[params.length, params.height, params.thickness]} />
      <meshStandardMaterial
        color={params.color}
        roughness={params.roughness ?? 0.85}
        metalness={params.metalness ?? 0.05}
        transparent={(params.opacity ?? 1.0) < 1.0}
        opacity={params.opacity ?? 1.0}
      />
    </mesh>
  );
};

/* ------------------------------------------------------------------ */
/*  Partition mesh — framed two-panel divider with base and feet       */
/* ------------------------------------------------------------------ */
const PartitionMesh = ({ model }: { model: ImportedModel }) => {
  const params = model.partitionParams ?? DEFAULT_PARTITION_PARAMS;
  const isTransparent = params.visibilityMode === "transparent";

  const { height: H, length: L, thickness: T } = params;

  // Design constants
  const frameWidth = 0.04;
  const feetHeight = 0.04;
  const feetWidth = 0.08;
  const baseHeight = 0.22;
  const dividerHeight = 0.02;

  // Calculate inner panel area
  const innerStartH = feetHeight + baseHeight;
  const totalInnerH = H - innerStartH - frameWidth;
  const topPanelH = totalInnerH * 0.35;
  const bottomPanelH = totalInnerH * 0.65 - dividerHeight;

  // Colors based on reference
  const frameColor = "#4a5568"; // Slate gray
  const topPanelColor = "#2d3748"; // Darker fabric gray
  const bottomPanelColor = "#718096"; // Lighter fabric gray
  const baseColor = "#1a202c"; // Darkest gray for plinth
  const plateColor = "#cbd5e0"; // Light gray for the small label plate

  const panelOpacity = isTransparent ? 0.45 : 1.0;

  return (
    <group>
      {/* 1. Feet */}
      <mesh position={[-L / 2 + feetWidth, feetHeight / 2, 0]}>
        <boxGeometry args={[feetWidth, feetHeight, T + 0.02]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} />
      </mesh>
      <mesh position={[L / 2 - feetWidth, feetHeight / 2, 0]}>
        <boxGeometry args={[feetWidth, feetHeight, T + 0.02]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} />
      </mesh>

      {/* 2. Base / Plinth */}
      <mesh
        position={[0, feetHeight + baseHeight / 2, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[L, baseHeight, T + 0.01]} />
        <meshStandardMaterial color={baseColor} roughness={0.7} />
      </mesh>

      {/* 3. Small label plate on base */}
      <mesh position={[-L / 4, feetHeight + baseHeight / 2, T / 2 + 0.01]}>
        <boxGeometry args={[0.1, 0.04, 0.005]} />
        <meshStandardMaterial color={plateColor} />
      </mesh>

      {/* 4. Outer Frames (Left, Right, Top) */}
      {/* Left */}
      <mesh
        position={[
          -L / 2 + frameWidth / 2,
          innerStartH + (H - innerStartH) / 2,
          0,
        ]}
        castShadow
      >
        <boxGeometry args={[frameWidth, H - innerStartH, T]} />
        <meshStandardMaterial color={frameColor} roughness={0.4} />
      </mesh>
      {/* Right */}
      <mesh
        position={[
          L / 2 - frameWidth / 2,
          innerStartH + (H - innerStartH) / 2,
          0,
        ]}
        castShadow
      >
        <boxGeometry args={[frameWidth, H - innerStartH, T]} />
        <meshStandardMaterial color={frameColor} roughness={0.4} />
      </mesh>
      {/* Top */}
      <mesh position={[0, H - frameWidth / 2, 0]} castShadow>
        <boxGeometry args={[L, frameWidth, T]} />
        <meshStandardMaterial color={frameColor} roughness={0.4} />
      </mesh>

      {/* 5. Panels */}
      {/* Bottom Panel (Lighter) */}
      <mesh
        position={[0, innerStartH + bottomPanelH / 2, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[L - frameWidth * 2, bottomPanelH, T * 0.8]} />
        <meshStandardMaterial
          color={bottomPanelColor}
          transparent={isTransparent}
          opacity={panelOpacity}
          roughness={0.9}
        />
      </mesh>

      {/* Divider Rail */}
      <mesh
        position={[0, innerStartH + bottomPanelH + dividerHeight / 2, 0]}
        castShadow
      >
        <boxGeometry args={[L - frameWidth * 2, dividerHeight, T * 0.9]} />
        <meshStandardMaterial color={baseColor} roughness={0.3} />
      </mesh>

      {/* Top Panel (Darker) */}
      <mesh
        position={[
          0,
          innerStartH + bottomPanelH + dividerHeight + topPanelH / 2,
          0,
        ]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[L - frameWidth * 2, topPanelH, T * 0.8]} />
        <meshStandardMaterial
          color={topPanelColor}
          transparent={isTransparent}
          opacity={panelOpacity}
          roughness={0.9}
        />
      </mesh>
    </group>
  );
};

/* ------------------------------------------------------------------ */
/*  Light mesh — server-room ceiling LED panel fixture                 */
/* ------------------------------------------------------------------ */
const LightMesh = ({ model }: { model: ImportedModel }) => {
  const params: LightParams = model.lightParams ?? DEFAULT_LIGHT_PARAMS;

  // Panel dimensions (typical 600×1200mm ceiling light scaled to scene units)
  const panelW = 1.2;
  const panelD = 0.6;
  const panelH = 0.06;
  const frameThick = 0.02;

  return (
    <group>
      {/* ── Outer aluminium housing / frame ── */}
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[panelW, panelH, panelD]} />
        <meshStandardMaterial
          color="#b0b0b0"
          roughness={0.35}
          metalness={0.7}
        />
      </mesh>

      {/* ── Inner diffuser panel (emissive — the actual glowing surface) ── */}
      <mesh position={[0, -(panelH / 2 - 0.005), 0]}>
        <boxGeometry
          args={[panelW - frameThick * 2, 0.01, panelD - frameThick * 2]}
        />
        <meshStandardMaterial
          color={params.color}
          emissive={params.color}
          emissiveIntensity={1.2}
          roughness={0.9}
          metalness={0}
          toneMapped={false}
        />
      </mesh>

      {/* ── Ceiling mount brackets (two short tabs) ── */}
      {[-0.35, 0.35].map((xOff) => (
        <mesh key={xOff} position={[xOff, panelH / 2 + 0.06, 0]}>
          <boxGeometry args={[0.04, 0.12, 0.04]} />
          <meshStandardMaterial
            color="#888"
            roughness={0.4}
            metalness={0.6}
          />
        </mesh>
      ))}

      {/* ── Thin top plate connecting brackets ── */}
      <mesh position={[0, panelH / 2 + 0.12, 0]}>
        <boxGeometry args={[0.8, 0.015, 0.06]} />
        <meshStandardMaterial
          color="#999"
          roughness={0.4}
          metalness={0.5}
        />
      </mesh>

      {/* ── Actual directional light emitter ── */}
      <directionalLight
        position={[0, 0, 0]}
        intensity={params.intensity}
        color={params.color}
        castShadow={false}
      />
    </group>
  );
};

import type { GlassParams } from "../../types";

/* ------------------------------------------------------------------ */
/*  GLB mesh — loads from dataUrl (base64 or public URL)               */
/* ------------------------------------------------------------------ */
const GltfMesh = ({
  url,
  onLoaded,
  glassParams,
  isCeilingMounted
}: {
  url: string;
  onLoaded?: (size: [number, number, number], hasGlass: boolean) => void;
  glassParams?: GlassParams;
  isCeilingMounted?: boolean;
}) => {
  const { scene: gltfScene } = useGLTF(url);

  const clonedData = useMemo(() => {
    if (!gltfScene) return null;
    const clone = gltfScene.clone(true);

    // Calculate bounding box for auto-centering
    const box = new Box3().setFromObject(clone);
    const center = new Vector3();
    const size = new Vector3();
    box.getCenter(center);
    box.getSize(size);

    // Center X, Z.
    // For ceiling-mounted models (CCTV), set top (max Y) to 0 so its top surface touches the ceiling flat.
    // For floor-mounted models, set bottom (min Y) to 0 so it sits on the floor.
    const yOffset = isCeilingMounted ? -box.max.y : -box.min.y;
    clone.position.set(-center.x, yOffset, -center.z);

    let foundGlass = false;
    clone.traverse((child) => {
      if ((child as Mesh).isMesh) {
        child.castShadow = !isCeilingMounted;
        child.receiveShadow = !isCeilingMounted;

        const mesh = child as Mesh;
        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach(mat => {
            const name = mat.name.toLowerCase();
            const isGlass = name.includes("glass") || mat.transparent || name === "lambert2";
            if (isGlass) {
              foundGlass = true;
            }
          });
        }
      }
    });
    return { clone, size: [size.x, size.y, size.z] as [number, number, number], hasGlass: foundGlass };
  }, [gltfScene]);

  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  useEffect(() => {
    if (clonedData?.size && onLoadedRef.current) {
      onLoadedRef.current(clonedData.size, clonedData.hasGlass);
    }
  }, [clonedData]);

  // Apply glassParams dynamically
  useEffect(() => {
    if (!clonedData?.clone || !glassParams) return;
    clonedData.clone.traverse((child) => {
      if ((child as Mesh).isMesh) {
        const mesh = child as Mesh;
        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach(mat => {
            const name = mat.name.toLowerCase();
            const isGlass = name.includes("glass") || mat.transparent || name === "lambert2";
            if (isGlass) {
              if ('color' in mat) (mat as any).color.set(glassParams.color);
              if ('roughness' in mat) (mat as any).roughness = glassParams.roughness;
              if ('metalness' in mat) (mat as any).metalness = glassParams.metalness;
              mat.transparent = true;
              mat.opacity = glassParams.opacity;
              mat.needsUpdate = true;
            }
          });
        }
      }
    });
  }, [clonedData, glassParams]);

  if (!clonedData) return null;
  return <primitive object={clonedData.clone} />;
};

/* ------------------------------------------------------------------ */
/*  CCTV Blinking Red LED (REC status indicator in View Mode)         */
/* ------------------------------------------------------------------ */
// 중심부의 선명한 초고휘도 LED 코어 텍스처 (중앙 핫스팟 + 블레이징 레드)
const cctvLedTexture = (() => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "#ffffff"); // 정중앙 초고휘도 백색 광점 (눈부심 효과)
  grad.addColorStop(0.2, "#ffffff");
  grad.addColorStop(0.38, "#ff3b5c"); // 고휘도 네온 핫핑크 레드
  grad.addColorStop(0.65, "#ff002e"); // 선명하고 진한 블레이징 레드
  grad.addColorStop(0.85, "rgba(255, 0, 46, 0.65)");
  grad.addColorStop(1, "rgba(255, 0, 46, 0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(64, 64, 64, 0, Math.PI * 2);
  ctx.fill();

  return new CanvasTexture(canvas);
})();

// 사방으로 부드럽게 퍼지는 자체 발광 네온 글로우 아우라 텍스처 (코로나)
const cctvGlowAuraTexture = (() => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255, 70, 95, 1.0)");
  grad.addColorStop(0.25, "rgba(255, 0, 40, 0.88)");
  grad.addColorStop(0.55, "rgba(255, 0, 30, 0.5)");
  grad.addColorStop(0.8, "rgba(230, 0, 20, 0.18)");
  grad.addColorStop(1, "rgba(200, 0, 0, 0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(64, 64, 64, 0, Math.PI * 2);
  ctx.fill();

  return new CanvasTexture(canvas);
})();

// 원거리에서도 시원하게 느껴지는 대형 대기 발광 광배 & 렌즈 플레어 스파크 텍스처
const cctvFlareTexture = (() => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // 1. 부드러운 대형 방사형 블룸 글로우
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, "rgba(255, 90, 115, 0.95)");
  grad.addColorStop(0.2, "rgba(255, 20, 50, 0.65)");
  grad.addColorStop(0.48, "rgba(255, 0, 35, 0.28)");
  grad.addColorStop(0.78, "rgba(240, 0, 25, 0.08)");
  grad.addColorStop(1, "rgba(200, 0, 0, 0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(128, 128, 128, 0, Math.PI * 2);
  ctx.fill();

  // 2. 가로/세로 렌즈 플레어 스파크 (실제 카메라 REC 라이트 특유의 빛 갈라짐 효과)
  const flareH = ctx.createLinearGradient(0, 128, 256, 128);
  flareH.addColorStop(0, "rgba(255, 50, 70, 0)");
  flareH.addColorStop(0.5, "rgba(255, 230, 240, 0.85)");
  flareH.addColorStop(1, "rgba(255, 50, 70, 0)");
  ctx.fillStyle = flareH;
  ctx.fillRect(0, 126, 256, 4);

  const flareV = ctx.createLinearGradient(128, 0, 128, 256);
  flareV.addColorStop(0, "rgba(255, 50, 70, 0)");
  flareV.addColorStop(0.5, "rgba(255, 230, 240, 0.85)");
  flareV.addColorStop(1, "rgba(255, 50, 70, 0)");
  ctx.fillStyle = flareV;
  ctx.fillRect(126, 0, 4, 256);

  return new CanvasTexture(canvas);
})();

const CctvBlinkingLed: React.FC<{ model: ImportedModel }> = ({ model }) => {
  const invalidate = useThree((s) => s.invalidate);
  const coreMeshRef = useRef<Mesh>(null);
  const glowMeshRef = useRef<Mesh>(null);
  const flareMeshRef = useRef<Mesh>(null);
  const lightRef = useRef<any>(null);

  const height = model.baseSize?.[1] ?? 0.235;

  // CCTV 고유 ID 기반 시작 딜레이 오프셋 (다수의 CCTV가 자연스럽게 엇갈려 깜빡임)
  const delayOffset = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < model.id.length; i++) {
      hash = (hash + model.id.charCodeAt(i) * (i + 1)) % 1000;
    }
    return Math.floor((hash / 1000) * 550);
  }, [model.id]);

  // React state 대신 Three.js Mesh.visible 직접 제어로 무한 setState 루프 완전 방지
  // frameloop="demand" 환경에서도 깜빡임이 즉시 화면에 그려지도록 invalidate 호출
  useEffect(() => {
    let isLit = true;
    let timer: NodeJS.Timeout;
    const startTimer = setTimeout(() => {
      timer = setInterval(() => {
        isLit = !isLit;
        if (coreMeshRef.current) coreMeshRef.current.visible = isLit;
        if (glowMeshRef.current) glowMeshRef.current.visible = isLit;
        if (flareMeshRef.current) flareMeshRef.current.visible = isLit;
        if (lightRef.current) lightRef.current.visible = isLit;
        invalidate();
      }, 550);
    }, delayOffset);

    return () => {
      clearTimeout(startTimer);
      if (timer) clearInterval(timer);
    };
  }, [invalidate, delayOffset]);

  // LED 3D 위치: CCTV 하단 렌즈 표면 바로 앞 (3D 모델 내부에 묻히지 않도록 최적화)
  const ledPosition: [number, number, number] = useMemo(() => {
    return [0, -height * 0.88, 0.025];
  }, [height]);

  return (
    <group position={ledPosition} raycast={() => null}>
      {/* CCTV 자체 하우징 표면에 은은하게 반사되는 마이크로 로컬 조명 (벽/천장 오염 없는 38cm 단거리) */}
      <pointLight
        ref={lightRef}
        position={[0, 0, 0.04]}
        color="#ff1133"
        intensity={3.2}
        distance={0.38}
        decay={2}
      />

      <Billboard>
        {/* 1. 꺼져 있을 때의 기본 LED 소켓 (어두운 암적색 미니 베이스) */}
        <mesh renderOrder={9996} raycast={() => null}>
          <planeGeometry args={[0.012, 0.012]} />
          <meshBasicMaterial
            color="#2a0006"
            transparent
            opacity={0.4}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>

        {/* 2. 원거리에서도 시원하게 퍼지는 대형 대기 발광 플레어 / 블룸 (13cm 광배) */}
        {cctvFlareTexture && (
          <mesh ref={flareMeshRef} renderOrder={9997} raycast={() => null}>
            <planeGeometry args={[0.13, 0.13]} />
            <meshBasicMaterial
              map={cctvFlareTexture}
              transparent
              opacity={0.88}
              blending={AdditiveBlending}
              toneMapped={false}
              depthTest={false}
              depthWrite={false}
            />
          </mesh>
        )}

        {/* 3. 켜졌을 때 사방으로 진하게 번지는 네온 글로우 코로나 (5.5cm 아우라) */}
        {cctvGlowAuraTexture && (
          <mesh ref={glowMeshRef} renderOrder={9998} raycast={() => null}>
            <planeGeometry args={[0.055, 0.055]} />
            <meshBasicMaterial
              map={cctvGlowAuraTexture}
              transparent
              opacity={0.95}
              blending={AdditiveBlending}
              toneMapped={false}
              depthTest={false}
              depthWrite={false}
            />
          </mesh>
        )}

        {/* 4. 눈부시게 빛나는 중심 초고휘도 LED 코어 핫스팟 (2.4cm) */}
        {cctvLedTexture && (
          <mesh ref={coreMeshRef} renderOrder={9999} raycast={() => null}>
            <planeGeometry args={[0.024, 0.024]} />
            <meshBasicMaterial
              map={cctvLedTexture}
              transparent
              opacity={1.0}
              blending={AdditiveBlending}
              toneMapped={false}
              depthTest={false}
              depthWrite={false}
            />
          </mesh>
        )}
      </Billboard>
    </group>
  );
};

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
export const ImportedModelMesh = ({ model }: ImportedModelMeshProps) => {
  const selectedModelId = useStore((s) => s.selectedModelId);
  const isEditMode = useStore((s) => s.isEditMode);
  const isSelected = selectedModelId === model.id;
  const isMoveEnabled = model.isMoveEnabled ?? false;

  const isWall = model.builtinType === "Wall";
  const isPartition = model.builtinType === "Partition";
  const isClock = model.builtinType === "Clock";
  const isLight = model.builtinType === "Light";
  const isCctv =
    model.builtinType === "CCTV" ||
    model.fileName?.toLowerCase().includes("cctv") ||
    model.name?.toLowerCase().includes("cctv");
  const isThermoHygro =
    model.builtinType === "ThermoHygro" ||
    model.fileName?.toLowerCase().includes("thermo_hygro") ||
    model.name?.toLowerCase().includes("온습도") ||
    model.name?.toLowerCase().includes("thermo");

  // 온습도계와 CCTV는 랙을 가려도 화면에서 절대 사라지지 않음
  const isModelObstructing = useStore((s) => s.obstructingModelIds.includes(model.id));
  const isObstructing = (!isCctv && !isThermoHygro) && isModelObstructing;
  const showDeviceLabels = useStore((s) => s.showDeviceLabels);

  const [isHovered, setIsHovered] = useState(false);
  const innerGroupRef = useRef<Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const thermoNametagRef = useRef<HTMLDivElement | null>(null);
  const cctvNametagRef = useRef<HTMLDivElement | null>(null);

  // Rack-specific occlusion check: ONLY racks occlude the device nametags
  useFrame(({ camera }) => {
    if (isEditMode || (!isCctv && !isThermoHygro)) return;
    const div = isCctv ? cctvNametagRef.current : thermoNametagRef.current;
    if (!div) return;

    const racksGroup = racksContainerRef.current;
    if (!racksGroup || racksGroup.children.length === 0) {
      if (div.style.display === "none") {
        div.style.display = "flex";
      }
      return;
    }

    const modelHeight = model.baseSize?.[1] ?? (isCctv ? 0.25 : 0.15);
    const nametagOffset = isCctv ? 0.22 : 0.38;

    // 1. Raycast to the Device Object itself
    _occlusionTargetPos.set(model.position[0], model.position[1] + modelHeight / 2, model.position[2]);
    const distToDevice = camera.position.distanceTo(_occlusionTargetPos);
    _occlusionRayDir.subVectors(_occlusionTargetPos, camera.position).normalize();
    _occlusionRaycaster.set(camera.position, _occlusionRayDir);
    _occlusionRaycaster.far = Math.max(0.05, distToDevice - 0.05);
    const deviceHits = _occlusionRaycaster.intersectObjects(racksGroup.children, true);

    let isOccluded = deviceHits.length > 0;

    // 2. If device itself is not hit, also check if a tall rack blocks the nametag anchor
    if (!isOccluded) {
      _occlusionTargetPos.set(
        model.position[0],
        model.position[1] + modelHeight / 2 + nametagOffset,
        model.position[2]
      );
      const distToNametag = camera.position.distanceTo(_occlusionTargetPos);
      _occlusionRayDir.subVectors(_occlusionTargetPos, camera.position).normalize();
      _occlusionRaycaster.set(camera.position, _occlusionRayDir);
      _occlusionRaycaster.far = Math.max(0.05, distToNametag - 0.05);
      const nametagHits = _occlusionRaycaster.intersectObjects(racksGroup.children, true);
      if (nametagHits.length > 0) {
        isOccluded = true;
      }
    }

    const targetDisplay = isOccluded ? "none" : "flex";
    if (div.style.display !== targetDisplay) {
      div.style.display = targetDisplay;
    }
  });

  // Re-render immediately on hover change
  useEffect(() => {
    invalidate();
  }, [isHovered, invalidate]);

  // Sensor data for DigitalClock & ThermoHygrometer
  const activeNodeId = useStore((s) => s.activeNodeId);
  const racks = useStore((s) => s.racks);
  const sensorData = activeNodeId ? getNodeSensorData(activeNodeId) : undefined;

  // Snap target state when dragging thermo-hygrometer near racks
  const [activeSnap, setActiveSnap] = useState<ThermoHygroSnapTarget | null>(null);
  const activeSnapRef = useRef<ThermoHygroSnapTarget | null>(null);

  // Linked ThermoHygrometer device from store / mock database
  const linkedSensor = useMemo(() => {
    return model.thermoHygroId ? getThermoHygroById(model.thermoHygroId) : undefined;
  }, [model.thermoHygroId]);

  // Theme for 3D overlay tags
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";

  // Linked CCTV device from store / mock database
  const linkedCctv = useMemo(() => {
    return model.cctvId ? getCctvById(model.cctvId) : undefined;
  }, [model.cctvId]);
  const cctvId = linkedCctv?.id || (model.name?.startsWith("CCTV") ? model.name : undefined);
  const displayCctvNo =
    cctvId ||
    model.name?.match(/(?:CCTV[-\s]?\d+|\d+)/i)?.[0] ||
    "CCTV";

  const displaySensorId =
    linkedSensor?.id ||
    model.thermoHygroId ||
    model.name?.match(/(?:TH[-\s]?\d+|온습도계\s*\d+|\d+)/i)?.[0] ||
    model.name ||
    "TH-01";

  const effectiveTemp = linkedSensor
    ? linkedSensor.temperature
    : (sensorData?.temperature ?? 23.4);
  const effectiveHum = linkedSensor
    ? linkedSensor.humidity
    : (sensorData?.humidity ?? 45.2);
  const effectiveStatus = linkedSensor ? linkedSensor.status : "normal";
  const statusMeta = getThermoHygroStatusMeta(effectiveStatus);

  const updateModel = useStore((s) => s.updateModel);
  const setModelDragging = useStore((s) => s.setModelDragging);
  const { controls } = useThree();


  // Live pose ref — stores the current transform while dragging without triggering re-renders
  const livePose = useRef<{
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  }>({
    position: [...model.position],
    rotation: [...model.rotation],
    scale: [...model.scale],
  });

  // Keep livePose in sync with store when NOT dragging
  const isDragging = useRef(false);
  useEffect(() => {
    if (isDragging.current) return;
    livePose.current = {
      position: [...model.position],
      rotation: [...model.rotation],
      scale: [...model.scale],
    };
  }, [model.position, model.rotation, model.scale]);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (isObstructing) return;
    if (e.button !== 0) return; // Only allow left-click
    if (e.delta > 15) return; // Ignore if user dragged
    (e as any).stoppedByModel = true;

    if (useStore.getState().isGizmoHovered) return;

    // Check if the user is clicking the PivotControls gizmo.
    // Because depthTest={false}, the gizmo is visually on top.
    // If the raycaster intersected the gizmo, we must let it handle the event,
    // even if the model geometry is geometrically closer to the camera.
    const hitGizmo = e.intersections.some((hit) => {
      let obj: Object3D | null = hit.object;
      let isInner = false;
      let isGizmo = false;
      while (obj) {
        if (obj.userData?.isInnerContent) isInner = true;
        if (obj.userData?.isGizmo || obj.userData?.isGizmoHelper) isGizmo = true;
        obj = obj.parent;
      }
      return isGizmo && !isInner;
    });

    if (hitGizmo) {
      return; // Do nothing, let PivotControls catch it
    }

    const { isEditMode: editMode, selectRack, selectModel } = useStore.getState();

    if (!editMode) {
      if (isCctv) {
        e.stopPropagation();
        useStore.getState().setActiveCctvLiveModelId(model.id);
        return;
      }
      if (isThermoHygro) {
        e.stopPropagation();
        useStore.getState().setActiveThermoHygroMappingModelId(model.id);
        return;
      }

      // 뷰 모드 일반 모델(유리 자동문, 가벽, 기둥, 책상 등):
      // 광선 관통 경로에 랙 인터랙션 박스가 있는지 확인
      const hasRackBehind = e.intersections.some(
        (hit) =>
          (hit.object as any).stoppedByRack ||
          hit.object.userData?.isRackInteractBox
      );
      if (hasRackBehind) {
        // 뒤쪽 랙으로 클릭 이벤트가 투과되어 랙이 선택될 수 있도록 선택 해제하지 않고 전달
        return;
      }

      selectRack(null);
      return;
    }

    e.stopPropagation();
    selectModel(model.id);
  };

  const wp = model.wallParams ?? DEFAULT_WALL_PARAMS;
  const pp = model.partitionParams ?? DEFAULT_PARTITION_PARAMS;

  // Hover outline bounding box for CCTV and ThermoHygrometer (장비 호버 효과와 동일한 #5ee0ff 아웃라인)
  const hoverOutlineArgs: [number, number, number] | null = isThermoHygro
    ? [0.354, 0.134, 0.044]
    : isCctv
      ? [
        (model.baseSize?.[0] ?? 0.28) * 1.03,
        (model.baseSize?.[1] ?? 0.235) * 1.03,
        (model.baseSize?.[2] ?? 0.28) * 1.03,
      ]
      : null;

  const hoverOutlinePos: [number, number, number] = isThermoHygro
    ? [0, 0, 0]
    : isCctv
      ? [0, -(model.baseSize?.[1] ?? 0.235) / 2, 0]
      : [0, 0, 0];

  // matrix used by PivotControls — derived from live pose ref while dragging
  const matrix = useMemo(() => {
    const m = new Matrix4();
    m.compose(
      new Vector3(...model.position),
      new Quaternion().setFromEuler(new Euler(...model.rotation)),
      new Vector3(...model.scale),
    );
    return m;

  }, [model.position, model.rotation, model.scale]);

  const shouldTransform = isSelected && isEditMode && isMoveEnabled;

  const innerContent = (
    <group
      ref={innerGroupRef}
      userData={{ isInnerContent: true, modelId: model.id }}
      raycast={isObstructing ? () => null : undefined}
      onClick={isObstructing ? undefined : handleClick}
      onPointerOver={(e) => {
        if (isObstructing) return;
        if (useStore.getState().isGizmoHovered) return;
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
        if (hitGizmoHelper) return;

        if (isEditMode) {
          e.stopPropagation();
          document.body.style.cursor = isMoveEnabled ? "grab" : "pointer";
        } else if (isCctv || isThermoHygro) {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
          setIsHovered(true);
        } else {
          // 뷰 모드 일반 모델(유리문, 가벽 등): 뒤쪽에 있는 랙으로 호버 이벤트가 전달되도록
          // e.stopPropagation()을 호출하지 않습니다.
        }
      }}
      onPointerMove={(e) => {
        if (isObstructing) return;
        if (useStore.getState().isGizmoHovered) return;
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
        if (hitGizmoHelper) return;

        if (isEditMode || isCctv || isThermoHygro) {
          e.stopPropagation();
        }
      }}
      onPointerOut={(e) => {
        if (isEditMode || isCctv || isThermoHygro) {
          e.stopPropagation();
          if (
            document.body.style.cursor === "grab" ||
            document.body.style.cursor === "pointer"
          ) {
            document.body.style.cursor = "auto";
          }
        } else {
          // 뷰 모드 일반 모델에서 벗어날 때: 현재 호버 중인 랙이나 장비가 없다면 커서 복구
          const state = useStore.getState();
          if (!state.hoveredRackId && !state.hoveredDevice) {
            if (
              document.body.style.cursor === "grab" ||
              document.body.style.cursor === "pointer"
            ) {
              document.body.style.cursor = "auto";
            }
          }
        }
        setIsHovered(false);
      }}
    >
      {/* Render appropriate mesh */}
      {isWall ? (
        <WallMesh model={model} />
      ) : isPartition ? (
        <PartitionMesh model={model} />
      ) : isClock ? (
        <DigitalClock
          temperature={sensorData?.temperature ?? undefined}
          humidity={sensorData?.humidity ?? undefined}
        />
      ) : isThermoHygro ? (
        <ThermoHygrometer
          sensorId={linkedSensor?.id ?? "TH-001"}
          sensorName={linkedSensor?.name}
          temperature={effectiveTemp}
          humidity={effectiveHum}
          status={effectiveStatus}
        />
      ) : isLight ? (
        <LightMesh model={model} />
      ) : (
        <GltfErrorBoundary key={model.id}>
          <Suspense fallback={null}>
            <GltfMesh
              url={model.dataUrl}
              glassParams={model.glassParams}
              isCeilingMounted={isCctv}
              onLoaded={(size, hasGlass) => {
                const updates: any = {};
                if (!model.baseSize || model.baseSize[0] !== size[0] || model.baseSize[1] !== size[1] || model.baseSize[2] !== size[2]) {
                  updates.baseSize = size;
                }
                if (model.hasGlass !== hasGlass) {
                  updates.hasGlass = hasGlass;
                }
                if (Object.keys(updates).length > 0) {
                  updateModel(model.id, updates);
                }
              }}
            />
          </Suspense>
        </GltfErrorBoundary>
      )}

      {/* 뷰모드 전용: CCTV 깜빡이는 작고 빨간 녹화(REC) LED 불빛 */}
      {!isEditMode && isCctv && (
        <CctvBlinkingLed model={model} />
      )}

      {/* Selection highlight box (Removed per user request) */}
      {/* Lock/Unlock status label */}
      {isSelected && isEditMode && (
        <Billboard
          position={[
            0,
            isWall
              ? wp.height + 0.4
              : isPartition
                ? pp.height + 0.4
                : isClock
                  ? 1.25
                  : isLight
                    ? 0.6
                    : isThermoHygro
                      ? 0.15
                      : isCctv
                        ? -(model.baseSize?.[1] ?? 0.25) - 0.2
                        : 1.4,
            0,
          ]}
        >
          <Html center zIndexRange={[0, 10]} style={{ pointerEvents: "none" }}>
            <div
              style={{
                background: isMoveEnabled
                  ? "rgba(74, 222, 128, 0.9)"
                  : "rgba(249, 115, 22, 0.9)",
                color: "#fff",
                padding: "3px 10px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: 700,
                fontFamily: "Inter, system-ui, sans-serif",
                whiteSpace: "nowrap",
                pointerEvents: "none",
                userSelect: "none",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              }}
            >
              {isMoveEnabled ? "🔓 Unlocked" : "🔒 Locked"}
            </div>
          </Html>
        </Billboard>
      )}

      {/* Equipment-style Hover Outline for CCTV and ThermoHygro */}
      {isHovered && hoverOutlineArgs && (
        <mesh position={hoverOutlinePos} raycast={() => null}>
          <boxGeometry args={hoverOutlineArgs} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          <Edges
            scale={1.0}
            threshold={15}
            color="#5ee0ff"
            lineWidth={4}
            raycast={() => null}
          />
        </mesh>
      )}
    </group>
  );

  return (
    <group
      userData={{ isModelContainer: true, modelId: model.id }}
      visible={!isObstructing}
      raycast={isObstructing ? () => null : undefined}
    >
      {/* 랙 자석 스냅 가이드 (온습도계를 랙 모서리 가까이 가져갔을 때 표시) */}
      {isThermoHygro && activeSnap && (
        <group position={activeSnap.position} rotation={activeSnap.rotation}>
          {/* 스냅 위치 타겟 박스 (아웃라인 및 은은한 글로우) */}
          <mesh>
            <boxGeometry args={[0.354, 0.134, 0.044]} />
            <meshBasicMaterial color="#00f0ff" wireframe transparent opacity={0.9} />
          </mesh>
          <mesh>
            <boxGeometry args={[0.35, 0.13, 0.04]} />
            <meshBasicMaterial color="#00f0ff" transparent opacity={0.2} />
          </mesh>
          {/* 자석 스냅 플로팅 툴팁 안내 */}
          <Billboard position={[0, 0.18, 0]}>
            <Html center distanceFactor={10} pointerEvents="none">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 9px",
                  background: "rgba(15, 23, 42, 0.94)",
                  border: "1px solid #00f0ff",
                  boxShadow: "0 0 14px rgba(0, 240, 255, 0.45)",
                  borderRadius: "6px",
                  color: "#e2e8f0",
                  fontSize: "11px",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  userSelect: "none",
                  backdropFilter: "blur(6px)",
                }}
              >
                <span style={{ fontSize: "13px" }}>🧲</span>
                <span style={{ color: "#38bdf8" }}>{activeSnap.rackTitle || "랙"}</span>
                <span>상단 {activeSnap.side === "left" ? "좌측끝" : "우측끝"} 스냅 (1cm)</span>
              </div>
            </Html>
          </Billboard>
        </group>
      )}

      {shouldTransform ? (
        <group userData={{ isGizmo: true }}>
          <PivotControls
            userData={{ isGizmo: true }}
            matrix={matrix}
            anchor={isThermoHygro ? [0, 0, 0] : isCctv ? [0, 1, 0] : [0, -1, 0]}
            depthTest={false}
            fixed
            scale={75}
            lineWidth={2.5}
            disableSliders={false}
            onDragStart={() => {
              isDragging.current = true;
              activeSnapRef.current = null;
              setActiveSnap(null);
              // Imperatively disable OrbitControls IMMEDIATELY to prevent
              // camera movement competing with PivotControls drag (XZ slider).
              // React state update (setModelDragging) only takes effect next render,
              // by which time OrbitControls has already captured the pointer.
              if (controls) (controls as unknown as ToggleableControls).enabled = false;
              setModelDragging(model.id);
            }}
            onDrag={(m) => {
              // Decompose the matrix and apply directly to group (NO store update here)
              const p = new Vector3();
              const r = new Quaternion();
              const s = new Vector3();
              m.decompose(p, r, s);
              const euler = new Euler().setFromQuaternion(r);

              if (isThermoHygro) {
                const snap = findThermoHygroRackSnap([p.x, p.y, p.z], racks, activeNodeId);
                if (snap) {
                  livePose.current = {
                    position: snap.position,
                    rotation: snap.rotation,
                    scale: [s.x, s.y, s.z],
                  };
                  if (
                    activeSnapRef.current?.rackId !== snap.rackId ||
                    activeSnapRef.current?.side !== snap.side
                  ) {
                    activeSnapRef.current = snap;
                    setActiveSnap(snap);
                  }
                  return;
                } else {
                  if (activeSnapRef.current !== null) {
                    activeSnapRef.current = null;
                    setActiveSnap(null);
                  }
                }
              }

              livePose.current = {
                position: [p.x, p.y, p.z],
                rotation: [euler.x, euler.y, euler.z],
                scale: [s.x, s.y, s.z],
              };
            }}
            onDragEnd={() => {
              isDragging.current = false;
              // Re-enable OrbitControls imperatively before state update
              if (controls) (controls as unknown as ToggleableControls).enabled = true;
              setModelDragging(null);

              const finalPos =
                isThermoHygro && activeSnapRef.current
                  ? activeSnapRef.current.position
                  : livePose.current.position;
              const finalRot =
                isThermoHygro && activeSnapRef.current
                  ? activeSnapRef.current.rotation
                  : livePose.current.rotation;
              const finalScale = livePose.current.scale;

              activeSnapRef.current = null;
              setActiveSnap(null);

              // Commit final pose to store ONCE on drag end
              updateModel(model.id, {
                position: finalPos,
                rotation: finalRot,
                scale: finalScale,
              });
            }}
          >
            {innerContent}
          </PivotControls>
        </group>
      ) : (
        <group
          position={model.position}
          rotation={model.rotation}
          scale={model.scale}
        >
          {innerContent}
        </group>
      )}

      {/* 온습도계 상시 이름표 어노테이션 (기기 3D 오브젝트를 가리지 않도록 상단에 살짝 떨어져서 항상 고정) */}
      {!isEditMode && isThermoHygro && (showDeviceLabels || isHovered) && (
        <group
          position={[
            model.position[0],
            model.position[1] + (model.baseSize?.[1] ?? 0.15) / 2 + 0.38,
            model.position[2],
          ]}
        >
          <Html center zIndexRange={[50, 0]} style={{ pointerEvents: "none" }}>
            <div
              ref={thermoNametagRef}
              onClick={(e) => {
                e.stopPropagation();
                useStore.getState().setActiveThermoHygroMappingModelId(model.id);
              }}
              className="device-nametag-wrapper thermo"
              title="클릭하여 온습도계 상세 정보 보기"
              style={{
                pointerEvents: showDeviceLabels ? "auto" : "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                userSelect: "none",
                cursor: "pointer",
                transition: "transform 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              {/* 메인 뱃지 */}
              <div
                className="device-nametag-badge thermo"
                style={{
                  background: isDarkMode
                    ? "rgba(15, 23, 42, 0.94)"
                    : "rgba(255, 255, 255, 0.96)",
                  color: isDarkMode ? "#ebedef" : "#202226",
                  padding: "4px 9px",
                  borderRadius: "10px",
                  fontSize: "11px",
                  fontWeight: 700,
                  border: `1.5px solid ${statusMeta.color || "#06b6d4"}`,
                  boxShadow: isDarkMode
                    ? `0 0 14px ${statusMeta.color || "#06b6d4"}60, 0 4px 12px rgba(0, 0, 0, 0.5)`
                    : `0 0 10px ${statusMeta.color || "#06b6d4"}40, 0 4px 10px rgba(0, 0, 0, 0.12)`,
                  whiteSpace: "nowrap",
                  backdropFilter: "blur(8px)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "2px",
                  fontFamily: "Inter, system-ui, sans-serif",
                }}
              >
                {/* 1행: 온습도계 번호 (오프라인 지원 mdi:thermometer-water 아이콘 포함) */}
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: statusMeta.color || "#10b981",
                      display: "inline-block",
                      boxShadow: `0 0 6px ${statusMeta.color || "#10b981"}`,
                    }}
                  />
                  <Icon
                    icon="mdi:thermometer-water"
                    style={{
                      width: "14px",
                      height: "14px",
                      color: statusMeta.color || "#06b6d4",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ color: statusMeta.color || "#06b6d4", fontWeight: 800, fontSize: "11px", letterSpacing: "0.2px" }}>
                    {displaySensorId}
                  </span>
                </div>
                {/* 2행: 줄바꿈 후 온습도 정보 */}
                <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10.5px", fontWeight: 700 }}>
                  <span style={{ color: "#38bdf8" }}>{effectiveTemp.toFixed(1)}°C</span>
                  <span style={{ opacity: 0.35, fontSize: "9px" }}>/</span>
                  <span style={{ color: "#60a5fa" }}>{effectiveHum.toFixed(1)}%</span>
                </div>
              </div>

              {/* 기기 방향을 가리키는 얇은 어노테이션 핀 스템 */}
              <div
                style={{
                  width: "1.5px",
                  height: "10px",
                  background: `linear-gradient(to bottom, ${statusMeta.color || "#06b6d4"}, rgba(6, 182, 212, 0.05))`,
                }}
              />
              <div
                style={{
                  width: "4px",
                  height: "4px",
                  borderRadius: "50%",
                  background: statusMeta.color || "#06b6d4",
                  boxShadow: `0 0 6px ${statusMeta.color || "#06b6d4"}`,
                  marginTop: "-2px",
                }}
              />
            </div>
          </Html>
        </group>
      )}

      {/* CCTV 이름표 어노테이션 (기기 3D 오브젝트를 가리지 않도록 상단에 살짝 떨어져서 항상 고정) */}
      {!isEditMode && isCctv && (showDeviceLabels || isHovered) && (
        <group
          position={[
            model.position[0],
            model.position[1] + (model.baseSize?.[1] ?? 0.25) / 2 + 0.22,
            model.position[2],
          ]}
        >
          <Html center zIndexRange={[50, 0]} style={{ pointerEvents: "none" }}>
            <div
              ref={cctvNametagRef}
              onClick={(e) => {
                e.stopPropagation();
                useStore.getState().setActiveCctvLiveModelId(model.id);
              }}
              className="device-nametag-wrapper cctv"
              title="클릭하여 CCTV 라이브 보기"
              style={{
                pointerEvents: showDeviceLabels ? "auto" : "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                userSelect: "none",
                cursor: "pointer",
                transition: "transform 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              {/* 메인 뱃지 */}
              <div
                className="device-nametag-badge cctv"
                style={{
                  background: isDarkMode
                    ? "rgba(15, 23, 42, 0.94)"
                    : "rgba(255, 255, 255, 0.96)",
                  color: isDarkMode ? "#ebedef" : "#202226",
                  padding: "4px 10px",
                  borderRadius: "14px",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  border: showDeviceLabels
                    ? "1.5px solid #3b82f6"
                    : isDarkMode
                      ? "1px solid rgba(255, 255, 255, 0.2)"
                      : "1px solid rgba(0, 0, 0, 0.12)",
                  boxShadow: showDeviceLabels
                    ? "0 0 14px rgba(59, 130, 246, 0.6), 0 4px 12px rgba(0, 0, 0, 0.45)"
                    : isDarkMode
                      ? "0 4px 15px rgba(0, 0, 0, 0.45)"
                      : "0 4px 12px rgba(0, 0, 0, 0.1)",
                  whiteSpace: "nowrap",
                  backdropFilter: "blur(8px)",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  fontFamily: "Inter, system-ui, sans-serif",
                }}
              >
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: linkedCctv?.status === "offline" ? "#ef4444" : "#10b981",
                    display: "inline-block",
                    boxShadow: linkedCctv?.status === "offline" ? "0 0 6px #ef4444" : "0 0 6px #10b981",
                  }}
                />
                <Icon icon="mdi:cctv" style={{ width: "14px", height: "14px", color: "#3b82f6" }} />
                <span style={{ color: "#60a5fa", fontFamily: "monospace", fontWeight: 800, fontSize: "11px" }}>
                  {displayCctvNo}
                </span>
              </div>

              {/* 기기 방향을 가리키는 얇은 어노테이션 핀 스템 */}
              <div
                style={{
                  width: "1.5px",
                  height: "7px",
                  background: "linear-gradient(to bottom, #3b82f6, rgba(59, 130, 246, 0.05))",
                }}
              />
              <div
                style={{
                  width: "4px",
                  height: "4px",
                  borderRadius: "50%",
                  background: "#3b82f6",
                  boxShadow: "0 0 6px #3b82f6",
                  marginTop: "-2px",
                }}
              />
            </div>
          </Html>
        </group>
      )}
    </group>
  );
};
