const fs = require('fs');
const path = require('path');
const file = path.join('src', 'components', 'DashboardWidgets.tsx');
let content = fs.readFileSync(file, 'utf8');

// Replace the start of Widget 1
content = content.replace(
  /\{\/\* Widget 1: Error Summary - Redesigned Panel \*\/\}\s*<div className="error-panel">/,
  \{/* Widget 1 Wrapper to position list correctly */}
      <div style={{ position: 'relative' }}>
      {/* Widget 1: Error Summary - Redesigned Panel */}
      <div className="error-panel">\
);

// Replace the end of Widget 1.5
content = content.replace(
  /<\/div>\s*<\/div>\s*\)\}\s*\{\/\* Widget 2:/,
  \</div>
        </div>
      )}
      </div>

      {/* Widget 2:\
);

fs.writeFileSync(file, content, 'utf8');
