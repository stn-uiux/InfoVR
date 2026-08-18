const fs = require('fs');

function repl(file, search, replace) {
    if (!fs.existsSync(file)) return;
    const content = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, content.replace(search, replace));
}

// DeviceRegistrationModal.tsx
repl('src/components/DeviceRegistrationModal.tsx', /const dragOverNodeId = useStore\(\(s\) => s\.dragOverNodeId\);\n/, '');

// ErrorMarker.tsx
repl('src/components/ErrorMarker.tsx', /const state = useStore\.getState\(\);\n/, '');

// HierarchyTree.tsx
repl('src/components/HierarchyTree.tsx', /const dragOverNodeId = useStore\(\(state\) => state\.dragOverNodeId\);\n/, '');
repl('src/components/HierarchyTree.tsx', /const handleRenameConfirm = useCallback\(\(\) => \{[\s\S]*?\}, \[renamingId, renameValue, renameNode\]\);\n/, '');

// ImportedModelMesh.tsx
repl('src/components/ImportedModelMesh.tsx', /const highlightColor = new Color\("#4dabf7"\);\n/, '');
repl('src/components/ImportedModelMesh.tsx', /const highlightOpacity = [^;]*;\n/, '');
repl('src/components/ImportedModelMesh.tsx', /const hlArgs = [^;]*;\n/, '');
repl('src/components/ImportedModelMesh.tsx', /const hlCenter = [^;]*;\n/, '');

// ImportExportModal.tsx
repl('src/components/ImportExportModal.tsx', /import \{ Icon \} from "@iconify\/react";\n/, '');
repl('src/components/ImportExportModal.tsx', /import \{ ExportScope \} from "\.\.\/types";\n/, '');
repl('src/components/ImportExportModal.tsx', /const handleGroupImportClick = useCallback\(\(\) => \{[\s\S]*?\}, \[handleApplyImport, setOverwriteNodes\]\);\n/, '');
repl('src/components/ImportExportModal.tsx', /const handleApplyImport = useCallback\(\(\) => \{[\s\S]*?\}, \[exportScope, importData, importStatus, nodes, racks, registeredDevices, overwriteNodes, saveChanges, showToast\]\);\n/, '');

// Rack.tsx
repl('src/components/Rack.tsx', /const selectRack = useStore\(\(state\) => state\.selectRack\);\n/, '');
repl('src/components/Rack.tsx', /const isGlobalDragging = useStore\(\(state\) => state\.isDragging\);\n/, '');

// useStore.ts
repl('src/store/useStore.ts', /baselineRacks,\n\s*baselineModels,\n/g, '');
