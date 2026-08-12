import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshReflectorMaterial } from "@react-three/drei";
import {
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  ShaderMaterial,
  DoubleSide,
} from "three";
import { useTheme } from "../contexts/ThemeContext";
import { useStore } from "../store/useStore";
import { GRID_SPACING } from "./constants";

/* ────────────────────────────────────────────────────────────────────
   Constants
   ──────────────────────────────────────────────────────────────────── */
const ROOM_H = 4;       // ceiling height (Y)
const TILE = 1.2;       // floor tile size (larger tiles per reference)
const PAD = 5;          // padding around bounding box
const MIN_SIZE = 12;    // minimum room dimension
const WALL_THICKNESS = 0.12;

// Wall panel layout – large rectangular panels with seam lines
const PANEL_H = 3.2;    // main wall panel height
const PANEL_GAP = 0.02; // seam width between panels
const BASEBOARD_H = ROOM_H - PANEL_H; // bottom baseboard strip

/** Simple seeded pseudo-random (mulberry32) */
function seededRandom(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shared room-dimensions interface */
interface RoomProps {
  isDark: boolean;
  w: number;
  d: number;
  cx: number;
  cz: number;
}

/* ────────────────────────────────────────────────────────────────────
   Hook – compute room bounds from racks + imported models
   ──────────────────────────────────────────────────────────────────── */
function useRoomBounds() {
  const racks = useStore((s) => s.racks);
  const activeNodeId = useStore((s) => s.activeNodeId);
  const importedModels = useStore((s) => s.importedModels);

  return useMemo(() => {
    const nodeRacks = racks.filter((r) => r.mapId === activeNodeId);

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const r of nodeRacks) {
      const wx = r.position[0] * GRID_SPACING;
      const wz = r.position[1] * GRID_SPACING;
      const hw = (r.width || 0.6) / 2;
      const hd = 0.5;
      minX = Math.min(minX, wx - hw);
      maxX = Math.max(maxX, wx + hw);
      minZ = Math.min(minZ, wz - hd);
      maxZ = Math.max(maxZ, wz + hd);
    }

    for (const m of importedModels) {
      const [mx, , mz] = m.position;
      minX = Math.min(minX, mx - 1);
      maxX = Math.max(maxX, mx + 1);
      minZ = Math.min(minZ, mz - 1);
      maxZ = Math.max(maxZ, mz + 1);
    }

    if (!isFinite(minX)) {
      minX = -MIN_SIZE / 2;
      maxX = MIN_SIZE / 2;
      minZ = -MIN_SIZE / 2;
      maxZ = MIN_SIZE / 2;
    }

    const rawW = maxX - minX + PAD * 2;
    const rawD = maxZ - minZ + PAD * 2;
    const w = Math.max(rawW, MIN_SIZE);
    const d = Math.max(rawD, MIN_SIZE);
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;

    return { w, d, cx, cz };
  }, [racks, activeNodeId, importedModels]);
}

/* ════════════════════════════════════════════════════════════════════
   FLOOR – large glossy tiles with subtle grid + strong reflection
   ════════════════════════════════════════════════════════════════════ */
const ServerRoomFloor = ({ isDark, w, d, cx, cz }: RoomProps) => {
  const floorMat = useMemo(() => {
    return new ShaderMaterial({
      uniforms: {
        u_tile: { value: TILE },
        u_roomW: { value: w },
        u_roomD: { value: d },
        u_bgColor: {
          value: isDark ? [0.08, 0.10, 0.15] : [0.90, 0.92, 0.95],
        },
        u_lineColor: {
          value: isDark ? [0.16, 0.20, 0.28] : [0.78, 0.80, 0.84],
        },
        u_lineWidth: { value: 0.006 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float u_tile;
        uniform float u_roomW;
        uniform float u_roomD;
        uniform vec3 u_bgColor;
        uniform vec3 u_lineColor;
        uniform float u_lineWidth;
        varying vec2 vUv;
        void main() {
          vec2 world = vUv * vec2(u_roomW, u_roomD);
          vec2 gridPos = fract(world / u_tile);
          float lineX = step(gridPos.x, u_lineWidth) + step(1.0 - u_lineWidth, gridPos.x);
          float lineY = step(gridPos.y, u_lineWidth) + step(1.0 - u_lineWidth, gridPos.y);
          float line = clamp(lineX + lineY, 0.0, 1.0);
          vec3 color = mix(u_bgColor, u_lineColor, line);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
  }, [isDark, w, d]);

  return (
    <group>
      {/* Tiled floor with grid pattern */}
      <mesh
        position={[cx, -0.005, cz]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={floorMat}
        receiveShadow
      >
        <planeGeometry args={[w, d]} />
      </mesh>

      {/* Glossy reflective overlay — high reflection like reference images */}
      <mesh position={[cx, -0.003, cz]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <MeshReflectorMaterial
          transparent
          opacity={isDark ? 0.35 : 0.25}
          blur={[100, 100]}
          resolution={1024}
          mixBlur={8}
          mixStrength={isDark ? 20 : 15}
          roughness={isDark ? 0.6 : 0.5}
          depthScale={0.8}
          minDepthThreshold={0.4}
          maxDepthThreshold={1}
          color={isDark ? "#1a2035" : "#d8dce5"}
          metalness={isDark ? 0.5 : 0.3}
        />
      </mesh>
    </group>
  );
};

/* ════════════════════════════════════════════════════════════════════
   CEILING – flat panel base + recessed rectangular light fixtures
   per reference: large rectangular glow panels in a grid pattern
   ════════════════════════════════════════════════════════════════════ */
const Ceiling = ({ isDark, w, d, cx, cz }: RoomProps) => {
  const panelColor = isDark ? "#1a2030" : "#dce0e8";

  /* Recessed rectangular ceiling light panels */
  const lights = useMemo(() => {
    const items: { x: number; z: number }[] = [];
    const spacingX = 4;
    const spacingZ = 4;
    const halfW = w / 2;
    const halfD = d / 2;
    for (let x = -halfW + spacingX / 2 + 1; x < halfW - 1; x += spacingX) {
      for (let z = -halfD + spacingZ / 2 + 1; z < halfD - 1; z += spacingZ) {
        items.push({ x: cx + x, z: cz + z });
      }
    }
    return items;
  }, [w, d, cx, cz]);

  /* Narrow strip lights between main panels (like reference) */
  const stripLights = useMemo(() => {
    const items: { x: number; z: number; isX: boolean }[] = [];
    const spacing = 6;
    const halfW = w / 2;
    const halfD = d / 2;
    // Strips running along X axis
    for (let z = -halfD + spacing; z < halfD; z += spacing) {
      items.push({ x: cx, z: cz + z, isX: true });
    }
    // Strips running along Z axis
    for (let x = -halfW + spacing; x < halfW; x += spacing) {
      items.push({ x: cx + x, z: cz, isX: false });
    }
    return items;
  }, [w, d, cx, cz]);

  return (
    <group>
      {/* Ceiling base — DoubleSide + transparent so visible from outside */}
      <mesh position={[cx, ROOM_H, cz]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial
          color={panelColor}
          roughness={0.85}
          metalness={0.05}
          side={DoubleSide}
          transparent
          opacity={0.92}
        />
      </mesh>

      {/* Ceiling grid seams — thin lines for T-bar grid */}
      <mesh position={[cx, ROOM_H - 0.005, cz]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <shaderMaterial
          transparent
          side={DoubleSide}
          uniforms={{
            u_tile: { value: 2.0 },
            u_roomW: { value: w },
            u_roomD: { value: d },
            u_lineColor: {
              value: isDark ? [0.15, 0.18, 0.25] : [0.75, 0.77, 0.82],
            },
            u_lineWidth: { value: 0.004 },
          }}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform float u_tile;
            uniform float u_roomW;
            uniform float u_roomD;
            uniform vec3 u_lineColor;
            uniform float u_lineWidth;
            varying vec2 vUv;
            void main() {
              vec2 world = vUv * vec2(u_roomW, u_roomD);
              vec2 gridPos = fract(world / u_tile);
              float lineX = step(gridPos.x, u_lineWidth) + step(1.0 - u_lineWidth, gridPos.x);
              float lineY = step(gridPos.y, u_lineWidth) + step(1.0 - u_lineWidth, gridPos.y);
              float line = clamp(lineX + lineY, 0.0, 1.0);
              gl_FragColor = vec4(u_lineColor, line * 0.5);
            }
          `}
        />
      </mesh>

      {/* Recessed rectangular panel lights (main illumination) */}
      {lights.map((l, i) => (
        <group key={`panel-${i}`} position={[l.x, ROOM_H - 0.02, l.z]}>
          {/* Housing recess (dark outline) */}
          <mesh>
            <boxGeometry args={[1.4, 0.04, 1.4]} />
            <meshStandardMaterial
              color={isDark ? "#0e1520" : "#c0c4cc"}
              metalness={0.3}
              roughness={0.5}
            />
          </mesh>
          {/* Glowing light panel */}
          <mesh position={[0, -0.025, 0]}>
            <boxGeometry args={[1.2, 0.01, 1.2]} />
            <meshStandardMaterial
              color={isDark ? "#a0c4f0" : "#f0f4ff"}
              emissive={isDark ? "#6090cc" : "#e0eaff"}
              emissiveIntensity={isDark ? 3.0 : 2.0}
              toneMapped={false}
            />
          </mesh>
          {/* Actual light source */}
          <pointLight
            position={[0, -0.3, 0]}
            color={isDark ? "#8ab4e8" : "#e8f0ff"}
            intensity={isDark ? 1.2 : 0.8}
            distance={6}
            decay={2}
          />
        </group>
      ))}

      {/* Narrow strip lights between ceiling grid sections */}
      {stripLights.map((s, i) => (
        <group key={`strip-${i}`} position={[s.x, ROOM_H - 0.015, s.z]}>
          <mesh>
            <boxGeometry
              args={s.isX ? [w * 0.7, 0.008, 0.08] : [0.08, 0.008, d * 0.7]}
            />
            <meshStandardMaterial
              color={isDark ? "#8ab8e8" : "#e8f0ff"}
              emissive={isDark ? "#5090cc" : "#d0e0ff"}
              emissiveIntensity={isDark ? 1.5 : 0.8}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
};

/* ════════════════════════════════════════════════════════════════════
   WALLS – large rectangular panels with frame seams,
   vertical column dividers, bottom baseboard with LED upwash,
   and corner LED tubes. All rendered BackSide for see-through.
   ════════════════════════════════════════════════════════════════════ */

/** Data for a single wall segment */
interface WallDef {
  /** Center position */
  pos: [number, number, number];
  /** Euler rotation */
  rot: [number, number, number];
  /** Face width (the long dimension of this wall face) */
  faceW: number;
}

const PanelWall = ({
  isDark,
  wallDef,
}: {
  isDark: boolean;
  wallDef: WallDef;
}) => {
  const { pos, rot, faceW } = wallDef;

  // Colors
  const panelColor = isDark ? "#1f2640" : "#e4e8f0";
  const frameColor = isDark ? "#10152a" : "#c4c8d4";
  const baseColor = isDark ? "#0e1325" : "#d0d4dc";

  // Compute panel subdivision – ~4m per panel
  const panelCount = Math.max(2, Math.round(faceW / 4));
  const panelW = (faceW - (panelCount + 1) * PANEL_GAP) / panelCount;

  return (
    <group position={pos} rotation={rot}>
      {/* Full wall background — DoubleSide + transparent for see-through */}
      <mesh>
        <boxGeometry args={[faceW, ROOM_H, WALL_THICKNESS]} />
        <meshStandardMaterial
          color={frameColor}
          roughness={0.6}
          metalness={0.15}
          side={DoubleSide}
          transparent
          opacity={isDark ? 0.7 : 0.55}
        />
      </mesh>

      {/* Individual panels */}
      {Array.from({ length: panelCount }).map((_, pi) => {
        const x =
          -faceW / 2 +
          PANEL_GAP +
          panelW / 2 +
          pi * (panelW + PANEL_GAP);
        return (
          <mesh
            key={pi}
            position={[x, BASEBOARD_H / 2, WALL_THICKNESS / 2 + 0.001]}
          >
            <planeGeometry args={[panelW - 0.02, PANEL_H - 0.04]} />
            <meshStandardMaterial
              color={panelColor}
              roughness={0.5}
              metalness={0.08}
              side={DoubleSide}
            />
          </mesh>
        );
      })}

      {/* Baseboard strip at bottom */}
      <mesh position={[0, -ROOM_H / 2 + BASEBOARD_H / 2, WALL_THICKNESS / 2 + 0.001]}>
        <planeGeometry args={[faceW - 0.04, BASEBOARD_H - 0.02]} />
        <meshStandardMaterial
          color={baseColor}
          roughness={0.4}
          metalness={0.2}
          side={DoubleSide}
        />
      </mesh>

      {/* Bottom LED upwash lights – small glowing blocks spaced along base */}
      {Array.from({
        length: Math.max(2, Math.round(faceW / 4)),
      }).map((_, li) => {
        const spacing = faceW / (Math.round(faceW / 4) + 1);
        const lx = -faceW / 2 + spacing * (li + 1);
        return (
          <group key={`led-${li}`}>
            {/* LED block */}
            <mesh position={[lx, -ROOM_H / 2 + 0.08, WALL_THICKNESS / 2 + 0.04]}>
              <boxGeometry args={[0.25, 0.06, 0.04]} />
              <meshStandardMaterial
                color={isDark ? "#4499ee" : "#70b0ff"}
                emissive={isDark ? "#2277dd" : "#5090ee"}
                emissiveIntensity={isDark ? 4.0 : 2.5}
                toneMapped={false}
              />
            </mesh>
            {/* LED point light for upwash glow */}
            <pointLight
              position={[lx, -ROOM_H / 2 + 0.3, WALL_THICKNESS / 2 + 0.15]}
              color={isDark ? "#3388dd" : "#6699ee"}
              intensity={isDark ? 0.6 : 0.3}
              distance={2.5}
              decay={2}
            />
          </group>
        );
      })}

      {/* Vertical LED tube at each end (corner lights) */}
      {[-1, 1].map((side) => (
        <group key={`vtube-${side}`}>
          <mesh
            position={[
              side * (faceW / 2 - 0.15),
              0,
              WALL_THICKNESS / 2 + 0.03,
            ]}
          >
            <boxGeometry args={[0.04, ROOM_H * 0.55, 0.03]} />
            <meshStandardMaterial
              color={isDark ? "#5599dd" : "#88bbff"}
              emissive={isDark ? "#3377cc" : "#6699ee"}
              emissiveIntensity={isDark ? 3.0 : 1.5}
              toneMapped={false}
            />
          </mesh>
          <pointLight
            position={[
              side * (faceW / 2 - 0.15),
              0,
              WALL_THICKNESS / 2 + 0.2,
            ]}
            color={isDark ? "#4488cc" : "#88aaee"}
            intensity={isDark ? 0.5 : 0.25}
            distance={3}
            decay={2}
          />
        </group>
      ))}
    </group>
  );
};

const Walls = ({ isDark, w, d, cx, cz }: RoomProps) => {
  const wallDefs = useMemo<WallDef[]>(
    () => [
      // Back (−Z)
      {
        pos: [cx, ROOM_H / 2, cz - d / 2],
        rot: [0, 0, 0],
        faceW: w,
      },
      // Front (+Z)
      {
        pos: [cx, ROOM_H / 2, cz + d / 2],
        rot: [0, Math.PI, 0],
        faceW: w,
      },
      // Left (−X)
      {
        pos: [cx - w / 2, ROOM_H / 2, cz],
        rot: [0, Math.PI / 2, 0],
        faceW: d,
      },
      // Right (+X)
      {
        pos: [cx + w / 2, ROOM_H / 2, cz],
        rot: [0, -Math.PI / 2, 0],
        faceW: d,
      },
    ],
    [w, d, cx, cz],
  );

  return (
    <group>
      {wallDefs.map((wd, i) => (
        <PanelWall key={i} isDark={isDark} wallDef={wd} />
      ))}
    </group>
  );
};

/* ════════════════════════════════════════════════════════════════════
   PARTICLES – subtle floating dust / air circulation
   ════════════════════════════════════════════════════════════════════ */
const DustParticles = ({ isDark, w, d, cx, cz }: RoomProps) => {
  const COUNT = 150;
  const pointsRef = useRef<Points>(null);

  const geometry = useMemo(() => {
    const rng = seededRandom(42);
    const positions = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = cx + (rng() - 0.5) * w * 0.8;
      positions[i * 3 + 1] = rng() * ROOM_H * 0.85 + 0.3;
      positions[i * 3 + 2] = cz + (rng() - 0.5) * d * 0.8;
    }
    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
    return geo;
  }, [w, d, cx, cz]);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const t = clock.getElapsedTime() * 0.12;
    const positions = pointsRef.current.geometry.attributes.position;
    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3;
      const iy = i * 3 + 1;
      (positions.array as Float32Array)[iy] += Math.sin(t + i * 0.3) * 0.0006;
      (positions.array as Float32Array)[ix] += Math.cos(t * 0.7 + i * 0.2) * 0.0003;
      if ((positions.array as Float32Array)[iy] > ROOM_H * 0.9) {
        (positions.array as Float32Array)[iy] = 0.3;
      }
    }
    positions.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={0.025}
        color={isDark ? "#7799cc" : "#a0b8d0"}
        transparent
        opacity={isDark ? 0.3 : 0.18}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
};

/* ════════════════════════════════════════════════════════════════════
   AMBIENT LIGHTING – cool blue tint from floor + overall fill
   ════════════════════════════════════════════════════════════════════ */
const ServerRoomLighting = ({ isDark, w, d, cx, cz }: RoomProps) => (
  <group>
    {/* Under-floor blue glow */}
    <rectAreaLight
      position={[cx, 0.05, cz]}
      rotation={[-Math.PI / 2, 0, 0]}
      width={w * 0.5}
      height={d * 0.5}
      intensity={isDark ? 0.4 : 0.15}
      color={isDark ? "#3366aa" : "#8899cc"}
    />
    {/* Overhead general fill (supplement ceiling panels) */}
    <rectAreaLight
      position={[cx, ROOM_H - 0.1, cz]}
      rotation={[Math.PI / 2, 0, 0]}
      width={w * 0.8}
      height={d * 0.8}
      intensity={isDark ? 0.15 : 0.3}
      color={isDark ? "#8ab4e8" : "#f0f4ff"}
    />
  </group>
);

/* ════════════════════════════════════════════════════════════════════
   ROOT – assembles all sub-components
   ════════════════════════════════════════════════════════════════════ */
export const CyberSpaceEnvironment = () => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const bounds = useRoomBounds();

  const props: RoomProps = { isDark, ...bounds };

  return (
    <group>
      <ServerRoomFloor {...props} />
      <Ceiling {...props} />
      <Walls {...props} />
      <DustParticles {...props} />
      <ServerRoomLighting {...props} />
    </group>
  );
};
