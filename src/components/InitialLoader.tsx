import { useState, useEffect } from "react";
import { useProgress } from "@react-three/drei";
import { useStore } from "../store/useStore";

export const InitialLoader = () => {
  const { active, progress, total } = useProgress();
  const [isReady, setIsReady] = useState(false);
  const [, setHasStarted] = useState(false);
  const nodes = useStore((s) => s.nodes);
  const activeNodeId = useStore((s) => s.activeNodeId);
  const isCanvasReady = useStore((s) => s.isCanvasReady);

  useEffect(() => {
    if (total > 0 || active) setHasStarted(true);
  }, [total, active]);

  useEffect(() => {
    if (isReady) return;

    // Wait until the active node is actually set (or there are no nodes at all)
    const isNodeSelected = nodes.length === 0 || activeNodeId !== null;
    if (!isNodeSelected) return;

    // Scene.tsx의 SceneReadyMonitor에서 모든 로딩(active false)이 끝난 후 
    // 최소 5프레임 이상 렌더링이 안정화되면 isCanvasReady를 true로 만듭니다.
    // 타이머 없이 완벽하게 맵핑이 완료된 시점을 감지합니다.
    if (isCanvasReady && !active && (progress === 100 || total === 0)) {
      setIsReady(true);
    }
  }, [active, progress, isCanvasReady, nodes.length, activeNodeId, isReady]);

  if (isReady) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "var(--bg-main, #0f172a)",
        zIndex: 999999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "#ffffff",
      }}
    >
      <div className="comm-logo-circle" style={{ width: 64, height: 64, marginBottom: 24, padding: 12 }}>
        <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
      </div>
      <h2 style={{ fontFamily: "Outfit", margin: 0, fontSize: "2rem", letterSpacing: "-0.5px" }}>ArcVRack</h2>
      <p style={{ color: "var(--text-tertiary)", marginTop: 8 }}>
        {active ? `3D 자원 불러오는 중... ${Math.round(progress)}%` : "3D 환경을 준비하는 중..."}
      </p>
      
      <div style={{ marginTop: 32, width: 240, height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden" }}>
        <div 
          style={{ 
            height: "100%", 
            background: "var(--theme-primary)", 
            width: "30%",
            animation: "loading-bar-anim 1.5s infinite ease-in-out" 
          }} 
        />
      </div>
      <style>
        {`
          @keyframes loading-bar-anim {
            0% { transform: translateX(-100%); width: 30%; }
            50% { width: 50%; }
            100% { transform: translateX(400%); width: 30%; }
          }
        `}
      </style>
    </div>
  );
};
