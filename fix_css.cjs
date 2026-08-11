const fs = require('fs');
const path = require('path');
const file = path.join('src', 'css', 'components.css');
let css = fs.readFileSync(file, 'utf8');

// Replace everything after .error-list-empty
const regex = /\.error-list-empty \{[\s\S]*$/;
const replacement = .error-list-empty {
  padding: 32px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 12px;
}

.error-list-table th:nth-child(1),
.error-list-table td:nth-child(1) {
  text-align: center;
  vertical-align: middle;
}
;
css = css.replace(regex, replacement);
fs.writeFileSync(file, css, 'utf8');
