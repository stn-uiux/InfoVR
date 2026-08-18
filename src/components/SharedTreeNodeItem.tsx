import React, { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import type { HierarchyNode } from "../types";

export interface SharedTreeNodeItemProps {
  node: HierarchyNode;
  depth: number;
  childNodes: HierarchyNode[]; // Children of this node to render recursively
  getAllChildren: (parentId: string) => HierarchyNode[]; // Function to get children for recursion
  
  // Selection
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  
  // Checkbox
  hasCheckbox?: boolean;
  isChecked?: boolean;
  onCheck?: (id: string, checked: boolean) => void;
  
  // Expansion
  isExpanded: boolean;
  onToggle: (id: string) => void;
  
  // Search Highlight
  nodeSearch?: string;
  
  // Extra Badges
  count?: number;
  isPinned?: boolean;
  onPinToggle?: (id: string) => void;
  isDirty?: boolean;
  
  // Drag and Drop
  isDraggable?: boolean;
  draggedNodeId?: string | null;
  onDragStart?: (id: string) => void;
  onDragOver?: (e: React.DragEvent, id: string, position: "before" | "after" | "inside") => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent, targetId: string, position: "before" | "after" | "inside") => void;
  
  // Context Menu
  onContextMenu?: (e: React.MouseEvent, id: string) => void;
  
  // Renaming
  isRenaming?: boolean;
  onRenameComplete?: (id: string, newName: string) => void;
  onRenameCancel?: () => void;
  onRenameStart?: (id: string) => void;

  // Custom renders
  renderIconExtra?: React.ReactNode;

  // Pass-through props for recursion
  renderChild: (childNode: HierarchyNode, depth: number) => React.ReactNode;
}

export const SharedTreeNodeItem = React.memo(({
  node,
  depth,
  childNodes,
  getAllChildren,
  isSelected,
  onSelect,
  hasCheckbox,
  isChecked,
  onCheck,
  isExpanded,
  onToggle,
  nodeSearch,
  count = 0,
  isPinned,
  onPinToggle,
  isDirty,
  isDraggable,
  draggedNodeId,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onContextMenu,
  isRenaming,
  onRenameComplete,
  onRenameCancel,
  onRenameStart,
  renderIconExtra,
  renderChild
}: SharedTreeNodeItemProps) => {
  const hasChildren = childNodes.length > 0;
  
  // Local edit states for renaming
  const [renameValue, setRenameValue] = useState(node.name);

  // Focus input when renaming starts
  useEffect(() => {
    if (isRenaming) {
      setRenameValue(node.name);
    }
  }, [isRenaming, node.name]);

  const handleRenameComplete = () => {
    if (renameValue.trim() && renameValue !== node.name) {
      if (onRenameComplete) onRenameComplete(node.nodeId, renameValue.trim());
    } else {
      if (onRenameCancel) onRenameCancel();
    }
  };

  const isDragged = draggedNodeId === node.nodeId;
  const [dropPos, setDropPos] = useState<"before" | "after" | "inside" | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    if (!isDraggable || isDragged || !onDragOver) return;
    e.preventDefault();
    e.stopPropagation();

    // Safety: Cannot drop on own children
    const getDescendantIds = (id: string): string[] => {
      const children = getAllChildren(id);
      return [id, ...children.flatMap((c) => getDescendantIds(c.nodeId))];
    };
    
    if (draggedNodeId && getDescendantIds(draggedNodeId).includes(node.nodeId)) {
      setDropPos(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const height = rect.height;

    let position: "before" | "after" | "inside";
    if (node.parentId === null) {
      position = "inside";
    } else if (relativeY < height * 0.25) {
      position = "before";
    } else if (relativeY > height * 0.75) {
      position = "after";
    } else {
      // Prevent dropping "inside" a server room
      position = node.type === "room" ? "after" : "inside";
    }

    setDropPos(position);
    onDragOver(e, node.nodeId, position);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!isDraggable || !dropPos || !onDrop) return;
    e.preventDefault();
    e.stopPropagation();
    onDrop(e, node.nodeId, dropPos);
    setDropPos(null);
  };

  const isMatch = nodeSearch && node.name.toLowerCase().includes(nodeSearch.toLowerCase());

  return (
    <div>
      <div
        className={`tree-node ${isSelected ? "selected" : ""} ${isMatch ? "match" : ""} ${isDragged ? "dragging" : ""} ${dropPos === "inside" ? "drop-target" : ""} ${dropPos === "before" ? "drop-before" : ""} ${dropPos === "after" ? "drop-after" : ""} ${isPinned ? "has-pin" : ""}`}
        style={{ paddingLeft: `${4 + depth * 8}px` }}
        onClick={() => {
          if (hasCheckbox && onCheck) {
            onCheck(node.nodeId, !isChecked);
          } else if (onSelect) {
            if (node.type === "room") {
              onSelect(node.nodeId);
            } else {
              if (hasChildren) onToggle(node.nodeId);
            }
          }
        }}
        onContextMenu={(e) => {
          if (onContextMenu) onContextMenu(e, node.nodeId);
        }}
        draggable={isDraggable && node.parentId !== null}
        onDragStart={(e) => {
          if (!isDraggable || node.parentId === null || !onDragStart) {
            e.preventDefault();
            return;
          }
          e.stopPropagation();
          onDragStart(node.nodeId);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragOver={handleDragOver}
        onDragLeave={() => {
          setDropPos(null);
          if (onDragLeave) onDragLeave();
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

        {/* Checkbox (Optional) */}
        {hasCheckbox && onCheck && (
          <span style={{ display: "flex", alignItems: "center", marginRight: "4px" }}>
            <input 
              type="checkbox" 
              checked={isChecked} 
              readOnly 
              style={{ marginRight: '6px' }}
              onClick={(e) => {
                e.stopPropagation();
                onCheck(node.nodeId, !isChecked);
              }}
            />
          </span>
        )}

        {/* Icon */}
        <span className="tree-node-icon" style={{ position: 'relative' }}>
          {renderIconExtra}
          {isDirty && <div className="tree-node-dirty-dot" title="저장되지 않은 변경사항" />}
          {node.parentId === null ? (
            <Icon icon="gis:network" className="icon"
              style={{ color: isSelected || isChecked ? "var(--theme-primary)" : "var(--text-secondary)" }}
            />
          ) : node.type === "room" ? (
            <Icon icon="mdi:server" className="icon"
              style={{ color: isSelected || isChecked ? "var(--theme-primary)" : "var(--text-secondary)" }}
            />
          ) : (
            <Icon icon="material-symbols:folder" className="icon"
              style={{ color: isSelected || isChecked ? "var(--theme-primary)" : "var(--text-secondary)" }}
            />
          )}
        </span>

        {/* Name / Rename Input */}
        {isRenaming ? (
          <input
            type="text"
            className="tree-rename-input"
            value={renameValue}
            autoFocus
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameComplete}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameComplete();
              if (e.key === "Escape" && onRenameCancel) onRenameCancel();
            }}
            onClick={(e) => e.stopPropagation()}
            onDragStart={(e) => e.preventDefault()}
            style={{
              flex: 1,
              background: "var(--bg-tertiary)",
              color: "var(--text-primary)",
              border: "1px solid var(--theme-primary)",
              borderRadius: "4px",
              padding: "2px 6px",
              fontSize: "12px",
              outline: "none",
            }}
          />
        ) : (
          <span
            className="tree-node-name"
            onDoubleClick={(e) => {
              if (isDraggable && onRenameStart) {
                e.stopPropagation();
                onRenameStart(node.nodeId);
              }
            }}
          >
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
        )}

        {/* Count Badge */}
        {count > 0 && !isRenaming && (
          <span
            className="tree-node-count"
            style={{ marginLeft: isDraggable ? "4px" : "auto" }}
          >
            {count}
          </span>
        )}

        {/* Pin Button */}
        {node.type === "room" && onPinToggle && !isRenaming && (
          <button
            className={`tree-node-pin ${isPinned ? "pinned" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onPinToggle(node.nodeId);
            }}
            title={isPinned ? "고정 해제" : "메인 전산실로 고정"}
          >
            <Icon icon="mynaui:pin-solid" className="icon comm-icon-sm" style={{ color: isPinned ? "var(--theme-primary)" : "var(--text-tertiary)" }} />
          </button>
        )}
      </div>

      {/* Children */}
      {isExpanded && childNodes.length > 0 && (
        <>
          {childNodes.map((child) => renderChild(child, depth + 1))}
        </>
      )}
    </div>
  );
});
