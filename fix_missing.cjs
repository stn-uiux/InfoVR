const fs = require('fs');
const path = require('path');
const file = path.join('src', 'components', 'DashboardWidgets.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add isErrorListExpanded
const stateRegex = /const \[selectedSeverity, setSelectedSeverity\] = useState<ErrorLevel \| null>\(\s*"critical",\s*\);/;
content = content.replace(stateRegex, 'const [isErrorListExpanded, setIsErrorListExpanded] = useState(false);');

// 2. Add displayErrors (and severityOrder) by replacing filteredErrors
const filteredErrorsRegex = /const filteredErrors = useMemo\(\(\) => \{\s*if \(\!selectedSeverity\) return \[\];\s*return allErrors\.filter\(\(err\) => err\.severity === selectedSeverity\);\s*\}, \[allErrors, selectedSeverity\]\);/;
const displayErrorsLogic = const severityOrder: Record<ErrorLevel, number> = {
    critical: 0,
    major: 1,
    minor: 2,
    warning: 3,
  };

  const displayErrors = useMemo(() => {
    return [...allErrors].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }, [allErrors]);;
content = content.replace(filteredErrorsRegex, displayErrorsLogic);

// 3. Remove Icons import
content = content.replace(/import \{ ExclamationCircleIcon, ChartBarIcon \} from "\.\/Icons";\r?\n/, '');

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed missing states and variables');
