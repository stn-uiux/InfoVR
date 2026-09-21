const fs = require('fs');
const path = require('path');
const dir = 'C:/Users/user/workspace/stn-uiux/InfoVR/src/assets/gwacheon';
const files = fs.readdirSync(dir);
const models = new Map();
files.forEach(f => {
  if (!f.endsWith('.png')) return;
  const match = f.match(/^\[(\d+)U\]\s*(.+)\.png$/i);
  if (match) {
    const uSize = parseInt(match[1], 10);
    let name = match[2].trim();
    if (name.endsWith('_back')) name = name.slice(0, -5);
    if (name.endsWith('_front')) name = name.slice(0, -6);
    if (name.endsWith('_rear')) name = name.slice(0, -5);
    if (name.endsWith(' back')) name = name.slice(0, -5);
    if (name.endsWith(' front')) name = name.slice(0, -6);
    if (name.endsWith(' rear')) name = name.slice(0, -5);
    models.set(name, uSize);
  }
});

const existing = [
  "7250 IXR-e big", "7250 IXR-e small", "7250 IXR-ec", "7250 IXR-s", "7250 IXR-X1",
  "7250 IXR-X3", "7250 IXR-Xs", "7250 IXR-R4", "7250 IXR-R6", "7250 IXR-R6d", "7250 IXR-6",
  "7250 IXR-R6dl", "7250 IXR-10", "AS7326-56X", "AXGATE 90", "DELL-R640", "ECS4650-54T", "AS-4125GS-TNRT2"
];

const results = [];
for (const [k, v] of models.entries()) {
  if (!existing.includes(k)) {
    results.push(`  { modelName: "${k}", type: "Server", uSize: ${v}, vendor: "Unknown" },`);
  }
}
console.log(results.join('\n'));
