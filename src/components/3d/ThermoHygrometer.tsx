import { useMemo, useEffect, useState, useRef, forwardRef } from "react";
import { CanvasTexture, Mesh, SRGBColorSpace, Color, AdditiveBlending } from "three";
import { useThree } from "@react-three/fiber";

// 수평 라인 네온 글로우 텍스처 (온습도계 상단 라인 발광 전용)
const thermoLineGlowTexture = (() => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // 1. 수직 방향 부드러운 가우시안/선형 페이드아웃 (중심 고휘도 백색 -> 외곽 페이드)
  const vGrad = ctx.createLinearGradient(0, 0, 0, 64);
  vGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
  vGrad.addColorStop(0.2, "rgba(255, 255, 255, 0.45)");
  vGrad.addColorStop(0.5, "rgba(255, 255, 255, 1.0)");
  vGrad.addColorStop(0.8, "rgba(255, 255, 255, 0.45)");
  vGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = vGrad;
  ctx.fillRect(0, 0, 512, 64);

  // 2. 수평 양끝 자연스러운 라운드 페이드아웃 (빛이 양끝에서 부드럽게 감쇄)
  ctx.globalCompositeOperation = "destination-in";
  const hGrad = ctx.createLinearGradient(0, 0, 512, 0);
  hGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
  hGrad.addColorStop(0.03, "rgba(255, 255, 255, 1)");
  hGrad.addColorStop(0.97, "rgba(255, 255, 255, 1)");
  hGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = hGrad;
  ctx.fillRect(0, 0, 512, 64);

  const tex = new CanvasTexture(canvas);
  return tex;
})();

interface ThermoHygrometerProps {
  sensorId?: string;
  sensorName?: string;
  temperature?: number;
  humidity?: number;
  status?: "normal" | "critical" | "major" | "minor" | "warning" | "offline" | "danger" | string;
  color?: string;
  dimensions?: [number, number, number];
  emissiveIntensity?: number;
}

export const ThermoHygrometer = forwardRef<Mesh, ThermoHygrometerProps>(
  (
    {
      sensorId = "TH-001",
      sensorName,
      temperature = 23.4,
      humidity = 45.2,
      status = "normal",
      color = "#181e29",
      dimensions = [0.35, 0.13, 0.04],
      emissiveIntensity = 0.65,
    },
    ref,
  ) => {
    const invalidate = useThree((s) => s.invalidate);
    const coreLineRef = useRef<Mesh>(null);
    const glowPlaneRef = useRef<Mesh>(null);

    const statusLineColor = useMemo(() => {
      const s = status?.toLowerCase();
      if (s === "critical" || s === "danger") return "#ef4444";
      if (s === "major") return "#f97316";
      if (s === "minor") return "#eab308";
      if (s === "warning") return "#3b82f6";
      if (s === "offline" || s === "unlinked") return "#64748b";
      return "#10b981"; // 정상: 초록색
    }, [status]);

    // 기기 고유 ID 기반 시작 딜레이 오프셋
    const delayOffset = useMemo(() => {
      let hash = 0;
      for (let i = 0; i < sensorId.length; i++) {
        hash = (hash + sensorId.charCodeAt(i) * (i + 1)) % 1000;
      }
      return Math.floor((hash / 1000) * 650);
    }, [sensorId]);

    // 650ms 주기 상단 라인 점멸 & 발광 (React 리렌더링 없이 Three.js Mesh.visible 직접 토글)
    useEffect(() => {
      let isLit = true;
      let timer: NodeJS.Timeout;
      const startTimer = setTimeout(() => {
        timer = setInterval(() => {
          isLit = !isLit;
          if (coreLineRef.current) coreLineRef.current.visible = isLit;
          if (glowPlaneRef.current) glowPlaneRef.current.visible = isLit;
          invalidate();
        }, 650);
      }, delayOffset);

      return () => {
        clearTimeout(startTimer);
        if (timer) clearInterval(timer);
      };
    }, [invalidate, delayOffset]);

    // 760 x 280 canvas: perfectly balanced margins without text overflowing
    const canvasWidth = 760;
    const canvasHeight = 280;

    const canvas = useMemo(() => {
      const c = document.createElement("canvas");
      c.width = canvasWidth;
      c.height = canvasHeight;
      return c;
    }, [canvasWidth, canvasHeight]);

    const baseTexture = useMemo(() => {
      const tex = new CanvasTexture(canvas);
      tex.colorSpace = SRGBColorSpace;
      return tex;
    }, [canvas]);

    const [fontsLoaded, setFontsLoaded] = useState(false);

    useEffect(() => {
      const styleId = "dseg-fonts-style";
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.innerHTML = `
          @font-face { font-family: "D7MI"; src: url("/font/fonts-DSEG_v046/DSEG7-Classic/DSEG7Classic-Italic.woff") format('woff'); }
          @font-face { font-family: "D14MI"; src: url("/font/fonts-DSEG_v046/DSEG14-Classic/DSEG14Classic-Italic.woff") format('woff'); }
          @font-face { font-family: "D7MBI"; src: url("/font/fonts-DSEG_v046/DSEG7-Classic/DSEG7Classic-BoldItalic.woff") format('woff'); }
        `;
        document.head.appendChild(style);
      }
      document.fonts.ready.then(() => setFontsLoaded(true));
    }, []);

    // Draw LCD Screen content
    const drawScreen = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Status color definition
      const s = status?.toLowerCase();
      const statusColor =
        s === "critical" || s === "danger"
          ? "#ef4444"
          : s === "major"
            ? "#f97316"
            : s === "minor"
              ? "#eab308"
              : s === "warning"
                ? "#3b82f6"
                : s === "offline" || s === "unlinked"
                  ? "#94a3b8"
                  : "#10b981";

      const statusBg =
        s === "critical" || s === "danger"
          ? "rgba(239, 68, 68, 0.22)"
          : s === "major"
            ? "rgba(249, 115, 22, 0.22)"
            : s === "minor"
              ? "rgba(234, 179, 8, 0.22)"
              : s === "warning"
                ? "rgba(59, 130, 246, 0.22)"
                : s === "offline" || s === "unlinked"
                  ? "rgba(148, 163, 184, 0.18)"
                  : "rgba(16, 185, 129, 0.22)";

      // Clear Canvas with deep OLED dark background
      ctx.fillStyle = "#090d16";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Inner LCD Screen border (여유 있는 10px 마진)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(10, 10, canvasWidth - 20, canvasHeight - 20);

      // ─── 1. Header: Sensor Tag & Status Pill ───
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      const headerY = 33;

      // Status Pill
      const statusText = status.toUpperCase();
      ctx.font = 'bold 16px "Inter", sans-serif';
      const statusMetrics = ctx.measureText(statusText);
      const pillWidth = Math.max(118, Math.ceil(statusMetrics.width + 46));
      const pillHeight = 28;
      const pillX = canvasWidth - pillWidth - 22;
      const pillY = headerY - pillHeight / 2;

      // Device ID (34px)
      ctx.font = 'bold 34px "Inter", "Segoe UI", sans-serif';
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(sensorId, 24, headerY);
      const idMetrics = ctx.measureText(sensorId);

      // Device Name
      if (sensorName) {
        const nameStartX = 24 + idMetrics.width + 12;
        const maxNameWidth = pillX - nameStartX - 16;
        if (maxNameWidth > 35) {
          ctx.font = '500 21px "Inter", "Malgun Gothic", sans-serif';
          ctx.fillStyle = "#64748b";

          let displayName = `|  ${sensorName}`;
          if (ctx.measureText(displayName).width > maxNameWidth) {
            while (
              displayName.length > 4 &&
              ctx.measureText(displayName + "...").width > maxNameWidth
            ) {
              displayName = displayName.slice(0, -1);
            }
            displayName += "...";
          }
          ctx.fillText(displayName, nameStartX, headerY);
        }
      }

      // Draw Status Pill (Capsule shape)
      ctx.fillStyle = statusBg;
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 14);
      ctx.fill();
      ctx.strokeStyle = statusColor;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Status dot
      const dotCenterX = pillX + 15;
      const dotCenterY = pillY + 14;
      ctx.beginPath();
      ctx.arc(dotCenterX, dotCenterY, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = statusColor;
      ctx.fill();

      // Status Text
      ctx.font = 'bold 16px "Inter", sans-serif';
      ctx.fillStyle = statusColor;
      ctx.fillText(statusText, pillX + 25, pillY + 14);

      // ─── Header Divider Line ───
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(20, 56);
      ctx.lineTo(canvasWidth - 20, 56);
      ctx.stroke();

      // ─── Center Vertical Divider Line (온도 °C 우측에 26px 여유 확보: 345) ───
      const midX = 345;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(midX, 66);
      ctx.lineTo(midX, 260);
      ctx.stroke();

      // ─── 2. Section Titles ───
      const titleY = 78;

      // ─── 3. Left Column: TEMPERATURE ───
      const leftColX = 24;
      const leftColW = midX - leftColX - 18; // ~303px

      ctx.font = 'bold 18px "Inter", "Malgun Gothic", sans-serif';
      ctx.fillStyle = "#38bdf8"; // bright sky blue
      ctx.fillText("온도  TEMPERATURE", leftColX, titleY);

      // Main Values Y-Center Baseline
      const valueCenterY = 146;

      // Actual Temperature Value
      const tempStr =
        temperature !== undefined ? temperature.toFixed(1) : "--.-";
      const tempColor =
        s === "critical" || s === "danger"
          ? "#ef4444"
          : s === "major"
            ? "#f97316"
            : s === "minor"
              ? "#eab308"
              : s === "warning"
                ? "#3b82f6"
                : s === "offline" || s === "unlinked"
                  ? "#94a3b8"
                  : "#ffffff";

      ctx.font = 'italic bold 112px "D7MBI", "D7MI", monospace';
      ctx.fillStyle = tempColor;
      ctx.fillText(tempStr, leftColX, valueCenterY);

      // °C Unit Symbol (세로선과 22px 이상 안전 여백 유지)
      const tempMetrics = ctx.measureText(tempStr);
      const tempUnitX = leftColX + tempMetrics.width + 8;
      ctx.font = 'bold 32px "Inter", "Segoe UI", sans-serif';
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("°C", tempUnitX, valueCenterY - 20);

      // Target Range Text & Value
      ctx.font = 'bold 17px "Inter", sans-serif';
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("TARGET :", leftColX, 220);
      const targetMetrics = ctx.measureText("TARGET : ");
      ctx.fillStyle = "#f8fafc";
      ctx.fillText("18.0 ~ 27.0 °C", leftColX + targetMetrics.width, 220);

      // Target Bar Track (바닥 254로 내부 테두리와 밀착)
      const targetBarY = 242;
      const targetBarH = 10;
      ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
      ctx.beginPath();
      ctx.roundRect(leftColX, targetBarY, leftColW, targetBarH, 5);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Highlight optimal zone (18~27°C)
      const tempOptStart = leftColX + leftColW * 0.32;
      const tempOptWidth = leftColW * 0.36;
      ctx.fillStyle = "rgba(16, 185, 129, 0.85)";
      ctx.beginPath();
      ctx.roundRect(tempOptStart, targetBarY, tempOptWidth, targetBarH, 5);
      ctx.fill();

      // Current temp position pin & dot on bar
      const tempVal = typeof temperature === "number" ? temperature : 23.4;
      const tempRatio = Math.max(0, Math.min(1, (tempVal - 10) / 25));
      const tempCursorX = leftColX + leftColW * tempRatio;
      const barCenterY = targetBarY + targetBarH / 2;

      ctx.beginPath();
      ctx.arc(tempCursorX, barCenterY, 8.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(tempCursorX, barCenterY, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = tempColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // ─── 4. Right Column: HUMIDITY (% 우측 28px 안전 여백 확보) ───
      const rightColX = midX + 22; // 367
      const rightColW = canvasWidth - rightColX - 24; // ~369px

      ctx.font = 'bold 18px "Inter", "Malgun Gothic", sans-serif';
      ctx.fillStyle = "#60a5fa"; // blue
      ctx.fillText("습도  HUMIDITY", rightColX, titleY);

      // 물방울 모양 게이지
      const dropW = 54;
      const dropH = 74;
      const dropX = rightColX;
      const dropY = valueCenterY - dropH / 2 + 1; // 110
      const cx = dropX + dropW * 0.5;
      const r = dropW * 0.5; // 27px
      const cy = dropY + dropH - r;
      const topY = dropY;

      const drawDropletPath = (c: CanvasRenderingContext2D) => {
        c.beginPath();
        c.moveTo(cx, topY);
        c.bezierCurveTo(
          cx + r * 0.65,
          topY + (cy - topY) * 0.45,
          cx + r,
          cy - r * 0.2,
          cx + r,
          cy,
        );
        c.arc(cx, cy, r, 0, Math.PI, false);
        c.bezierCurveTo(
          cx - r,
          cy - r * 0.2,
          cx - r * 0.65,
          topY + (cy - topY) * 0.45,
          cx,
          topY,
        );
        c.closePath();
      };

      // 4-1. Droplet Background & Liquid Fill Gauge
      ctx.save();
      drawDropletPath(ctx);
      ctx.clip();

      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.fill();

      // Liquid Fill level based on humidity % (50%가 허리선에 안착)
      const humVal = typeof humidity === "number" ? humidity : 45.2;
      const humPct = Math.max(0, Math.min(100, humVal)) / 100;

      let fillHeight: number;
      if (humPct <= 0.5) {
        const t = humPct / 0.5;
        fillHeight = r * Math.pow(t, 0.95);
      } else {
        const t = (humPct - 0.5) / 0.5;
        fillHeight = r + (dropH - r) * Math.pow(t, 1.05);
      }
      const fillY = dropY + dropH - fillHeight;

      const dropGrad = ctx.createLinearGradient(0, dropY + dropH, 0, fillY);
      dropGrad.addColorStop(0, "#0284c7");
      dropGrad.addColorStop(0.5, "#0ea5e9");
      dropGrad.addColorStop(1, "#38bdf8");
      ctx.fillStyle = dropGrad;
      ctx.fillRect(dropX - 10, fillY, dropW + 20, fillHeight + 10);

      // Meniscus surface curve
      if (humPct > 0.04 && humPct < 0.96) {
        ctx.strokeStyle = "#e0f2fe";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(dropX, fillY);
        ctx.bezierCurveTo(
          dropX + dropW * 0.33,
          fillY - 2,
          dropX + dropW * 0.66,
          fillY + 2,
          dropX + dropW,
          fillY,
        );
        ctx.stroke();
      }
      ctx.restore();

      // 4-2. Droplet Outer Border
      drawDropletPath(ctx);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // 4-3. Humidity Value (온도와 100% 동일한 112px 디지털 폰트)
      const humStartX = dropX + dropW + 14;
      const humStr = humidity !== undefined ? humidity.toFixed(1) : "--.-";
      ctx.font = 'italic bold 112px "D7MBI", "D7MI", monospace';
      ctx.fillStyle = "#38bdf8"; // bright cyan
      ctx.fillText(humStr, humStartX, valueCenterY);

      // % Unit (우측 테두리와 28px 이상 안전 여백 유지)
      const humMetrics = ctx.measureText(humStr);
      const humUnitX = humStartX + humMetrics.width + 8;
      ctx.font = 'bold 32px "Inter", "Segoe UI", sans-serif';
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("%", humUnitX, valueCenterY - 20);

      // Target Range Text & Value
      ctx.font = 'bold 17px "Inter", sans-serif';
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("TARGET :", rightColX, 220);
      const humTargetMetrics = ctx.measureText("TARGET : ");
      ctx.fillStyle = "#f8fafc";
      ctx.fillText("40.0 ~ 60.0 %", rightColX + humTargetMetrics.width, 220);

      // Target Bar Track for Humidity (% 끝선과 안전 마진에 정렬된 너비)
      ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
      ctx.beginPath();
      ctx.roundRect(rightColX, targetBarY, rightColW, targetBarH, 5);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Highlight optimal zone (40% to 60%)
      const humOptStart = rightColX + rightColW * 0.4;
      const humOptWidth = rightColW * 0.2;
      ctx.fillStyle = "rgba(14, 165, 233, 0.85)";
      ctx.beginPath();
      ctx.roundRect(humOptStart, targetBarY, humOptWidth, targetBarH, 5);
      ctx.fill();

      // Current hum position pin & dot on bar
      const humRatio = Math.max(0, Math.min(1, humVal / 100));
      const humCursorX = rightColX + rightColW * humRatio;

      ctx.beginPath();
      ctx.arc(humCursorX, barCenterY, 8.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(56, 189, 248, 0.3)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(humCursorX, barCenterY, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.stroke();

      baseTexture.needsUpdate = true;
    };

    // Redraw whenever values change or fonts load
    useEffect(() => {
      drawScreen();
    }, [temperature, humidity, status, sensorId, sensorName, fontsLoaded]);

    return (
      <group>
        {/* 1. Main Outer Casing (안정적 밸런스 직사각형, 0.35m x 0.13m x 0.04m) */}
        <mesh ref={ref} castShadow receiveShadow position={[0, 0, 0]}>
          <boxGeometry args={dimensions} />
          <meshStandardMaterial
            color={color}
            roughness={0.4}
            metalness={0.7}
          />
        </mesh>

        {/* 2. Front Bezel Accent Ring */}
        <mesh position={[0, 0, dimensions[2] / 2 + 0.001]}>
          <planeGeometry args={[dimensions[0] * 0.98, dimensions[1] * 0.96]} />
          <meshStandardMaterial color="#0f172a" roughness={0.6} metalness={0.5} />
        </mesh>

        {/* 3. Screen Plane with Canvas Texture */}
        <mesh position={[0, 0, dimensions[2] / 2 + 0.002]}>
          <planeGeometry args={[dimensions[0] * 0.96, dimensions[1] * 0.92]} />
          <meshStandardMaterial
            map={baseTexture}
            emissiveMap={baseTexture}
            emissive={new Color(0xffffff)}
            emissiveIntensity={emissiveIntensity}
            roughness={0.8}
            metalness={0.0}
          />
        </mesh>

        {/* 4. Top Status Line (상단 라인 자체만 깔끔하게 점멸 및 발광) */}
        {/* 4-1. 꺼져 있을 때의 기본 슬롯 (어두운 베이스 트림) */}
        <mesh
          position={[0, dimensions[1] / 2 - 0.003, dimensions[2] / 2 + 0.003]}
          raycast={() => null}
        >
          <boxGeometry args={[dimensions[0] * 0.96, 0.004, 0.003]} />
          <meshStandardMaterial color="#0f172a" roughness={0.7} metalness={0.5} />
        </mesh>

        {/* 4-2. 켜졌을 때 라인 자체가 네온 컬러로 선명하게 빛나는 코어 바 */}
        <mesh
          ref={coreLineRef}
          position={[0, dimensions[1] / 2 - 0.003, dimensions[2] / 2 + 0.0032]}
          raycast={() => null}
        >
          <boxGeometry args={[dimensions[0] * 0.96, 0.0042, 0.0032]} />
          <meshBasicMaterial
            color={statusLineColor}
            toneMapped={false}
          />
        </mesh>

        {/* 4-3. 라인 테두리 바로 위 1.5mm만 은은하게 감싸는 슬림 엣지 글로우 (화면이나 랙으로 번지지 않음) */}
        {thermoLineGlowTexture && (
          <mesh
            ref={glowPlaneRef}
            position={[0, dimensions[1] / 2 - 0.003, dimensions[2] / 2 + 0.005]}
            raycast={() => null}
          >
            <planeGeometry args={[dimensions[0] * 0.96, 0.007]} />
            <meshBasicMaterial
              map={thermoLineGlowTexture}
              color={statusLineColor}
              transparent
              opacity={0.8}
              blending={AdditiveBlending}
              toneMapped={false}
              depthTest={false}
              depthWrite={false}
            />
          </mesh>
        )}

        {/* 5. Back Mount Plate / Bracket */}
        <mesh position={[0, 0, -dimensions[2] / 2 - 0.005]}>
          <boxGeometry args={[dimensions[0] * 0.6, dimensions[1] * 0.6, 0.01]} />
          <meshStandardMaterial color="#334155" roughness={0.8} metalness={0.3} />
        </mesh>
      </group>
    );
  },
);

ThermoHygrometer.displayName = "ThermoHygrometer";
