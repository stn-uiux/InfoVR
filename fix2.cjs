const fs = require('fs');
const path = require('path');
const file = path.join('src', 'components', 'DashboardWidgets.tsx');
let content = fs.readFileSync(file, 'utf8');

const regex = /<\/div>\s*<\/div>\s*<\/div>\s*\{\/\* Widget 2:/;
content = content.replace(regex, '</div>\n            </div>\n          </div>\n          )}\n        </div>\n\n      {/* Widget 2:');

fs.writeFileSync(file, content, 'utf8');
