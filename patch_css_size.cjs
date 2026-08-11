const fs = require('fs');
const path = require('path');

const cssFile = path.resolve('c:/Users/user/workspace/stn-uiux/arcVRack/src/css/features.css');
let css = fs.readFileSync(cssFile, 'utf8');

// 1. Font Family
css = css.replace(/font-family: ui-sans-serif, system-ui, sans-serif;/g, "font-family: 'Pretendard', ui-sans-serif, system-ui, sans-serif;");

// 2. Main layout padding
css = css.replace(/\.sentinel-main\s*{\s*max-width:\s*1920px;\s*margin:\s*0\s*auto;\s*padding:\s*2\.5rem;/g, ".sentinel-main {\n  max-width: 1920px;\n  margin: 0 auto;\n  padding: 1.5rem;");
css = css.replace(/\.sentinel-layout\s*{\s*display:\s*grid;\s*grid-template-columns:\s*1fr;\s*gap:\s*2\.5rem;/g, ".sentinel-layout {\n  display: grid;\n  grid-template-columns: 1fr;\n  gap: 1.5rem;");
css = css.replace(/\.sentinel-canvas-section\s*{\s*display:\s*flex;\s*flex-direction:\s*column;\s*gap:\s*1\.5rem;/g, ".sentinel-canvas-section {\n  display: flex;\n  flex-direction: column;\n  gap: 1rem;");
css = css.replace(/\.sentinel-sidebar-section\s*>\s*\*\s*\+\s*\*\s*{\s*margin-top:\s*2rem;/g, ".sentinel-sidebar-section > * + * {\n  margin-top: 1rem;");

// 3. Button heights
css = css.replace(/\.sentinel-header__back-btn\s*{\s*width:\s*2\.75rem;\s*height:\s*2\.75rem;/g, ".sentinel-header__back-btn {\n  width: 28px;\n  height: 28px;");
css = css.replace(/\.sentinel-header__logo\s*{\s*width:\s*2\.75rem;\s*height:\s*2\.75rem;/g, ".sentinel-header__logo {\n  width: 28px;\n  height: 28px;");
css = css.replace(/\.sentinel-toolbar__add-btn\s*{\s*height:\s*2\.5rem;/g, ".sentinel-toolbar__add-btn {\n  height: 28px;");
css = css.replace(/\.sentinel-toolbar__edit-btn\s*{\s*height:\s*2\.5rem;/g, ".sentinel-toolbar__edit-btn {\n  height: 28px;");
css = css.replace(/\.sentinel-toolbar__icon-btn\s*{\s*width:\s*2\.5rem;\s*height:\s*2\.5rem;/g, ".sentinel-toolbar__icon-btn {\n  width: 28px;\n  height: 28px;");
css = css.replace(/\.sentinel-zoom__fit-btn\s*{\s*padding:\s*0\.75rem\s*0\.375rem;/g, ".sentinel-zoom__fit-btn {\n  padding: 0 0.5rem;\n  height: 28px;");
css = css.replace(/\.sentinel-analyze-btn\s*{\s*width:\s*100%;\s*height:\s*3\.5rem;/g, ".sentinel-analyze-btn {\n  width: 100%;\n  height: 28px;");

fs.writeFileSync(cssFile, css, 'utf8');
console.log('CSS updated successfully');
