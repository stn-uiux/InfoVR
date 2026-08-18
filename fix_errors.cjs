const fs = require('fs');

function repl(file, search, replace) {
    if (!fs.existsSync(file)) return;
    const content = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, content.replace(search, replace));
}

repl('src/components/BaseModal.tsx', /import React, \{\s*/, 'import { ');
repl('src/components/BaseModal.tsx', /import React from ['"]react['"];\n/, '');
repl('src/components/DeviceTooltip.tsx', /import React, \{\s*/, 'import { ');
repl('src/components/DeviceTooltip.tsx', /import React from ['"]react['"];\n/, '');
repl('src/components/InitialLoader.tsx', /import React, \{\s*/, 'import { ');
repl('src/components/InitialLoader.tsx', /import React from ['"]react['"];\n/, '');
repl('src/components/InitialLoader.tsx', /const \[hasStarted, setHasStarted\] =/, 'const [, setHasStarted] =');

repl('src/components/CameraController.tsx', /const orbitControls = useStore\.getState\(\)\._controlsRef as any;\n\s*if \(orbitControls\) orbitControls\.enabled = false;\n/, '');
repl('src/components/CameraController.tsx', /const targetVec = new Vector3\(\.\.\.target\);\n/, '');

repl('src/components/DeviceRegistrationModal.tsx', /const dragOverNodeId = useStore\(\(s\) => s\.dragOverNodeId\);\n/, '');
repl('src/components/ErrorMarker.tsx', /const state = useStore\.getState\(\);\n/, '');

repl('src/components/HierarchyTree.tsx', /getNodeEquipmentCount,\s*/, '');
repl('src/components/HierarchyTree.tsx', /const dragOverNodeId = useStore\(\(state\) => state\.dragOverNodeId\);\n/, '');
repl('src/components/HierarchyTree.tsx', /const handleRenameConfirm = \([\s\S]*?\}?;\n/g, ''); // Be careful here, maybe manual fix

repl('src/components/ImportedModelMesh.tsx', /const highlightColor = new Color\("#4dabf7"\);\n/, '');
repl('src/components/ImportedModelMesh.tsx', /const highlightOpacity = [^;]*;\n/, '');
repl('src/components/ImportedModelMesh.tsx', /const hlArgs = [^;]*;\n/, '');
repl('src/components/ImportedModelMesh.tsx', /const hlCenter = [^;]*;\n/, '');

repl('src/components/ImportExportModal.tsx', /import \{ Icon \} from "@iconify\/react";\n/, '');
repl('src/components/ImportExportModal.tsx', /import \{ ExportScope \} from "\.\.\/types";\n/, '');
repl('src/components/ImportExportModal.tsx', /getNodeName,\s*/, '');
repl('src/components/ImportExportModal.tsx', /getAncestorPath,\s*/, '');
repl('src/components/ImportExportModal.tsx', /getNodeEquipmentCount,\s*/, '');
repl('src/components/ImportExportModal.tsx', /const \[importStatus, setImportStatus\]/, 'const [, setImportStatus]');
repl('src/components/ImportExportModal.tsx', /const \[overwriteNodes, setOverwriteNodes\]/, 'const [overwriteNodes]');
repl('src/components/ImportExportModal.tsx', /const handleGroupImportClick = [\s\S]*?;\n\n/g, ''); // maybe fail
repl('src/components/ImportExportModal.tsx', /const handleApplyImport = [\s\S]*?;\n\n/g, '');

repl('src/components/Rack.tsx', /RoundedBox,\s*/, '');
repl('src/components/Rack.tsx', /Outlines,\s*/, '');
repl('src/components/Rack.tsx', /const selectRack = useStore\(\(state\) => state\.selectRack\);\n/, '');
repl('src/components/Rack.tsx', /const isGlobalDragging = useStore\(\(state\) => state\.isDragging\);\n/, '');

repl('src/store/useStore.ts', /baselineRacks,\n\s*baselineModels,\n/g, '');
