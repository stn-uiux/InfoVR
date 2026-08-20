const fs = require('fs');
let html = fs.readFileSync('docs/화면설계서.html', 'utf8');
const defaultStateStr = fs.readFileSync('temp_json.txt', 'utf8').trim();

// 1. Update localStorage.setItem
html = html.replace(/localStorage\.setItem\('storyboard_markers_v4', JSON\.stringify\(state\)\);/g, "localStorage.setItem('storyboard_markers_v5', JSON.stringify(state));");

// 2. Update clearAllData
html = html.replace(/localStorage\.removeItem\('storyboard_markers_v4'\);/g, "localStorage.removeItem('storyboard_markers_v5');\n        location.reload();"); // Add reload if it was removed

// 3. Update loadMarkers function body
const oldLoadMarkersRegex = /function loadMarkers\(\) \{\s*let saved = localStorage\.getItem\('storyboard_markers_v4'\);\s*if \(saved\) \{/g;
const newLoadMarkers = `function loadMarkers() {
      let saved = localStorage.getItem('storyboard_markers_v5');
      if (!saved) {
        // Inject default AI generated markers based on UI keyword mapping
        saved = JSON.stringify(${defaultStateStr});
      }
      if (saved) {`;

if (oldLoadMarkersRegex.test(html)) {
  html = html.replace(oldLoadMarkersRegex, newLoadMarkers);
  fs.writeFileSync('docs/화면설계서.html', html);
  console.log('Successfully injected v5 markers.');
} else {
  console.log('Could not find loadMarkers pattern to replace.');
}
