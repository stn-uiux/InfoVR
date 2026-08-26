const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'infoVR_ui_design_spec.html');
const jsonPath = path.join(__dirname, 'markers.json');

const content = fs.readFileSync(htmlPath, 'utf8');
const markersJson = fs.readFileSync(jsonPath, 'utf8').trim();

// Use regex to replace the JSON.stringify(...) part
const regex = /saved = JSON\.stringify\(\{[\s\S]*?\}\);/;
const replacement = `saved = JSON.stringify(${markersJson});`;

const newContent = content.replace(regex, replacement);

fs.writeFileSync(htmlPath, newContent, 'utf8');
console.log('Replacement successful.');
