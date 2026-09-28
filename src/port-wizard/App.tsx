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
  progress?: number;
}

let analysisQueue = Promise.resolve();
const abortControllers = new Map<string, AbortController>();

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

  const lastUploadTimeRef = useRef(0);

  // Handle files
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement> | { target: { files: FileList | File[] } }) => {
    const now = Date.now();
    if (now - lastUploadTimeRef.current < 500) {
      return; // Debounce duplicate events
    }
    lastUploadTimeRef.current = now;

    const rawFiles = Array.from(e.target.files || []);
    if (rawFiles.length === 0) return;

    // Deduplicate files by name and size to prevent double-uploads from browser bugs
    const files = rawFiles.filter((file, index, self) => 
      index === self.findIndex(f => f.name === file.name && f.size === file.size)
    );

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
    
    // Set active session ID safely outside the reducer
    setActiveSessionId(currentActive => {
      // If we don't have an active session, or the current one is somehow invalid, use the first new one
      if (!currentActive) return newSessions[0].id;
      return currentActive;
    });
    
    // Enqueue all analysis tasks in a strict global queue to prevent any parallel API calls
    newSessions.forEach((s, index) => {
      analysisQueue = analysisQueue.then(async () => {
        // 5초 대기 (분당 최대 12개만 요청되도록 제한하여 15 RPM 회피)
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
        await runAnalysisForSession(s.id, s.image, s.originalFileName);
      });
    });
    
    // reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const runAnalysisForSession = async (id: string, imageBase64: string, originalName: string) => {
    let sessionExists = false;
    setSessions(prev => {
      sessionExists = prev.some(s => s.id === id);
      return sessionExists ? prev.map(s => s.id === id ? { ...s, status: "analyzing", progress: 0 } : s) : prev;
    });

    if (!sessionExists) return;

    const controller = new AbortController();
    abortControllers.set(id, controller);
    
    const progressInterval = setInterval(() => {
      setSessions(prev => prev.map(s => {
        if (s.id === id && s.status === "analyzing") {
          const current = s.progress || 0;
          const increment = current < 50 ? 5 : current < 80 ? 2 : current < 95 ? 1 : 0.2;
          const next = Math.min(99, current + increment);
          return { ...s, progress: next };
        }
        return s;
      }));
    }, 500);

    try {
      const result = await analyzeHardwareImage(imageBase64, 5, controller.signal);
      let fileName = originalName.replace(/\.[^/.]+$/, "");
      
      clearInterval(progressInterval);
      abortControllers.delete(id);
      
      setSessions(prev => prev.map(s => s.id === id ? {
        ...s,
        status: "completed",
        progress: 100,
        analysis: result.analysis || "Mapping complete.",
        ports: result.ports || [],
        downloadFileName: fileName
      } : s));
    } catch (err: any) {
      clearInterval(progressInterval);
      abortControllers.delete(id);
      if (err.message === "Analysis aborted by user") return;

      setSessions(prev => prev.map(s => s.id === id ? {
        ...s,
        status: "error",
        progress: 0,
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
    
    // Abort if currently analyzing
    const controller = abortControllers.get(id);
    if (controller) {
      controller.abort();
      abortControllers.delete(id);
    }
    
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
    <div style={{ width: "260px", display: "flex", flexDirection: "column", height: "calc(100vh - 110px)", position: "sticky", top: "5.5rem", borderRight: "1px solid var(--s-border)", paddingRight: "1rem" }}>
      <div style={{ padding: "8px 0", display: "flex", gap: "8px", flexShrink: 0 }}>
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
              abortControllers.forEach(controller => controller.abort());
              abortControllers.clear();
              setSessions([]);
              setActiveSessionId(null);
            }
          }}
        >
          <Icon icon="fluent:delete-24-regular" /> 일괄 삭제
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1, overflowY: "auto", paddingBottom: "8px" }}>
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
                {s.status === "analyzing" && <><Icon icon="line-md:loading-twotone-loop" style={{ color: "var(--s-primary)" }} /> 분석중... {Math.floor(s.progress || 0)}%</>}
                {s.status === "completed" && <><Icon icon="fluent:checkmark-circle-24-filled" style={{ color: "var(--severity-success)" }} /> 완료 ({s.ports.length})</>}
                {s.status === "error" && (
                  <div style={{ color: "var(--severity-critical)", display: "flex", alignItems: "center", gap: "4px" }} title={s.error || ""}>
                    <Icon icon="fluent:error-circle-24-filled" /> 
                    <span style={{ maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      에러: {s.error}
                    </span>
                  </div>
                )}
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

      <div style={{ paddingTop: "16px", paddingBottom: "16px", flexShrink: 0 }}>
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
        sessionStatus={activeSession?.status}
        sessionError={activeSession?.error}
        onStateChange={(s) => {
          if (activeSession) handleStateChange(activeSession.id, s);
        }}
        onRetryAnalysis={() => {
          if (activeSession) {
            const currentIndex = sessions.findIndex(s => s.id === activeSession.id);
            if (currentIndex === -1) return;
            
            // 현재 항목을 포함하여, 이후에 있는 실패한(error) 항목들을 모두 찾습니다.
            const sessionsToRetry = sessions.slice(currentIndex).filter(s => s.id === activeSession.id || s.status === "error");
            
            // 큐에 넣기 전에 미리 상태를 대기중(pending)으로 변경하여 UI에 즉각 반영합니다.
            const retryIds = new Set(sessionsToRetry.map(s => s.id));
            setSessions(prev => prev.map(s => retryIds.has(s.id) ? { ...s, status: "pending", error: null, progress: 0 } : s));

            sessionsToRetry.forEach((s, idx) => {
              analysisQueue = analysisQueue.then(async () => {
                if (idx > 0) {
                  await new Promise(resolve => setTimeout(resolve, 5000));
                }
                await runAnalysisForSession(s.id, s.image, s.originalFileName);
              });
            });
          }
        }}
        onMultiUpload={(files) => handleUpload({ target: { files } } as any)}
        leftSidebar={leftSidebar}
      />
    </>
  );
}
