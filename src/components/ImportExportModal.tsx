import React, { useCallback, useRef, useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { useStore } from "../store/useStore";
import type { Rack, RegisteredDevice, HierarchyNode } from "../types";
import type { ExportScope } from "../utils/storage";
import { getNodeName, getAncestorPath, getNodeEquipmentCount, getSubtreeNodeIds } from "../utils/nodeUtils";
import {
  exportGroupWorkbook,
  importGroupPackage,
} from "../utils/storage";
import type { ExportRequest } from "../utils/storage";

export const ImportExportModal = () => {
  const {
    activeNodeId,
    registeredDevices,
    importExportModalRackId,
    setImportExportModalRackId,
    nodes,
    upsertNodes,
    showToast,
    setHierarchyCollapsed,
    pendingImportFile,
    setPendingImportFile,
  } = useStore();

  const [checkedNodes, setCheckedNodes] = useState<Set<string>>(new Set());
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Sync with activeNodeId when modal opens
  useEffect(() => {
    if (importExportModalRackId === "all") {
       if (activeNodeId) {
         const subtree = getSubtreeNodeIds(nodes, activeNodeId);
         const next = new Set<string>();
         next.add(activeNodeId);
         subtree.forEach(id => next.add(id));
         setCheckedNodes(next);
       } else {
         setCheckedNodes(new Set(nodes.map(n => n.nodeId)));
       }
       // 모든 노드를 기본적으로 펼치기
       setExpandedNodes(new Set(nodes.map(n => n.nodeId)));
    }
  }, [importExportModalRackId, activeNodeId, nodes]);

  const toggleNodeCheck = useCallback((nodeId: string, isChecked: boolean) => {
    setCheckedNodes((prev) => {
      const next = new Set(prev);
      const descendants = getSubtreeNodeIds(nodes, nodeId);
      if (isChecked) {
        next.add(nodeId);
        descendants.forEach(id => next.add(id));
        let currentId = nodes.find(n => n.nodeId === nodeId)?.parentId;
        while (currentId) {
          const siblings = nodes.filter(n => n.parentId === currentId);
          if (siblings.every(s => next.has(s.nodeId))) {
            next.add(currentId);
          }
          currentId = nodes.find(n => n.nodeId === currentId)?.parentId;
        }
      } else {
        next.delete(nodeId);
        descendants.forEach(id => next.delete(id));
        let currentId = nodes.find(n => n.nodeId === nodeId)?.parentId;
        while (currentId) {
          next.delete(currentId);
          currentId = nodes.find(n => n.nodeId === currentId)?.parentId;
        }
      }
      return next;
    });
  }, [nodes]);

  const [isExporting, setIsExporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [overwriteNodes, setOverwriteNodes] = useState(true);
  const [importPreview, setImportPreview] = useState<{
    fileName: string;
    nodes: HierarchyNode[];
    dataByNode: Record<
      string,
      { racks: Rack[]; registeredDevices: RegisteredDevice[] }
    >;
    exportScope: { type: "ALL" | "NODE"; nodeId?: string };
    effectiveScopeId: string | "ALL";
    nodeIdMap: Record<string, string>;
    ignoredCount: number;
  } | null>(null);

  const selectedNodeCounts = useMemo(() => {
    const allRacks: Rack[] = [];
    Object.values(useStore.getState().layouts).forEach(l => allRacks.push(...(l.racks || [])));

    const subtreeRacks = allRacks.filter(r => checkedNodes.has(r.mapId));
    const rackCount = subtreeRacks.length;
    
    const deviceCount = registeredDevices.filter(d => checkedNodes.has(d.deviceGroupId || '')).length;

    const portCount = subtreeRacks.reduce(
      (sum, r) => sum + (r.devices?.reduce((s, d) => s + (d.portStates?.length || 0), 0) || 0),
      0,
    );
    return { rackCount, deviceCount, portCount };
  }, [checkedNodes, registeredDevices]);

  const groupImportRef = useRef<HTMLInputElement>(null);

  // --- Handlers ---

  const handleGroupExport = async () => {
    if (isExporting) return;
    if (checkedNodes.size === 0) {
      showToast("내보낼 노드를 선택해주세요.", "error");
      return;
    }

    const isAll = checkedNodes.size === nodes.length;
    const request: ExportRequest = {
      requestId: crypto.randomUUID(),
      scopeId: isAll ? "ALL" : Array.from(checkedNodes),
      scopeLabel: isAll ? "전체" : "다중 선택 노드",
      exportedAt: new Date().toISOString(),
    };

    setIsExporting(true);
    try {
      // Aggregate all racks from all layouts to ensure full scope export
      const allRacks: Rack[] = [];
      Object.values(useStore.getState().layouts).forEach(l => {
        if (l.racks) allRacks.push(...l.racks);
      });

      // Small delay to ensure UI updates (disable button) before heavy work
      await new Promise((r) => setTimeout(r, 100));
      exportGroupWorkbook(allRacks, registeredDevices, nodes, request);
      showToast(`${request.scopeLabel} 내보내기 완료`, "success");
    } finally {
      setIsExporting(false);
    }
  };

  const handleGroupImportClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    setImportStatus(null);
    if (groupImportRef.current) {

      groupImportRef.current.value = "";
      groupImportRef.current.click();
    } else {
      console.error("[IEM] File input ref is null!");
    }
  };

  const handleGroupImportFile = useCallback(async (
    file: File,
  ) => {

    setImportStatus(`⏳ "${file.name}" 분석 중...`);

    try {
      // Decouple analysis from UI selection to prevent scope leakage.
      // Always analyze as "ALL" first to see what's in the file.
      const effectiveScope = "ALL";
      

      const result = await importGroupPackage(file, nodes, effectiveScope);
      const nodeCount = result.nodes.length;
      const totalRacksInFile = Object.values(result.dataByNode).reduce(
        (sum, n) => sum + n.racks.length,
        0,
      );
      const totalDevicesInFile = Object.values(result.dataByNode).reduce(
        (sum, n) => sum + n.registeredDevices.length,
        0,
      );

      if (nodeCount === 0 || (totalRacksInFile === 0 && totalDevicesInFile === 0)) {
        setImportStatus(`⚠️ 파일에서 유효한 데이터를 찾지 못했습니다. [제외됨: ${result.ignoredCount}건]`);
        return;
      }

      setImportPreview({
        fileName: file.name,
        nodes: result.nodes,
        dataByNode: result.dataByNode,
        exportScope: result.exportScope,
        effectiveScopeId: result.effectiveScopeId,
        nodeIdMap: result.nodeIdMap,
        ignoredCount: result.ignoredCount,
      });
      setImportStatus(null);
    } catch (err) {
      setImportStatus(`❌ 파일 분석 실패: ${(err as Error).message}`);
    }
  }, [nodes]);

  // Auto-trigger analysis if file was provided via toolbar
  const processedFileRef = useRef<File | null>(null);
  useEffect(() => {
    if (pendingImportFile && importExportModalRackId === "all" && pendingImportFile !== processedFileRef.current) {
      processedFileRef.current = pendingImportFile;
      handleGroupImportFile(pendingImportFile);
      setPendingImportFile(null); // Clear after starting
    }
  }, [pendingImportFile, importExportModalRackId, handleGroupImportFile, setPendingImportFile]);

  const handleApplyImport = () => {
    if (!importPreview) return;
    setImportStatus("⏳ 데이터 적용 중...");

    try {
      const { nodes: importedRawNodes, dataByNode, nodeIdMap } = importPreview;

      // 1. Determine Scope from File Metadata
      const isNodeImport = importPreview.exportScope.type === "NODE";
      
      // 2. Remap Node Hierarchy to Final System IDs
      const finalNodes = importedRawNodes.map(n => ({
        ...n,
        nodeId: nodeIdMap[n.nodeId] || n.nodeId,
        parentId: n.parentId ? (nodeIdMap[n.parentId] || n.parentId) : null
      }));

      // 3. Remap entity data using the same mapping
      const remappedByNode: Record<
        string,
        { racks: Rack[]; registeredDevices: RegisteredDevice[] }
      > = {};
      
      Object.entries(dataByNode).forEach(([nid, nodeData]) => {
        const finalNid = nodeIdMap[nid] || nid;
        if (!remappedByNode[finalNid]) {
          remappedByNode[finalNid] = { racks: [], registeredDevices: [] };
        }
        remappedByNode[finalNid].racks.push(
          ...nodeData.racks.map((r) => ({ ...r, mapId: finalNid })),
        );
        remappedByNode[finalNid].registeredDevices.push(
          ...nodeData.registeredDevices.map((d) => ({ ...d, deviceGroupId: finalNid })),
        );
      });

      // 4. PREPARE HIERARCHY: Dry run to get mapping and updated nodes array
      const { mapping: upsertMapping, updatedNodes: nextNodes } = upsertNodes(finalNodes, overwriteNodes, true);

      // 5. REMAP ENTITIES: Link racks/devices to final system node IDs
      const finalRemapped: typeof remappedByNode = {};
      Object.entries(remappedByNode).forEach(([nid, nodeData]) => {
        const systemNid = upsertMapping[nid] || nid;
        if (!finalRemapped[systemNid]) {
          finalRemapped[systemNid] = { racks: [], registeredDevices: [] };
        }
        finalRemapped[systemNid].racks.push(
          ...nodeData.racks.map(r => ({ ...r, mapId: systemNid })),
        );
        finalRemapped[systemNid].registeredDevices.push(
          ...nodeData.registeredDevices.map(d => ({ ...d, deviceGroupId: systemNid })),
        );
      });

      // 6. BUILD STATE UPDATES: Prepare updated layouts and registered devices list
      const prevState = useStore.getState();
      const updatedLayouts = { ...prevState.layouts };
      let updatedRegDevices = [...prevState.registeredDevices];
      
      Object.entries(finalRemapped).forEach(([nodeId, nodeData]) => {
        // Replace registered devices for imported nodes
        updatedRegDevices = updatedRegDevices.filter(d => d.deviceGroupId !== nodeId);
        updatedRegDevices.push(...nodeData.registeredDevices);
        
        // Update layouts (preserve existing models)
        updatedLayouts[nodeId] = {
          racks: nodeData.racks,
          importedModels: updatedLayouts[nodeId]?.importedModels || []
        };
      });

      // 7. DETERMINE TARGET NODE: Where to focus after import
      let targetNodeId: string | null = null;
      if (isNodeImport && importPreview.exportScope.nodeId) {
        const rawNodeId = importPreview.exportScope.nodeId;
        const mappedId = nodeIdMap[rawNodeId] || rawNodeId;
        targetNodeId = upsertMapping[mappedId] || mappedId;
      } else {
        // Fallback: Pick first node that has racks
        targetNodeId = Object.entries(finalRemapped).find(([, data]) => data.racks.length > 0)?.[0] || null;
      }
      
      // Secondary fallback: if no racks but we have devices, pick first node with devices
      if (!targetNodeId) {
        targetNodeId = Object.entries(finalRemapped).find(([, data]) => data.registeredDevices.length > 0)?.[0] || null;
      }

      // 8. FINAL ATOMIC UPDATE: Apply everything to store in ONE go
      const targetLayout = targetNodeId ? (updatedLayouts[targetNodeId] || { racks: [], importedModels: [] }) : { racks: [], importedModels: [] };
      
      // Expand target node path before update
      if (targetNodeId) {
        useStore.getState().expandNodePath(targetNodeId);
      }

      useStore.setState((state) => ({
        nodes: nextNodes,
        layouts: updatedLayouts,
        racks: targetLayout.racks,
        importedModels: targetLayout.importedModels,
        registeredDevices: updatedRegDevices,
        activeNodeId: targetNodeId || state.activeNodeId,
        selectedRackId: null,
        focusedRackId: null,
        selectedDeviceId: null,
        // Sync baselines to current state to detect future changes
        baselineRacks: JSON.parse(JSON.stringify(targetLayout.racks)),
        baselineModels: JSON.parse(JSON.stringify(targetLayout.importedModels)),
        baselineNodes: JSON.parse(JSON.stringify(nextNodes)),
        _importDirty: true,
      }));

      // 9. UI FEEDBACK & CLEANUP
      if (targetNodeId) {
        setHierarchyCollapsed(false);
        setTimeout(() => {
          const selectedEl = document.querySelector(".tree-node.selected");
          selectedEl?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 150);
      }

      const totalRacks = Object.values(finalRemapped).reduce((sum, n) => sum + n.racks.length, 0);
      const totalDevices = Object.values(finalRemapped).reduce((sum, n) => sum + n.registeredDevices.length, 0);
      
      if (totalRacks === 0 && totalDevices === 0) {
        const failMsg = "⚠️ 가져온 데이터가 없습니다. (범위가 일치하지 않을 수 있습니다.)";
        setImportStatus(failMsg);
        showToast(failMsg, "error");
        return;
      }

      showToast(`✅ Import 완료! (${Object.keys(finalRemapped).length}개 노드: Racks ${totalRacks}개, Devices ${totalDevices}개)`, "success");
      setImportPreview(null);



      Object.keys(finalRemapped).forEach(nid => {
        useStore.getState().toggleNodeExpansion(nid, true);
      });
      setTimeout(() => {
         setImportExportModalRackId(null);
      }, 500);
    } catch (err) {
      setImportStatus(`❌ 적용 실패: ${(err as Error).message}`);
    }
  };


  const renderExportTree = (parentId: string | null = null, depth = 0) => {
    const children = nodes
      .filter((n) => n.parentId === parentId)
      .sort((a, b) => a.order - b.order);
    if (children.length === 0) return null;

    return children.map((node) => {
      const isExpanded = expandedNodes.has(node.nodeId);
      const isChecked = checkedNodes.has(node.nodeId);
      const subChildren = nodes.filter((n) => n.parentId === node.nodeId);
      const hasChildren = subChildren.length > 0;

      return (
        <React.Fragment key={node.nodeId}>
          <div
            className={`tree-node ${isChecked ? "selected" : ""}`}
            style={{ paddingLeft: `${depth * 16 + 12}px` }}
            onClick={() => toggleNodeCheck(node.nodeId, !isChecked)}
            title={node.name}
          >
            <span
              className={`tree-node-toggle ${isExpanded ? "expanded" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setExpandedNodes((prev) => {
                  const next = new Set(prev);
                  if (next.has(node.nodeId)) next.delete(node.nodeId);
                  else next.add(node.nodeId);
                  return next;
                });
              }}
              style={{ visibility: hasChildren ? "visible" : "hidden" }}
            >
              <svg
                viewBox="0 0 24 24"
                width="10"
                height="10"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </span>
            <span style={{ fontSize: "16px", flexShrink: 0, display: "flex", alignItems: "center", marginRight: "4px" }}>
              <input 
                type="checkbox" 
                checked={isChecked} 
                onChange={(e) => {
                  e.stopPropagation();
                  toggleNodeCheck(node.nodeId, e.target.checked);
                }}
                onClick={(e) => e.stopPropagation()}
                style={{ marginRight: '6px' }} 
              />
              {node.type === "root" ? (
                <Icon icon="gis:network" className="icon" style={{ color: "var(--text-secondary)" }} />
              ) : node.type === "room" ? (
                <Icon icon="mdi:server" className="icon" style={{ color: "var(--theme-primary)" }} />
              ) : (
                <Icon icon="material-symbols:folder" className="icon" style={{ color: "var(--text-secondary)" }} />
              )}
            </span>
            <span className="node-name">{node.name}</span>
          </div>
          {isExpanded && renderExportTree(node.nodeId, depth + 1)}
        </React.Fragment>
      );
    });
  };

  const renderGlobalGroupContent = () => {
    return (
      <>
        {/* EXPORT SECTION */}
        <div className="options-group">
          <div className="group-header">
            <div className="group-title">
              <span>📤</span> 데이터 내보내기 범위 선택
            </div>
          </div>

          <div className="export-tree-container">
            {renderExportTree()}
          </div>

          <div className="export-selection-preview">
            <div className="export-breadcrumb">
              📍 Scope:{" "}
              {(() => {
                if (checkedNodes.size === nodes.length) return "전체 (전역 데이터)";
                const checkedGroupCount = nodes.filter(n => checkedNodes.has(n.nodeId) && n.type !== "room").length;
                const checkedRoomCount = nodes.filter(n => checkedNodes.has(n.nodeId) && n.type === "room").length;
                return `그룹 ${checkedGroupCount}개, 전산실 ${checkedRoomCount}개`;
              })()}
            </div>
            <div className="export-counts-row">
              <span>
                Racks: <strong>{selectedNodeCounts.rackCount}</strong>
              </span>
              <span>
                Devices: <strong>{selectedNodeCounts.deviceCount}</strong>
              </span>
              <span>
                Ports: <strong>{selectedNodeCounts.portCount}</strong>
              </span>
            </div>
          </div>

          <div className="export-helper-text">
            💡{" "}
            {checkedNodes.size === nodes.length
              ? "전체 노드의 모든 데이터(Racks & Devices)가 하나의 파일로 출력됩니다."
              : `선택한 노드 및 그 하위 노드(서버실 등)의 모든 데이터가 포함됩니다.`}
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              className="comm-btn comm-btn-lg comm-btn-primary"
              style={{
                flex: 1,
                boxShadow: "0 4px 12px rgba(var(--theme-primary-rgb), 0.25)",
                cursor: isExporting ? "not-allowed" : "pointer",
                opacity: isExporting ? 0.7 : 1,
              }}
              onClick={handleGroupExport}
              disabled={checkedNodes.size === 0 || isExporting}
            >
              {isExporting
                ? "생성 중.."
                : `🚀 Export ${checkedNodes.size === nodes.length ? "전체" : "선택 노드"}`}
            </button>
          </div>
        </div>


      </>
    );
  };

  if (!importExportModalRackId) return null;
  
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="comm-modal-overlay"
      style={{ zIndex: 2000 }}
      onClick={() => setImportExportModalRackId(null)}
    >
      <div
        className="comm-modal"
        style={{
          width: "520px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          borderTop: "4px solid var(--theme-primary)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="comm-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "20px" }}>💾</span>
            <h2 className="comm-modal-title">
              데이터 내보내기
            </h2>
          </div>
          <button
            className="comm-modal-close"
            onClick={() => setImportExportModalRackId(null)}
          >
            &times;
          </button>
        </div>
        <div className="comm-modal-content">
          {renderGlobalGroupContent()}
        </div>
      </div>
    </div>,
    document.body
  );
};
