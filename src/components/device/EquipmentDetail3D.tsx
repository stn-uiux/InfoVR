import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { Icon } from '@iconify/react';
import { useTheme } from "../../contexts/ThemeContext";

// ─── 3D 회전/드래그 상태 관리 (회전 중 호버 차단용) ───
let isGlobalRotating = false;
let globalRotateEndTimer: ReturnType<typeof setTimeout> | undefined;

function setGlobalRotating(rotating: boolean) {
  clearTimeout(globalRotateEndTimer);
  if (rotating) {
    if (!isGlobalRotating) {
      isGlobalRotating = true;
      window.dispatchEvent(new CustomEvent('3d-orbit-start'));
    }
  } else {
    // 마우스 버튼을 뗀 후 약간의 딜레이(100ms)를 두어 드래그 종료 시점의 클릭 및 오호버 방지
    globalRotateEndTimer = setTimeout(() => {
      isGlobalRotating = false;
      window.dispatchEvent(new CustomEvent('3d-orbit-end'));
    }, 100);
  }
}



// ponytail: 2D 마우스 오버레이 툴팁용 훅 추가
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function useTooltipHover(getTooltipData: () => any) {
  const [hovered, setHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const domElementRef = useRef<HTMLElement | null>(null);

  // 전역 핀 고정 이벤트 리스너 (클릭 핀 고정 시 호버 박스 유지)
  useEffect(() => {
    const handleTooltipPin = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const myData = getTooltipData();
      if (detail && detail.title === myData?.title) {
        setIsPinned((prev) => !prev);
      } else {
        setIsPinned(false);
      }
    };
    document.addEventListener('3d-tooltip-pin', handleTooltipPin);
    return () => document.removeEventListener('3d-tooltip-pin', handleTooltipPin);
  }, [getTooltipData]);

  // 전역 툴팁 이벤트 리스너:
  // 다른 부품이 호버되었거나(title 불일치), 마우스 아웃되었을 때(detail === null)
  // 내 로컬 hovered 상태를 즉각 해제하여 잔상(Ghost box) 완전 방지!
  useEffect(() => {
    const handleGlobalTooltip = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const myData = getTooltipData();
      if (!detail || detail.title !== myData?.title) {
        clearTimeout(timeout.current);
        setHovered(false);
      }
    };
    document.addEventListener('3d-tooltip', handleGlobalTooltip);
    return () => document.removeEventListener('3d-tooltip', handleGlobalTooltip);
  }, [getTooltipData]);

  // 회전 시작 시 즉시 호버 해제 및 커서 복원
  useEffect(() => {
    const handleOrbitStart = () => {
      clearTimeout(timeout.current);
      setHovered(false);
      document.body.style.cursor = 'auto';
      if (domElementRef.current) domElementRef.current.style.cursor = 'auto';
    };
    window.addEventListener('3d-orbit-start', handleOrbitStart);
    return () => {
      window.removeEventListener('3d-orbit-start', handleOrbitStart);
      document.body.style.cursor = 'auto';
      if (domElementRef.current) domElementRef.current.style.cursor = 'auto';
    };
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onOver = useCallback((e: any) => {
    if (isGlobalRotating || (e.buttons !== undefined && e.buttons > 0) || (e.nativeEvent && e.nativeEvent.buttons > 0)) {
      return;
    }
    e.stopPropagation();
    clearTimeout(timeout.current);
    setHovered(true);
    document.body.style.cursor = 'pointer';
    if (e.gl?.domElement) {
      domElementRef.current = e.gl.domElement;
      e.gl.domElement.style.cursor = 'pointer';
    }
    document.dispatchEvent(new CustomEvent('3d-tooltip', {
      detail: { ...getTooltipData(), x: e.clientX, y: e.clientY }
    }));
  }, [getTooltipData]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onOut = useCallback((e: any) => {
    e.stopPropagation();
    clearTimeout(timeout.current);
    setHovered(false);
    document.body.style.cursor = 'auto';
    if (domElementRef.current) domElementRef.current.style.cursor = 'auto';
    document.dispatchEvent(new CustomEvent('3d-tooltip', { detail: null }));
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onMove = useCallback((e: any) => {
    if (isGlobalRotating || (e.buttons !== undefined && e.buttons > 0) || (e.nativeEvent && e.nativeEvent.buttons > 0)) {
      if (hovered) {
        setHovered(false);
        document.body.style.cursor = 'auto';
        if (domElementRef.current) domElementRef.current.style.cursor = 'auto';
        document.dispatchEvent(new CustomEvent('3d-tooltip', { detail: null }));
      }
      return;
    }
    e.stopPropagation();
    clearTimeout(timeout.current);
    if (!hovered) {
      setHovered(true);
    }
    document.body.style.cursor = 'pointer';
    if (e.gl?.domElement) {
      domElementRef.current = e.gl.domElement;
      e.gl.domElement.style.cursor = 'pointer';
    }
    document.dispatchEvent(new CustomEvent('3d-tooltip', {
      detail: { ...getTooltipData(), x: e.clientX, y: e.clientY }
    }));
  }, [getTooltipData, hovered]);

  // 클릭 시 핀 고정 이벤트 발송 (회전 드래그 중이거나 5px 이상 드래그 시 무시)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onClick = useCallback((e: any) => {
    if (isGlobalRotating || (e.delta !== undefined && e.delta > 5)) {
      return;
    }
    e.stopPropagation();
    document.dispatchEvent(new CustomEvent('3d-tooltip-pin', {
      detail: { ...getTooltipData(), x: e.clientX, y: e.clientY }
    }));
  }, [getTooltipData]);

  const isBoxActive = hovered || isPinned;

  return { hovered: isBoxActive, isPinned, onOver, onOut, onMove, onClick } as const;
}





// ─── 칩 목록 자동 롤링 컴포넌트 (4개 단위 자동 순환) ───
interface ChipItem {
  id: number;
  temp: string;
  power: string;
  memory: string;
}

function RollingChipsGrid({ chips, isPinned = false }: { chips: ChipItem[]; isPinned?: boolean }) {
  const [page, setPage] = useState(0);
  const [fade, setFade] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const pageSize = 4; // 2x2 형태
  const totalPages = Math.ceil(chips.length / pageSize);

  useEffect(() => {
    if (totalPages <= 1 || isPaused) return;

    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setPage((prev) => (prev + 1) % totalPages);
        setFade(true);
      }, 180);
    }, 2800);

    return () => clearInterval(interval);
  }, [totalPages, isPaused]);

  const currentPage = totalPages > 0 ? page % totalPages : 0;
  const currentChips = chips.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const goToPage = (newPage: number) => {
    setIsPaused(true);
    setFade(false);
    setTimeout(() => {
      setPage((newPage + totalPages) % totalPages);
      setFade(true);
    }, 120);
  };

  return (
    <div
      className="equipment-detail-chips-wrapper"
      onMouseEnter={() => {
        if (!isPinned) setIsPaused(true);
      }}
      onMouseLeave={() => {
        if (!isPinned) setIsPaused(false);
      }}
    >
      {/* 4개 초과일 때 상단 롤링 인디케이터 헤더 */}
      {totalPages > 1 && (
        <div className="equipment-detail-chips-header">
          <span className="equipment-detail-chips-info">
            <span>칩 상세</span>
            <span className="equipment-detail-chips-badge">
              {currentPage * pageSize + 1}~{Math.min((currentPage + 1) * pageSize, chips.length)} / {chips.length}
            </span>
            {isPinned ? (
              <button
                type="button"
                onClick={() => setIsPaused(!isPaused)}
                className="equipment-detail-chips-pause-btn"
                style={{ color: isPaused ? '#38bdf8' : '#fbbf24' }}
              >
                {isPaused ? '▶ 재생' : '❚❚ 정지'}
              </button>
            ) : (
              isPaused && <span style={{ fontSize: 9, color: '#fbbf24', marginLeft: 2 }}>❚❚ 정지</span>
            )}
          </span>

          {/* 페이지 내비게이션 & 도트 인디케이터 */}
          <div className="equipment-detail-chips-nav">
            {isPinned && (
              <button
                type="button"
                onClick={() => goToPage(currentPage - 1)}
                className="equipment-detail-chips-nav-btn"
                title="이전 칩 목록"
              >
                ‹
              </button>
            )}

            <div className="equipment-detail-chips-dots">
              {Array.from({ length: totalPages }).map((_, idx) => (
                <div
                  key={idx}
                  onClick={isPinned ? () => goToPage(idx) : undefined}
                  className={`equipment-detail-chips-dot ${idx === currentPage ? 'active' : ''}`}
                  style={{ cursor: isPinned ? 'pointer' : 'default' }}
                  title={isPinned ? `페이지 ${idx + 1}` : undefined}
                />
              ))}
            </div>

            {isPinned && (
              <button
                type="button"
                onClick={() => goToPage(currentPage + 1)}
                className="equipment-detail-chips-nav-btn"
                title="다음 칩 목록"
              >
                ›
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2x2 칩 그리드 */}
      <div
        className="equipment-detail-chips-grid"
        style={{
          opacity: fade ? 1 : 0.2,
          transform: fade ? 'translateY(0)' : 'translateY(2px)',
        }}
      >
        {currentChips.map((chip) => (
          <div key={chip.id} className="equipment-detail-chip-box">
            <div className="equipment-detail-chip-title">Chip {chip.id}</div>
            <div className="equipment-detail-tooltip-row">
              <span className="equipment-detail-tooltip-label">온도</span>
              <span className="equipment-detail-tooltip-value">{chip.temp}</span>
            </div>
            <div className="equipment-detail-tooltip-row">
              <span className="equipment-detail-tooltip-label">전력</span>
              <span className="equipment-detail-tooltip-value">{chip.power}</span>
            </div>
            <div className="equipment-detail-tooltip-row">
              <span className="equipment-detail-tooltip-label">메모리</span>
              <span className="equipment-detail-tooltip-value">{chip.memory}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}



// ponytail: 2D 오버레이 툴팁으로 전환되어 bodyPortalRef 미사용

// ─── 회전하는 팬 블레이드 ───
function SpinningFan({ position, radius = 0.35, label = "Fan", rpm = 4200, isOk = true }: {
  position: [number, number, number]; radius?: number;
  label?: string; rpm?: number; isOk?: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const { hovered, onOver, onOut, onMove, onClick } = useTooltipHover(
    useCallback(() => ({
      title: label,
      rows: [{ label: '회전 속도', value: isOk ? `${rpm} RPM` : '0 RPM' }],
      status: { ok: isOk, text: isOk ? '정상 작동' : '이상 감지 (정지)' },
    }), [label, rpm, isOk])
  );

  // 멈춤 없는 무한 연속 등속도 회전
  const rotationSpeed = isOk ? 16.0 : 0;

  useFrame((_, delta) => {
    if (ref.current && isOk) {
      ref.current.rotation.z += delta * rotationSpeed;
    }
  });

  return (
    <group position={position}>
      {/* 팬 전체 영역을 한 덩어리로 인식시키는 통합 투명 히트박스 (회전 날개로 인한 호버 깜빡임 원천 방지) */}
      <mesh
        position={[0, 0.03, 0.015]}
        onPointerOver={onOver}
        onPointerOut={onOut}
        onPointerMove={onMove}
        onClick={onClick}
      >
        <boxGeometry args={[radius * 2.35, radius * 2.5, 0.22]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Fan housing */}
      <mesh>
        <boxGeometry args={[radius * 2.3, radius * 2.3, 0.15]} />
        <meshStandardMaterial color={hovered ? '#1a1a2e' : '#111111'} roughness={0.9} />
      </mesh>
      {/* Fan ring */}
      <mesh position={[0, 0, 0.08]}>
        <ringGeometry args={[radius * 0.85, radius, 32]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      {/* 고속 회전 시 생기는 은은한 반투명 모션 블러 잔상 링 (블레이드 뒤 z=0.082에 배치) */}
      {isOk && (
        <group position={[0, 0, 0.082]}>
          <mesh>
            <ringGeometry args={[radius * 0.34, radius * 0.95, 32]} />
            <meshStandardMaterial
              color="#64748b"
              transparent
              opacity={0.18}
              depthWrite={false}
              roughness={0.5}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh position={[0, 0, 0.001]}>
            <ringGeometry args={[radius * 0.58, radius * 0.93, 32]} />
            <meshStandardMaterial
              color="#94a3b8"
              transparent
              opacity={0.12}
              depthWrite={false}
              roughness={0.4}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      )}

      {/* Spinning 6-blade fan */}
      <group ref={ref} position={[0, 0, 0.09]}>
        {/* Central motor hub */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[radius * 0.32, radius * 0.34, 0.04, 24]} />
          <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Hub center metal badge */}
        <mesh position={[0, 0, 0.022]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[radius * 0.14, radius * 0.14, 0.005, 16]} />
          <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.2} />
        </mesh>

        {/* 6 aerodynamic fan blades (선명하고 매끄러운 6개 블레이드) */}
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const angle = (i * Math.PI * 2) / 6;
          return (
            <group key={i} rotation={[0, 0, angle]}>
              <mesh position={[radius * 0.62, 0, 0]} rotation={[0.35, 0, 0]}>
                <boxGeometry args={[radius * 0.58, 0.075, 0.012]} />
                <meshStandardMaterial
                  color="#64748b"
                  metalness={0.5}
                  roughness={0.3}
                  transparent={isOk}
                  opacity={isOk ? 0.85 : 1.0}
                  side={THREE.DoubleSide}
                />
              </mesh>
            </group>
          );
        })}
      </group>
      {/* Handle on top */}
      <mesh position={[0, radius + 0.08, 0.02]}>
        <boxGeometry args={[radius * 1.2, 0.06, 0.12]} />
        <meshStandardMaterial color="#e8e0c8" roughness={0.6} />
      </mesh>
      {/* Hover highlight bounding box (depthTest false로 앞쪽 부품에 가려져 잘리는 현상 방지) */}
      {hovered && (
        <mesh position={[0, 0.03, 0.02]} raycast={() => null} renderOrder={999}>
          <boxGeometry args={[radius * 2.34, radius * 2.48, 0.20]} />
          <meshBasicMaterial
            color="#38bdf8"
            wireframe
            transparent
            opacity={0.3}
            depthTest={false}
          />
        </mesh>
      )}
    </group>
  );
}

// ─── LED 인디케이터 ───
function LED({ position, color = "#10b981", size = 0.03 }: { position: [number, number, number]; color?: string; size?: number }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[size, 8, 8]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} />
    </mesh>
  );
}

// ─── NPU 데이터 (각 카드별) ───
const npuData = [
  {
    load: '0%',
    power: '343 W',
    pcie: '정상',
    ok: true,
    avgTemp: '32.6 °C',
    cardPower: '343 W',
    chips: [
      { id: 1, temp: '32 °C', power: '81 W', memory: '0.0 GB / 16 GB' },
      { id: 2, temp: '41 °C', power: '0 W', memory: '2.1 GB / 16 GB' },
      { id: 3, temp: '29 °C', power: '43 W', memory: '14.7 GB / 16 GB' },
      { id: 4, temp: '35 °C', power: '45 W', memory: '14.7 GB / 16 GB' },
      { id: 5, temp: '36 °C', power: '43 W', memory: '14.7 GB / 16 GB' },
      { id: 6, temp: '35 °C', power: '43 W', memory: '9.4 GB / 16 GB' },
      { id: 7, temp: '33 °C', power: '44 W', memory: '12.0 GB / 16 GB' },
      { id: 8, temp: '34 °C', power: '44 W', memory: '11.8 GB / 16 GB' },
    ]
  },
  {
    load: '52%',
    power: '210 W',
    pcie: '정상',
    ok: true,
    avgTemp: '48.0 °C',
    cardPower: '210 W',
    chips: [
      { id: 1, temp: '47 °C', power: '48 W', memory: '14.2 GB / 16 GB' },
      { id: 2, temp: '49 °C', power: '52 W', memory: '14.5 GB / 16 GB' },
      { id: 3, temp: '48 °C', power: '49 W', memory: '14.0 GB / 16 GB' },
      { id: 4, temp: '48 °C', power: '51 W', memory: '14.1 GB / 16 GB' },
    ]
  },
  {
    load: '98%',
    power: '320 W',
    pcie: '정상',
    ok: false, // 발열 경고
    avgTemp: '84.5 °C',
    cardPower: '320 W',
    chips: [
      { id: 1, temp: '83 °C', power: '78 W', memory: '15.9 GB / 16 GB' },
      { id: 2, temp: '86 °C', power: '82 W', memory: '15.8 GB / 16 GB' },
      { id: 3, temp: '84 °C', power: '77 W', memory: '15.9 GB / 16 GB' },
      { id: 4, temp: '85 °C', power: '79 W', memory: '15.7 GB / 16 GB' },
    ]
  },
  {
    load: '41%',
    power: '170 W',
    pcie: '정상',
    ok: true,
    avgTemp: '40.2 °C',
    cardPower: '170 W',
    chips: [
      { id: 1, temp: '39 °C', power: '38 W', memory: '10.5 GB / 16 GB' },
      { id: 2, temp: '41 °C', power: '42 W', memory: '10.8 GB / 16 GB' },
      { id: 3, temp: '40 °C', power: '39 W', memory: '10.6 GB / 16 GB' },
      { id: 4, temp: '41 °C', power: '41 W', memory: '10.5 GB / 16 GB' },
    ]
  },
  {
    load: '47%',
    power: '190 W',
    pcie: '정상',
    ok: true,
    avgTemp: '43.8 °C',
    cardPower: '190 W',
    chips: [
      { id: 1, temp: '42 °C', power: '44 W', memory: '13.1 GB / 16 GB' },
      { id: 2, temp: '45 °C', power: '48 W', memory: '13.4 GB / 16 GB' },
      { id: 3, temp: '44 °C', power: '45 W', memory: '13.2 GB / 16 GB' },
      { id: 4, temp: '44 °C', power: '45 W', memory: '13.0 GB / 16 GB' },
    ]
  },
  {
    load: '0%',
    power: '0 W',
    pcie: '연결 끊김',
    ok: false, // 장애
    avgTemp: 'N/A',
    cardPower: '0 W',
    chips: [
      { id: 1, temp: 'N/A', power: '0 W', memory: '0 GB / 16 GB' },
      { id: 2, temp: 'N/A', power: '0 W', memory: '0 GB / 16 GB' },
      { id: 3, temp: 'N/A', power: '0 W', memory: '0 GB / 16 GB' },
      { id: 4, temp: 'N/A', power: '0 W', memory: '0 GB / 16 GB' },
    ]
  },
  {
    load: '43%',
    power: '175 W',
    pcie: '정상',
    ok: true,
    avgTemp: '41.5 °C',
    cardPower: '175 W',
    chips: [
      { id: 1, temp: '40 °C', power: '40 W', memory: '11.2 GB / 16 GB' },
      { id: 2, temp: '42 °C', power: '43 W', memory: '11.5 GB / 16 GB' },
      { id: 3, temp: '41 °C', power: '41 W', memory: '11.3 GB / 16 GB' },
      { id: 4, temp: '43 °C', power: '41 W', memory: '11.0 GB / 16 GB' },
    ]
  },
  {
    load: '44%',
    power: '180 W',
    pcie: '정상',
    ok: true,
    avgTemp: '42.0 °C',
    cardPower: '180 W',
    chips: [
      { id: 1, temp: '41 °C', power: '41 W', memory: '12.0 GB / 16 GB' },
      { id: 2, temp: '43 °C', power: '44 W', memory: '12.2 GB / 16 GB' },
      { id: 3, temp: '42 °C', power: '42 W', memory: '12.1 GB / 16 GB' },
      { id: 4, temp: '42 °C', power: '41 W', memory: '11.9 GB / 16 GB' },
    ]
  }
];

// ponytail: 24개 RAM 모듈 사용량 모의 데이터 정의 (총 384GB, 각 16GB)
const ramData = Array.from({ length: 24 }).map((_, i) => {
  const total = 16;
  let used = 0;

  if (i % 8 === 0) used = 2.4;
  else if (i % 5 === 0) used = 14.8;
  else if (i % 3 === 0) used = 11.2;
  else used = parseFloat((5.5 + (i % 4) * 2.3).toFixed(1));

  return {
    id: i + 1,
    used,
    total,
  };
});

const totalRam = 24 * 16;
const usedRam = parseFloat(ramData.reduce((acc, curr) => acc + curr.used, 0).toFixed(1));
const freeRam = parseFloat((totalRam - usedRam).toFixed(1));

// ─── NPU 카드 (Rebellions) ───
function NPUCard({ position, index }: { position: [number, number, number]; index: number }) {
  const data = npuData[index] || npuData[0];
  const { hovered, onOver, onOut, onMove, onClick } = useTooltipHover(
    useCallback(() => ({
      title: `NPU ${index + 1} (Rebellions)`,
      rows: [
        { label: '연산 부하', value: data.load },
        { label: '평균 온도', value: data.avgTemp },
        { label: '카드 전력', value: data.cardPower },
        { label: 'PCIe 상태', value: data.pcie, color: data.pcie === '정상' ? '#10b981' : '#ef4444', isValueColored: true }
      ],
      chipsGrid: data.chips,
      status: { ok: data.ok, text: data.ok ? '정상' : (data.pcie === '연결 끊김' ? '장애' : '발열 경고') },
    }), [index, data])
  );

  return (
    <group position={position}>
      {/* NPU 전체 영역을 한 덩어리로 감싸는 통합 투명 히트박스 (마우스 아웃 누락 방지) */}
      <mesh
        onPointerOver={onOver}
        onPointerOut={onOut}
        onPointerMove={onMove}
        onClick={onClick}
      >
        <boxGeometry args={[0.4, 0.67, 1.62]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* NPU body */}
      <mesh>
        <boxGeometry args={[0.38, 0.65, 1.6]} />
        <meshStandardMaterial
          color={hovered ? "#2a3a4e" : "#1a2332"}
          metalness={0.7}
          roughness={0.4}
        />
      </mesh>

      {/* Top label */}
      <group position={[0, 0.326, 0]} rotation={[-Math.PI / 2, 0, -Math.PI / 2]}>
        <Text fontSize={0.1} color="#c8d6e5" anchorX="center" anchorY="middle" letterSpacing={0.05}>
          rebellions_
        </Text>
      </group>

      {/* Heatsink fins on top */}
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={i} position={[-0.14 + i * 0.04, 0.33, 0]}>
          <boxGeometry args={[0.015, 0.02, 1.4]} />
          <meshStandardMaterial color="#2d3748" metalness={0.6} roughness={0.5} />
        </mesh>
      ))}

      {/* Power connector at front */}
      <mesh position={[0, -0.1, 0.81]}>
        <boxGeometry args={[0.25, 0.15, 0.04]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>

      {/* Status LED */}
      <LED
        position={[0.12, 0.2, 0.81]}
        color={data.ok ? "#10b981" : "#ef4444"}
        size={0.02}
      />

      {/* Blue accent strip */}
      <mesh position={[0, -0.32, 0]}>
        <boxGeometry args={[0.38, 0.01, 1.6]} />
        <meshStandardMaterial color="#1e40af" emissive="#1e40af" emissiveIntensity={0.3} />
      </mesh>

      {/* Hover highlight */}
      {hovered && (
        <mesh raycast={() => null} renderOrder={999}>
          <boxGeometry args={[0.4, 0.67, 1.62]} />
          <meshBasicMaterial
            color="#38bdf8"
            wireframe
            transparent
            opacity={0.3}
            depthTest={false}
          />
        </mesh>
      )}
    </group>
  );
}

// ─── CPU 히트싱크 ───
function CPUHeatsink({ position, label, temp, isWarning = false, clock = '2.4 GHz', cores = '32 Core' }: {
  position: [number, number, number]; label: string; temp: string; isWarning?: boolean;
  clock?: string; cores?: string;
}) {
  const isOk = !isWarning;
  const { hovered, onOver, onOut, onMove, onClick } = useTooltipHover(
    useCallback(() => ({
      title: label,
      rows: [
        { label: '클럭 속도', value: clock },
        { label: '코어', value: cores },
        { label: '온도', value: `${temp}°C`, color: isOk ? '#10b981' : '#ef4444', isValueColored: true }
      ],
      status: { ok: isOk, text: isOk ? '정상' : '발열 경고' },
    }), [label, clock, cores, temp, isOk])
  );

  return (
    <group position={position}>
      {/* CPU 전체를 한 덩어리로 인식시키는 통합 투명 히트박스 (핀/파이프 사이 호버 깜빡임 방지) */}
      <mesh
        position={[0, 0.06, 0]}
        onPointerOver={onOver}
        onPointerOut={onOut}
        onPointerMove={onMove}
        onClick={onClick}
      >
        <boxGeometry args={[0.74, 0.58, 0.74]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* CPU socket base */}
      <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[0.7, 0.04, 0.7]} />
        <meshStandardMaterial color="#1e293b" metalness={0.6} />
      </mesh>

      {/* Heatsink fins */}
      {Array.from({ length: 14 }).map((_, i) => (
        <mesh key={i} position={[-0.3 + i * 0.046, 0.15, 0]}>
          <boxGeometry args={[0.018, 0.25, 0.6]} />
          <meshStandardMaterial color="#c0c8d0" metalness={0.9} roughness={0.2} />
        </mesh>
      ))}

      {/* Copper heatpipes */}
      {[-0.12, 0, 0.12].map((x) => (
        <mesh key={x} position={[x, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.6]} />
          <meshStandardMaterial color="#b45309" metalness={0.85} roughness={0.15} />
        </mesh>
      ))}

      {/* Top plate */}
      <mesh position={[0, 0.28, 0]}>
        <boxGeometry args={[0.65, 0.03, 0.65]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.15} />
      </mesh>

      {/* Hover highlight bounding box */}
      {hovered && (
        <mesh position={[0, 0.06, 0]} raycast={() => null} renderOrder={999}>
          <boxGeometry args={[0.74, 0.58, 0.74]} />
          <meshBasicMaterial
            color="#38bdf8"
            wireframe
            transparent
            opacity={0.3}
            depthTest={false}
          />
        </mesh>
      )}
    </group>
  );
}

// ─── 시스템 메모리 (24개 RAM 모듈 그룹) ───
function SystemMemory() {
  const { hovered, onOver, onOut, onMove, onClick } = useTooltipHover(
    useCallback(() => ({
      title: '시스템 메모리 (RAM)',
      rows: [
        { label: '사용 중인 메모리', value: `${usedRam} GB` },
        { label: '남은 메모리 / 총 메모리', value: `${freeRam} GB / ${totalRam} GB` },
      ],
      ramGrid: ramData,
      status: { ok: true, text: '정상 작동 중 (ECC 활성화)' }
    }), [])
  );

  // 24개 RAM 모듈을 마더보드 가로폭 전체(X = -1.45 ~ 1.45)에 걸쳐 일정한 간격으로 빈 공간 없이 쫙 펼쳐 배치
  const startX = -1.45;
  const endX = 1.45;
  const totalSlots = 24;
  const dx = (endX - startX) / (totalSlots - 1);
  const zPos = 0.1;

  return (
    <group>
      {/* 24개 RAM 모듈 전체를 한 덩어리로 인식시키는 통합 투명 히트박스 (카드 사이 간격 호버 깜빡임 방지) */}
      <mesh
        position={[0, 0.12, zPos]}
        onPointerOver={onOver}
        onPointerOut={onOut}
        onPointerMove={onMove}
        onClick={onClick}
      >
        <boxGeometry args={[3.04, 0.28, 0.75]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {Array.from({ length: totalSlots }).map((_, i) => {
        const xPos = startX + i * dx;
        const ramModule = ramData[i];
        const isHighUsage = (ramModule.used / ramModule.total) > 0.85;

        return (
          <group key={i} position={[xPos, 0.12, zPos]}>
            {/* RAM PCB (Vertical-aligned, Z-long) */}
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.02, 0.22, 0.65]} />
              <meshStandardMaterial
                color={hovered ? "#2563eb" : "#1e40af"}
                roughness={0.7}
                metalness={0.2}
              />
            </mesh>
            {/* Gold fingers contact strip */}
            <mesh position={[0, -0.115, 0]}>
              <boxGeometry args={[0.022, 0.01, 0.61]} />
              <meshStandardMaterial color="#d97706" metalness={0.9} roughness={0.1} />
            </mesh>
            {/* Memory Chips (Z-long layout) */}
            {[-0.22, -0.07, 0.07, 0.22].map((zChip, cIdx) => (
              <group key={cIdx}>
                <mesh position={[0.012, 0.02, zChip]}>
                  <boxGeometry args={[0.005, 0.08, 0.08]} />
                  <meshStandardMaterial color="#111827" roughness={0.9} />
                </mesh>
                <mesh position={[-0.012, 0.02, zChip]}>
                  <boxGeometry args={[0.005, 0.08, 0.08]} />
                  <meshStandardMaterial color="#111827" roughness={0.9} />
                </mesh>
              </group>
            ))}
            {/* Small LED on top of RAM */}
            <mesh position={[0.012, 0.115, 0.28]}>
              <sphereGeometry args={[0.008, 8, 8]} />
              <meshStandardMaterial
                color={isHighUsage ? "#ef4444" : "#10b981"}
                emissive={isHighUsage ? "#ef4444" : "#10b981"}
                emissiveIntensity={1.5}
              />
            </mesh>

            {/* DIMM Slot socket base */}
            <mesh position={[0, -0.13, 0]}>
              <boxGeometry args={[0.035, 0.02, 0.69]} />
              <meshStandardMaterial color="#1e293b" />
            </mesh>
            {/* White ejector latch (front and back) */}
            <mesh position={[0, -0.08, -0.33]}>
              <boxGeometry args={[0.03, 0.08, 0.02]} />
              <meshStandardMaterial color="#cbd5e1" />
            </mesh>
            <mesh position={[0, -0.08, 0.33]}>
              <boxGeometry args={[0.03, 0.08, 0.02]} />
              <meshStandardMaterial color="#cbd5e1" />
            </mesh>
          </group>
        );
      })}

      {/* Hover highlight bounding box (Single large box covering all 24 slots) */}
      {hovered && (
        <mesh position={[0, 0.12, zPos]} raycast={() => null} renderOrder={999}>
          <boxGeometry args={[3.04, 0.28, 0.75]} />
          <meshBasicMaterial
            color="#38bdf8"
            wireframe
            transparent
            opacity={0.3}
            depthTest={false}
          />
        </mesh>
      )}
    </group>
  );
}

// ─── 전면 드라이브 베이 ───
function DriveBays({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Bay housing */}
      <mesh>
        <boxGeometry args={[3.5, 0.35, 0.08]} />
        <meshStandardMaterial color="#0f172a" roughness={0.8} />
      </mesh>
      {/* Individual drive trays */}
      {Array.from({ length: 12 }).map((_, i) => (
        <group key={i} position={[-1.6 + i * 0.29, 0, 0.04]}>
          <mesh>
            <boxGeometry args={[0.25, 0.28, 0.04]} />
            <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.5} />
          </mesh>
          {/* Orange latch */}
          <mesh position={[0, -0.1, 0.02]}>
            <boxGeometry args={[0.17, 0.04, 0.02]} />
            <meshStandardMaterial color="#f97316" />
          </mesh>
          {/* LED */}
          <LED position={[-0.08, 0.1, 0.03]} color={i % 4 === 0 ? "#10b981" : "#3b82f6"} size={0.015} />
        </group>
      ))}
    </group>
  );
}

// ─── 전원 케이블 번들 ───
function PowerCables({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {[-1.4, -1.0, -0.6, -0.2, 0.4, 0.8, 1.2, 1.6].map((x, i) => (
        <group key={i} position={[x, 0, 0]}>
          <mesh rotation={[Math.PI / 2.8, 0, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.5]} />
            <meshStandardMaterial color="#facc15" />
          </mesh>
          <mesh rotation={[Math.PI / 2.8, 0, 0]} position={[0.03, 0, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.5]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── PSU (전원 공급 장치) ───
function PSU({
  position,
  label,
  isError = false,
  power = 650,
  currentOutput = 420,
}: {
  position: [number, number, number];
  label: string;
  isError?: boolean;
  power?: number;
  currentOutput?: number;
}) {
  const { hovered, onOver, onOut, onMove, onClick } = useTooltipHover(
    useCallback(() => ({
      title: label,
      rows: [
        { label: '정격 용량', value: `${power} W (80 PLUS Platinum)` },
        { label: '입력 전압', value: isError ? '0 V AC (차단됨)' : '220 V AC (60 Hz)', color: isError ? '#ef4444' : undefined, isValueColored: isError },
        { label: '현재 출력', value: isError ? '0 W' : `${currentOutput} W` },
        { label: '전력 효율', value: isError ? '0.0 %' : '94.2 %' },
        { label: '내부 온도', value: isError ? '58.4 °C (비정상)' : '36.5 °C', color: isError ? '#ef4444' : undefined, isValueColored: isError },
      ],
      status: {
        ok: !isError,
        text: isError ? '전원 장애 (이중화 Failover 작동 중)' : '정상 작동 (Redundant Standby)',
      },
    }), [label, isError, power, currentOutput])
  );

  return (
    <group position={position}>
      {/* PSU 통합 투명 히트박스 (클릭 및 호버 영역) */}
      <mesh
        onPointerOver={onOver}
        onPointerOut={onOut}
        onPointerMove={onMove}
        onClick={onClick}
      >
        <boxGeometry args={[0.68, 0.68, 0.12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <mesh>
        <boxGeometry args={[0.65, 0.65, 0.06]} />
        <meshStandardMaterial color={hovered ? "#e2e8f0" : "#cbd5e1"} metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Fan hole */}
      <mesh position={[-0.1, 0, -0.03]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.02, 16]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      {/* Power plug */}
      <mesh position={[0.2, 0, -0.03]}>
        <boxGeometry args={[0.13, 0.18, 0.04]} />
        <meshStandardMaterial color="#000000" />
      </mesh>
      {/* Status LED */}
      <LED position={[0.2, -0.2, -0.04]} color={isError ? "#ef4444" : "#10b981"} size={0.025} />

      {/* 호버/선택 와이어프레임 박스 하이라이트 */}
      {hovered && (
        <mesh raycast={() => null} renderOrder={999}>
          <boxGeometry args={[0.67, 0.67, 0.1]} />
          <meshBasicMaterial
            color="#38bdf8"
            wireframe
            transparent
            opacity={0.3}
            depthTest={false}
          />
        </mesh>
      )}
    </group>
  );
}

// ─── 메인 서버 상세 뷰 (AS-4125GS-TNRT2) ───
function ServerDetailScene({ isExploded = false }: { isExploded?: boolean }) {
  const frontFansRef = useRef<THREE.Group>(null);
  const backFansRef = useRef<THREE.Group>(null);
  const cpu1Ref = useRef<THREE.Group>(null);
  const cpu2Ref = useRef<THREE.Group>(null);
  const ramGroupRef = useRef<THREE.Group>(null);
  const npuGroupRef = useRef<THREE.Group>(null);
  const npuRefs = useRef<(THREE.Group | null)[]>([]);
  const psu1Ref = useRef<THREE.Group>(null);
  const psu2Ref = useRef<THREE.Group>(null);
  const topCoverRef = useRef<THREE.Group>(null);
  const explodeProgressRef = useRef(0);

  // 분해도 뷰 부드러운 애니메이션 전환 (0.0 -> 1.0)
  useFrame((state, delta) => {
    const target = isExploded ? 1 : 0;
    explodeProgressRef.current = THREE.MathUtils.damp(
      explodeProgressRef.current,
      target,
      5.5,
      delta
    );
    const p = explodeProgressRef.current;

    // 분해도 뷰 활성화 시 카메라 25% 축소 (zoom: 1.0 -> 0.75)
    if (state.camera instanceof THREE.PerspectiveCamera) {
      const targetZoom = 1.0 - p * 0.25;
      if (Math.abs(state.camera.zoom - targetZoom) > 0.0005) {
        state.camera.zoom = targetZoom;
        state.camera.updateProjectionMatrix();
      }
    }

    // Fans (제자리에서 위로만 수직 상승: 후면줄 y=0.65, 전면줄 y=0.35)
    if (backFansRef.current) {
      backFansRef.current.position.y = p * 0.65;
      backFansRef.current.position.z = -0.4;
    }
    if (frontFansRef.current) {
      frontFansRef.current.position.y = p * 0.35;
      frontFansRef.current.position.z = 0.4;
    }

    // CPU 1 & 2 (상승 분리)
    if (cpu1Ref.current) {
      cpu1Ref.current.position.y = 0.35 + p * 1.25;
    }
    if (cpu2Ref.current) {
      cpu2Ref.current.position.y = 0.35 + p * 1.25;
    }

    // RAM Group (메모리 뱅크: 위로 상승 분리)
    if (ramGroupRef.current) {
      ramGroupRef.current.position.y = p * 0.75;
    }

    // NPU Group 전체 z축 살짝 후방 분리
    if (npuGroupRef.current) {
      npuGroupRef.current.position.z = -1.6 - p * 0.25;
    }

    // NPU 카드들 (1부터 8까지 서서히 조금씩 더 올라가게 계단식 분해)
    for (let i = 0; i < 8; i++) {
      const cardRef = npuRefs.current[i];
      if (cardRef) {
        cardRef.position.y = (0.60 + i * 0.14) * p;
      }
    }

    // PSU 1 & 2 (후면 밖으로 슬라이드 아웃 + 살짝 상승)
    if (psu1Ref.current) {
      psu1Ref.current.position.z = -0.05 - p * 1.0;
      psu1Ref.current.position.y = p * 0.25;
    }
    if (psu2Ref.current) {
      psu2Ref.current.position.z = -0.05 - p * 1.0;
      psu2Ref.current.position.y = p * 0.25;
    }

    // Top Cover (상단 커버: 위로 높이 분리하여 시야 확보)
    if (topCoverRef.current) {
      topCoverRef.current.position.y = p * 1.8;
    }
  });

  return (
    <group position={[0, -0.5, 0]}>
      {/* ═══ 케이스 본체 ═══ */}
      {/* Bottom plate */}
      <mesh
        position={[0, 0, 0]}
        onPointerOver={() => {
          document.dispatchEvent(new CustomEvent('3d-tooltip', { detail: null }));
        }}
      >
        <boxGeometry args={[3.8, 0.08, 5.6]} />
        <meshStandardMaterial color="#52606d" metalness={0.85} roughness={0.35} />
      </mesh>

      {/* Side walls */}
      <mesh position={[-1.85, 0.4, 0]}>
        <boxGeometry args={[0.08, 0.75, 5.6]} />
        <meshStandardMaterial color="#52606d" metalness={0.85} roughness={0.35} />
      </mesh>
      <mesh position={[1.85, 0.4, 0]}>
        <boxGeometry args={[0.08, 0.75, 5.6]} />
        <meshStandardMaterial color="#52606d" metalness={0.85} roughness={0.35} />
      </mesh>

      {/* Rear wall (partial - top half visible) */}
      <mesh position={[0, 0.55, -2.77]}>
        <boxGeometry args={[3.8, 0.45, 0.06]} />
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.4} />
      </mesh>

      {/* Top cover - transparent/open (shows internal) */}
      <group ref={topCoverRef}>
        <mesh position={[0, 0.8, -0.3]} renderOrder={999}>
          <boxGeometry args={[3.76, 0.03, 4.4]} />
          <meshStandardMaterial
            color="#64748b"
            metalness={0.9}
            roughness={0.2}
            transparent
            opacity={0.15}
            depthWrite={false}
          />
        </mesh>

        {/* Top cover frame rails */}
        <mesh position={[-1.82, 0.8, -0.3]}>
          <boxGeometry args={[0.04, 0.04, 4.4]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[1.82, 0.8, -0.3]}>
          <boxGeometry args={[0.04, 0.04, 4.4]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* ═══ 전면 패널 ═══ */}
      <group position={[0, 0.4, 2.77]}>
        {/* Main bezel */}
        <mesh>
          <boxGeometry args={[3.8, 0.75, 0.08]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.4} />
        </mesh>

        {/* Handles */}
        <mesh position={[-1.82, 0, 0.08]}>
          <boxGeometry args={[0.07, 0.55, 0.12]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
        </mesh>
        <mesh position={[1.82, 0, 0.08]}>
          <boxGeometry args={[0.07, 0.55, 0.12]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
        </mesh>

        {/* Upper mesh vent area */}
        <mesh position={[0, 0.18, 0.05]}>
          <boxGeometry args={[3.4, 0.3, 0.02]} />
          <meshStandardMaterial color="#0f172a" roughness={0.9} />
        </mesh>
        {/* Vent holes */}
        <group position={[0, 0.18, 0.06]}>
          {Array.from({ length: 28 }).map((_, x) =>
            Array.from({ length: 3 }).map((_, y) => (
              <mesh key={`${x}-${y}`} position={[-1.5 + x * 0.11, -0.08 + y * 0.08, 0]}>
                <circleGeometry args={[0.022, 6]} />
                <meshBasicMaterial color="#334155" />
              </mesh>
            ))
          )}
        </group>

        {/* Drive bays (lower half) */}
        <DriveBays position={[0, -0.18, 0.05]} />

        {/* Front panel LEDs */}
        <LED position={[-1.6, 0.3, 0.06]} color="#10b981" />
        <LED position={[-1.52, 0.3, 0.06]} color="#3b82f6" />
      </group>

      {/* ═══ 마더보드 ═══ */}
      <mesh
        position={[0, 0.06, -0.5]}
        onPointerOver={() => {
          document.dispatchEvent(new CustomEvent('3d-tooltip', { detail: null }));
        }}
      >
        <boxGeometry args={[3.7, 0.04, 4]} />
        <meshStandardMaterial color="#064e3b" roughness={0.7} metalness={0.3} />
      </mesh>
      {/* PCB traces (subtle) */}
      {Array.from({ length: 20 }).map((_, i) => (
        <mesh key={`trace-${i}`} position={[-1.5 + i * 0.16, 0.085, -0.5]}>
          <boxGeometry args={[0.005, 0.001, 3.8]} />
          <meshStandardMaterial color="#0d9488" emissive="#0d9488" emissiveIntensity={0.2} />
        </mesh>
      ))}

      {/* ═══ 전면 팬 어레이 (8개: 4+4) ═══ */}
      <group position={[0, 0.4, 1.6]}>
        {/* Front row (전면줄: 아래로 살짝 내려서 배치) */}
        <group ref={frontFansRef} position={[0, 0, 0.4]}>
          {[-1.3, -0.43, 0.43, 1.3].map((x, i) => {
            const isOk = i !== 2;
            const fanRpm = isOk ? (4200 + i * 150) : 0;
            return (
              <SpinningFan key={`ff-${i}`} position={[x, 0, 0]} radius={0.33}
                label={`전면 Fan ${i + 1}`} rpm={fanRpm}
                isOk={isOk}
              />
            );
          })}
        </group>
        {/* Back row (후면줄: 위로 상승) */}
        <group ref={backFansRef} position={[0, 0, -0.4]}>
          {[-1.3, -0.43, 0.43, 1.3].map((x, i) => {
            const fanRpm = 4100 + i * 120;
            return (
              <SpinningFan key={`fb-${i}`} position={[x, 0, 0]} radius={0.33}
                label={`후면 Fan ${i + 1}`} rpm={fanRpm}
              />
            );
          })}
        </group>
      </group>

      {/* ═══ CPU 히트싱크 ═══ */}
      <group ref={cpu1Ref} position={[-0.5, 0.35, 0.1]}>
        <CPUHeatsink position={[0, 0, 0]} label="CPU 1 (Intel Xeon)" temp="45" clock="2.4 GHz" cores="32 Core" />
      </group>
      <group ref={cpu2Ref} position={[0.5, 0.35, 0.1]}>
        <CPUHeatsink position={[0, 0, 0]} label="CPU 2 (Intel Xeon)" temp="82" isWarning clock="3.2 GHz (Boost)" cores="32 Core" />
      </group>

      {/* ═══ 메모리 뱅크 ═══ */}
      <group ref={ramGroupRef}>
        <SystemMemory />
      </group>

      {/* ═══ NPU 카드 어레이 (8개: 1부터 8까지 서서히 계단식 상승) ═══ */}
      <group ref={npuGroupRef} position={[0, 0.45, -1.6]}>
        {/* Left bank (NPU 1 ~ 4) */}
        {[-1.45, -1.02, -0.59, -0.16].map((x, i) => (
          <group key={`npu-l-${i}`} ref={(el) => { npuRefs.current[i] = el; }} position={[x, 0, 0]}>
            <NPUCard position={[0, 0, 0]} index={i} />
          </group>
        ))}

        {/* Center vertical PCBs (expansion cards) */}
        {[0.08, 0.16].map((x, i) => (
          <mesh key={`exp-${i}`} position={[x, -0.05, -0.1]}>
            <boxGeometry args={[0.03, 0.55, 1.3]} />
            <meshStandardMaterial color="#064e3b" />
          </mesh>
        ))}

        {/* Right bank (NPU 5 ~ 8) */}
        {[0.4, 0.83, 1.26, 1.69].map((x, i) => {
          const idx = i + 4;
          return (
            <group key={`npu-r-${i}`} ref={(el) => { npuRefs.current[idx] = el; }} position={[x, 0, 0]}>
              <NPUCard position={[0, 0, 0]} index={idx} />
            </group>
          );
        })}
      </group>

      {/* ═══ 전원 케이블 ═══ */}
      <PowerCables position={[0, 0.3, -0.4]} />

      {/* ═══ 후면 패널 ═══ */}
      <group position={[0, 0.4, -2.77]}>
        {/* PCIe slot covers */}
        <group position={[-0.6, 0, -0.05]}>
          {Array.from({ length: 8 }).map((_, i) => (
            <group key={i} position={[-0.85 + i * 0.24, 0, 0]}>
              <mesh>
                <boxGeometry args={[0.18, 0.65, 0.04]} />
                <meshStandardMaterial color="#334155" metalness={0.6} />
              </mesh>
              <mesh position={[0, 0, -0.02]}>
                <boxGeometry args={[0.08, 0.45, 0.02]} />
                <meshStandardMaterial color="#0f172a" />
              </mesh>
            </group>
          ))}
        </group>

        {/* I/O ports */}
        <group position={[0.5, -0.15, -0.05]}>
          {/* USB */}
          <mesh position={[-0.15, 0, 0]}>
            <boxGeometry args={[0.12, 0.16, 0.04]} />
            <meshStandardMaterial color="#000000" />
          </mesh>
          <mesh position={[-0.15, 0, -0.02]}>
            <boxGeometry args={[0.08, 0.03, 0.02]} />
            <meshBasicMaterial color="#3b82f6" />
          </mesh>
          {/* Ethernet */}
          <mesh position={[0.08, 0, 0]}>
            <boxGeometry args={[0.16, 0.16, 0.04]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.8} />
          </mesh>
          {/* VGA */}
          <mesh position={[0.3, 0, 0]}>
            <boxGeometry args={[0.2, 0.12, 0.04]} />
            <meshStandardMaterial color="#3b82f6" />
          </mesh>
        </group>

        {/* PSUs (이중화 전원공급장치) */}
        <group ref={psu1Ref} position={[1.1, 0, -0.05]}>
          <PSU position={[0, 0, 0]} label="PSU 1 (전원공급장치)" power={650} currentOutput={420} />
        </group>
        <group ref={psu2Ref} position={[1.6, 0, -0.05]}>
          <PSU position={[0, 0, 0]} label="PSU 2 (전원공급장치)" isError power={650} currentOutput={0} />
        </group>
      </group>
    </group>
  );
}

// ─── 모달용 3D 장비 뷰 (export) ───
export function EquipmentDetail3D({ className }: { className?: string }) {
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const bgGradient = isDarkMode
    ? "radial-gradient(circle at 50% 50%, #1e3a8a 0%, #0a1324 60%, #050b14 100%)"
    : "radial-gradient(circle at 50% 50%, #e0e7ff 0%, #cbd5e1 60%, #94a3b8 100%)";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pinnedTooltip, setPinnedTooltip] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [hoverTooltip, setHoverTooltip] = useState<any>(null);
  const [isExploded, setIsExploded] = useState(false);
  const [isRefreshSpinning, setIsRefreshSpinning] = useState(false);
  const isResettingCameraRef = useRef(false);
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  const activeTooltip = pinnedTooltip || hoverTooltip;
  const isPinned = !!pinnedTooltip;

  // 회전 상태 이벤트 리스너 등록
  useEffect(() => {
    const handleOrbitStart = () => {
      setHoverTooltip(null);
    };
    window.addEventListener('3d-orbit-start', handleOrbitStart);
    return () => {
      window.removeEventListener('3d-orbit-start', handleOrbitStart);
    };
  }, []);

  // 윈도우 전역 pointerup 이벤트로 마우스 릴리즈 감지
  useEffect(() => {
    const handleWindowPointerUp = () => {
      pointerDownPos.current = null;
      setGlobalRotating(false);
    };
    window.addEventListener('pointerup', handleWindowPointerUp);
    return () => window.removeEventListener('pointerup', handleWindowPointerUp);
  }, []);

  // 카메라 위치 및 타겟 중심점 콘솔 표출 (쓰로틀링 적용)
  const lastLogTime = useRef(0);
  const logCameraTransform = useCallback((force = false) => {
    if (!controlsRef.current) return;
    const now = Date.now();
    if (!force && now - lastLogTime.current < 400) return;
    lastLogTime.current = now;

    const ctrl = controlsRef.current;
    const cam = ctrl.object;
    if (!cam) return;
    const pos = [
      Number(cam.position.x.toFixed(2)),
      Number(cam.position.y.toFixed(2)),
      Number(cam.position.z.toFixed(2)),
    ];
    const tgt = [
      Number(ctrl.target.x.toFixed(2)),
      Number(ctrl.target.y.toFixed(2)),
      Number(ctrl.target.z.toFixed(2)),
    ];
    const zoomRatio = cam.zoom !== undefined ? Number(cam.zoom.toFixed(2)) : 1;
    const zoomText = zoomRatio !== 1 ? `, 줌(Zoom): ${(zoomRatio * 100).toFixed(0)}%` : '';
    console.log(
      `📷 [3D 내부 카메라] 위치(Position): [${pos.join(', ')}], 타겟(Target): [${tgt.join(', ')}]${zoomText}`,
      { position: pos, target: tgt, zoom: zoomRatio }
    );
  }, []);

  useEffect(() => {
    // 최초 렌더링 후 초기 카메라 위치/타겟 표출
    const timer = setTimeout(() => {
      logCameraTransform(true);
    }, 400);
    return () => clearTimeout(timer);
  }, [logCameraTransform]);

  // ESC 키 누르면 핀 고정 해제
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinnedTooltip(null);
        document.dispatchEvent(new CustomEvent('3d-tooltip-pin', { detail: null }));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleTooltip = (e: Event) => {
      if (isGlobalRotating) {
        setHoverTooltip(null);
        return;
      }
      const detail = (e as CustomEvent).detail;
      setHoverTooltip(detail || null);
    };

    const handleTooltipPin = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setPinnedTooltip((prev: Record<string, unknown> | null) => {
        // 동일 부품 다시 클릭 시 핀 해제 (토글)
        if (!detail || (prev && prev.title === detail.title)) {
          return null;
        }
        return detail;
      });
    };

    document.addEventListener('3d-tooltip', handleTooltip);
    document.addEventListener('3d-tooltip-pin', handleTooltipPin);
    return () => {
      document.removeEventListener('3d-tooltip', handleTooltip);
      document.removeEventListener('3d-tooltip-pin', handleTooltipPin);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        pointerDownPos.current = { x: e.clientX, y: e.clientY };
        setHoverTooltip(null);
      }}
      onPointerMove={(e) => {
        if (pointerDownPos.current && e.buttons > 0) {
          const dist = Math.hypot(e.clientX - pointerDownPos.current.x, e.clientY - pointerDownPos.current.y);
          if (dist > 4) {
            setGlobalRotating(true);
          }
        }
      }}
      onPointerUp={(e) => {
        if (pointerDownPos.current) {
          const dx = Math.abs(e.clientX - pointerDownPos.current.x);
          const dy = Math.abs(e.clientY - pointerDownPos.current.y);
          // 5px 이하 클릭이고 툴팁 내부를 클릭한 게 아닐 때 핀 해제
          if (dx < 5 && dy < 5 && !(e.target as HTMLElement)?.closest?.('.equipment-detail-tooltip')) {
            setPinnedTooltip(null);
            document.dispatchEvent(new CustomEvent('3d-tooltip-pin', { detail: null }));
          }
          pointerDownPos.current = null;
        }
        setGlobalRotating(false);
      }}
      onPointerLeave={() => {
        document.dispatchEvent(new CustomEvent('3d-tooltip', { detail: null }));
        document.body.style.cursor = 'auto';
      }}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: bgGradient,
        borderRadius: 'inherit',
        overflow: 'hidden',
      }}
    >
      <Canvas
        camera={{ position: [2.9, 5.14, 5.55], fov: 38 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
        shadows
        style={{ width: '100%', height: '100%', background: 'transparent' }}
        onPointerMissed={() => {
          document.dispatchEvent(new CustomEvent('3d-tooltip', { detail: null }));
        }}
      >
        {/* Ambient & Hemisphere Soft Fill */}
        <ambientLight intensity={isDarkMode ? 0.7 : 0.9} />
        <hemisphereLight
          args={['#ffffff', '#64748b', isDarkMode ? 0.6 : 0.8]}
        />

        {/* Main Key Light (Top-Right Front) */}
        <directionalLight
          position={[6, 12, 6]}
          intensity={isDarkMode ? 2.2 : 2.5}
          color="#ffffff"
          castShadow
          shadow-mapSize={[1024, 1024]}
        />

        {/* Front Direct Fill Light (brightens front bezel & drive bays) */}
        <directionalLight
          position={[0, 4, 10]}
          intensity={isDarkMode ? 1.4 : 1.6}
          color="#f8fafc"
        />

        {/* Left Side Fill Light */}
        <directionalLight
          position={[-8, 8, 4]}
          intensity={isDarkMode ? 1.2 : 1.4}
          color="#e0f2fe"
        />

        {/* Back Rim Light (highlights metal edges & silhouette) */}
        <directionalLight
          position={[0, 8, -8]}
          intensity={isDarkMode ? 1.8 : 1.5}
          color="#93c5fd"
        />

        {/* Internal Accent Lights (Motherboard, CPU, Fans, NPU Cards) */}
        <pointLight position={[0, 2.5, 0.2]} intensity={isDarkMode ? 1.5 : 1.0} color="#38bdf8" distance={12} decay={2} />
        <pointLight position={[0, 1.8, 1.8]} intensity={isDarkMode ? 1.2 : 0.8} color="#e2e8f0" distance={8} decay={2} />
        <pointLight position={[0, 2.0, -1.8]} intensity={isDarkMode ? 1.2 : 0.8} color="#818cf8" distance={8} decay={2} />
        <pointLight position={[-4, 3, -0.5]} intensity={0.8} color="#3b82f6" distance={10} />
        <pointLight position={[4, 3, -0.5]} intensity={0.8} color="#06b6d4" distance={10} />

        {/* Server */}
        <ServerDetailScene isExploded={isExploded} />

        {/* Controls */}
        <OrbitControls
          ref={controlsRef}
          enablePan={true}
          panSpeed={1.0}
          screenSpacePanning={true}
          mouseButtons={{
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
          }}
          maxPolarAngle={Math.PI / 2 - 0.05}
          minPolarAngle={0.15}
          minDistance={3}
          maxDistance={25}
          target={[0, -0.54, 0.23]}
          enableDamping
          dampingFactor={0.08}
          onStart={() => {
            // 회전/이동 시작 시 즉시 임시 호버 툴팁 제거
            setHoverTooltip(null);
          }}
          onChange={() => {
            logCameraTransform(false);
            if (pointerDownPos.current) {
              setGlobalRotating(true);
            }
          }}
          onEnd={() => {
            logCameraTransform(true);
            setGlobalRotating(false);
          }}
        />
      </Canvas>

      {/* Top-Right Floating Controls (분해도 뷰 & 새로고침) */}
      <div className="equipment-3d-floating-controls">
        {/* 분해도 뷰 토글 버튼 */}
        <button
          type="button"
          onClick={() => setIsExploded((prev) => !prev)}
          className={`equipment-3d-btn equipment-3d-btn-explode ${isExploded ? 'active' : ''}`}
          title={isExploded ? '조립 상태로 전환' : '호버 부품 분해도 보기'}
        >
          <Icon
            icon="mdi:layers-triple-outline"
            width={16}
            height={16}
            className="equipment-3d-btn-icon"
          />
          <span>분해도 뷰</span>
          {isExploded && <span className="equipment-3d-btn-dot" />}
        </button>

        {/* 새로고침 (카메라 뷰 초기화) 버튼 */}
        <button
          type="button"
          onClick={() => {
            if (!controlsRef.current || isResettingCameraRef.current) return;
            const ctrl = controlsRef.current;
            const cam = ctrl.object;
            if (!cam) return;

            isResettingCameraRef.current = true;
            setIsRefreshSpinning(true);
            setTimeout(() => setIsRefreshSpinning(false), 650);

            const startPos = cam.position.clone();
            const endPos = new THREE.Vector3(2.9, 5.14, 5.55);
            const startTarget = ctrl.target.clone();
            const endTarget = new THREE.Vector3(0, -0.54, 0.23);

            const startTime = performance.now();
            const duration = 550;

            const step = (now: number) => {
              const elapsed = now - startTime;
              const progress = Math.min(1, elapsed / duration);
              // easeInOutCubic
              const ease = progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;

              cam.position.lerpVectors(startPos, endPos, ease);
              ctrl.target.lerpVectors(startTarget, endTarget, ease);
              ctrl.update();

              if (progress < 1) {
                requestAnimationFrame(step);
              } else {
                isResettingCameraRef.current = false;
                logCameraTransform(true);
              }
            };
            requestAnimationFrame(step);
          }}
          className={`equipment-3d-btn equipment-3d-btn-refresh ${isRefreshSpinning ? 'is-spinning' : ''}`}
          title="카메라 시점 새로고침 (기본 시점으로 복원)"
          aria-label="카메라 시점 새로고침"
        >
          <Icon
            icon="mdi:refresh"
            width={18}
            height={18}
            className="equipment-3d-refresh-icon"
          />
        </button>
      </div>

      {/* Bottom-Left Controls Guide (조작법) */}
      <div className="equipment-3d-guide-card">
        {/* 헤더: 마우스 아이콘 + 조작법 */}
        <div className="equipment-3d-guide-header">
          <svg
            className="equipment-3d-guide-icon"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="5" y="2" width="14" height="20" rx="7" />
            <line x1="12" y1="6" x2="12" y2="10" />
          </svg>
          <span className="equipment-3d-guide-title">조작법</span>
        </div>

        {/* 조작 설명 항목들 */}
        <div className="equipment-3d-guide-list">
          <div className="equipment-3d-guide-item">
            <span className="equipment-3d-guide-key">좌클릭 드래그</span>
            <span className="equipment-3d-guide-dash">—</span>
            <span className="equipment-3d-guide-desc">회전</span>
          </div>
          <div className="equipment-3d-guide-item">
            <span className="equipment-3d-guide-key">휠(스크롤)</span>
            <span className="equipment-3d-guide-dash">—</span>
            <span className="equipment-3d-guide-desc">확대/축소</span>
          </div>
          <div className="equipment-3d-guide-item">
            <span className="equipment-3d-guide-key">부품 클릭</span>
            <span className="equipment-3d-guide-dash">—</span>
            <span className="equipment-3d-guide-desc">상세정보 고정</span>
          </div>
        </div>
      </div>

      {/* 2D HTML 툴팁 오버레이 (마우스 커서를 절대 가리지 않는 스마트 배치) */}
      {activeTooltip && (() => {
        const winW = window.innerWidth;
        const winH = window.innerHeight;
        const mx = activeTooltip.x;
        const my = activeTooltip.y;

        // 마우스 커서와 툴팁 사이의 안전 여백 (커서와 대상 부품 시야를 완전히 확보)
        const OFFSET_X = 22;
        const OFFSET_Y = 18;

        // 실제 툴팁 너비/높이(텍스트 길이에 따라 최대 ~340px)를 보수적으로 고려
        const estWidth = activeTooltip.chipsGrid ? 280 : (activeTooltip.ramGrid ? 320 : 300);
        const estHeight = activeTooltip.chipsGrid ? 320 : (activeTooltip.ramGrid ? 260 : 200);

        // 커서 우측 공간이 부족하면 커서 좌측으로 배치, 충분하면 우측 배치
        const placeLeft = mx + OFFSET_X + estWidth > winW - 16;
        // 커서 하단 공간이 부족하면 커서 상단으로 배치, 충분하면 하단 배치
        const placeTop = my + OFFSET_Y + estHeight > winH - 16;

        const anchorX = placeLeft ? (mx - OFFSET_X) : (mx + OFFSET_X);
        const anchorY = placeTop ? (my - OFFSET_Y) : (my + OFFSET_Y);

        // 브라우저 렌더링된 요소의 실제 크기를 100% 기준으로 이동하므로 커서를 절대 덮지 않음
        const transform = `translate(${placeLeft ? '-100%' : '0%'}, ${placeTop ? '-100%' : '0%'})`;

        return (
          <div
            className={`equipment-detail-tooltip ${isPinned ? 'is-pinned' : ''} ${activeTooltip.chipsGrid ? 'has-chips' : ''
              } ${activeTooltip.ramGrid ? 'has-ram' : ''}`}
            style={{
              left: Math.max(12, Math.min(winW - 12, anchorX)),
              top: Math.max(12, Math.min(winH - 12, anchorY)),
              transform,
            }}
          >
            {/* Header: Title + Pinned Badge + Close Button */}
            <div className="equipment-detail-tooltip-header">
              <div className="equipment-detail-tooltip-title-wrap">
                <span className="equipment-detail-tooltip-title">{activeTooltip.title}</span>
                {isPinned && <span className="equipment-detail-tooltip-badge">📌 고정됨</span>}
              </div>
              {isPinned && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPinnedTooltip(null);
                    document.dispatchEvent(new CustomEvent('3d-tooltip-pin', { detail: null }));
                  }}
                  className="equipment-detail-tooltip-close"
                  title="고정 해제 (ESC)"
                >
                  ✕
                </button>
              )}
            </div>

            {activeTooltip.rows.map((row: { label: string; value: string; isValueColored?: boolean; color?: string }, idx: number) => (
              <div key={idx} className="equipment-detail-tooltip-row">
                <span className="equipment-detail-tooltip-label">{row.label}</span>
                <span
                  className="equipment-detail-tooltip-value"
                  style={row.isValueColored ? { color: row.color } : undefined}
                >
                  {row.value}
                </span>
              </div>
            ))}

            {activeTooltip.chipsGrid && (
              <RollingChipsGrid chips={activeTooltip.chipsGrid} isPinned={isPinned} />
            )}

            {activeTooltip.ramGrid && (
              <div className="equipment-detail-ram-grid">
                {activeTooltip.ramGrid.map((ram: { id: number; used: number; total: number }) => {
                  const usagePercent = (ram.used / ram.total) * 100;
                  let color = '#10b981';
                  if (usagePercent > 85) color = '#ef4444';
                  else if (usagePercent > 60) color = '#f97316';

                  return (
                    <div key={ram.id} className="equipment-detail-ram-box">
                      <div className="equipment-detail-ram-title">R{ram.id}</div>
                      <div className="equipment-detail-ram-val">
                        <div>{ram.used}G</div>
                        <div className="equipment-detail-ram-bar-track">
                          <div
                            className="equipment-detail-ram-bar-fill"
                            style={{ width: `${usagePercent}%`, background: color }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTooltip.status && (
              <div className="equipment-detail-tooltip-row equipment-detail-tooltip-status">
                <span className={`equipment-detail-tooltip-status-text ${activeTooltip.status.ok ? 'is-ok' : 'is-error'}`}>
                  <span className={`equipment-detail-tooltip-status-dot ${activeTooltip.status.ok ? 'is-ok' : 'is-error'}`} />
                  {activeTooltip.status.text}
                </span>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ponytail: 기존 Scene3D 전체 뷰도 유지 — 다른 곳에서 쓸 수 있으니
export { ServerDetailScene };
export default EquipmentDetail3D;
