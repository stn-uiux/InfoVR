const fs = require('fs');

function repl(file, search, replace) {
    if (!fs.existsSync(file)) return;
    const content = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, content.replace(search, replace));
}

// CameraController.tsx
repl('src/components/CameraController.tsx', /const orbitControls = useStore\.getState\(\)\._controlsRef as any;\n\s*if \(orbitControls\) orbitControls\.enabled = false;\n/g, '');
repl('src/components/CameraController.tsx', /const targetVec = new Vector3\(\.\.\.target\);\n/g, '');
repl('src/components/CameraController.tsx', /const orbitControls = [^;]+;\n/g, '');
repl('src/components/CameraController.tsx', /const targetVec = [^;]+;\n/g, '');

// DeviceRegistrationModal.tsx
repl('src/components/DeviceRegistrationModal.tsx', /const dragOverNodeId = useStore\(\(s\) => s\.dragOverNodeId\);\n/g, '');

// ErrorMarker.tsx
repl('src/components/ErrorMarker.tsx', /const state = useStore\.getState\(\);\n/g, '');

// HierarchyTree.tsx
repl('src/components/HierarchyTree.tsx', /const dragOverNodeId = useStore\(\(state\) => state\.dragOverNodeId\);\n/g, '');
repl('src/components/HierarchyTree.tsx', /const handleRenameConfirm = \([\s\S]*?\}?;\n/g, ''); // maybe fail, but let's just do a string replacement if possible or ignore
// Better: remove handleRenameConfirm entirely
repl('src/components/HierarchyTree.tsx', /const handleRenameConfirm = \(\) => \{[\s\S]*?^\s*\};\n/gm, '');

// ImportedModelMesh.tsx
repl('src/components/ImportedModelMesh.tsx', /const highlightColor = new Color\("#4dabf7"\);\n/g, '');
repl('src/components/ImportedModelMesh.tsx', /const highlightOpacity = [^;]+;\n/g, '');
repl('src/components/ImportedModelMesh.tsx', /const hlArgs:[^;]+;\n/g, '');
repl('src/components/ImportedModelMesh.tsx', /const hlCenter = [^;]+;\n/g, '');
repl('src/components/ImportedModelMesh.tsx', /const hlArgs = [^;]+;\n/g, '');

// ImportExportModal.tsx
repl('src/components/ImportExportModal.tsx', /import \{ Icon \} from "@iconify\/react";\n/g, '');
repl('src/components/ImportExportModal.tsx', /import \{ ExportScope \} from "\.\.\/types";\n/g, '');
repl('src/components/ImportExportModal.tsx', /const handleGroupImportClick = \(\) => \{[\s\S]*?^\s*\};\n/gm, '');
repl('src/components/ImportExportModal.tsx', /const handleApplyImport = \(\) => \{[\s\S]*?^\s*\};\n/gm, '');

// Rack.tsx
repl('src/components/Rack.tsx', /const selectRack = useStore\(\(state\) => state\.selectRack\);\n/g, '');
repl('src/components/Rack.tsx', /const isGlobalDragging = useStore\(\(state\) => state\.isDragging\);\n/g, '');

// useStore.ts
repl('src/store/useStore.ts', /baselineRacks,\n\s*baselineModels,\n/g, '');
