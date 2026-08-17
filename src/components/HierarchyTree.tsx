import { Icon } from "@iconify/react";
import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import { useStore } from "../store/useStore";
import type { HierarchyNode } from "../types";
import {
  getChildren,
  getSubtreeEquipmentCount,
  getNodeEquipmentCount,
  getSubtreeDevices,
  isLeafNode,
} from "../utils/nodeUtils";
import { getHighestError } from "../utils/errorHelpers";



// ─── Tree Node Component ─────────────────────────────────────────────────────

interface TreeNodeItemProps {
  node: HierarchyNode;
  depth: number;
  nodes: HierarchyNode[];
  activeNodeId: string;
  collapsedIds: Set<string>;
  equipmentCounts: Map<string, number>;
  isEditMode: boolean;
  showEquipment: boolean;
  highlightedDeviceId: string | null;
  onToggle: (nodeId: string) => void;
  onSelect: (nodeId: string) => void;
  onContextMenu: (e: React.MouseEvent, nodeId: string) => void;
  // Drag and drop
  draggedNodeId: string | null;
  dragOverNodeId: string | null;
  onDragStart: (nodeId: string) => void;
  onDragOver: (
    e: React.DragEvent,
    nodeId: string,
    position: "before" | "after" | "inside",
  ) => void;
  onDragLeave: () => void;
  onDrop: (
    e: React.DragEvent,
    targetNodeId: string,
    position: "before" | "after" | "inside",
  ) => void;
  nodeSearch?: string;
}

import { layoutsEqual } from "../utils/comparison";

const NodeDirtyDot = ({ nodeId }: { nodeId: string }) => {
  const isDirty = useStore((s) => {
    // 1. check node itself
    const baseNode = s.baselineNodes?.find(n => n.nodeId === nodeId);
    const currNode = s.nodes.find(n => n.nodeId === nodeId);
    if (!baseNode || JSON.stringify(baseNode) !== JSON.stringify(currNode)) return true;

    // 2. check environment
    if (JSON.stringify(s.baselineNodeEnvironments?.[nodeId] || {}) !== JSON.stringify(s.nodeEnvironments[nodeId] || {})) return true;

    // 3. check layouts
    const baseLayout = s.baselineLayouts?.[nodeId];
    let currLayout = s.layouts[nodeId];
    if (s.activeSceneNodeId === nodeId) {
      currLayout = { racks: s.racks, importedModels: s.importedModels };
    }
    
    // If it's a group, layout might be undefined, which is fine
    if (currLayout) {
      if (!baseLayout || !layoutsEqual(baseLayout, currLayout)) return true;
    } else if (baseLayout) {
      return true; // was present, now undefined
    }

    return false;
  });

  if (!isDirty) return null;
  return <div style={{ 
    width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--severity-critical)', 
    position: 'absolute', top: -2, right: -2, zIndex: 2 
  }} />;
};

const TreeNodeItem = ({
  node,
  depth,
  nodes,
  activeNodeId,
  collapsedIds,
  equipmentCounts,
  isEditMode,
  showEquipment,
  highlightedDeviceId,
  onToggle,
  onSelect,
  onContextMenu,
  draggedNodeId,
  dragOverNodeId,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  nodeSearch,
}: TreeNodeItemProps) => {
  const pinnedNodeId = useStore((s) => s.pinnedNodeId);
  const setPinnedNode = useStore((s) => s.setPinnedNode);

  const children = getChildren(nodes, node.nodeId);
  const hasChildren = children.length > 0;
  const isExpanded = !collapsedIds.has(node.nodeId);
  const isSelected = activeNodeId === node.nodeId;
  const count = equipmentCounts.get(node.nodeId) || 0;

  const [dropPos, setDropPos] = useState<"before" | "after" | "inside" | null>(
    null,
  );

  const handleDragOver = (e: React.DragEvent) => {
    if (!isEditMode || draggedNodeId === node.nodeId) return;
    e.preventDefault();

    // Safety: Cannot drop on own children
    const getDescendantIds = (id: string): string[] => {
      const children = nodes.filter((n) => n.parentId === id);
      return [id, ...children.flatMap((c) => getDescendantIds(c.nodeId))];
    };
    if (
      draggedNodeId &&
      getDescendantIds(draggedNodeId).includes(node.nodeId)
    ) {
      setDropPos(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const height = rect.height;

    let position: "before" | "after" | "inside";
    if (node.parentId === null) {
      // Root node only allows "inside"
      position = "inside";
    } else if (relativeY < height * 0.25) {
      position = "before";
    } else if (relativeY > height * 0.75) {
      position = "after";
    } else {
      position = "inside";
    }

    setDropPos(position);
    onDragOver(e, node.nodeId, position);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!isEditMode || !dropPos) return;
    e.preventDefault();
    e.stopPropagation();
    onDrop(e, node.nodeId, dropPos);
    setDropPos(null);
  };

  const isMatch = nodeSearch && node.name.toLowerCase().includes(nodeSearch.toLowerCase());

  return (
    <div>
      <div
        className={`tree-node ${isSelected ? "selected" : ""} ${isMatch ? "match" : ""} ${draggedNodeId === node.nodeId ? "dragging" : ""
          } ${dropPos === "inside" ? "drop-target" : ""} ${dropPos === "before" ? "drop-before" : ""
          } ${dropPos === "after" ? "drop-after" : ""} ${pinnedNodeId === node.nodeId ? "has-pin" : ""
          }`}
        style={{ paddingLeft: `${4 + depth * 8}px` }}
        onClick={() => {
          if (node.type === "room") {
            onSelect(node.nodeId);
          } else {
            if (hasChildren) onToggle(node.nodeId);
          }
        }}
        onContextMenu={(e) => isEditMode && onContextMenu(e, node.nodeId)}
        // Drag and drop handlers
        draggable={isEditMode && node.parentId !== null}
        onDragStart={(e) => {
          if (!isEditMode) return;
          onDragStart(node.nodeId);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragOver={handleDragOver}
        onDragLeave={() => {
          setDropPos(null);
          onDragLeave();
        }}
        onDrop={handleDrop}
      >
        {/* Toggle arrow */}
        <span
          className={`tree-node-toggle ${isExpanded ? "expanded" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggle(node.nodeId);
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
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </span>

        {/* Icon */}
        <span className="tree-node-icon" style={{ position: 'relative' }}>
          {isEditMode && <NodeDirtyDot nodeId={node.nodeId} />}
          {node.type === "root" ? (
            <Icon icon="gis:network" className="icon"
              style={{ color: isSelected ? "var(--theme-primary)" : "var(--text-secondary)" }}
            />
          ) : node.type === "room" ? (
            <Icon icon="mdi:server" className="icon"
              style={{ color: isSelected ? "var(--theme-primary)" : "var(--text-secondary)" }}
            />
          ) : (
            <Icon icon="material-symbols:folder" className="icon"
              style={{ color: isSelected ? "var(--theme-primary)" : "var(--text-secondary)" }}
            />
          )}
        </span>

        {/* Name */}
        <span className="tree-node-name">
          {(() => {
            if (!nodeSearch) return node.name;
            const idx = node.name.toLowerCase().indexOf(nodeSearch.toLowerCase());
            if (idx === -1) return node.name;
            return (
              <>
                {node.name.slice(0, idx)}
                <mark className="search-highlight">
                  {node.name.slice(idx, idx + nodeSearch.length)}
                </mark>
                {node.name.slice(idx + nodeSearch.length)}
              </>
            );
          })()}
        </span>

        {/* Rack count badge */}
        {count > 0 && <span className="tree-node-count">{count}</span>}
        {/* Pin button (only for rooms) */}
        {node.type === "room" && (
          <button
            className={`tree-node-pin ${pinnedNodeId === node.nodeId ? "pinned" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              if (pinnedNodeId === node.nodeId) setPinnedNode(null);
              else setPinnedNode(node.nodeId);
            }}
            title={pinnedNodeId === node.nodeId ? "고정 해제" : "메인 전산실로 고정"}
          >
            <Icon icon="mynaui:pin-solid" className="icon icon comm-icon-sm" style={{ color: pinnedNodeId === node.nodeId ? "var(--theme-primary)" : "var(--text-tertiary)" }} />
          </button>
        )}
      </div>

      {/* Children */}
      {isExpanded && (
        <>
          {children.map((child) => (
            <TreeNodeItem
              key={child.nodeId}
              node={child}
              depth={depth + 1}
              nodes={nodes}
              activeNodeId={activeNodeId}
              collapsedIds={collapsedIds}
              equipmentCounts={equipmentCounts}
              isEditMode={isEditMode}
              showEquipment={showEquipment}
              highlightedDeviceId={highlightedDeviceId}
              onToggle={onToggle}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
              draggedNodeId={draggedNodeId}
              dragOverNodeId={dragOverNodeId}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              nodeSearch={nodeSearch}
            />
          ))}
        </>
      )}
    </div>
  );
};

// ─── Main HierarchyTree Component ────────────────────────────────────────────

export const HierarchyTree = React.memo(() => {
  const nodes = useStore((s) => s.nodes);
  const activeNodeId = useStore((s) => s.activeNodeId);
  const setActiveNode = useStore((s) => s.setActiveNode);
  const pinnedNodeId = useStore((s) => s.pinnedNodeId);
  const collapsedNodeIds = useStore((s) => s.collapsedNodeIds);
  const toggleNodeExpansion = useStore((s) => s.toggleNodeExpansion);
  const expandNodePath = useStore((s) => s.expandNodePath);
  const isCollapsed = useStore((s) => s.isHierarchyCollapsed);
  const setIsCollapsed = useStore((s) => s.setHierarchyCollapsed);
  const racks = useStore((s) => s.racks);
  const isEditMode = useStore((s) => s.isEditMode);
  const addNode = useStore((s) => s.addNode);
  const renameNode = useStore((s) => s.renameNode);
  const deleteNode = useStore((s) => s.deleteNode);
  const showEquipment = useStore((s) => s.showEquipmentInTree);
  const setShowEquipment = useStore((s) => s.setShowEquipmentInTree);
  const highlightedDeviceId = useStore((s) => s.highlightedDeviceId);
  const locateDevice = useStore((s) => s.locateDevice);
  const showToast = useStore((s) => s.showToast);
  const registeredDevices = useStore((s) => s.registeredDevices);
  const layouts = useStore((s) => s.layouts);
  const reorderNode = useStore((s) => s.reorderNode);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string;
  } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOverNodeId, setDragOverNodeId] = useState<string | null>(null);
  const [nodeSearch, setNodeSearch] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Expand parents if searching
  useEffect(() => {
    if (nodeSearch.trim()) {
      const q = nodeSearch.toLowerCase();
      nodes.forEach((n) => {
        if (n.name.toLowerCase().includes(q)) {
          if (n.parentId) expandNodePath(n.parentId);
        }
      });
    }
  }, [nodeSearch, nodes, expandNodePath]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const close = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(".tree-context-menu")) return;
      setContextMenu(null);
    };
    window.addEventListener("click", close, { capture: true });
    return () => window.removeEventListener("click", close, { capture: true });
  }, [contextMenu]);

  // Focus rename input
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  // Calculate direct node equipment counts (ONLY devices directly in this node) - Optimized O(N)
  const equipmentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    registeredDevices.forEach((rd) => {
      if (rd.deviceGroupId) {
        counts.set(rd.deviceGroupId, (counts.get(rd.deviceGroupId) || 0) + 1);
      }
    });
    // Add "ALL" count
    counts.set("ALL", registeredDevices.length);
    return counts;
  }, [registeredDevices]);

  // Consolidated racks from all node layouts for accurate equipment mapping in parent nodes
  const allRacksForMapping = useMemo(() => {
    const fromLayouts = Object.entries(layouts)
      .filter(([nid]) => nid !== activeNodeId)
      .flatMap(([, l]) => l.racks || []);
    return [...fromLayouts, ...racks];
  }, [layouts, racks, activeNodeId]);

  const totalDeviceCount = useMemo(() => {
    if (!activeNodeId) return 0;
    return getSubtreeEquipmentCount(nodes, registeredDevices, activeNodeId);
  }, [nodes, activeNodeId, registeredDevices]);

  const deviceGroups = useMemo(() => {
    if (!activeNodeId) return [];
    // Key fix: Use allRacksForMapping instead of just current racks to find placements in descendant nodes
    const flat = getSubtreeDevices(
      nodes,
      activeNodeId,
      registeredDevices,
      allRacksForMapping,
    );

    // Grouping by actual nodeId
    const groups: Record<string, typeof flat> = {};
    flat.forEach((item) => {
      const nid = item.device.deviceGroupId || '';
      if (!groups[nid]) groups[nid] = [];
      groups[nid].push(item);
    });

    // Extract ordered list of groups based on node tree order
    const result: {
      nodeId: string;
      nodeName: string;
      devices: typeof flat;
    }[] = [];
    nodes.forEach((n) => {
      if (groups[n.nodeId]) {
        result.push({
          nodeId: n.nodeId,
          nodeName: n.name,
          devices: groups[n.nodeId],
        });
      }
    });

    return result;
  }, [nodes, activeNodeId, registeredDevices, allRacksForMapping]);

  const handleToggle = useCallback(
    (nodeId: string) => {
      toggleNodeExpansion(nodeId);
    },
    [toggleNodeExpansion],
  );

  const handleSelect = useCallback(
    (nodeId: string) => {
      if (renamingId) return;
      setActiveNode(nodeId);
    },
    [setActiveNode, renamingId],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      console.log("handleContextMenu triggered for node:", nodeId, "isEditMode:", isEditMode);
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, nodeId });
    },
    [isEditMode],
  );

  const handleDeviceClick = useCallback(
    (registeredDeviceId: string) => {
      const found = locateDevice(registeredDeviceId);
      if (!found) {
        showToast("배치되지 않은 장비입니다. 랙에 먼저 배치해주세요.", "error");
      }
    },
    [locateDevice, showToast],
  );

  const handleAddGroup = useCallback(() => {
    if (!contextMenu) return;
    const parentId = contextMenu.nodeId;
    const siblings = nodes.filter((n) => n.parentId === parentId);
    const newId = addNode({
      parentId,
      name: "New Group",
      type: "group",
      order: siblings.length,
    });
    setContextMenu(null);
    expandNodePath(newId);
    setActiveNode(newId);
    setRenamingId(newId);
    setRenameValue("New Group");
  }, [contextMenu, nodes, addNode, expandNodePath, setActiveNode]);

  const handleAddRoom = useCallback(() => {
    if (!contextMenu) return;
    const parentId = contextMenu.nodeId;
    const siblings = nodes.filter((n) => n.parentId === parentId);
    const newId = addNode({
      parentId,
      name: "New Room",
      type: "room",
      order: siblings.length,
    });
    setContextMenu(null);
    expandNodePath(newId);
    setActiveNode(newId);
    setRenamingId(newId);
    setRenameValue("New Room");
  }, [contextMenu, nodes, addNode, expandNodePath, setActiveNode]);

  const handleRenameStart = useCallback(() => {
    if (!contextMenu) return;
    const node = nodes.find((n) => n.nodeId === contextMenu.nodeId);
    if (node) {
      setRenamingId(node.nodeId);
      setRenameValue(node.name);
    }
    setContextMenu(null);
  }, [contextMenu, nodes]);

  const handleRenameConfirm = useCallback(() => {
    if (renamingId && renameValue.trim()) {
      renameNode(renamingId as string, renameValue.trim());
    }
    setRenamingId(null);
  }, [renamingId, renameValue, renameNode]);

  const handleDelete = useCallback(() => {
    if (!contextMenu) return;
    const node = nodes.find((n) => n.nodeId === contextMenu.nodeId);
    if (node && node.parentId !== null) {
      // Do not allow deleting root
      if (
        window.confirm(`"${node.name}" 노드와 하위 데이터를 삭제하시겠습니까?`)
      ) {
        deleteNode(node.nodeId);
      }
    }
    setContextMenu(null);
  }, [contextMenu, nodes, deleteNode]);

  // Drag and Drop handlers
  const handleDragStart = useCallback((nodeId: string) => {
    setDraggedNodeId(nodeId);
  }, []);

  const handleDragOver = useCallback(
    (
      e: React.DragEvent,
      nodeId: string,
    ) => {
      e.preventDefault();
      if (draggedNodeId === nodeId) return;
      setDragOverNodeId(nodeId);
    },
    [draggedNodeId],
  );

  const handleDragLeave = useCallback(() => {
    setDragOverNodeId(null);
  }, []);

  const handleDrop = useCallback(
    (
      e: React.DragEvent,
      targetNodeId: string,
      position: "before" | "after" | "inside",
    ) => {
      e.preventDefault();
      const sourceId = draggedNodeId;
      setDraggedNodeId(null);
      setDragOverNodeId(null);

      if (sourceId && sourceId !== targetNodeId) {
        reorderNode(sourceId, targetNodeId, position);
      }
    },
    [draggedNodeId, reorderNode],
  );

  // Auto-expand tree when activeNodeId changes from external sources (breadcrumb, search, etc.)
  useEffect(() => {
    if (activeNodeId) {
      expandNodePath(activeNodeId);
    }
  }, [activeNodeId, expandNodePath]);

  const rootNodes = getChildren(nodes, null);
  const hasAppliedPinnedDefault = useRef(false);

  useEffect(() => {
    if (hasAppliedPinnedDefault.current) return;
    if (!rootNodes.length) return;

    let firstRoomId: string | null = null;
    const findFirstRoom = (nodesList: HierarchyNode[]) => {
      for (const n of nodesList) {
        if (n.type === "room") {
          firstRoomId = n.nodeId;
          return true;
        }
        const children = getChildren(nodes, n.nodeId);
        if (findFirstRoom(children)) return true;
      }
      return false;
    };
    findFirstRoom(rootNodes);

    const defaultNodeId = pinnedNodeId || firstRoomId || rootNodes[0].nodeId;

    if (!activeNodeId) {
      setActiveNode(defaultNodeId);
      hasAppliedPinnedDefault.current = true;
      return;
    }

    const isDefaultRootSelection = rootNodes.some(
      (root) => root.nodeId === activeNodeId,
    );

    if (isDefaultRootSelection && activeNodeId !== defaultNodeId) {
      setActiveNode(defaultNodeId);
    }
    hasAppliedPinnedDefault.current = true;
  }, [pinnedNodeId, activeNodeId, rootNodes, nodes, setActiveNode]);

  return (
    <div className="tree-sidebar-container">
      <div
        className={`collapse-panel ${isCollapsed ? "collapsed" : "expanded"}`}
        style={{ flex: 1, height: "auto", minHeight: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="collapse-panel-header">
          <div
            className="comm-flex-center-10-flex1"
          >
            <span
              className="comm-flex-center-8-noshrink"
            >
              <span
                className="comm-icon-primary-lg"
              >
                <Icon icon="material-symbols:grid-view" className="icon comm-icon-md" />
              </span>
              <span className="tree-node-header-text">구조</span>
            </span>
            {/* breadcrumb preview removed when collapsed per request */}
          </div>

          <div className="tree-node-group-row">
            <div
              className="tree-toggle-item"
              onClick={(e) => e.stopPropagation()}
              title="장비 표시 토글"
            >
              <span className="tree-toggle-label">장비</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={showEquipment}
                  onChange={(e) => setShowEquipment(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="tree-node-title-row">
              {isEditMode && (
                <button
                  className="comm-icon-btn"
                  title="최상위 노드 추가"
                  onClick={(e) => {
                    e.stopPropagation();
                    const siblings = nodes.filter((n) => n.parentId === null);
                    const newId = addNode({
                      parentId: null,
                      name: "New Root",
                      type: "root",
                      order: siblings.length,
                    });
                    setRenamingId(newId);
                    setRenameValue("New Root");
                    if (isCollapsed) setIsCollapsed(false);
                  }}
                  style={{ padding: "4px", display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer" }}
                >
                  <Icon icon="material-symbols:add" style={{ fontSize: "20px", color: "var(--text-secondary)" }} />
                </button>
              )}
            </div>
          </div>
        </div>

        {!isCollapsed && (
          <div style={{ padding: "0 16px" }}>
            <div className="drm-sidebar-search-wrap" style={{ margin: 0, width: "100%" }}>
              <Icon icon="material-symbols:search" className="icon drm-sidebar-search-icon" style={{ width: 16, height: 16 }} />
              <input
                type="text"
                className="drm-sidebar-search"
                placeholder="노드 검색..."
                value={nodeSearch}
                onChange={(e) => setNodeSearch(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="collapse-panel-body">
          {rootNodes.map((root) => (
            <TreeNodeItem
              key={root.nodeId}
              node={root}
              depth={0}
              nodes={nodes}
              activeNodeId={activeNodeId || ""}
              collapsedIds={collapsedNodeIds}
              equipmentCounts={equipmentCounts}
              isEditMode={isEditMode}
              showEquipment={showEquipment}
              highlightedDeviceId={highlightedDeviceId}
              onToggle={handleToggle}
              onSelect={handleSelect}
              onContextMenu={handleContextMenu}
              draggedNodeId={draggedNodeId}
              dragOverNodeId={dragOverNodeId}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              nodeSearch={nodeSearch}
            />
          ))}
        </div>
      </div>

      {/* Equipment Detail Side Panel - Rendered via Portal to avoid overflow clipping */}
      {showEquipment && !isCollapsed && activeNodeId && (
        (() => {
          const portalTarget = document.getElementById("equipment-panel-portal");
          if (!portalTarget) return null;

          const nodeName = nodes.find((n) => n.nodeId === activeNodeId)?.name || "전체";

          return createPortal(
            <div className="equipment-detail-panel comm-pointer-auto">
              <div className="equipment-panel-header">
                📦 장비: {nodeName} ({totalDeviceCount})
              </div>
              <div className="equipment-panel-body">
                {deviceGroups.length > 0 ? (
                  deviceGroups.map((group) => {
                    const isLeaf = isLeafNode(nodes, activeNodeId);

                    return (
                      <div key={group.nodeId} className="equipment-subgroup">
                        {/* Show header if not a leaf view OR if there are multiple groups (though usually leaf implies 1 group) */}
                        {!isLeaf && (
                          <div className="equipment-subgroup-header">
                            <span className="equipment-subgroup-icon">
                              📂
                            </span>
                            {group.nodeName} ({group.devices.length})
                          </div>
                        )}
                        {group.devices.map(
                          ({ device, rackId, instanceId, portStates }) => {
                            const highestError = getHighestError(portStates);
                            const hasError = !!highestError;

                            const rack = rackId
                              ? allRacksForMapping.find(
                                (r) => r.rackId === rackId,
                              )
                              : null;

                            const equipmentLabel =
                              device.title ||
                              device.modelName ||
                              "Device";

                            const rackLabel = rack
                              ? (rack.rackTitle ||
                                `Rack-${rack.rackId.slice(0, 4)}`) +
                              ` (${rack.rackSize}U)`
                              : "미배치 (Inventory)";

                            return (
                              <div
                                key={`${activeNodeId}-${device.deviceId}`}
                                className={`tree-node tree-node-equipment ${highlightedDeviceId === (instanceId || device.deviceId) ? "highlighted" : ""} ${hasError ? "has-error" : ""}`}
                                onClick={() => handleDeviceClick(device.deviceId)}
                              >
                                <span
                                  className="tree-node-icon"
                                  style={{ color: hasError ? highestError.color : "inherit" }}
                                >
                                  {hasError ? "⚠" : "📟"}
                                </span>
                                <div
                                  className="comm-flex-col"
                                >
                                  <div className="tree-node-title-row">
                                    <span className="tree-node-title-text">
                                      {equipmentLabel}
                                    </span>
                                    {hasError && (
                                      <span
                                        className="equipment-status-dot"
                                        style={{ background: highestError.color }}
                                        title={highestError.level}
                                      />
                                    )}
                                  </div>
                                  <span
                                    className="comm-text-secondary-xs"
                                  >
                                    📍 {rackLabel}
                                  </span>
                                </div>
                                <span className="tree-node-count">
                                  {device.size}U
                                </span>
                              </div>
                            );
                          },
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="equipment-panel-empty">
                    표시할 장비가 없습니다.
                  </div>
                )}
              </div>
            </div>,
            portalTarget
          );
        })()
      )}

      {/* Rename overlay (displayed over the tree node name) */}
      {renamingId && (
        <div
          className="comm-modal-overlay-top"
          onClick={handleRenameConfirm}
        >
          <div
            className="comm-modal-dialog-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="comm-title-md"
            >
              노드 이름 변경
            </div>
            <input
              ref={renameInputRef}
              className="tree-inline-input comm-input-full"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameConfirm();
                if (e.key === "Escape") setRenamingId(null);
              }}
            />
            <div className="comm-modal-footer">
              <button
                className="comm-btn comm-btn-primary comm-modal-btn"
                onClick={handleRenameConfirm}
              >
                확인
              </button>
              <button
                className="comm-btn comm-btn-secondary comm-modal-btn"
                onClick={() => setRenamingId(null)}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context menu */}
      {contextMenu &&
        createPortal(
          <div
            className="tree-context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tree-context-item" onClick={handleAddGroup}>
              <Icon icon="material-symbols:create-new-folder" className="icon comm-icon-mr8" /> 그룹 추가
            </div>
            <div className="tree-context-item" onClick={handleAddRoom}>
              <Icon icon="mdi:server" className="icon comm-icon-mr8" /> 전산실 추가
            </div>
            <div className="tree-context-item" onClick={handleRenameStart}>
              <Icon icon="material-symbols:edit" className="icon comm-icon-mr8" />{" "}
              이름 변경
            </div>
            {nodes.find((n) => n.nodeId === contextMenu.nodeId)?.parentId !==
              null && (
                <div className="tree-context-item danger" onClick={handleDelete}>
                  <Icon icon="material-symbols:delete" className="icon comm-icon-mr8" />{" "}
                  삭제
                </div>
              )}
          </div>,
          document.body
        )}

    </div>
  );
});
