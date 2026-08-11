const fs = require('fs');
const path = require('path');
const file = path.join('src', 'components', 'DashboardWidgets.tsx');
let content = fs.readFileSync(file, 'utf8');

// Remove unused state
content = content.replace(/const \[selectedSeverity, setSelectedSeverity\] = useState<ErrorLevel \| null>\(\s*"critical",\s*\);\n/, '');

fs.writeFileSync(file, content, 'utf8');
