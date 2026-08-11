const fs = require('fs');
const path = require('path');
const file = path.join('src', 'components', 'HierarchyTree.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Re-apply pin icon change
content = content.replace(
  /<Icon icon="material-symbols:location-on" className="icon" style=\{\{ width: 24, height: 24, color: pinnedNodeId === node.nodeId \? "var\(--theme-primary\)" : "var\(--text-tertiary\)" \}\} \/>/,
  '<Icon icon="mynaui:pin-solid" className="icon" style={{ width: 16, height: 16, color: pinnedNodeId === node.nodeId ? "var(--theme-primary)" : "var(--text-tertiary)" }} />'
);
content = content.replace(
  /<Icon icon="mynaui:pin-solid" className="icon" style=\{\{ width: 24, height: 24, color: pinnedNodeId === node.nodeId \? "var\(--theme-primary\)" : "var\(--text-tertiary\)" \}\} \/>/,
  '<Icon icon="mynaui:pin-solid" className="icon" style={{ width: 16, height: 16, color: pinnedNodeId === node.nodeId ? "var(--theme-primary)" : "var(--text-tertiary)" }} />'
);
content = content.replace(
  /<Icon icon="mynaui:pin-solid" className="icon" style=\{\{ width: 18, height: 18, color: pinnedNodeId === node.nodeId \? "var\(--theme-primary\)" : "var\(--text-tertiary\)" \}\} \/>/,
  '<Icon icon="mynaui:pin-solid" className="icon" style={{ width: 16, height: 16, color: pinnedNodeId === node.nodeId ? "var(--theme-primary)" : "var(--text-tertiary)" }} />'
);

// 2. Change click behavior
const clickRegex = /onClick=\{\(\) => \{\s*onSelect\(node\.nodeId\);\s*\}\}/;
const newClick = onClick={() => {
          if (node.type === "room") {
            onSelect(node.nodeId);
          } else {
            if (hasChildren) onToggle(node.nodeId);
          }
        }};
content = content.replace(clickRegex, newClick);

// 3. Change icon logic
const iconRegex = /\{node\.parentId === null \? \([\s\S]*?Icon icon="material-symbols:business"[\s\S]*?\) : \([\s\S]*?Icon icon="material-symbols:folder"[\s\S]*?\)\}/;
const newIconLogic = {node.type === "root" ? (
            <Icon icon="ri:network-fill" className="icon"
              style={{ width: 14, height: 14, color: isSelected ? "var(--theme-primary)" : "var(--text-secondary)" }}
            />
          ) : node.type === "room" ? (
            <Icon icon="basil:server-solid" className="icon"
              style={{ width: 14, height: 14, color: isSelected ? "var(--theme-primary)" : "var(--text-secondary)" }}
            />
          ) : (
            <Icon icon="material-symbols:folder" className="icon"
              style={{ width: 14, height: 14, color: isSelected ? "var(--theme-primary)" : "var(--text-secondary)" }}
            />
          )};
content = content.replace(iconRegex, newIconLogic);

// 4. Update context menu handlers
const handleAddChildRegex = /const handleAddChild = useCallback\(\(\) => \{[\s\S]*?setRenameValue\("New Node"\);\s*\}, \[contextMenu, nodes, addNode, toggleNodeExpansion\]\);/;
const newHandlers = const handleAddGroup = useCallback(() => {
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
    toggleNodeExpansion(parentId);
    setRenamingId(newId);
    setRenameValue("New Group");
  }, [contextMenu, nodes, addNode, toggleNodeExpansion]);

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
    toggleNodeExpansion(parentId);
    setRenamingId(newId);
    setRenameValue("New Room");
  }, [contextMenu, nodes, addNode, toggleNodeExpansion]);;
content = content.replace(handleAddChildRegex, newHandlers);

// 5. Update context menu HTML
const contextMenuHtmlRegex = /<div className="tree-context-item" onClick=\{handleAddChild\}>[\s\S]*?하위\s*노드 추가\s*<\/div>/;
const newContextMenuHtml = <div className="tree-context-item" onClick={handleAddGroup}>
            <Icon icon="material-symbols:create-new-folder" className="icon" style={{ marginRight: 8 }} /> 그룹 추가
          </div>
          <div className="tree-context-item" onClick={handleAddRoom}>
            <Icon icon="basil:server-solid" className="icon" style={{ marginRight: 8 }} /> 전산실 추가
          </div>;
content = content.replace(contextMenuHtmlRegex, newContextMenuHtml);

fs.writeFileSync(file, content, 'utf8');
console.log('HierarchyTree updated successfully');
