const fs = require('fs');
const path = require('path');
const historyDir = path.join(process.env.APPDATA, 'Code', 'User', 'History');

const targetFiles = [
  'Breadcrumb.tsx',
  'DeviceModal.tsx',
  'DevicePanel.tsx',
  'FocusCarousel.tsx',
  'ImportExportModal.tsx',
  'ModulePopover.tsx',
  'UnsavedChangesDialog.tsx',
  'main.tsx',
  'port-sentinel/App.tsx',
  'App.tsx'
];

fs.readdirSync(historyDir).forEach(folder => {
  const entriesPath = path.join(historyDir, folder, 'entries.json');
  if (fs.existsSync(entriesPath)) {
    const entries = JSON.parse(fs.readFileSync(entriesPath, 'utf8'));
    const res = entries.resource;
    if (res && res.includes('stn-uiux') && res.includes('ArcVRack')) {
      for (const target of targetFiles) {
        // Normalize slashes for comparison
        if (res.replace(/%2F/g, '/').endsWith(target)) {
          console.log(`Found history for ${target} in ${folder}`);
          const latestEntry = entries.entries[entries.entries.length - 1];
          console.log(`Latest entry ID: ${latestEntry.id}, Time: ${new Date(latestEntry.timestamp)}`);
        }
      }
    }
  }
});
