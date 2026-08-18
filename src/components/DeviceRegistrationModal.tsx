import { Icon } from "@iconify/react";
import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { useStore } from "../store/useStore";
import type { Device, HierarchyNode, RegisteredDevice } from "../types";
import {
  exportRegisteredDevicesToExcel,
  parseRegisteredDevicesFromExcel,
} from "../utils/storage";
import {
  getNodeName,
  getChildren,
  getAncestorPath,
  getSubtreeEquipmentCount,
  getSubtreeNodeIds,
} from "../utils/nodeUtils";
import { getHighestError } from "../utils/errorHelpers";
import { SharedTreeNodeItem } from "./SharedTreeNodeItem";
import { RegistrationFormModal } from "./DeviceRegistrationModal/RegistrationFormModal";
import { ChildMultiPicker } from "./DeviceRegistrationModal/ChildMultiPicker";
import { DeviceRow } from "./DeviceRegistrationModal/DeviceRow";

interface ToastState {
  message: string;
  type: "success" | "error";
  action?: "export" | "import" | "add" | "delete";
}

export const DeviceRegistrationModal = () => {
  const isOpen = useStore((s) => s.deviceRegistrationModalOpen);
  const setOpen = useStore((s) => s.setDeviceRegistrationModalOpen);
  const registeredDevices = useStore((s) => s.registeredDevices);
  const upsertRegisteredDevices = useStore((s) => s.upsertRegisteredDevices);
  const activeNodeId = useStore((s) => s.activeNodeId);
  const nodes = useStore((s) => s.nodes);
  const locateDevice = useStore((s) => s.locateDevice);
  const setDeviceDeleteConfirm = useStore((s) => s.setDeviceDeleteConfirm);
  const findExistingMount = useStore((s) => s.findExistingMount);
  const racks = useStore((s) => s.racks);
  const layouts = useStore((s) => s.layouts);

  // Table state
  const [search, setSearch] = useState("");
  // Table filter state
  const [nodeFilter, setNodeFilter] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Node Management State
  const isEditMode = useStore((s) => s.isEditMode);
  const addNode = useStore((s) => s.addNode);
  const deleteNode = useStore((s) => s.deleteNode);
  const renameNode = useStore((s) => s.renameNode);
  const reorderNode = useStore((s) => s.reorderNode);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string;
  } | null>(null);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOverNodeId, setDragOverNodeId] = useState<string | null>(null);
  const [nodeDeleteConfirm, setNodeDeleteConfirm] = useState<{
    node: HierarchyNode;
    rect: DOMRect;
  } | null>(null);

  // New Redesign States
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [nodeSearch, setNodeSearch] = useState("");
  const [nodeExpandedIds, setNodeExpandedIds] = useState<Set<string>>(
    new Set(),
  );
  const [renamingId, setRenamingId] = useState<string | null>(null);

  // UI state
  const [toast, setToast] = useState<ToastState | null>(null);
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const showToast = useCallback(
    (
      message: string,
      type: "success" | "error",
      action?: ToastState["action"],
    ) => {
      setToast({ message, type, action });
      setTimeout(() => setToast(null), 3000);
    },
    [],
  );

  // Scope Filtering States
  const [directNodeOnly, setDirectNodeOnly] = useState(false);
  const [showUnmountedOnly, setShowUnmountedOnly] = useState(false);
  const [selectedChildNodeIds, setSelectedChildNodeIds] = useState<Set<string>>(
    new Set(),
  );

  // --- NEW: Infinite scroll state ---
  const [visibleCount, setVisibleCount] = useState(50);

  const tableContentRef = useRef<HTMLDivElement>(null);

  // Reset visibleCount and scroll position when filters change
  useEffect(() => {
    setVisibleCount(50);
    if (tableContentRef.current) {
      tableContentRef.current.scrollTop = 0;
    }
  }, [search, nodeFilter, directNodeOnly, showUnmountedOnly, selectedChildNodeIds]);

  const handleTableScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight * 1.5) {
      setVisibleCount((prev) => prev + 50);
    }
  }, []);

  // Drag Handlers
  const handleDragStart = useCallback((nodeId: string) => {
    setDraggedNodeId(nodeId);
    setDragOverNodeId(null);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, nodeId: string) => {
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
      targetId: string,
      position: "before" | "after" | "inside",
    ) => {
      e.preventDefault();
      const sourceId = draggedNodeId;
      setDraggedNodeId(null);
      setDragOverNodeId(null);
      if (sourceId && sourceId !== targetId) {
        reorderNode(sourceId, targetId, position);
      }
    },
    [draggedNodeId, reorderNode],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, nodeId });
    },
    [],
  );

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(".tree-context-menu")) return;
      setContextMenu(null);
    };
    window.addEventListener("click", handleClick, { capture: true });
    return () =>
      window.removeEventListener("click", handleClick, { capture: true });
  }, []);

  // Node Editing
  const handleAddGroup = useCallback(
    (parentId: string) => {
      // Auto expand parent for visibility
      setNodeExpandedIds((prev) => {
        const next = new Set(prev);
        next.add(parentId);
        return next;
      });

      const siblings = nodes.filter((n) => n.parentId === parentId);
      const newId = addNode({
        parentId,
        name: "새 그룹",
        type: "group",
        order: siblings.length,
      });

      setRenamingId(newId);
    },
    [nodes, addNode],
  );

  const handleAddRoom = useCallback(
    (parentId: string) => {
      // Auto expand parent for visibility
      setNodeExpandedIds((prev) => {
        const next = new Set(prev);
        next.add(parentId);
        return next;
      });

      const siblings = nodes.filter((n) => n.parentId === parentId);
      const newId = addNode({
        parentId,
        name: "새 전산실",
        type: "room",
        order: siblings.length,
      });

      setRenamingId(newId);
    },
    [nodes, addNode],
  ); // setNodeExpandedIds is stable from useState, so it doesn't strictly need to be in deps but good for clarity

  const handleAddRootNode = useCallback(() => {
    const siblings = nodes.filter((n) => n.parentId === null);
    const newId = addNode({
      parentId: null,
      name: "New Root",
      type: "root",
      order: siblings.length,
    });
    setRenamingId(newId);
  }, [nodes, addNode]);





  const confirmNodeDelete = useCallback(() => {
    if (!nodeDeleteConfirm) return;
    deleteNode(nodeDeleteConfirm.node.nodeId);
    setNodeDeleteConfirm(null);
  }, [nodeDeleteConfirm, deleteNode]);

  const selectedChildTags = useMemo(() => {
    return Array.from(selectedChildNodeIds).map((id) => {
      const node = nodes.find((n) => n.nodeId === id);
      return { id, name: node?.name || id };
    });
  }, [selectedChildNodeIds, nodes]);

  const handleRemoveChildTag = (id: string) => {
    setSelectedChildNodeIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const descendantsOfFilter = useMemo(() => {
    if (!nodeFilter || nodeFilter === "all") return [];

    const result: { node: HierarchyNode; depth: number }[] = [];
    const collect = (id: string, depth: number) => {
      const children = getChildren(nodes, id);
      children.forEach((c) => {
        result.push({ node: c, depth });
        collect(c.nodeId, depth + 1);
      });
    };
    collect(nodeFilter, 0);
    return result;
  }, [nodes, nodeFilter]);

  const hasDescendants = descendantsOfFilter.length > 0;

  // Reset filters and selection when node changes
  useEffect(() => {
    setDirectNodeOnly(false);
    setSelectedChildNodeIds(new Set());
    setSelectedIds(new Set());
  }, [nodeFilter]);

  // Reset selection when scope filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [directNodeOnly, selectedChildNodeIds]);

  // Redesign: Expand parents if searching or if activeNodeId exists
  useEffect(() => {
    if (nodeSearch.trim()) {
      const q = nodeSearch.toLowerCase();
      const toExpand = new Set<string>();

      nodes.forEach((n) => {
        if (n.name.toLowerCase().includes(q)) {
          let curr = n;
          while (curr.parentId) {
            toExpand.add(curr.parentId);
            const parent = nodes.find((p) => p.nodeId === curr.parentId);
            if (!parent) break;
            curr = parent;
          }
        }
      });

      if (toExpand.size > 0) {
        setNodeExpandedIds((prev) => {
          const next = new Set(prev);
          toExpand.forEach((id) => next.add(id));
          return next;
        });
      }
    }
  }, [nodeSearch, nodes]);

  // Expand parents of active node when opening
  useEffect(() => {
    if (isOpen && activeNodeId) {
      const path = getAncestorPath(nodes, activeNodeId);
      setNodeExpandedIds((prev) => {
        const next = new Set(prev);
        path.forEach((n) => next.add(n.nodeId));
        return next;
      });
    }
  }, [isOpen, activeNodeId, nodes]);

  // Sync state when modal opens ONLY (don't reset on nodes change during session)
  useEffect(() => {
    if (isOpen) {
      if (activeNodeId) {
        setNodeFilter(activeNodeId);
      } else {
        const root = nodes.find((n) => n.parentId === null);
        if (root) setNodeFilter(root.nodeId);
      }
      // Reset selection when modal opens
      setSelectedIds(new Set());
      // Redesign: Close registration modal by default
      setIsRegistrationModalOpen(false);
      setEditingDeviceId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Filtered list — respects nodeFilter selection
  const filteredDevices = useMemo(() => {
    let list = registeredDevices;

    if (showUnmountedOnly) {
      list = list.filter((d) => !findExistingMount(d.deviceId));
    }

    if (nodeFilter !== "all" && nodeFilter !== "") {
      if (directNodeOnly) {
        // Mode 1: Show only equipment directly in this node
        list = list.filter((d) => (d.deviceGroupId || "") === nodeFilter);
      } else if (selectedChildNodeIds.size > 0) {
        // Mode 2: Show only equipment directly assigned to the selected nodes
        list = list.filter((d) =>
          selectedChildNodeIds.has(d.deviceGroupId || ""),
        );
      } else {
        // Mode 3: Show full subtree (default when no specific filter is picked)
        const descendantIds = getSubtreeNodeIds(nodes, nodeFilter);
        list = list.filter((d) => descendantIds.has(d.deviceGroupId || ""));
      }
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (d) =>
          (d.title || "").toLowerCase().includes(q) ||
          (d.modelName || "").toLowerCase().includes(q) ||
          d.IPAddr.toLowerCase().includes(q) ||
          d.macAddr.toLowerCase().includes(q) ||
          (d.vendor || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [
    registeredDevices,
    nodeFilter,
    search,
    directNodeOnly,
    showUnmountedOnly,
    findExistingMount,
    racks,
    layouts,
    selectedChildNodeIds,
    nodes,
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Performance: Pre-compute lookup maps once per data change ---

  // Equipment count per node (for sidebar tree)
  const equipCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of registeredDevices) {
      const gid = d.deviceGroupId || "";
      map.set(gid, (map.get(gid) || 0) + 1);
    }
    return map;
  }, [registeredDevices]);

  // Device status lookup: deviceId → { placed: boolean }
  const deviceStatusMap = useMemo(() => {
    const map = new Map<string, { placed: boolean }>();
    for (const rd of registeredDevices) {
      map.set(rd.deviceId, {
        placed: !!findExistingMount(rd.deviceId),
      });
    }
    return map;
  }, [registeredDevices, findExistingMount, racks, layouts]);

  // Node name lookup: nodeId → name string
  const nodeNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of nodes) {
      map.set(n.nodeId, n.name);
    }
    return map;
  }, [nodes]);

  const getNodeNameFast = useCallback(
    (nodeId: string | null) => {
      if (!nodeId) return "없음";
      return nodeNameMap.get(nodeId) || getNodeName(nodes, nodeId);
    },
    [nodeNameMap, nodes],
  );

  const headerBadgeText = useMemo(() => {
    const name = getNodeNameFast(nodeFilter);
    // Get subtree devices for the selected node filter
    const descendantIds = getSubtreeNodeIds(nodes, nodeFilter);
    const subtreeDevices = registeredDevices.filter((d) =>
      descendantIds.has(d.deviceGroupId || ""),
    );
    const totalCount = subtreeDevices.length;
    let mountedCount = 0;
    for (const d of subtreeDevices) {
      const status = deviceStatusMap.get(d.deviceId);
      if (status?.placed) mountedCount++;
    }
    const unmountedCount = totalCount - mountedCount;
    return `${name} (전체: ${totalCount}대 / 실장: ${mountedCount}대 / 미실장: ${unmountedCount}대)`;
  }, [nodeFilter, nodes, registeredDevices, deviceStatusMap, getNodeNameFast]);

  const handleEditClick = useCallback(
    (device: RegisteredDevice) => {
      setEditingDeviceId(device.deviceId);
      setIsRegistrationModalOpen(true);
    },
    [],
  );

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredDevices.map((d) => d.deviceId)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const isAllSelected =
    filteredDevices.length > 0 &&
    filteredDevices.every((d) => selectedIds.has(d.deviceId));

  const handleImportExcel = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    } else {
      console.error("[DRM] File input ref is null!");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;
    setIsProcessing(true);
    try {
      const { devices: parsed, newNodes } =
        await parseRegisteredDevicesFromExcel(file, nodes);
      if (parsed.length === 0) {
        showToast(
          "파일에서 유효한 장비를 찾을 수 없습니다.",
          "error",
          "import",
        );
        return;
      }

      // If there are new nodes in the path, upsert them first and apply mapping
      if (newNodes.length > 0) {
        const { mapping: idMap } = useStore
          .getState()
          .upsertNodes(newNodes, false);
        parsed.forEach((d) => {
          if (idMap[d.deviceGroupId || ""]) {
            d.deviceGroupId = idMap[d.deviceGroupId || ""];
          }
        });
      }

      const { added, updated } = upsertRegisteredDevices(parsed);
      showToast(
        `일괄 등록 완료! (신규: ${added}건, 갱신: ${updated}건${newNodes.length > 0 ? `, 신규 노드: ${newNodes.length}개` : ""})`,
        "success",
        "import",
      );
    } catch (err: unknown) {
      console.error(err);
      showToast(`일괄 등록 실패: ${err instanceof Error ? err.message : String(err)}`, "error", "import");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportExcel = () => {
    if (selectedIds.size === 0) {
      showToast("내보낼 장비를 선택하세요.", "error", "export");
      return;
    }
    const selectedDevices = registeredDevices.filter((d) =>
      selectedIds.has(d.deviceId),
    );
    const scope = nodeFilter === "all" ? "ALL" : getNodeName(nodes, nodeFilter);
    exportRegisteredDevicesToExcel(selectedDevices, nodes, scope);
    showToast("선택한 장비 데이터가 내보내졌습니다.", "success", "export");
  };

  const handleRegistrationSuccess = (title: string, isEdit: boolean) => {
    showToast(
      `장비 "${title}" 정보가 ${isEdit ? "수정" : "등록"}되었습니다.`,
      "success",
      "add",
    );
    setIsRegistrationModalOpen(false);
    setEditingDeviceId(null);
  };

  const handleDeleteClick = useCallback(
    (
      e: React.MouseEvent<HTMLButtonElement>,
      device: RegisteredDevice,
    ) => {
      e.stopPropagation();
      const existing = findExistingMount(device.deviceId);
      setDeviceDeleteConfirm({
        id: device.deviceId,
        title: device.title || device.modelName || "",
        rackName: existing?.rackName,
      });
    },
    [findExistingMount, setDeviceDeleteConfirm],
  );

  const handleLocateDevice = useCallback(
    (device: RegisteredDevice) => {
      const found = locateDevice(device.deviceId);
      if (!found) {
        showToast("해당 장비는 랙에 탑재되어 있지 않습니다.", "error");
      } else {
        // Sync modal filter if navigation happened
        const newActiveId = useStore.getState().activeNodeId;
        if (newActiveId) {
          setNodeFilter(newActiveId);
          // Clear selection to avoid confusion
          setSelectedIds(new Set());
        }
      }
    },
    [locateDevice, showToast],
  );

  if (!isOpen && !nodeDeleteConfirm) return null;

  return (
    <>
      {/* Modal */}
      {isOpen &&
        createPortal(
          <div
            className="drm-overlay"
            onClick={() => {
              if (!nodeDeleteConfirm) setOpen(false);
            }}
          >
            <div className="drm-modal" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="drm-header">
                <h2>
                  <div className="icon-wrap">
                    <Icon icon="material-symbols:archive" className="icon" style={{ width: 20, height: 20 }} />
                  </div>
                  장비 관리
                </h2>
                <button
                  className="drm-close"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="drm-body">
                {/* Left Sidebar: Node Hierarchy */}
                <div className="drm-sidebar">
                  <div className="collapse-panel-header" style={{ padding: "16px 16px 8px" }}>
                    <div className="comm-flex-center-10-flex1">
                      <span className="comm-flex-center-8-noshrink">
                        <span className="comm-icon-primary-lg">
                          <Icon icon="material-symbols:grid-view" className="icon comm-icon-md" />
                        </span>
                        <span className="tree-node-header-text">구조</span>
                      </span>
                    </div>

                    <div className="tree-node-group-row">
                      <div className="tree-node-title-row" style={{ marginLeft: "auto" }}>
                        {isEditMode && (
                          <button
                            className="comm-btn comm-btn-sm comm-btn-secondary"
                            title="최상위 노드 추가"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddRootNode();
                            }}
                          >
                            <Icon icon="material-symbols:add" className="icon" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
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
                  <div className="drm-sidebar-content">
                    {(() => {
                      const renderSharedTree = (node: HierarchyNode, depth: number) => {
                        const isExpanded = nodeExpandedIds.has(node.nodeId);
                        const count = equipCountMap.get(node.nodeId) || 0;
                        const isSelected = nodeFilter === node.nodeId;
                        const isRenaming = renamingId === node.nodeId;
                        return (
                          <SharedTreeNodeItem
                            key={node.nodeId}
                            node={node}
                            depth={depth}
                            childNodes={nodes.filter(n => n.parentId === node.nodeId).sort((a, b) => a.order - b.order)}
                            getAllChildren={(id) => nodes.filter(n => n.parentId === id)}
                            isSelected={isSelected}
                            onSelect={(id) => {
                              setNodeFilter(id);
                              setSelectedIds(new Set());
                            }}
                            isExpanded={isExpanded}
                            onToggle={(id) =>
                              setNodeExpandedIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(id)) next.delete(id);
                                else next.add(id);
                                return next;
                              })
                            }
                            nodeSearch={nodeSearch}
                            count={count}
                            isDraggable={isEditMode}
                            draggedNodeId={draggedNodeId}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onContextMenu={handleContextMenu}
                            isRenaming={isRenaming}
                            onRenameStart={(id) => {
                              setRenamingId(id);
                            }}
                            onRenameComplete={(id, newName) => {
                              renameNode(id, newName);
                              setRenamingId(null);
                            }}
                            onRenameCancel={() => setRenamingId(null)}
                            renderChild={renderSharedTree}
                          />
                        );
                      };

                      return nodes
                        .filter((n) => n.parentId === null)
                        .map((root) => renderSharedTree(root, 0));
                    })()}
                  </div>
                </div>

                {contextMenu &&
                  createPortal(
                    <div
                      className="tree-context-menu"
                      style={{ top: contextMenu.y, left: contextMenu.x }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        className="tree-context-item"
                        onClick={() => {
                          handleAddGroup(contextMenu.nodeId);
                          setContextMenu(null);
                        }}
                      >
                        <Icon icon="material-symbols:create-new-folder" className="icon comm-icon-mr8" /> 그룹 추가
                      </div>
                      <div
                        className="tree-context-item"
                        onClick={() => {
                          handleAddRoom(contextMenu.nodeId);
                          setContextMenu(null);
                        }}
                      >
                        <Icon icon="mdi:server" className="icon comm-icon-mr8" /> 전산실 추가
                      </div>
                      <div
                        className="tree-context-item"
                        onClick={() => {
                          setRenamingId(contextMenu.nodeId);
                          setContextMenu(null);
                        }}
                      >
                        <Icon icon="material-symbols:edit" className="icon comm-icon-mr8" /> 이름 변경
                      </div>
                      {nodes.find((n) => n.nodeId === contextMenu.nodeId)
                        ?.parentId !== null && (
                          <div
                            className="tree-context-item danger"
                            onClick={() => {
                              const node = nodes.find(
                                (n) => n.nodeId === contextMenu.nodeId,
                              );
                              if (node) {
                                const hasChildren = nodes.some((n) => n.parentId === node.nodeId);
                                const count = getSubtreeEquipmentCount(
                                  nodes,
                                  registeredDevices,
                                  node.nodeId,
                                );
                                if (hasChildren || count > 0) {
                                  showToast(
                                    "하위 노드가 있거나 등록된 장비가 있어 삭제할 수 없습니다.",
                                    "error",
                                  );
                                } else {
                                  // Find the element for rect
                                  const target = document.querySelector(
                                    `.tree-node`
                                  );
                                  const rect =
                                    target?.getBoundingClientRect() ||
                                    ({
                                      left: contextMenu.x,
                                      bottom: contextMenu.y,
                                    } as DOMRect);
                                  setNodeDeleteConfirm({
                                    node,
                                    rect: rect as DOMRect,
                                  });
                                }
                              }
                              setContextMenu(null);
                            }}
                          >
                            <Icon icon="material-symbols:delete" className="icon comm-icon-mr8" /> 삭제
                          </div>
                        )}
                    </div>,
                    document.body,
                  )}

                {/* Right Content: Equipment List */}
                <div className="drm-content">
                  <RegistrationFormModal
                    isOpen={isRegistrationModalOpen}
                    onClose={() => {
                      setIsRegistrationModalOpen(false);
                      setEditingDeviceId(null);
                    }}
                    editingDeviceId={editingDeviceId}
                    activeNodeId={
                      (nodeFilter !== "all" ? nodeFilter : activeNodeId) || ""
                    }
                    nodes={nodes}
                    registeredDevices={registeredDevices}
                    onSuccess={handleRegistrationSuccess}
                  />

                  {/* Device Table */}
                  <div className="drm-section-card" style={{ flex: 1 }}>
                    <div className="drm-table-header">
                      {/* First Row: Metadata & Actions */}
                      <div className="drm-header-row">
                        <div className="drm-metadata-cluster">
                          <div className="drm-form-title">
                            <span
                              className="icon"
                              style={{ display: "flex", alignItems: "center" }}
                            >
                              <Icon icon="material-symbols:archive" className="icon"
                                style={{ width: 18, height: 18 }}
                              />
                            </span>{" "}
                            등록 장비 목록
                          </div>
                          <div
                            className="drm-badge highlight"
                            style={{ fontWeight: 700 }}
                          >
                            {headerBadgeText}
                          </div>
                          {selectedIds.size > 0 && (
                            <div className="drm-badge highlight">
                              {selectedIds.size}개 선택됨
                            </div>
                          )}
                        </div>

                        <div className="drm-action-cluster">
                          <input
                            type="file"
                            accept=".xlsx"
                            ref={fileInputRef}
                            style={{ display: "none" }}
                            onChange={handleFileChange}
                          />
                          <button
                            className="comm-btn comm-btn-md comm-btn-primary"
                            onClick={() => {
                              setEditingDeviceId(null);
                              setIsRegistrationModalOpen(true);
                            }}
                          >
                            <Icon icon="material-symbols:add" className="icon" /> 새 장비 등록
                          </button>
                          <button
                            className="comm-btn comm-btn-md comm-btn-secondary"
                            onClick={handleExportExcel}
                          >
                            <Icon icon="material-symbols:upload" className="icon" /> 내보내기
                          </button>
                          <button
                            className="comm-btn comm-btn-md comm-btn-secondary"
                            onClick={handleImportExcel}
                          >
                            <Icon icon="material-symbols:download" className="icon" /> 일괄 등록
                          </button>
                        </div>
                      </div>

                      {/* Second Row: Search */}
                      <div className="drm-header-row">
                        <div className="drm-search-container">
                          <div className="drm-search-wrap">
                            <Icon icon="material-symbols:search"
                              className="icon drm-search-icon"
                              style={{ width: 18, height: 18 }}
                            />
                            <input
                              className="drm-search-input"
                              type="text"
                              placeholder="목록에서 검색 (장비명, 모델명, IP, MAC, 제조사)"
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                            />
                          </div>

                          {/* Scope Filtering Controls */}
                          <div className="drm-filter-controls" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                            <label className="drm-checkbox-label">
                              <input
                                type="checkbox"
                                checked={showUnmountedOnly}
                                onChange={(e) =>
                                  setShowUnmountedOnly(e.target.checked)
                                }
                              />
                              미실장 장비만 보기
                            </label>

                            {hasDescendants && (
                              <>
                                <label className="drm-checkbox-label">
                                  <input
                                    type="checkbox"
                                    checked={directNodeOnly}
                                    onChange={(e) =>
                                      setDirectNodeOnly(e.target.checked)
                                    }
                                  />
                                  현재 노드 장비만 보기
                                </label>

                                {!directNodeOnly && (
                                  <ChildMultiPicker
                                    options={descendantsOfFilter}
                                    selectedIds={selectedChildNodeIds}
                                    onToggle={(id) => {
                                      setSelectedChildNodeIds((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(id)) next.delete(id);
                                        else next.add(id);
                                        return next;
                                      });
                                    }}
                                  />
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Tags row */}
                      {selectedChildTags.length > 0 && !directNodeOnly && (
                        <div className="drm-tag-list">
                          {selectedChildTags.map((tag) => (
                            <div
                              key={tag.id}
                              className="drm-tag"
                              onClick={() => handleRemoveChildTag(tag.id)}
                              title="클릭하여 필터 제거"
                            >
                              <span>{tag.name}</span>
                              <span className="drm-tag-remove">×</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div
                      ref={tableContentRef}
                      className="drm-table-content"
                      onScroll={handleTableScroll}
                    >
                      {filteredDevices.length > 0 ? (
                        <table className="drm-table">
                          <thead>
                            <tr>
                              <th className="col-check">
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: "100%",
                                    height: "100%",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isAllSelected}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      handleSelectAll(e.target.checked);
                                    }}
                                  />
                                </div>
                              </th>
                              <th className="col-name">장비명</th>
                              <th className="col-model">모델명</th>
                              <th className="col-IPAddr">IP 주소</th>
                              <th className="col-macAddr">MAC 주소</th>
                              <th className="col-vendor">제조사</th>
                              <th className="col-status">상태</th>
                              <th className="col-actions">관리</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredDevices
                              .slice(0, visibleCount)
                              .map((device) => (
                                <DeviceRow
                                  key={device.deviceId}
                                  device={device}
                                  isSelected={selectedIds.has(device.deviceId)}
                                  groupName={getNodeNameFast(
                                    device.deviceGroupId || "",
                                  )}
                                  statusInfo={deviceStatusMap.get(
                                    device.deviceId,
                                  )}
                                  onLocate={handleLocateDevice}
                                  onSelect={handleSelectRow}
                                  onEdit={handleEditClick}
                                  onDelete={handleDeleteClick}
                                />
                              ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="drm-empty-state">
                          <div
                            style={{ fontSize: "40px", marginBottom: "16px" }}
                          >
                            Empty
                          </div>
                          {search
                            ? "검색 결과가 없습니다."
                            : "등록된 장비가 없습니다."}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Processing Overlay */}
      {isProcessing &&
        createPortal(
          <div
            className="drm-overlay"
            style={{ zIndex: 3000, background: "rgba(0,0,0,0.7)" }}
          >
            <div className="drm-toast" style={{ padding: "40px" }}>
              <div
                style={{
                  fontSize: "40px",
                  marginBottom: "16px",
                  animation: "spin 2s linear infinite",
                }}
              >
                ⏳
              </div>
              <h3 style={{ margin: 0 }}>일괄 등록 처리 중...</h3>
              <p style={{ marginTop: "8px", opacity: 0.7 }}>
                잠시만 기다려 주세요.
              </p>
            </div>
          </div>,
          document.body,
        )}

      {/* Toast (Centered Popup) - Rendered last to fix backdrop-filter stacking context bug */}
      {toast &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="drm-toast-wrapper" onClick={() => setToast(null)}>
            <div
              className={`drm-toast ${toast.type === "success" ? "drm-toast-success" : "drm-toast-error"} ${toast.action === "add" || toast.action === "delete" ? "compact" : ""}`}
              onClick={(e) => e.stopPropagation()}
            >
              {toast.action !== "add" && toast.action !== "delete" && (
                <img
                  src={
                    toast.action === "export"
                      ? toast.type === "success"
                        ? "/assets/export_success.png"
                        : "/assets/export_error.png"
                      : toast.action === "import"
                        ? toast.type === "success"
                          ? "/assets/import_success.png"
                          : "/assets/import_error.png"
                        : toast.type === "success"
                          ? "/assets/success_popup.png"
                          : "/assets/error_popup.png"
                  }
                  alt="status illustration"
                  className="drm-toast-image"
                />
              )}
              <div className="drm-toast-content">
                <h3>
                  {toast.type === "success"
                    ? toast.action === "export"
                      ? "내보내기 완료"
                      : toast.action === "import"
                        ? "가져오기 완료"
                        : toast.action === "add"
                          ? "등록 성공"
                          : toast.action === "delete"
                            ? "삭제 완료"
                            : "완료되었습니다"
                    : toast.action === "export"
                      ? "내보내기 실패"
                      : toast.action === "import"
                        ? "가져오기 실패"
                        : "확인이 필요합니다"}
                </h3>
                <p>{toast.message}</p>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Node Delete confirmation popover */}
      {nodeDeleteConfirm &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="drm-confirm-overlay"
              onClick={(e) => {
                e.stopPropagation();
                setNodeDeleteConfirm(null);
              }}
            />
            <div
              className="drm-confirm-popover"
              onClick={(e) => e.stopPropagation()}
            >
              <p style={{ margin: "0 0 12px 0", fontSize: "13px" }}>
                노드 <strong>"{nodeDeleteConfirm.node.name}"</strong>을(를)
                삭제하시겠습니까?
              </p>
              <div
                className="drm-confirm-actions"
                style={{
                  display: "flex",
                  gap: "8px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  className="comm-btn comm-btn-secondary"
                  style={{ fontSize: "12px", padding: "4px 12px" }}
                  onClick={() => setNodeDeleteConfirm(null)}
                >
                  취소
                </button>
                <button
                  className="comm-btn comm-btn-destructive"
                  style={{ fontSize: "12px", padding: "4px 12px" }}
                  onClick={confirmNodeDelete}
                >
                  삭제
                </button>
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
};
