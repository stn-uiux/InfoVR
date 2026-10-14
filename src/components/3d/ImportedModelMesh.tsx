import { useEffect, useLayoutEffect, useRef, useMemo, useState, Suspense } from "react";
import { type ThreeEvent, useThree, useFrame } from "@react-three/fiber";
import { useGLTF, Html, Billboard, PivotControls, Edges } from "@react-three/drei";
import { Box3, Euler, Group, Matrix4, Mesh, Object3D, Quaternion, Vector3 } from 'three';
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

interface ToggleableControls {
  enabled: boolean;
}

interface ImportedModelMeshProps {
  model: ImportedModel;
}

/* ------------------------------------------------------------------ */
/*  Droplet gauge SVG for hover popover                               */
/* ------------------------------------------------------------------ */
const DropletGaugeSvg: React.FC<{ humidity: number; id: string }> = ({ humidity, id }) => {
  const humVal = typeof humidity === "number" ? humidity : 45.2;
  const humPct = Math.max(0, Math.min(100, humVal)) / 100;

  let fillH: number;
  if (humPct <= 0.5) {
    fillH = 11 * Math.pow(humPct / 0.5, 0.95);
  } else {
    fillH = 11 + 19 * Math.pow((humPct - 0.5) / 0.5, 1.05);
  }
  const fillY = 31 - fillH;

  const clipId = `popover-drop-clip-${id}`;
  const gradId = `popover-drop-grad-${id}`;

  return (
    <svg
      width="18"
      height="25"
      viewBox="0 0 24 32"
      style={{ overflow: "visible", flexShrink: 0 }}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          <path d="M 12 1 C 15.5 8, 23 14, 23 20 A 11 11 0 0 1 1 20 C 1 14, 8.5 8, 12 1 Z" />
        </clipPath>
        <linearGradient id={gradId} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#0284c7" />
          <stop offset="50%" stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      {/* Background */}
      <path
        d="M 12 1 C 15.5 8, 23 14, 23 20 A 11 11 0 0 1 1 20 C 1 14, 8.5 8, 12 1 Z"
        fill="rgba(15, 23, 42, 0.85)"
      />
      {/* Liquid Fill */}
      <g clipPath={`url(#${clipId})`}>
        <rect
          x="0"
          y={fillY}
          width="24"
          height={fillH + 4}
          fill={`url(#${gradId})`}
        />
        {humPct > 0.05 && humPct < 0.95 && (
          <path
            d={`M 1 ${fillY} Q 12 ${fillY - 1.5} 23 ${fillY}`}
            stroke="#e0f2fe"
            strokeWidth="1.2"
            fill="none"
            opacity="0.85"
          />
        )}
      </g>
      {/* Outer Border */}
      <path
        d="M 12 1 C 15.5 8, 23 14, 23 20 A 11 11 0 0 1 1 20 C 1 14, 8.5 8, 12 1 Z"
        fill="none"
        stroke="#38bdf8"
        strokeWidth="1.8"
      />
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/*  Smart screen-aware hover popover for ThermoHygrometer             */
/* ------------------------------------------------------------------ */
interface ThermoHygroHoverOverlayProps {
  model: ImportedModel;
  linkedSensor: any;
  statusMeta: {
    label: string;
    bg: string;
    color: string;
    borderColor: string;
  };
  effectiveTemp: number;
  effectiveHum: number;
}

const ThermoHygroHoverOverlay: React.FC<ThermoHygroHoverOverlayProps> = ({
  model,
  linkedSensor,
  statusMeta,
  effectiveTemp,
  effectiveHum,
}) => {
  const vCenter = useMemo(() => new Vector3(), []);
  const vTop = useMemo(() => new Vector3(), []);
  const vBottom = useMemo(() => new Vector3(), []);

  const calculatePosition = (
    el: Object3D,
    camera: any,
    size: { width: number; height: number }
  ): [number, number] => {
    el.updateWorldMatrix(true, false);
    const mat = el.matrixWorld;

    vCenter.set(0, 0, 0).applyMatrix4(mat).project(camera);
    vTop.set(0, 0.075, 0).applyMatrix4(mat).project(camera);
    vBottom.set(0, -0.075, 0).applyMatrix4(mat).project(camera);

    const screenX = ((vCenter.x + 1) / 2) * size.width;
    const topScreenY = ((-vTop.y + 1) / 2) * size.height;
    const bottomScreenY = ((-vBottom.y + 1) / 2) * size.height;

    const sensorTopY = Math.min(topScreenY, bottomScreenY);
    const sensorBottomY = Math.max(topScreenY, bottomScreenY);

    const popoverEl = document.getElementById(`thermo-popover-${model.id}`);
    const width = popoverEl?.offsetWidth || 300;
    const height = popoverEl?.offsetHeight || 190;

    let minScreenTop = 65;
    const maxScreenBottom = size.height - 16;
    let minScreenLeft = 16;
    let maxScreenRight = size.width - 16;

    // 1. Top header offset check
    const topHeader = document.querySelector(
      ".comm-toolbar, .app-header, .top-nav, header, [class*='header'], [class*='navbar'], [class*='toolbar']"
    ) as HTMLElement | null;
    if (topHeader && topHeader.offsetHeight > 0) {
      const rect = topHeader.getBoundingClientRect();
      if (rect.bottom > 0 && rect.bottom < 150) {
        minScreenTop = Math.max(minScreenTop, rect.bottom + 12);
      }
    }

    // 2. Right panel check
    const rightPanel = document.querySelector(".stn-side-panel") as HTMLElement | null;
    if (rightPanel && rightPanel.offsetWidth > 0) {
      const rect = rightPanel.getBoundingClientRect();
      if (rect.left > size.width / 2 && rect.left < maxScreenRight) {
        maxScreenRight = Math.min(maxScreenRight, rect.left - 12);
      }
    }

    // 3. Left sidebar check
    const leftSidebar = document.querySelector(
      ".comm-sidebar, .sidebar-container"
    ) as HTMLElement | null;
    if (leftSidebar && leftSidebar.offsetWidth > 0) {
      const rect = leftSidebar.getBoundingClientRect();
      if (rect.right > minScreenLeft && rect.right < size.width / 2) {
        minScreenLeft = Math.max(minScreenLeft, rect.right + 12);
      }
    }

    const GAP = 14;
    const wouldClipTop = sensorTopY - GAP - height < minScreenTop;
    const isBottom = wouldClipTop;

    if (popoverEl) {
      const nextPlacement = isBottom ? "bottom" : "top";
      if (popoverEl.getAttribute("data-placement") !== nextPlacement) {
        popoverEl.setAttribute("data-placement", nextPlacement);
      }
    }

    let targetTop: number;
    if (isBottom) {
      targetTop = sensorBottomY + GAP;
      if (targetTop + height > maxScreenBottom) {
        targetTop = maxScreenBottom - height;
      }
      if (targetTop < minScreenTop) {
        targetTop = minScreenTop;
      }
    } else {
      targetTop = sensorTopY - GAP - height;
      if (targetTop < minScreenTop) {
        targetTop = minScreenTop;
      }
      if (targetTop + height > maxScreenBottom) {
        targetTop = maxScreenBottom - height;
      }
    }

    let targetLeft = screenX - width / 2;
    if (targetLeft + width > maxScreenRight) {
      targetLeft = maxScreenRight - width;
    }
    if (targetLeft < minScreenLeft) {
      targetLeft = minScreenLeft;
    }

    return [Math.round(targetLeft), Math.round(targetTop)];
  };

  return (
    <Html
      calculatePosition={calculatePosition}
      zIndexRange={[100, 200]}
      style={{ pointerEvents: "none" }}
    >
      <div
        id={`thermo-popover-${model.id}`}
        className="thermo-hygro-popover"
        data-placement="top"
      >
        <div className="thermo-popover-header">
          <span className="thermo-popover-icon">
            <Icon icon="mdi:thermometer-water" width="18" height="18" />
          </span>
          {(() => {
            const displayId = linkedSensor?.id || model.thermoHygroId || (model.name?.startsWith("TH-") ? model.name : undefined);
            return displayId ? (
              <span className="thermo-popover-id">{displayId}</span>
            ) : null;
          })()}
          <span className="thermo-popover-title">
            {linkedSensor?.name || model.name || "온습도계"}
          </span>
          <span
            className="thermo-popover-badge"
            style={{
              background: statusMeta.bg,
              color: statusMeta.color,
              border: `1px solid ${statusMeta.borderColor}`,
            }}
          >
            {statusMeta.label}
          </span>
            </div>
            <div className="thermo-popover-metrics">
              {/* 1. 온도 영역 (온도값 + 하단 타겟 정보/바) */}
              <div className="thermo-metric-col temp">
                <span className="thermo-metric-lbl">온도</span>
                <div className="thermo-metric-val">
                  {effectiveTemp.toFixed(1)}
                  <span className="thermo-metric-unit">°C</span>
                </div>
                <div className="thermo-target-info">
                  <span className="thermo-target-lbl">TARGET :</span>
                  <span className="thermo-target-val">18.0 ~ 27.0 °C</span>
                </div>
                <div className="thermo-target-bar-track">
                  <div className="thermo-target-bar-opt temp-opt" />
                  <div
                    className="thermo-target-bar-dot temp-dot"
                    style={{
                      left: `${Math.max(0, Math.min(100, ((effectiveTemp - 10) / 25) * 100))}%`,
                    }}
                  />
                </div>
              </div>

              <div className="thermo-popover-vdiv" />

              {/* 2. 습도 영역 (물방울 게이지 + 습도값 + 하단 타겟 정보/바) */}
              <div className="thermo-metric-col hum">
                <span className="thermo-metric-lbl">습도</span>
                <div className="thermo-metric-val hum-val-row">
                  <DropletGaugeSvg humidity={effectiveHum} id={model.id} />
                  <span>{effectiveHum.toFixed(1)}</span>
                  <span className="thermo-metric-unit">%</span>
                </div>
                <div className="thermo-target-info">
                  <span className="thermo-target-lbl">TARGET :</span>
                  <span className="thermo-target-val">40.0 ~ 60.0 %</span>
                </div>
                <div className="thermo-target-bar-track">
                  <div className="thermo-target-bar-opt hum-opt" />
                  <div
                    className="thermo-target-bar-dot hum-dot"
                    style={{
                      left: `${Math.max(0, Math.min(100, effectiveHum))}%`,
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="thermo-popover-footer">
              <span>📍 {linkedSensor?.location || "랙 48U 상단"}</span>
              {linkedSensor?.battery !== undefined && (
                <span>🔋 {linkedSensor.battery}%</span>
              )}
            </div>
          </div>
        </Html>
      );
    };

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

  const [isHovered, setIsHovered] = useState(false);
  const innerGroupRef = useRef<Group>(null);
  const invalidate = useThree((s) => s.invalidate);

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
  const cctvTitle = linkedCctv?.name || model.name || "CCTV";

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

        e.stopPropagation();
        if (isEditMode) {
          document.body.style.cursor = isMoveEnabled ? "grab" : "pointer";
        } else if (isCctv || isThermoHygro) {
          document.body.style.cursor = "pointer";
        }
        if (isCctv || isThermoHygro) {
          setIsHovered(true);
        }
      }}
      onPointerMove={(e) => {
        if (isObstructing) return;
        if ((isCctv || isThermoHygro) && !isHovered) {
          setIsHovered(true);
        }
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

        e.stopPropagation();
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        if (
          document.body.style.cursor === "grab" ||
          document.body.style.cursor === "pointer"
        ) {
          document.body.style.cursor = "auto";
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

      {/* View Mode Hover Popover (멀리서도 선명하게 온습도 정보 표출 - 화면 잘림 방지 및 자동 상/하 플립) */}
      {!isEditMode && isThermoHygro && isHovered && (
        <ThermoHygroHoverOverlay
          model={model}
          linkedSensor={linkedSensor}
          statusMeta={statusMeta}
          effectiveTemp={effectiveTemp}
          effectiveHum={effectiveHum}
        />
      )}

      {/* CCTV Hover Tag (랙 호버 태그와 동일한 고품질 플로팅 태그) */}
      {!isEditMode && isCctv && isHovered && (
        <Billboard position={[0, -(model.baseSize?.[1] ?? 0.25) - 0.16, 0]} visible={isHovered}>
          <Html center zIndexRange={[50, 100]} style={{ pointerEvents: "none" }}>
            <div
              style={{
                background: isDarkMode
                  ? "rgba(23, 24, 28, 0.88)"
                  : "rgba(255, 255, 255, 0.92)",
                color: isDarkMode ? "#ebedef" : "#202226",
                padding: "4px 12px",
                borderRadius: "16px",
                fontSize: "12px",
                fontWeight: 600,
                border: isDarkMode
                  ? "1px solid rgba(255, 255, 255, 0.2)"
                  : "1px solid rgba(0, 0, 0, 0.12)",
                boxShadow: isDarkMode
                  ? "0 4px 15px rgba(0, 0, 0, 0.45)"
                  : "0 4px 12px rgba(0, 0, 0, 0.1)",
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
                  background: linkedCctv?.status === "offline" ? "#ef4444" : "#10b981",
                  display: "inline-block",
                  boxShadow: linkedCctv?.status === "offline" ? "0 0 6px #ef4444" : "0 0 6px #10b981",
                }}
              />
              {cctvId && (
                <>
                  <span style={{ color: "#60a5fa", fontFamily: "monospace", fontWeight: 700 }}>
                    {cctvId}
                  </span>
                  <span style={{ opacity: 0.4 }}>|</span>
                </>
              )}
              <span>{cctvTitle}</span>
            </div>
          </Html>
        </Billboard>
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
    </group>
  );
};
