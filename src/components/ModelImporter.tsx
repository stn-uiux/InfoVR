import { Icon } from "@iconify/react";
import React, { useRef, useState, useCallback, useEffect } from "react";
import { useStore } from "../store/useStore";
import type { ImportedModel, WallParams, PartitionParams, LightParams } from "../types";
import {
  BUILTIN_MODELS,
  DEFAULT_WALL_PARAMS,
  DEFAULT_PARTITION_PARAMS,
  DEFAULT_LIGHT_PARAMS,
} from "../utils/builtinModels";
import type { BuiltinModelDef } from "../utils/builtinModels";
import {
  exportModels,
  readModelExportFile,
  getImportPreview,
  deserializeModels,
  type ModelExportPackage,
  type ImportPreview,
} from "../utils/modelStorage";
import { HierarchyTree } from "./HierarchyTree";
/** Read a File as a base64 data URL */
const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const isValidExtension = (name: string): boolean => {
  const lower = name.toLowerCase();
  return lower.endsWith(".glb") || lower.endsWith(".gltf");
};

export const ModelImporter = () => {
  const isEditMode = useStore((s) => s.isEditMode);
  const addImportedModel = useStore((s) => s.addImportedModel);
  const importedModels = useStore((s) => s.importedModels);
  const selectedModelId = useStore((s) => s.selectedModelId);
  const selectModel = useStore((s) => s.selectModel);
  const deleteModel = useStore((s) => s.deleteModel);
  const updateModel = useStore((s) => s.updateModel);
  const toggleModelMove = useStore((s) => s.toggleModelMove);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Model export/import state
  const modelImportRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(
    null,
  );
  const [importPkg, setImportPkg] = useState<ModelExportPackage | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleExportModels = useCallback(async () => {
    if (importedModels.length === 0) {
      setError("No models to export.");
      setTimeout(() => setError(null), 3000);
      return;
    }
    try {
      await exportModels(importedModels);
      setSuccessMsg(`Exported ${importedModels.length} model(s)`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
      setTimeout(() => setError(null), 4000);
    }
  }, [importedModels]);

  const handleModelImportFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (modelImportRef.current) modelImportRef.current.value = "";
      if (!file) return;
      try {
        setImportError(null);
        const pkg = await readModelExportFile(file);
        const preview = getImportPreview(pkg);
        setImportPkg(pkg);
        setImportPreview(preview);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : String(err));
      }
    },
    [],
  );

  const handleConfirmImport = useCallback(() => {
    if (!importPkg) return;
    setIsImporting(true);
    try {
      const models = deserializeModels(importPkg);
      for (const m of models) {
        addImportedModel(m);
      }
      setSuccessMsg(`Imported ${models.length} model(s)`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
      setTimeout(() => setError(null), 4000);
    } finally {
      setIsImporting(false);
      setImportPkg(null);
      setImportPreview(null);
    }
  }, [importPkg, addImportedModel]);

  const handleCancelImport = useCallback(() => {
    setImportPkg(null);
    setImportPreview(null);
    setImportError(null);
  }, []);

  /** Add a built-in default model to the scene */
  const handleAddBuiltin = useCallback(
    (def: BuiltinModelDef) => {
      if (def.type === "Wall") {
        addImportedModel({
          name: "Wall",
          fileName: def.fileName,
          dataUrl: "",
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          isMoveEnabled: false,
          builtinType: "Wall",
          wallParams: { ...DEFAULT_WALL_PARAMS },
        });
      } else if (def.type === "Partition") {
        addImportedModel({
          name: "Partition",
          fileName: def.fileName,
          dataUrl: "",
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          isMoveEnabled: false,
          builtinType: "Partition",
          partitionParams: { ...DEFAULT_PARTITION_PARAMS },
        });
      } else if (def.type === "Clock") {
        addImportedModel({
          name: "Clock",
          fileName: def.fileName,
          dataUrl: "",
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          isMoveEnabled: false,
          builtinType: "Clock",
        });
      } else if (def.type === "Light") {
        addImportedModel({
          name: "Light",
          fileName: def.fileName,
          dataUrl: "",
          position: [5, 10, 5],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          isMoveEnabled: false,
          builtinType: "Light",
          lightParams: { ...DEFAULT_LIGHT_PARAMS },
        });
      } else {
        addImportedModel({
          name: def.label,
          fileName: def.fileName,
          dataUrl: def.assetUrl,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          isMoveEnabled: false,
          builtinType: def.type,
        });
      }
    },
    [addImportedModel],
  );

  type PanelType = "hierarchy" | "project" | "builtin" | "imported" | null;
  const [floatingPanel, setFloatingPanel] = useState<PanelType>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);

  const [treeHeight, setTreeHeight] = useState(300);
  const [isDraggingTree, setIsDraggingTree] = useState(false);

  const [floatingWidth, setFloatingWidth] = useState(300);
  const [floatingHeight, setFloatingHeight] = useState<number | string>("calc(100vh - 120px)");
  const [floatingResizeMode, setFloatingResizeMode] = useState<"width" | "height" | "both" | null>(null);

  useEffect(() => {
    if (!isCollapsed) setFloatingPanel(null);
  }, [isCollapsed]);

  const handleSidebarResize = useCallback((e: MouseEvent) => {
    setSidebarWidth(e.clientX < 200 ? 200 : e.clientX > 600 ? 600 : e.clientX);
  }, []);

  const handleSidebarMouseUp = useCallback(() => {
    setIsDraggingSidebar(false);
  }, []);

  const handleTreeResize = useCallback((e: MouseEvent) => {
    // top offset is roughly 56px, plus 40px padding/header
    const newHeight = e.clientY - 60;
    setTreeHeight(newHeight < 100 ? 100 : newHeight > window.innerHeight - 200 ? window.innerHeight - 200 : newHeight);
  }, []);

  const handleTreeMouseUp = useCallback(() => {
    setIsDraggingTree(false);
  }, []);

  useEffect(() => {
    if (isDraggingSidebar) {
      document.body.classList.add("comm-no-select");
      window.addEventListener("mousemove", handleSidebarResize);
      window.addEventListener("mouseup", handleSidebarMouseUp);
    } else {
      document.body.classList.remove("comm-no-select");
      window.removeEventListener("mousemove", handleSidebarResize);
      window.removeEventListener("mouseup", handleSidebarMouseUp);
    }
    return () => {
      document.body.classList.remove("comm-no-select");
      window.removeEventListener("mousemove", handleSidebarResize);
      window.removeEventListener("mouseup", handleSidebarMouseUp);
    };
  }, [isDraggingSidebar, handleSidebarResize, handleSidebarMouseUp]);

  useEffect(() => {
    if (isDraggingTree) {
      document.body.classList.add("comm-no-select");
      window.addEventListener("mousemove", handleTreeResize);
      window.addEventListener("mouseup", handleTreeMouseUp);
    } else {
      document.body.classList.remove("comm-no-select");
      window.removeEventListener("mousemove", handleTreeResize);
      window.removeEventListener("mouseup", handleTreeMouseUp);
    }
    return () => {
      document.body.classList.remove("comm-no-select");
      window.removeEventListener("mousemove", handleTreeResize);
      window.removeEventListener("mouseup", handleTreeMouseUp);
    };
  }, [isDraggingTree, handleTreeResize, handleTreeMouseUp]);

  const handleFloatingResize = useCallback((e: MouseEvent) => {
    if (!floatingResizeMode) return;
    if (floatingResizeMode === "width" || floatingResizeMode === "both") {
      setFloatingWidth(Math.max(200, Math.min(e.clientX - 48, 800)));
    }
    if (floatingResizeMode === "height" || floatingResizeMode === "both") {
      setFloatingHeight(Math.max(200, Math.min(e.clientY, window.innerHeight - 20)));
    }
  }, [floatingResizeMode]);

  const handleFloatingMouseUp = useCallback(() => {
    setFloatingResizeMode(null);
  }, []);

  useEffect(() => {
    if (floatingResizeMode) {
      document.body.classList.add("comm-no-select");
      window.addEventListener("mousemove", handleFloatingResize);
      window.addEventListener("mouseup", handleFloatingMouseUp);
    } else {
      document.body.classList.remove("comm-no-select");
      window.removeEventListener("mousemove", handleFloatingResize);
      window.removeEventListener("mouseup", handleFloatingMouseUp);
    }
    return () => {
      document.body.classList.remove("comm-no-select");
      window.removeEventListener("mousemove", handleFloatingResize);
      window.removeEventListener("mouseup", handleFloatingMouseUp);
    };
  }, [floatingResizeMode, handleFloatingResize, handleFloatingMouseUp]);

  const selectedModel = importedModels.find((m) => m.id === selectedModelId);

  const handleImport = useCallback(
    async (file: File) => {
      if (!isValidExtension(file.name)) {
        setError("Unsupported format. Use .glb or .gltf only.");
        setTimeout(() => setError(null), 4000);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const dataUrl = await fileToDataUrl(file);
        const baseName = file.name.replace(/\.(glb|gltf)$/i, "");

        addImportedModel({
          name: baseName,
          fileName: file.name,
          dataUrl,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          isMoveEnabled: false,
        });
      } catch {
        setError("Failed to read file.");
        setTimeout(() => setError(null), 4000);
      } finally {
        setIsLoading(false);
      }
    },
    [addImportedModel],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleImport(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [handleImport],
  );

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files") && isEditMode) {
        setIsDragOver(true);
      }
    };
    window.addEventListener("dragenter", handleDragEnter);
    return () => window.removeEventListener("dragenter", handleDragEnter);
  }, [isEditMode]);

  const renderProjectPanel = () => (
    <div className="comm-panel" style={{ padding: "16px", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", flexShrink: 0 }}>
      <div className="comm-flex-col-10">
        <button
          className="comm-btn comm-btn-md comm-btn-primary comm-w-full"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
        >
          {isLoading ? <span className="spinner-mini" /> : <Icon icon="material-symbols:add" className="icon" />}
          Add New Asset
        </button>
        <div style={{ background: "rgba(128, 128, 128, 0.1)", padding: "12px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-weak)" }}>
          <span className="comm-section-header">
            Project Data
          </span>
          <div className="comm-flex-gap-8">
            <button
              className="comm-btn comm-btn-md comm-btn-secondary"
              style={{ flex: 1, background: importedModels.length > 0 ? "rgba(128, 128, 128, 0.2)" : "transparent", color: importedModels.length > 0 ? "var(--text-primary)" : "var(--text-disabled)", borderColor: importedModels.length > 0 ? "var(--border-medium)" : "var(--border-weak)" }}
              disabled={importedModels.length === 0}
              onClick={handleExportModels}
            >
              <span role="img" aria-label="save">💾</span> Save
            </button>
            <button
              className="comm-flex-1"
              onClick={() => modelImportRef.current?.click()}
            >
              <span role="img" aria-label="load">📂</span> Load
            </button>
          </div>
          {(successMsg || error || importError) && (
            <div style={{ marginTop: "8px", fontSize: "10px", color: error || importError ? "#ef4444" : "#22c55e", fontWeight: 500, textAlign: "center", padding: "6px", background: error || importError ? "rgba(239, 68, 68, 0.05)" : "rgba(34, 197, 94, 0.05)", borderRadius: "4px", border: "1px solid", borderColor: error || importError ? "rgba(239, 68, 68, 0.1)" : "rgba(34, 197, 94, 0.1)" }}>
              {(error || importError || successMsg)?.replace("Exported", "Saved").replace("Import", "Load")}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderBuiltinPanel = () => (
    <div className="comm-panel" style={{ padding: "12px 16px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", flexShrink: 0 }}>
      <span className="comm-section-header-lg">
        Default Models
      </span>
      <div className="comm-grid-2col-8">
        {BUILTIN_MODELS.map((def) => (
          <button
            key={def.type}
            className="comm-w-full"
            onClick={() => handleAddBuiltin(def)}
          >
            <span role="img" aria-label={def.label}>{def.emoji}</span> {def.label}
          </button>
        ))}
      </div>
    </div>
  );

  const renderImportedPanel = () => {
    if (importedModels.length === 0) return null;
    return (
      <div className="comm-panel" style={{ display: "flex", flexDirection: "column", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
        <div style={{ padding: "12px 16px", background: "rgba(128, 128, 128, 0.1)", borderBottom: "1px solid var(--border-weak)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="comm-label-uppercase">
            Scene Objects ({importedModels.length})
          </span>
        </div>
        <div style={{ padding: "8px", overflowY: "auto", maxHeight: "260px" }}>
          {importedModels.map((m) => {
            const isSelected = selectedModelId === m.id;
            return (
              <div
                key={m.id}
                onClick={() => selectModel(selectedModelId === m.id ? null : m.id)}
                style={{ padding: "10px 12px", borderRadius: "var(--radius-md)", cursor: "pointer", background: isSelected ? "var(--selected-bg)" : "transparent", border: "1px solid", borderColor: isSelected ? "var(--theme-primary)" : "transparent", marginBottom: "4px", display: "flex", alignItems: "center", gap: "10px", transition: "all 0.15s ease" }}
              >
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: isSelected ? "var(--theme-primary)" : "var(--text-disabled)", flexShrink: 0 }} />
                <span style={{ fontSize: "13px", fontWeight: isSelected ? 600 : 400, color: isSelected ? "var(--text-primary)" : "var(--text-secondary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.name}
                </span>
                <div className="comm-flex-gap-4">
                  <button
                    style={{ background: m.isMoveEnabled ? "rgba(34, 197, 94, 0.1)" : "rgba(249, 115, 22, 0.08)", color: m.isMoveEnabled ? "#22c55e" : "#f97316", border: "1px solid", borderColor: m.isMoveEnabled ? "rgba(34, 197, 94, 0.2)" : "rgba(249, 115, 22, 0.2)", borderRadius: "4px", padding: "2px 6px", fontSize: "10px", cursor: "pointer" }}
                    onClick={(e) => { e.stopPropagation(); toggleModelMove(m.id); }}
                  >
                    {m.isMoveEnabled ? "🔓" : "🔒"}
                  </button>
                  <button
                    style={{ background: "transparent", color: "var(--text-tertiary)", border: "none", fontSize: "14px", padding: "0 4px", cursor: "pointer" }}
                    onClick={(e) => { e.stopPropagation(); deleteModel(m.id); }}
                    onMouseOver={(e) => (e.currentTarget.style.color = "#ef4444")}
                    onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb,.gltf"
        className="comm-hidden"
        onChange={handleFileChange}
      />
      <input
        ref={modelImportRef}
        type="file"
        accept=".json"
        className="comm-hidden"
        onChange={handleModelImportFile}
      />

      <div className="mi-main-wrapper">
        <div
          className={`mi-sidebar ${isCollapsed ? 'sidebar-fold' : ''} ${isDraggingSidebar ? 'no-transition' : ''}`}
          style={isCollapsed ? undefined : { width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px` }}
        >
          {/* Universal Toggle Button */}
          <div className="mi-collapse-btn-wrapper">
            <button
              onClick={() => {
                if (isCollapsed) {
                  setIsCollapsed(false);
                } else {
                  setIsCollapsed(true);
                  setFloatingPanel(null); // Close floating panels when collapsing
                }
              }}
              className="mi-collapse-btn"
              title={isCollapsed ? "사이드바 열기" : "사이드바 닫기"}
            >
              {isCollapsed ? "»" : "«"}
            </button>
          </div>

          {/* Folded State: Icon Toolbar */}
          <div className="sidebar-icon-toolbar">
            <button
              className={`sidebar-tab-btn ${floatingPanel === "hierarchy" ? "active" : ""}`}
              onClick={() => setFloatingPanel((p) => p === "hierarchy" ? null : "hierarchy")}
              title="구조 (Hierarchy)"
            >
              <Icon icon="material-symbols:grid-view" className="icon" />
            </button>
            {isEditMode && (
              <>
                <button
                  className={`sidebar-tab-btn ${floatingPanel === "project" ? "active" : ""}`}
                  onClick={() => setFloatingPanel((p) => p === "project" ? null : "project")}
                  title="프로젝트 & 에셋 (Project)"
                >
                  <Icon icon="material-symbols:folder" className="icon" />
                </button>
                <button
                  className={`sidebar-tab-btn ${floatingPanel === "builtin" ? "active" : ""}`}
                  onClick={() => setFloatingPanel((p) => p === "builtin" ? null : "builtin")}
                  title="기본 모델 (Built-in)"
                >
                  <Icon icon="material-symbols:inventory-2" className="icon" />
                </button>
                <button
                  className={`sidebar-tab-btn ${floatingPanel === "imported" ? "active" : ""}`}
                  onClick={() => setFloatingPanel((p) => p === "imported" ? null : "imported")}
                  title="가져온 모델 (Imported)"
                >
                  <Icon icon="material-symbols:archive" className="icon" />
                </button>
              </>
            )}
          </div>

          {/* Expanded State: Stacked Panels */}
          <div className="sidebar-expanded-content">
            <div
              className="sidebar-tree-area"
              style={{
                height: isEditMode ? `${treeHeight}px` : "100%",
                flex: isEditMode ? "none" : 1,
              }}
            >
              <HierarchyTree />
              <div id={isCollapsed ? "equipment-panel-portal-hidden" : "equipment-panel-portal"} className="sidebar-portal-target" />
            </div>

            <div
              onMouseDown={() => setIsDraggingTree(true)}
              className="sidebar-tree-resizer"
              style={{
                display: isEditMode ? "block" : "none",
                background: isDraggingTree ? "var(--theme-primary)" : "transparent",
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = "var(--theme-primary)")}
              onMouseOut={(e) => (e.currentTarget.style.background = isDraggingTree ? "var(--theme-primary)" : "transparent")}
            />

            <div
              className="sidebar-panels-area"
              style={{
                display: isEditMode ? "flex" : "none",
              }}
            >
              {isEditMode && renderProjectPanel()}
              {isEditMode && renderBuiltinPanel()}
              {isEditMode && renderImportedPanel()}
            </div>
          </div>

          {/* Resize Handle (only active when expanded) */}
          <div
            className={`sidebar-resize-handle ${isDraggingSidebar ? 'dragging' : ''}`}
            onMouseDown={() => setIsDraggingSidebar(true)}
          />

          {/* Floating Panel Popup (only active when collapsed) */}
          {floatingPanel && isCollapsed && (
            <div
              className="sidebar-floating-panel"
              style={{
                width: `${floatingWidth}px`,
              }}
            >
              <div className="sidebar-floating-header">
                <span className="sidebar-floating-title">
                  {floatingPanel === "hierarchy" && "구조 (Hierarchy)"}
                  {floatingPanel === "project" && "프로젝트 & 에셋"}
                  {floatingPanel === "builtin" && "기본 모델"}
                  {floatingPanel === "imported" && "가져온 모델"}
                </span>
                <button
                  onClick={() => setFloatingPanel(null)}
                  className="sidebar-floating-close"
                >
                  ×
                </button>
              </div>

              <div
                className="sidebar-floating-content"
                style={{
                  height: typeof floatingHeight === "number" ? `${floatingHeight}px` : floatingHeight,
                }}
              >
                {floatingPanel === "hierarchy" && <HierarchyTree />}
                {floatingPanel === "project" && isEditMode && renderProjectPanel()}
                {floatingPanel === "builtin" && isEditMode && renderBuiltinPanel()}
                {floatingPanel === "imported" && isEditMode && renderImportedPanel()}
              </div>

              <div id={isCollapsed ? "equipment-panel-portal" : "equipment-panel-portal-hidden-floating"} className="sidebar-portal-target" />

              <div onMouseDown={() => setFloatingResizeMode("width")} className="floating-resize-e" />
              <div onMouseDown={() => setFloatingResizeMode("height")} className="floating-resize-s" />
              <div onMouseDown={() => setFloatingResizeMode("both")} className="floating-resize-se" />
            </div>
          )}
        </div>
      </div>
      {/* Properties Section — positioned right next to the left panel */}
      {isEditMode && selectedModel && (
        <div
          style={{
            position: "absolute",
            top: "76px",
            left: "324px",
            zIndex: 100,
            width: "300px",
            maxHeight: "calc(100vh - 160px)",
            overflowY: "auto",
          }}
        >
          <ModelProperties
            model={selectedModel}
            onUpdate={(updates) => updateModel(selectedModel.id, updates)}
            onDelete={() => deleteModel(selectedModel.id)}
          />
        </div>
      )}

      {isEditMode && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: isDragOver ? 1000 : -1,
            pointerEvents: isDragOver ? "auto" : "none",
            background: isDragOver ? "rgba(79, 70, 229, 0.08)" : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            backdropFilter: isDragOver ? "blur(4px)" : "none",
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) handleImport(file);
          }}
        >
          {isDragOver && (
            <div
              className="comm-drag-overlay"
            >
              <div className="comm-icon-64">📦</div>
              <div
                className="comm-title-lg"
              >
                Ready to Import
              </div>
              <div
                className="comm-subtitle-md"
              >
                Drop your GLB or GLTF file to add it
              </div>
            </div>
          )}
        </div>
      )}

      {/* Import Preview Modal */}
      {importPreview && importPkg && (
        <div
          className="comm-modal-overlay-blur"
          onClick={handleCancelImport}
        >
          <div
            className="comm-modal-dialog-420"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="comm-modal-header-flex"
            >
              📥 Import Preview
            </h3>

            {/* Summary stats */}
            <div
              className="comm-grid-3col-10-mb20"
            >
              {[
                {
                  label: "Total",
                  value: importPreview.totalCount,
                  color: "#6366f1",
                },
                {
                  label: "Built-in",
                  value: importPreview.builtinCount + importPreview.wallCount,
                  color: "#06b6d4",
                },
                {
                  label: "Imported",
                  value: importPreview.importedCount,
                  color: "#f59e0b",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="comm-box-card"
                >
                  <div
                    style={{
                      fontSize: "22px",
                      fontWeight: 700,
                      color: stat.color,
                    }}
                  >
                    {stat.value}
                  </div>
                  <div
                    className="comm-label-uppercase-mt4"
                  >
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Model list */}
            <div
              className="comm-list-box-scrollable"
            >
              <div
                className="comm-label-uppercase comm-mb-8"
              >
                Models to import
              </div>
              {importPreview.modelNames.map((name, idx) => {
                const m = importPkg.models[idx];
                const icon =
                  m.builtinType === "Wall"
                    ? "🧱"
                    : m.builtinType === "Partition"
                      ? "🪟"
                      : m.builtinType === "Chair"
                        ? "🪑"
                        : m.builtinType === "Desk"
                          ? "🖥️"
                          : m.builtinType === "Desk2"
                            ? "📐"
                            : m.builtinType === "Light"
                              ? "💡"
                              : "📦";
                return (
                  <div
                    key={idx}
                    style={{
                      padding: "6px 0",
                      borderBottom:
                        idx < importPreview.modelNames.length - 1
                          ? "1px solid var(--border-weak)"
                          : "none",
                      fontSize: "12px",
                      color: "var(--text-secondary)",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span>{icon}</span>
                    <span className="comm-flex-1">{name}</span>
                    <span
                      style={{
                        fontSize: "10px",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: m.isMoveEnabled
                          ? "rgba(34,197,94,0.1)"
                          : "rgba(249,115,22,0.08)",
                        color: m.isMoveEnabled ? "#16a34a" : "#f97316",
                      }}
                    >
                      {m.isMoveEnabled ? "Unlocked" : "Locked"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Schema info */}
            <div
              className="comm-text-tertiary-sm comm-mb-20"
            >
              Schema v{importPkg.schemaVersion} · exported{" "}
              {new Date(importPkg.exportedAt).toLocaleString()}
            </div>

            {/* Actions */}
            <div className="comm-flex-gap-10">
              <button
                className={`comm-btn-primary ${isImporting ? "waiting" : ""}`}
                disabled={isImporting}
                onClick={handleConfirmImport}
              >
                {isImporting
                  ? "Importing..."
                  : `Import ${importPreview.totalCount} Model(s)`}
              </button>
              <button
                className="comm-btn-secondary"
                onClick={handleCancelImport}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

interface ModelPropertiesProps {
  model: ImportedModel;
  onUpdate: (updates: Partial<Omit<ImportedModel, "id">>) => void;
  onDelete: () => void;
}

/** Helper to update a single wall param field */
const updateWallParam = (
  model: ImportedModel,
  onUpdate: ModelPropertiesProps["onUpdate"],
  field: keyof WallParams,
  value: number | string,
) => {
  const current = model.wallParams ?? DEFAULT_WALL_PARAMS;
  onUpdate({ wallParams: { ...current, [field]: value } });
};

/** Helper to update a single partition param field */
const updatePartitionParam = (
  model: ImportedModel,
  onUpdate: ModelPropertiesProps["onUpdate"],
  field: keyof PartitionParams,
  value: PartitionParams[keyof PartitionParams],
) => {
  const current = model.partitionParams ?? DEFAULT_PARTITION_PARAMS;
  onUpdate({ partitionParams: { ...current, [field]: value } });
};

/** Helper to update a single light param field */
const updateLightParam = (
  model: ImportedModel,
  onUpdate: ModelPropertiesProps["onUpdate"],
  field: keyof LightParams,
  value: number | string | boolean,
) => {
  const current = model.lightParams ?? DEFAULT_LIGHT_PARAMS;
  onUpdate({ lightParams: { ...current, [field]: value } });
};

const ModelProperties = ({
  model,
  onUpdate,
  onDelete,
}: ModelPropertiesProps) => {

  const numInput = (
    label: string,
    value: number,
    onChange: (v: number) => void,
    step = 0.1,
  ) => (
    <div
      className="comm-flex-col-4-flex1"
    >
      <span
        className="comm-label-sm-center"
      >
        {label}
      </span>
      <input
        type="number"
        value={Number(value.toFixed(3))}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="comm-input-center-sm"
      />
    </div>
  );

  const vec3Block = (
    label: string,
    values: [number, number, number],
    onChange: (v: [number, number, number]) => void,
    step = 0.1,
  ) => (
    <div className="comm-mb-16">
      <label
        className="comm-label-block"
      >
        {label}
      </label>
      <div className="comm-flex-gap-8">
        {numInput(
          "X",
          values[0],
          (v) => onChange([v, values[1], values[2]]),
          step,
        )}
        {numInput(
          "Y",
          values[1],
          (v) => onChange([values[0], v, values[2]]),
          step,
        )}
        {numInput(
          "Z",
          values[2],
          (v) => onChange([values[0], values[1], v]),
          step,
        )}
      </div>
    </div>
  );

  return (
    <div
      className="comm-panel-content-scrollable"
    >
      <div className="comm-mb-20">
        <input
          type="text"
          value={model.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Model Name"
          className="comm-input-title"
          onFocus={(e) =>
            (e.currentTarget.style.borderBottomColor = "var(--theme-primary)")
          }
          onBlur={(e) =>
            (e.currentTarget.style.borderBottomColor = "var(--border-weak)")
          }
        />
      </div>

      {vec3Block("Position", model.position, (v) => onUpdate({ position: v }))}
      {vec3Block(
        "Rotation (°)",
        [
          (model.rotation[0] * 180) / Math.PI,
          (model.rotation[1] * 180) / Math.PI,
          (model.rotation[2] * 180) / Math.PI,
        ],
        (v) =>
          onUpdate({
            rotation: [
              (v[0] * Math.PI) / 180,
              (v[1] * Math.PI) / 180,
              (v[2] * Math.PI) / 180,
            ],
          }),
        15,
      )}
      {vec3Block("Scale", model.scale, (v) => onUpdate({ scale: v }), 0.1)}

      {/* Wall-specific parametric controls */}
      {model.builtinType === "Wall" &&
        (() => {
          const wp = model.wallParams ?? DEFAULT_WALL_PARAMS;
          return (
            <div className="comm-mb-16">
              <label
                className="comm-label-block"
              >
                Wall Parameters
              </label>
              <div className="comm-flex-gap-8 comm-mb-8">
                {numInput(
                  "Height",
                  wp.height,
                  (v) =>
                    updateWallParam(
                      model,
                      onUpdate,
                      "height",
                      Math.max(0.1, v),
                    ),
                  0.5,
                )}
                {numInput(
                  "Length",
                  wp.length,
                  (v) =>
                    updateWallParam(
                      model,
                      onUpdate,
                      "length",
                      Math.max(0.1, v),
                    ),
                  0.5,
                )}
                {numInput(
                  "Thick",
                  wp.thickness,
                  (v) =>
                    updateWallParam(
                      model,
                      onUpdate,
                      "thickness",
                      Math.max(0.01, v),
                    ),
                  0.05,
                )}
              </div>
              <div
                className="comm-flex-center-8"
              >
                <span
                  className="comm-label-sm"
                >
                  COLOR
                </span>
                <input
                  type="color"
                  value={wp.color}
                  onChange={(e) =>
                    updateWallParam(model, onUpdate, "color", e.target.value)
                  }
                  className="comm-btn-icon-small"
                />
                <span
                  className="comm-text-tertiary-sm"
                >
                  {wp.color}
                </span>
              </div>
            </div>
          );
        })()}

      {/* Partition-specific parametric controls */}
      {model.builtinType === "Partition" &&
        (() => {
          const pp = model.partitionParams ?? DEFAULT_PARTITION_PARAMS;
          const isTransparent = pp.visibilityMode === "transparent";

          return (
            <div className="comm-mb-16">
              <label
                className="comm-label-block"
              >
                Partition Parameters
              </label>
              <div
                className="comm-flex-gap-8 comm-mb-12"
              >
                {numInput(
                  "Height",
                  pp.height,
                  (v) =>
                    updatePartitionParam(
                      model,
                      onUpdate,
                      "height",
                      Math.max(0.1, v),
                    ),
                  0.5,
                )}
                {numInput(
                  "Length",
                  pp.length,
                  (v) =>
                    updatePartitionParam(
                      model,
                      onUpdate,
                      "length",
                      Math.max(0.1, v),
                    ),
                  0.5,
                )}
                {numInput(
                  "Thick",
                  pp.thickness,
                  (v) =>
                    updatePartitionParam(
                      model,
                      onUpdate,
                      "thickness",
                      Math.max(0.01, v),
                    ),
                  0.05,
                )}
              </div>

              {/* Transparency Toggle */}
              <div className="comm-mb-12">
                <span
                  className="comm-label-sm-header"
                >
                  Transparency
                </span>
                <div className="comm-flex-gap-4">
                  <button
                    onClick={() =>
                      updatePartitionParam(
                        model,
                        onUpdate,
                        "visibilityMode",
                        "transparent",
                      )
                    }
                    className={`comm-btn-tab ${isTransparent ? "active" : "inactive"}`}
                  >
                    반투명
                  </button>
                  <button
                    onClick={() =>
                      updatePartitionParam(
                        model,
                        onUpdate,
                        "visibilityMode",
                        "opaque",
                      )
                    }
                    className={`comm-btn-tab ${!isTransparent ? "active" : "inactive"}`}
                  >
                    불투명
                  </button>
                </div>
              </div>

              <div
                className="comm-flex-center-8"
              >
                <span
                  className="comm-label-sm"
                >
                  COLOR
                </span>
                <input
                  type="color"
                  value={pp.color}
                  onChange={(e) =>
                    updatePartitionParam(
                      model,
                      onUpdate,
                      "color",
                      e.target.value,
                    )
                  }
                  className="comm-btn-icon-small"
                />
                <span
                  className="comm-text-tertiary-sm"
                >
                  {pp.color}
                </span>
              </div>
            </div>
          );
        })()}

      {/* Light-specific parametric controls */}
      {model.builtinType === "Light" &&
        (() => {
          const lp = model.lightParams ?? DEFAULT_LIGHT_PARAMS;
          return (
            <div className="comm-mb-16">
              <label
                className="comm-label-block"
              >
                Light Parameters
              </label>
              <div className="comm-flex-gap-8 comm-mb-12">
                {numInput(
                  "Intensity",
                  lp.intensity,
                  (v) =>
                    updateLightParam(
                      model,
                      onUpdate,
                      "intensity",
                      Math.max(0, v),
                    ),
                  0.1,
                )}
                {numInput(
                  "Shadow Res",
                  lp.shadowMapSize,
                  (v) => {
                    const clamped = Math.min(4096, Math.max(256, v));
                    updateLightParam(
                      model,
                      onUpdate,
                      "shadowMapSize",
                      clamped,
                    );
                  },
                  256,
                )}
              </div>

              {/* Shadow Toggle */}
              <div className="comm-mb-12">
                <span
                  className="comm-label-sm-header"
                >
                  Shadow
                </span>
                <div className="comm-flex-gap-4">
                  <button
                    onClick={() =>
                      updateLightParam(model, onUpdate, "castShadow", true)
                    }
                    className={`comm-btn-tab ${lp.castShadow ? "active" : "inactive"}`}
                  >
                    ON
                  </button>
                  <button
                    onClick={() =>
                      updateLightParam(model, onUpdate, "castShadow", false)
                    }
                    className={`comm-btn-tab ${!lp.castShadow ? "active" : "inactive"}`}
                  >
                    OFF
                  </button>
                </div>
              </div>

              {/* Color picker */}
              <div
                className="comm-flex-center-8"
              >
                <span
                  className="comm-label-sm"
                >
                  COLOR
                </span>
                <input
                  type="color"
                  value={lp.color}
                  onChange={(e) =>
                    updateLightParam(model, onUpdate, "color", e.target.value)
                  }
                  className="comm-btn-icon-small"
                />
                <span
                  className="comm-text-tertiary-sm"
                >
                  {lp.color}
                </span>
              </div>
            </div>
          );
        })()}

      <div
        className="comm-mt-24 comm-flex-col-10"
      >
        <button
          className="comm-btn"
          style={{
            width: "100%",
            height: "36px",
            fontSize: "12px",
            fontWeight: 600,
            background: model.isMoveEnabled
              ? "rgba(34, 197, 94, 0.1)"
              : "rgba(249, 115, 22, 0.08)",
            color: model.isMoveEnabled ? "#16a34a" : "#ea580c",
            border: "1px solid",
            borderColor: model.isMoveEnabled
              ? "rgba(34, 197, 94, 0.3)"
              : "rgba(249, 115, 22, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
          onClick={() => useStore.getState().toggleModelMove(model.id)}
        >
          {model.isMoveEnabled ? "🔓 Move Enabled" : "🔒 Move Locked"}
        </button>

        <div className="comm-flex-gap-8">
          <button
            className="comm-btn"
            style={{
              flex: 1,
              height: "36px",
              fontSize: "12px",
              background: "rgba(128, 128, 128, 0.1)",
              border: "1px solid var(--border-medium)",
              color: "var(--text-primary)",
            }}
            onClick={() => {
              const { addImportedModel } = useStore.getState();

              const { id, ...modelData } = model;
              addImportedModel({
                ...modelData,
                name: `${modelData.name} (copy)`,
                position: [
                  modelData.position[0] + 0.5,
                  modelData.position[1],
                  modelData.position[2] + 0.5,
                ],
              });
            }}
          >
            Duplicate
          </button>
          <button
            className="comm-btn"
            style={{
              flex: 1,
              height: "36px",
              fontSize: "12px",
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              color: "#ef4444",
            }}
            onClick={onDelete}
          >
            Delete
          </button>
        </div>


      </div>
    </div>
  );
};
