import { useState, useRef, useEffect } from "react";
import localforage from "localforage";
import { Icon } from "@iconify/react";
import PortWizardEditor, { PortData } from "./PortWizardEditor";
import { analyzeHardwareImage } from "./utils/analyzer";

export interface PortSession {
  id: string;
  originalFileName: string;
  image: string; // base64
  status: "pending" | "analyzing" | "completed" | "error";
  analysis: string;
  ports: PortData[];
  past: PortData[][];
  future: PortData[][];
  error: string | null;
  downloadFileName: string;
}

export default function App() {
  const [sessions, setSessions] = useState<PortSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isRestored, setIsRestored] = useState(false);
  const [hasMultiSessionMode, setHasMultiSessionMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore state
  useEffect(() => {
    async function restore() {
      try {
        const saved = await localforage.getItem<PortSession[]>("port-wizard-sessions");
        if (saved && saved.length > 0) {
          setSessions(saved);
          setActiveSessionId(saved[0].id);
        }
      } catch (e) {}
      setIsRestored(true);
    }
    restore();
  }, []);

  // Save state
  useEffect(() => {
    if (isRestored) {
      localforage.setItem("port-wizard-sessions", sessions);
    }
  }, [sessions, isRestored]);

  // Track multi-session mode sticky state
  useEffect(() => {
    if (sessions.length > 1) {
      setHasMultiSessionMode(true);
    } else if (sessions.length === 0) {
      setHasMultiSessionMode(false);
    }
  }, [sessions.length]);

  // Handle files
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement> | { target: { files: FileList | File[] } }) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newSessions: PortSession[] = [];
    for (const file of files) {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");

      newSessions.push({
        id: crypto.randomUUID(),
        originalFileName: file.name,
        image: base64,
        status: "pending",
        analysis: "",
        ports: [],
        past: [],
        future: [],
        error: null,
        downloadFileName: fileNameWithoutExt
      });
    }

    setSessions(prev => [...prev, ...newSessions]);
    if (!activeSessionId && newSessions.length > 0) {
      setActiveSessionId(newSessions[0].id);
    }
    
    // Auto-start analysis for new pending sessions
    newSessions.forEach(s => {
      runAnalysisForSession(s.id, s.image, s.originalFileName);
    });
    
    // reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const runAnalysisForSession = async (id: string, imageBase64: string, originalName: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, status: "analyzing" } : s));
    try {
      const result = await analyzeHardwareImage(imageBase64);
      let fileName = originalName.replace(/\.[^/.]+$/, "");
      
      setSessions(prev => prev.map(s => s.id === id ? {
        ...s,
        status: "completed",
        analysis: result.analysis || "Mapping complete.",
        ports: result.ports || [],
        downloadFileName: fileName
      } : s));
    } catch (err: any) {
      setSessions(prev => prev.map(s => s.id === id ? {
        ...s,
        status: "error",
        error: err.message || "Failed to analyze"
      } : s));
    }
  };

  const handleStateChange = (id: string, newState: any) => {
    setSessions(prev => prev.map(s => {
      if (s.id === id) {
        return {
          ...s,
          image: newState.image,
          ports: newState.ports,
          analysis: newState.analysis,
          past: newState.past,
          future: newState.future,
          downloadFileName: newState.downloadFileName
        };
      }
      return s;
    }));
  };

  const batchDownload = async () => {
    const completed = sessions.filter(s => s.ports.length > 0);
    for (const s of completed) {
      await downloadSingleSVG(s);
    }
  };

  const downloadSingleSVG = async (session: PortSession) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = session.image;

    await new Promise((resolve) => {
      img.onload = resolve;
    });

    let exportWidth = img.naturalWidth;
    let exportHeight = img.naturalHeight;

    if (exportWidth > 1000) {
      exportHeight = Math.round(exportHeight * (1000 / exportWidth));
      exportWidth = 1000;
    }

    const canvas = document.createElement("canvas");
    canvas.width = exportWidth;
    canvas.height = exportHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.drawImage(img, 0, 0, exportWidth, exportHeight);

    const compressedImage = canvas.toDataURL("image/webp", 0.85);

    const paths = session.ports
      .map((port) => {
        const [ymin, xmin, ymax, xmax] = port.box_2d;
        const x = (xmin / 1000) * exportWidth;
        const y = (ymin / 1000) * exportHeight;
        const w = ((xmax - xmin) / 1000) * exportWidth;
        const h = ((ymax - ymin) / 1000) * exportHeight;
        const pathData = `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;

        return `    <path 
      class="port-hitbox"
      data-port-type="${port.portName || "port"}"
      data-local-port="${port.portNumber}"
      d="${pathData}" 
      fill="none"
      stroke="none"
    />`;
      })
      .join("\n");

    const svgString = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg width="${exportWidth}" height="${exportHeight}" viewBox="0 0 ${exportWidth} ${exportHeight}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <title>Hardware Port Analysis</title>
  <image href="${compressedImage}" xlink:href="${compressedImage}" width="${exportWidth}" height="${exportHeight}" />
  <g id="ports-layer">
${paths}
  </g>
</svg>`;

    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    let finalFileName = session.originalFileName.replace(/\.[^/.]+$/, "") + ".svg";
    link.download = finalFileName;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const removeSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Determine the next active session *before* state update if needed
    let nextActiveId = activeSessionId;
    if (activeSessionId === id) {
      const remaining = sessions.filter(s => s.id !== id);
      nextActiveId = remaining.length > 0 ? remaining[0].id : null;
      setActiveSessionId(nextActiveId);
    }

    setSessions(prev => prev.filter(s => s.id !== id));
  };

  // If there were ever >1 files, we keep showing the left sidebar until all are deleted.
  // "하나일때는 원래대로 동작하고" (When 1 originally, no sidebar. But if deleted from 2->1, keep sidebar for good UX)
  const showSidebar = hasMultiSessionMode && sessions.length > 0;

  const leftSidebar = showSidebar ? (
    <div style={{ width: "260px", display: "flex", flexDirection: "column", gap: "8px", height: "100%", overflowY: "auto", borderRight: "1px solid var(--s-border)", paddingRight: "1rem" }}>
      <div style={{ padding: "8px 0", display: "flex", gap: "8px" }}>
        <button 
          className="comm-btn comm-btn-primary" 
          style={{ flex: 1, borderRadius: "var(--radius-md)", padding: "8px 0", justifyContent: "center" }}
          onClick={() => fileInputRef.current?.click()}
        >
          <Icon icon="fluent:folder-add-24-regular" /> 파일 추가
        </button>
        <button 
          className="comm-btn comm-btn-destructive" 
          style={{ flex: 1, borderRadius: "var(--radius-md)", padding: "8px 0", justifyContent: "center" }}
          onClick={() => {
            if (confirm("업로드된 모든 이미지를 삭제하시겠습니까?")) {
              setSessions([]);
              setActiveSessionId(null);
            }
          }}
        >
          <Icon icon="fluent:delete-24-regular" /> 일괄 삭제
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {sessions.map(s => (
          <div 
            key={s.id}
            onClick={() => setActiveSessionId(s.id)}
            style={{
              display: "flex", alignItems: "center", gap: "10px", padding: "10px",
              backgroundColor: activeSessionId === s.id ? "var(--s-active)" : "var(--s-elevated)",
              border: activeSessionId === s.id ? "1px solid var(--s-primary)" : "1px solid var(--s-border)",
              borderRadius: "var(--radius-md)", cursor: "pointer", transition: "all 0.2s"
            }}
          >
            <img src={s.image} alt="thumb" style={{ width: "40px", height: "40px", objectFit: "contain", borderRadius: "4px", backgroundColor: "#000" }} />
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div style={{ fontSize: "13px", fontWeight: "bold", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--s-text)" }}>
                {s.originalFileName}
              </div>
              <div style={{ fontSize: "11px", color: "var(--s-text-muted)", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                {s.status === "pending" && <><Icon icon="fluent:clock-24-regular" /> 대기중</>}
                {s.status === "analyzing" && <><Icon icon="line-md:loading-twotone-loop" style={{ color: "var(--s-primary)" }} /> 분석중...</>}
                {s.status === "completed" && <><Icon icon="fluent:checkmark-circle-24-filled" style={{ color: "var(--severity-success)" }} /> 완료 ({s.ports.length})</>}
                {s.status === "error" && <><Icon icon="fluent:error-circle-24-filled" style={{ color: "var(--severity-critical)" }} /> 에러</>}
              </div>
            </div>
            <button 
              className="wizard-toolbar__icon-btn wizard-toolbar__icon-btn--danger" 
              style={{ padding: "4px", minWidth: "auto" }}
              onClick={(e) => removeSession(s.id, e)}
            >
              <Icon icon="fluent:dismiss-24-regular" />
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "auto", paddingTop: "16px", paddingBottom: "16px" }}>
        <button 
          className="comm-btn comm-btn-primary" 
          style={{ width: "100%", background: "var(--severity-success)", borderRadius: "var(--radius-md)" }}
          onClick={batchDownload}
          disabled={sessions.filter(s => s.ports.length > 0).length === 0}
        >
          <Icon icon="fluent:save-multiple-24-regular" /> 일괄 SVG 저장 ({sessions.filter(s => s.ports.length > 0).length}개)
        </button>
      </div>
    </div>
  ) : null;

  const activeSession = sessions.find(s => s.id === activeSessionId);

  return (
    <>
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: "none" }} 
        multiple 
        accept="image/*"
        onChange={handleUpload}
      />
      <PortWizardEditor
        key={activeSession?.id || "empty"}
        initialImage={activeSession?.image || null}
        initialPorts={activeSession?.ports || []}
        initialAnalysis={activeSession?.analysis || ""}
        initialPast={activeSession?.past || []}
        initialFuture={activeSession?.future || []}
        initialDownloadFileName={activeSession?.downloadFileName || "hardware-ports"}
        originalFileName={activeSession?.originalFileName || ""}
        onStateChange={(s) => {
          if (activeSession) handleStateChange(activeSession.id, s);
        }}
        onMultiUpload={(files) => handleUpload({ target: { files } } as any)}
        leftSidebar={leftSidebar}
      />
    </>
  );
}
