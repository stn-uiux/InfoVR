import React, { useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { Scene } from "./components/Scene";
import { DevicePanel } from "./components/DevicePanel";
import { DashboardWidgets } from "./components/DashboardWidgets";
import { ThemeToggle } from "./components/ThemeToggle";
import { CyberSpaceToggle } from "./components/CyberSpaceToggle";
import { FocusCarousel } from "./components/FocusCarousel";
import { UnsavedChangesDialog } from "./components/UnsavedChangesDialog";
import { DeviceModal } from "./components/DeviceModal";
import { DeviceTooltip } from "./components/DeviceTooltip";
const ImportExportModal = React.lazy(() =>
  import("./components/ImportExportModal").then((m) => ({
    default: m.ImportExportModal,
  })),
);
const ModelImporter = React.lazy(() =>
  import("./components/ModelImporter").then((m) => ({
    default: m.ModelImporter,
  })),
);
const DeviceRegistrationModal = React.lazy(() =>
  import("./components/DeviceRegistrationModal").then((m) => ({
    default: m.DeviceRegistrationModal,
  })),
);
const ModelRegistrationModal = React.lazy(() =>
  import("./components/ModelRegistrationModal/ModelRegistrationModal").then((m) => ({
    default: m.ModelRegistrationModal,
  })),
);
import { useTheme } from "./contexts/ThemeContext";
import { useStore } from "./store/useStore";
import {
  sampleRacks,
  sampleRegisteredDevices,
  sampleNodes,
} from "./utils/sampleData";
import { createPortal } from "react-dom";
import { PortErrorSynchronizer } from "./components/PortErrorSynchronizer";

/* ---------- Device Delete Confirmation Modal (top-level, z=99999) ---------- */
const DeviceDeleteConfirmModal = () => {
  const confirm = useStore((s) => s.deviceDeleteConfirm);
  const setConfirm = useStore((s) => s.setDeviceDeleteConfirm);
  const removeRegisteredDevice = useStore((s) => s.removeRegisteredDevice);
  const setOpen = useStore((s) => s.setDeviceRegistrationModalOpen);

  if (!confirm) return null;

  const handleConfirm = () => {
    removeRegisteredDevice(confirm.id);
    setConfirm(null);
    setOpen(true); // ensure main modal stays open
  };

  const handleCancel = () => {
    setConfirm(null);
    setOpen(true); // ensure main modal stays open
  };

  return createPortal(
    <>
      <div
        onClick={handleCancel}
        className="comm-modal-overlay"
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className="comm-modal-dialog"
      >
        <p
          className="comm-modal-body-text"
        >
          <strong className="comm-text-primary">
            "{confirm.title}"
          </strong>
          {confirm.rackName
            ? `은(는) 「${confirm.rackName}」에 배치되어 있습니다. 삭제하시겠습니까?`
            : "을(를) 삭제하시겠습니까?"}
        </p>
        {confirm.rackName && (
          <div
            className="comm-modal-warning-box"
          >
            ⚠️ 삭제하면 현재 배치된 위치에서도 함께 제거됩니다.
          </div>
        )}
        <div
          className="comm-modal-actions"
        >
          <button
            className="comm-btn comm-btn-secondary comm-btn-pad"
            onClick={handleCancel}
          >
            취소
          </button>
          <button
            className="comm-btn comm-btn-destructive comm-btn-pad"
            onClick={handleConfirm}
          >
            삭제
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
};

/* ---------- Premium Toast Component ---------- */
const Toast = () => {
  const toast = useStore((s) => s.toast);
  if (!toast) return null;

  return createPortal(
    <div className={`toast-overlay ${toast.type}`}>
      <div className={`toast-card ${toast.type}`}>
        <div className="toast-icon">
          {toast.type === "success" ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
        </div>
        <span className="toast-message">{toast.message}</span>
      </div>
    </div>,
    document.body,
  );
};

function App() {
  const navigate = useNavigate();
  // Phase 2-A: 개별 셀렉터로 불필요 리렌더 방지
  const addRack = useStore((s) => s.addRack);
  const loadState = useStore((s) => s.loadState);
  const selectedRackId = useStore((s) => s.selectedRackId);
  const isEditMode = useStore((s) => s.isEditMode);
  const setEditMode = useStore((s) => s.setEditMode);
  const setImportExportModalRackId = useStore((s) => s.setImportExportModalRackId);
  const setDeviceRegistrationModalOpen = useStore((s) => s.setDeviceRegistrationModalOpen);
  const deviceRegistrationModalOpen = useStore((s) => s.deviceRegistrationModalOpen);
  const importExportModalRackId = useStore((s) => s.importExportModalRackId);
  const selectedDeviceId = useStore((s) => s.selectedDeviceId);
  const selectDevice = useStore((s) => s.selectDevice);
  const setPendingImportFile = useStore((s) => s.setPendingImportFile);
  const setModelRegistrationModalOpen = useStore((s) => s.setModelRegistrationModalOpen);
  const modelRegistrationModalOpen = useStore((s) => s.modelRegistrationModalOpen);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const saveChanges = useStore((s) => s.saveChanges);

  // Phase 2: isDirty — isEditMode가 아닐 때는 항상 false (비교 스킵)
  const racks = useStore((s) => s.racks);
  const importedModels = useStore((s) => s.importedModels);
  const nodes = useStore((s) => s.nodes);
  const _importDirty = useStore((s) => s._importDirty);
  const baselineRacks = useStore((s) => s.baselineRacks);
  const baselineModels = useStore((s) => s.baselineModels);
  const baselineNodes = useStore((s) => s.baselineNodes);
  const isDirty = useMemo(() => {
    // Keep these store slices as render triggers for getIsDirty().
    void racks;
    void importedModels;
    void nodes;
    void baselineRacks;
    void baselineModels;
    void baselineNodes;
    if (!isEditMode && !_importDirty) return false;
    return useStore.getState().getIsDirty();
  }, [isEditMode, _importDirty, racks, importedModels, nodes, baselineRacks, baselineModels, baselineNodes]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent shortcuts when typing in inputs/textareas
      const activeElem = document.activeElement;
      const isInput =
        activeElem instanceof HTMLInputElement ||
        activeElem instanceof HTMLTextAreaElement ||
        (activeElem as HTMLElement)?.isContentEditable;

      if (!isInput && (e.ctrlKey || e.metaKey)) {
        if (e.key === "z" || e.key === "Z") {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        } else if (e.key === "s" || e.key === "S") {
          e.preventDefault();
          if (useStore.getState().getIsDirty()) {
            saveChanges();
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, saveChanges]);

  const toolbarImportInputRef = useRef<HTMLInputElement>(null);

  const isModalOpen =
    deviceRegistrationModalOpen ||
    modelRegistrationModalOpen ||
    importExportModalRackId !== null ||
    selectedDeviceId !== null;

  const loadSample = () => {
    loadState(sampleRacks, undefined, sampleRegisteredDevices, sampleNodes);
  };

  const handleToolbarImportClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (toolbarImportInputRef.current) {
      toolbarImportInputRef.current.value = "";
      toolbarImportInputRef.current.click();
    }
  };

  const handleToolbarImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingImportFile(file);
      setDeviceRegistrationModalOpen(false);
      setImportExportModalRackId("all");
    }
  };

  return (
    <div className="comm-app-container">
      {/* 3D Scene Layer */}
      <div
        className="comm-scene-container"
      >
        <Scene />
      </div>

      {/* UI Overlay Layer (Toolbar) */}
      <div
        className="comm-toolbar comm-toolbar-absolute"
      >
        {/* Logo Area */}
        <div className="comm-logo-container">
          <div className="comm-logo-circle">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
          </div>
          <div className="comm-logo-text-col">
            <h1 className="comm-logo-h1">ArcVRack</h1>
            <p className="comm-logo-p">3D Server Room Architecture</p>
          </div>
        </div>



        {isEditMode && (
          <>
            <div className="comm-toolbar-divider" />

            {/* Add Rack Consolidated */}
            <div className="comm-toolbar-group" style={{ gap: "4px" }}>
              <span
                className="comm-toolbar-label"
                style={{ fontSize: "11px", opacity: 0.8 }}
              >
                Std:
              </span>
              <button
                className="comm-btn comm-btn-md comm-btn-secondary comm-btn-compact"
                onClick={() => addRack(24)}
              >
                24
              </button>
              <button
                className="comm-btn comm-btn-md comm-btn-secondary comm-btn-compact"
                onClick={() => addRack(32)}
              >
                32
              </button>
              <button
                className="comm-btn comm-btn-md comm-btn-secondary comm-btn-compact"
                onClick={() => addRack(48)}
              >
                48
              </button>

              {/*
              <div
                className="comm-toolbar-divider"
                style={{ height: "16px", margin: "0 6px" }}
              />

              <span
                className="comm-toolbar-label"
                style={{ fontSize: "11px", opacity: 0.8 }}
              >
                Wide:
              </span>
              <button
                className="comm-btn comm-btn-md comm-btn-secondary comm-btn-compact"
                onClick={() => addRack(24, undefined, 1.0)}
              >
                24
              </button>
              <button
                className="comm-btn comm-btn-md comm-btn-secondary comm-btn-compact"
                onClick={() => addRack(32, undefined, 1.0)}
              >
                32
              </button>
              <button
                className="comm-btn comm-btn-md comm-btn-secondary comm-btn-compact"
                onClick={() => addRack(48, undefined, 1.0)}
              >
                48
              </button>
              */}
            </div>

            <div className="comm-toolbar-divider" />

            {/* Port Sentinel & Device Registration */}
            <button
              className="comm-btn comm-btn-md comm-btn-tertiary"
              onClick={() => navigate('/port-sentinel')}
              title="포트맵핑 마법사 - 하드웨어 포트 매핑 도구"
            >
              포트맵핑 마법사 <Icon icon="mdi:magic" />
            </button>

            <button
              className="comm-btn comm-btn-md comm-btn-primary"
              onClick={(e) => {
                e.stopPropagation();
                // Close other modals
                setImportExportModalRackId(null);
                setDeviceRegistrationModalOpen(true);
              }}
              title="장비 관리"
            >
              <Icon icon="material-symbols:archive" className="icon" />
              장비
            </button>

            <button
              className="comm-btn comm-btn-md comm-btn-secondary"
              onClick={(e) => {
                e.stopPropagation();
                setModelRegistrationModalOpen(true);
              }}
              title="장비 모델 관리"
            >
              모델 관리
            </button>

            <div className="comm-toolbar-divider" />

            {/* Unified Room Operations */}
            <div className="comm-toolbar-group">
              <button
                className="comm-btn comm-btn-md comm-btn-secondary"
                onClick={() => {
                  setDeviceRegistrationModalOpen(false);
                  setImportExportModalRackId("all");
                }}
                title="Export Room Data"
              >
                <Icon icon="material-symbols:upload" className="icon" />
                Export
              </button>
              <button
                className="comm-btn comm-btn-md comm-btn-secondary"
                title="Import Room Data"
                onClick={handleToolbarImportClick}
              >
                <Icon icon="material-symbols:download" className="icon" />
                Import
              </button>
              <input
                type="file"
                ref={toolbarImportInputRef}
                className="comm-hidden"
                accept=".xlsx"
                onChange={handleToolbarImportFile}
              />

              <div
                className="comm-toolbar-divider"
                style={{ height: "20px", margin: "0 8px" }}
              />

              <button
                className={`comm-btn comm-btn-md ${isDirty ? "comm-btn-primary" : "comm-btn-secondary"}`}
                onClick={saveChanges}
                disabled={!isDirty}
                title={isDirty ? "Save Unsaved Changes" : "No Changes to Save"}
                style={{
                  opacity: isDirty ? 1 : 0.5,
                  cursor: isDirty ? "pointer" : "not-allowed",
                  transition: "all 0.2s ease",
                }}
              >
                <Icon icon="material-symbols:save" className="icon" />
                Save
              </button>

              <button
                className="comm-btn comm-btn-md comm-btn-tertiary"
                onClick={loadSample}
              >
                <Icon icon="fluent:sparkle-28-filled" /> Sample
              </button>
              <button
                className="comm-btn comm-btn-md comm-btn-tertiary"
                onClick={() => {
                  if (confirm("정말 모든 데이터를 초기화하시겠습니까?")) {
                    localStorage.removeItem("server-room-storage");
                    try {
                      indexedDB.deleteDatabase("server-room-db");
                    } catch (_e) { }
                    window.location.reload();
                  }
                }}
                style={{ color: "var(--severity-critical)" }}
              >
                초기화
              </button>
            </div>
          </>
        )}

        {/* Right Controls */}
        <div className="comm-toolbar-right">
          {/* Edit Mode Toggle */}
          <div
            className={`stn-mode-indicator ${isEditMode ? "active" : ""}`}
            onClick={() => setEditMode(!isEditMode)}

          >
            <div
              className={`comm-status-dot ${isEditMode ? "comm-status-dot-active" : "comm-status-dot-inactive"}`}
            />
            <span
              style={{
                fontWeight: 700,
                fontSize: "var(--font-size-sm)",
                lineHeight: 1,
                color: isEditMode
                  ? "var(--severity-success-text)"
                  : "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
              }}
            >
              {isEditMode ? "Edit Mode: ON" : "Edit Mode: OFF"}
            </span>
          </div>

          <CyberSpaceToggle />
          <ThemeToggle />
        </div>
      </div>

      {/* Dashboard Widgets (shown when no rack is selected and no modal is open) */}
      {!selectedRackId && !isModalOpen && !isEditMode && <DashboardWidgets />}

      {/* Side Panel */}
      {selectedRackId && <DevicePanel />}

      {/* Phase 5: Device Modal — 선택 시에만 마운트 (SVG 캐시는 모듈 레벨) */}
      {selectedDeviceId && (
        <DeviceModal
          deviceId={selectedDeviceId}
          onClose={() => selectDevice(null)}
        />
      )}

      {/* Global Import/Export Modal */}
      {importExportModalRackId !== null && (
        <React.Suspense fallback={null}>
          <ImportExportModal />
        </React.Suspense>
      )}

      {/* Device Registration Modal */}
      {deviceRegistrationModalOpen && (
        <React.Suspense fallback={null}>
          <DeviceRegistrationModal />
        </React.Suspense>
      )}

      {/* Model Registration Modal */}
      <React.Suspense fallback={null}>
        <ModelRegistrationModal />
      </React.Suspense>

      {/* Device Delete Confirm Modal - top-level, always above everything */}
      <DeviceDeleteConfirmModal />

      {/* 3D Model Importer & Hierarchy Tree (Tree is always visible, importer is Edit Mode only) */}
      <React.Suspense fallback={null}>
        <ModelImporter />
      </React.Suspense>

      {/* Rack Navigation Carousel (Normal Mode) */}
      <FocusCarousel />

      <UnsavedChangesDialog />

      {/* 2D UI Overlay - Fit to Models (Fixed next to Gizmo) */}
      <FitToModelsButton />

      <DeviceTooltip />
      <Toast />
      <PortErrorSynchronizer />
    </div>
  );
}

const FitToModelsButton = () => {
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const fitToScene = useStore((s) => s.fitToScene);
  const selectedRackId = useStore((s) => s.selectedRackId);
  const isEditMode = useStore((s) => s.isEditMode);
  const deviceRegistrationModalOpen = useStore((s) => s.deviceRegistrationModalOpen);
  const importExportModalRackId = useStore((s) => s.importExportModalRackId);
  const selectedDeviceId = useStore((s) => s.selectedDeviceId);

  if (selectedRackId) return null;

  const isModalOpen =
    deviceRegistrationModalOpen ||
    importExportModalRackId !== null ||
    selectedDeviceId !== null;

  const showDashboardWidgets = !isModalOpen && !isEditMode;
  const rightPosition = showDashboardWidgets ? "380px" : "40px";

  return (
    <div
      style={{
        position: "absolute",
        top: "240px",
        right: rightPosition,
        transition: "right 0.2s ease-out",
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
        width: "80px",
      }}
    >
      <button
        className="comm-btn comm-btn-secondary"
        onClick={(e) => {
          e.stopPropagation();
          fitToScene();
        }}
        title="모든 모델을 화면에 맞춤 (Fit All Models)"
        style={{
          width: "42px",
          height: "42px",
          padding: 0,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: isDarkMode ? "#2A3342" : "#ffffff",
          border: `1px solid ${isDarkMode ? "#526484" : "#dbdfea"}`,
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          color: isDarkMode ? "#ffffff" : "#111827",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.05)";
          e.currentTarget.style.borderColor = "#3b82f6";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.borderColor = isDarkMode
            ? "#526484"
            : "#dbdfea";
        }}
      >
        <Icon icon="material-symbols:fullscreen" className="icon" style={{ width: "22px", height: "22px" }} />
      </button>
      <span
        style={{
          fontSize: "10px",
          fontWeight: 800,
          color: isDarkMode ? "#ffffff" : "#364a63",
          textShadow: isDarkMode
            ? "0 1px 2px rgba(0,0,0,0.8)"
            : "0 1px 2px rgba(255,255,255,0.8)",
          pointerEvents: "none",
          background: isDarkMode
            ? "rgba(42,51,66,0.9)"
            : "rgba(255,255,255,0.9)",
          padding: "2px 8px",
          borderRadius: "12px",
          whiteSpace: "nowrap",
          border: `1px solid ${isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)"}`,
          letterSpacing: "0.02em",
        }}
      >
        FIT MODELS
      </span>
    </div>
  );
};

export default App;
