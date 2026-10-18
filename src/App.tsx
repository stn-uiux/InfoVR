import React, { useRef, useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { Loader, useProgress } from "@react-three/drei";
import { Scene } from "./components/3d/Scene";
import { DevicePanel } from "./components/device/DevicePanel";
import { DashboardWidgets } from "./components/layout/DashboardWidgets";
import { ThemeToggle } from "./components/ui/ThemeToggle";
import { LowSpecToggle } from "./components/ui/LowSpecToggle";
import { CyberSpaceToggle } from "./components/layout/CyberSpaceToggle";
import { CyberSpaceControlPanel } from "./components/layout/CyberSpaceControlPanel";
import { FocusCarousel } from "./components/layout/FocusCarousel";
import { UnsavedChangesDialog } from "./components/system/UnsavedChangesDialog";
import { DeviceModal } from "./components/device/DeviceModal";
import { DeviceTooltip } from "./components/device/DeviceTooltip";
import { InitialLoader } from "./components/layout/InitialLoader";
import { ModeTransitionOverlay } from "./components/layout/ModeTransitionOverlay";
import { ThemeTransitionOverlay } from "./components/layout/ThemeTransitionOverlay";
import { DataTransitionOverlay } from "./components/layout/DataTransitionOverlay";
import { SettingsDropdown } from "./components/layout/SettingsDropdown";
const ImportExportModal = React.lazy(() =>
  import("./components/system/ImportExportModal").then((m) => ({
    default: m.ImportExportModal,
  })),
);
const ModelImporter = React.lazy(() =>
  import("./components/3d/ModelImporter").then((m) => ({
    default: m.ModelImporter,
  })),
);
const DeviceRegistrationModal = React.lazy(() =>
  import("./components/device/DeviceRegistrationModal").then((m) => ({
    default: m.DeviceRegistrationModal,
  })),
);
const ModelRegistrationModal = React.lazy(() =>
  import("./components/model/ModelRegistrationModal/ModelRegistrationModal").then((m) => ({
    default: m.ModelRegistrationModal,
  })),
);
import { MyPageModal } from "./components/account/MyPageModal";
import { AccountPermissionsModal } from "./components/account/AccountPermissionsModal";
import { CctvMappingModal } from "./components/cctv/CctvMappingModal";
import { CctvLiveModal } from "./components/cctv/CctvLiveModal";
import { ThermoHygroMappingModal } from "./components/thermo-hygro/ThermoHygroMappingModal";
import { ThermoHygroDetailModal } from "./components/thermo-hygro/ThermoHygroDetailModal";
import "./css/cctv.css";
import { useTheme } from "./contexts/ThemeContext";
import { useStore } from "./store/useStore";
import { useComposerTaskProgress } from "./hooks/useSvgComposer";
import {
  sampleRacks,
  sampleRegisteredDevices,
  sampleNodes,
} from "./utils/sampleData";
import { createPortal } from "react-dom";
import { PortErrorSynchronizer } from "./components/device/PortErrorSynchronizer";
import { usePreloadThumbnails } from "./hooks/usePreloadThumbnails";
import logoLightFull from "./assets/logo/InfoVR_light_full.svg";
import logoDarkFull from "./assets/logo/InfoVR_dark_full.svg";
import { exportRoomLayoutJson, importRoomLayoutJson } from "./utils/roomLayoutStorage";
import layoutSTN from "./assets/layout_STN.json";
import { resolveDeviceType } from "./utils/deviceTemplates";

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

/* ---------- Docs Dropdown Component (숨김 처리) ---------- */
// const DocsDropdown = () => {
//   const [isOpen, setIsOpen] = useState(false);
//   return (
//     <div className="docs-dropdown-container">
//       ...
//     </div>
//   );
// };

/* ---------- Import/Export Dropdown Component (우측 하단) ---------- */
const ImportExportDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const nodes = useStore((s) => s.nodes);
  const activeNodeId = useStore((s) => s.activeNodeId);
  const setImportExportModalRackId = useStore((s) => s.setImportExportModalRackId);
  const setDeviceRegistrationModalOpen = useStore((s) => s.setDeviceRegistrationModalOpen);
  const setPendingImportFile = useStore((s) => s.setPendingImportFile);

  const activeNode = nodes.find((n) => n.nodeId === activeNodeId);
  const isRoomNode = activeNode?.type === "room";

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);

  const handleExcelExport = () => {
    setIsOpen(false);
    setDeviceRegistrationModalOpen(false);
    setImportExportModalRackId("all");
  };

  const handleExcelImportClick = () => {
    setIsOpen(false);
    if (excelInputRef.current) {
      excelInputRef.current.value = "";
      excelInputRef.current.click();
    }
  };

  const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingImportFile(file);
      setDeviceRegistrationModalOpen(false);
      setImportExportModalRackId("all");
    }
  };

  const handleJsonExport = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    if (activeNodeId) {
      exportRoomLayoutJson(activeNodeId, useStore.getState());
    }
  };

  const handleJsonImportClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    if (jsonInputRef.current) {
      jsonInputRef.current.value = "";
      jsonInputRef.current.click();
    }
  };

  const handleJsonFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeNodeId) {
      importRoomLayoutJson(activeNodeId, file, useStore.getState());
    }
  };

  return (
    <div ref={containerRef} className="docs-dropdown-container">
      {isOpen && (
        <div className="docs-dropdown-menu" style={{ minWidth: "185px", padding: "8px" }}>
          <button
            type="button"
            className="docs-dropdown-item-btn"
            onClick={handleExcelExport}
            disabled={!isRoomNode}
            title={!isRoomNode ? "전산실을 선택해주세요" : "Excel 파일로 내보내기"}
          >
            <Icon icon="material-symbols:upload" style={{ fontSize: "18px", color: "#22c55e" }} />
            <span>Excel 내보내기</span>
          </button>
          <button
            type="button"
            className="docs-dropdown-item-btn"
            onClick={handleExcelImportClick}
            disabled={!isRoomNode}
            title={!isRoomNode ? "전산실을 선택해주세요" : "Excel 파일에서 가져오기"}
          >
            <Icon icon="material-symbols:download" style={{ fontSize: "18px", color: "#22c55e" }} />
            <span>Excel 가져오기</span>
          </button>

          <div style={{ height: "1px", background: "var(--color-border, #3f3f46)", margin: "4px 0" }} />

          <button
            type="button"
            className="docs-dropdown-item-btn"
            onClick={handleJsonExport}
            disabled={!isRoomNode}
            title={!isRoomNode ? "전산실을 선택해주세요" : "JSON 레이아웃으로 내보내기"}
          >
            <Icon icon="material-symbols:upload" style={{ fontSize: "18px", color: "#3b82f6" }} />
            <span>JSON 내보내기</span>
          </button>
          <button
            type="button"
            className="docs-dropdown-item-btn"
            onClick={handleJsonImportClick}
            disabled={!isRoomNode}
            title={!isRoomNode ? "전산실을 선택해주세요" : "JSON 레이아웃에서 가져오기"}
          >
            <Icon icon="material-symbols:download" style={{ fontSize: "18px", color: "#3b82f6" }} />
            <span>JSON 가져오기</span>
          </button>
        </div>
      )}

      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={excelInputRef}
        style={{ display: "none" }}
        accept=".xlsx"
        onChange={handleExcelFileChange}
      />
      <input
        type="file"
        ref={jsonInputRef}
        style={{ display: "none" }}
        accept=".json"
        onChange={handleJsonFileChange}
      />

      <button
        type="button"
        className="comm-btn comm-btn-md comm-btn-secondary docs-dropdown-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="데이터 관리"
      >
        <Icon icon="mdi:import-export" style={{ fontSize: "18px" }} />
        데이터 관리
        <Icon
          icon={isOpen ? "mdi:chevron-down" : "mdi:chevron-up"}
          style={{ marginLeft: "6px", fontSize: "18px" }}
        />
      </button>
    </div>
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
  const { theme } = useTheme();
  const isDarkMode = theme === "dark";
  const logoSrc = isDarkMode ? logoDarkFull : logoLightFull;

  const navigate = useNavigate();
  // Phase 2-A: 개별 셀렉터로 불필요 리렌더 방지
  const addRack = useStore((s) => s.addRack);
  const loadState = useStore((s) => s.loadState);
  const selectedRackId = useStore((s) => s.selectedRackId);
  const isEditMode = useStore((s) => s.isEditMode);
  const isModeTransitioning = useStore((s) => s.isModeTransitioning);
  const setIsEditMode = useStore((s) => s.setIsEditMode);
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
  const cyberSpaceEnabled = useStore((s) => s.cyberSpaceEnabled);

  // Phase 2: isDirty — isEditMode가 아닐 때는 항상 false (비교 스킵)
  const racks = useStore((s) => s.racks);
  const importedModels = useStore((s) => s.importedModels);
  const nodes = useStore((s) => s.nodes);
  const _importDirty = useStore((s) => s._importDirty);
  const baselineRacks = useStore((s) => s.baselineRacks);
  const baselineModels = useStore((s) => s.baselineModels);
  const baselineNodes = useStore((s) => s.baselineNodes);
  const nodeEnvironments = useStore((s) => s.nodeEnvironments);
  const isSyncingPorts = useStore((s) => s.isSyncingPorts);

  usePreloadThumbnails();

  const activeNodeId = useStore((s) => s.activeNodeId);
  const activeNode = nodes.find(n => n.nodeId === activeNodeId);
  const isRoomNode = activeNode?.type === "room";

  // Rack creation state
  const [selectedRackSize, setSelectedRackSize] = useState<string>("24-100");
  const [isRackBidirectional, setIsRackBidirectional] = useState<boolean>(false);

  const isDirty = useMemo(() => {
    // Keep these store slices as render triggers for getIsDirty().
    void racks;
    void importedModels;
    void nodes;
    void baselineRacks;
    void baselineModels;
    void baselineNodes;
    void nodeEnvironments;
    void isSyncingPorts;
    if (!isEditMode && !_importDirty) return false;
    return useStore.getState().getIsDirty();
  }, [isEditMode, _importDirty, racks, importedModels, nodes, baselineRacks, baselineModels, baselineNodes, nodeEnvironments, isSyncingPorts]);

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


  const isModalOpen =
    deviceRegistrationModalOpen ||
    modelRegistrationModalOpen ||
    importExportModalRackId !== null ||
    selectedDeviceId !== null;

  const { active, progress, total } = useProgress();
  const isCanvasReady = useStore((s) => s.isCanvasReady);
  const pendingComposerTasks = useComposerTaskProgress();

  // 3D 렌더링 및 썸네일 합성 등의 작업이 진행 중인지 여부
  const is3DLoading = !isCanvasReady || active || pendingComposerTasks > 0;

  // 최초 진입 시 room 노드가 없으면 layout_STN.json 자동 로드 (InitialLoader 사용하므로 중복 오버레이 방지)
  useEffect(() => {
    const state = useStore.getState();
    if (!state.nodes.some((n) => n.type === "room")) {
      state.loadDefaultLayout(false);
    }
  }, []);

  // 최초 진입 로딩이 완료되었는지 추적 (한 번 true가 되면 다시 false로 돌아가지 않음)
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  useEffect(() => {
    if (!initialLoadDone && isCanvasReady && !active && pendingComposerTasks === 0) {
      // 약간의 지연을 두고 설정 (InitialLoader와 동기화)
      const timer = setTimeout(() => setInitialLoadDone(true), 200);
      return () => clearTimeout(timer);
    }
  }, [initialLoadDone, isCanvasReady, active, pendingComposerTasks]);

  const toolbarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!toolbarRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        document.documentElement.style.setProperty('--header-height', `${entry.target.getBoundingClientRect().height}px`);
      }
    });
    observer.observe(toolbarRef.current);
    return () => observer.disconnect();
  }, []);

  const loadSample = () => {
    if (useStore.getState().isDataTransitioning) return;
    useStore.getState().setDataTransition(true, {
      type: "sample",
      badge: "SAMPLE DATA",
      title: "샘플 데이터 불러오는 중...",
      desc: "기본 랙 및 장비 배치 데이터를 구성하고 있습니다",
      icon: "fluent:sparkle-28-filled",
    });

    setTimeout(() => {
      loadState(sampleRacks, undefined, sampleRegisteredDevices, sampleNodes);
      setTimeout(() => {
        useStore.getState().setDataTransition(false, null);
      }, 500);
    }, 60);
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
        ref={toolbarRef}
        className="comm-toolbar comm-toolbar-absolute"
      >
        {/* Logo Area */}
        <div className="comm-logo-container">
          <img src={logoSrc} alt="InfoVR Logo" style={{ height: "32px", cursor: "pointer" }} onClick={() => navigate("/")} />
          {/* Mode Status Indicator Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 12px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: 800,
              letterSpacing: "0.03em",
              lineHeight: 1,
              userSelect: "none",
              background: isEditMode
                ? "rgba(16, 185, 129, 0.16)"
                : "rgba(59, 130, 246, 0.16)",
              border: `1px solid ${
                isEditMode
                  ? "rgba(16, 185, 129, 0.4)"
                  : "rgba(59, 130, 246, 0.4)"
              }`,
              color: isEditMode ? "#34d399" : "#60a5fa",
            }}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: isEditMode ? "#34d399" : "#60a5fa",
                boxShadow: isEditMode
                  ? "0 0 6px rgba(52, 211, 153, 0.8)"
                  : "0 0 6px rgba(96, 165, 250, 0.8)",
                display: "inline-block",
              }}
            />
            <span>{isEditMode ? "EDIT MODE" : "VIEW MODE"}</span>
          </div>
        </div>



        {isEditMode && (
          <>
            <div className="comm-toolbar-divider" />

            {/* Add Rack Consolidated */}
            <div className="comm-toolbar-group" style={{ gap: "4px", display: "flex", alignItems: "center" }}>
              <span className="comm-toolbar-label" style={{ fontSize: "11px", opacity: 0.8, marginRight: "4px" }}>
                랙 추가:
              </span>
              <select
                className="stn-input stn-input-md"
                style={{ width: "90px" }}
                value={selectedRackSize}
                onChange={(e) => setSelectedRackSize(e.target.value)}
              >
                <option value="24-30">24U 30</option>
                <option value="24-60">24U 60</option>
                <option value="24-75">24U 75</option>
                <option value="24-100">24U 100</option>
                <option value="24-120">24U 120</option>
                <option value="32-30">32U 30</option>
                <option value="32-60">32U 60</option>
                <option value="32-75">32U 75</option>
                <option value="32-100">32U 100</option>
                <option value="32-120">32U 120</option>
                <option value="48-30">48U 30</option>
                <option value="48-60">48U 60</option>
                <option value="48-75">48U 75</option>
                <option value="48-100">48U 100</option>
                <option value="48-120">48U 120</option>
              </select>

              {/*
              <select
                className="stn-input stn-input-md"
                style={{ width: "90px" }}
                value={isRackBidirectional ? "bidirectional" : "unidirectional"}
                onChange={(e) => setIsRackBidirectional(e.target.value === "bidirectional")}
              >
                <option value="unidirectional">단일방향</option>
                <option value="bidirectional">양방향</option>
              </select>
              */}

              <button
                className="comm-btn comm-btn-md comm-btn-primary comm-btn-compact"
                onClick={() => {
                  const [u, d] = selectedRackSize.split("-").map(Number);
                  addRack(u as 24 | 32 | 48, undefined, undefined, d as 60 | 80 | 100, isRackBidirectional);
                }}
              >
                추가
              </button>

            </div>

            <div className="comm-toolbar-divider" />

            {/* Port Sentinel & Device Registration */}
            <button
              className="comm-btn comm-btn-md comm-btn-tertiary stn-toolbar-nav-btn stn-toolbar-nav-btn--magic"
              onClick={() => window.open('/port-wizard', '_blank')}
              title="포트맵핑 마법사 새 창으로 열기"
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
              <Icon icon="mdi:server" className="icon" />
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


            <div
              className="comm-toolbar-divider"
              style={{ height: "20px", margin: "0 8px" }}
            />

            <div className="comm-toolbar-group">

              <button
                className={`comm-btn comm-btn-md ${isDirty && !(isSyncingPorts || is3DLoading) ? "comm-btn-primary" : "comm-btn-secondary"}`}
                onClick={saveChanges}
                disabled={!isDirty || isSyncingPorts || is3DLoading}
                title={isDirty ? "Save Unsaved Changes" : "No Changes to Save"}
                style={{
                  opacity: (isDirty && !(isSyncingPorts || is3DLoading)) ? 1 : 0.5,
                  cursor: (isDirty && !(isSyncingPorts || is3DLoading)) ? "pointer" : "not-allowed",
                  transition: "all 0.2s ease",
                }}
              >
                {isSyncingPorts || is3DLoading ? (
                  <>
                    <Icon icon="line-md:loading-twotone-loop" className="icon" />
                    배치 중...
                  </>
                ) : (
                  <>
                    <Icon icon="material-symbols:save" className="icon" />
                    저장
                  </>
                )}
              </button>

              <button
                className="comm-btn comm-btn-md comm-btn-tertiary"
                onClick={loadSample}
              >
                <Icon icon="fluent:sparkle-28-filled" /> 샘플 데이터
              </button>
              <button
                className="comm-btn comm-btn-md comm-btn-tertiary"
                onClick={() => {
                  if (confirm("정말 모든 데이터를 초기화하시겠습니까?\n(초기화 시 모든 데이터가 즉시 삭제됩니다.)")) {
                    useStore.getState().resetAllData();
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
          {isEditMode && !nodes.some(n => n.type === "room") && (
            <>
              <button
                className="comm-btn comm-btn-md comm-btn-secondary"
                onClick={() => {
                  useStore.getState().loadDefaultLayout(true);
                }}
                title="STN테스트베드 전산실 만들기"
              >
                <Icon icon="mdi:folder-download" />
                STN테스트베드
              </button>

              <button
                className="comm-btn comm-btn-md comm-btn-primary"
                onClick={() => {
                  const state = useStore.getState();
                  const rootNode = state.nodes.find(n => n.parentId === null);
                  if (rootNode) {
                    const siblings = state.nodes.filter(n => n.parentId === rootNode.nodeId);
                    const newId = state.addNode({
                      parentId: rootNode.nodeId,
                      name: "새 전산실",
                      type: "room",
                      order: siblings.length
                    });
                    state.setActiveNode(newId);
                    state.expandNodePath(newId);
                  }
                }}
                title="새 전산실 만들기"
              >
                <Icon icon="mdi:plus" />
                새 전산실
              </button>
            </>
          )}

          {/* Edit Mode Toggle Button */}
          <button
            type="button"
            className={`comm-btn comm-btn-md ${isEditMode ? "comm-btn-secondary" : "comm-btn-primary"}`}
            style={
              isModeTransitioning
                ? { opacity: 0.7, pointerEvents: "none" }
                : undefined
            }
            disabled={isModeTransitioning}
            onClick={() => setIsEditMode(!isEditMode)}
          >
            <Icon
              icon={isEditMode ? "mdi:logout" : "material-symbols:edit"}
              width="18"
              height="18"
            />
            <span>{isEditMode ? "나가기" : "편집"}</span>
          </button>

          {/* <CyberSpaceToggle /> */}
          <ThemeToggle />
          <LowSpecToggle />
          <SettingsDropdown />
        </div>
      </div>

      {cyberSpaceEnabled && <CyberSpaceControlPanel />}

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

      <MyPageModal />
      <AccountPermissionsModal />
      <UnsavedChangesDialog />

      {/* CCTV Modals */}
      <CctvLiveModal />
      <CctvMappingModal />

      {/* ThermoHygrometer Modals */}
      <ThermoHygroDetailModal />
      <ThermoHygroMappingModal />

      {/* 2D UI Overlay - Fit to Models (Fixed next to Gizmo) */}
      <FitToModelsButton />

      {/* Docs Links (숨김 처리) */}
      {/* <DocsDropdown /> */}

      {/* Import/Export Dropdown (우측 하단) */}
      <ImportExportDropdown />

      <DeviceTooltip />
      <Toast />
      <PortErrorSynchronizer />
      {/* drei Loader는 최초 진입 시에만 표시. 이후 샘플 데이터 등을 불러올 때는 암전 방지를 위해 숨김 */}
      {!initialLoadDone && <Loader />}

      {/* Initial Loading Screen */}
      <InitialLoader />

      {/* Edit Mode Transition Dimmed Loading Overlay */}
      <ModeTransitionOverlay />

      {/* Theme Transition Dimmed Loading Overlay */}
      <ThemeTransitionOverlay />

      {/* Room Change / Sample Data / STN Testbed Dimmed Loading Overlay */}
      <DataTransitionOverlay />
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
  const showDeviceLabels = useStore((s) => s.showDeviceLabels);
  const toggleShowDeviceLabels = useStore((s) => s.toggleShowDeviceLabels);

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
        gap: "14px",
        width: "80px",
      }}
    >
      {/* 1. 전체보기 버튼 */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
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
            transition: "all 0.15s ease",
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
          전체보기
        </span>
      </div>

      {/* 2. 기기보기 버튼 (CCTV 및 온습도계 이름표 툴팁 띄우기) */}
      {!isEditMode && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
          <button
            className="comm-btn comm-btn-secondary"
            onClick={(e) => {
              e.stopPropagation();
              toggleShowDeviceLabels();
            }}
            title={showDeviceLabels ? "기기 이름표 끄기" : "CCTV 및 온습도계 이름표 보기"}
            style={{
              width: "42px",
              height: "42px",
              padding: 0,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: showDeviceLabels
                ? "#2563eb"
                : isDarkMode
                  ? "#2A3342"
                  : "#ffffff",
              border: showDeviceLabels
                ? "1.5px solid #60a5fa"
                : `1px solid ${isDarkMode ? "#526484" : "#dbdfea"}`,
              boxShadow: showDeviceLabels
                ? "0 0 16px rgba(37, 99, 235, 0.6), 0 4px 12px rgba(0,0,0,0.3)"
                : "0 4px 12px rgba(0,0,0,0.2)",
              color: showDeviceLabels ? "#ffffff" : isDarkMode ? "#ffffff" : "#111827",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.05)";
              if (!showDeviceLabels) e.currentTarget.style.borderColor = "#3b82f6";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              if (!showDeviceLabels) {
                e.currentTarget.style.borderColor = isDarkMode ? "#526484" : "#dbdfea";
              }
            }}
          >
            <Icon icon="mdi:cctv" className="icon" style={{ width: "22px", height: "22px" }} />
          </button>
          <span
            style={{
              fontSize: "10px",
              fontWeight: 800,
              color: showDeviceLabels ? (isDarkMode ? "#93c5fd" : "#2563eb") : isDarkMode ? "#ffffff" : "#364a63",
              textShadow: isDarkMode
                ? "0 1px 2px rgba(0,0,0,0.8)"
                : "0 1px 2px rgba(255,255,255,0.8)",
              pointerEvents: "none",
              background: showDeviceLabels
                ? isDarkMode
                  ? "rgba(37, 99, 235, 0.3)"
                  : "rgba(37, 99, 235, 0.12)"
                : isDarkMode
                  ? "rgba(42,51,66,0.9)"
                  : "rgba(255,255,255,0.9)",
              padding: "2px 8px",
              borderRadius: "12px",
              whiteSpace: "nowrap",
              border: showDeviceLabels
                ? "1px solid rgba(96, 165, 250, 0.5)"
                : `1px solid ${isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)"}`,
              letterSpacing: "0.02em",
              transition: "all 0.2s ease",
            }}
          >
            기기보기
          </span>
        </div>
      )}
    </div>
  );
};

export default App;
