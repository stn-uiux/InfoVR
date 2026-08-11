const fs = require('fs');
const path = require('path');

const iconMap = {
  ArrowUpTrayIcon: 'material-symbols:upload',
  ArrowDownTrayIcon: 'material-symbols:download',
  ArchiveBoxIcon: 'material-symbols:archive',
  FloppyIcon: 'material-symbols:save',
  ArrowsPointingOutIcon: 'material-symbols:fullscreen',
  ChevronDownIcon: 'material-symbols:keyboard-arrow-down',
  TrashIcon: 'material-symbols:delete',
  ExclamationCircleIcon: 'material-symbols:error',
  ChartBarIcon: 'material-symbols:bar-chart',
  PencilIcon: 'material-symbols:edit',
  MagnifyingGlassIcon: 'material-symbols:search',
  BuildingOfficeIcon: 'material-symbols:business',
  FolderIcon: 'material-symbols:folder',
  ServerStackIcon: 'material-symbols:dns',
  CubeIcon: 'material-symbols:inventory-2',
  CloudArrowUpIcon: 'material-symbols:cloud-upload',
  Square2StackIcon: 'material-symbols:layers',
  ExclamationTriangleIcon: 'material-symbols:warning',
  FireIcon: 'material-symbols:local-fire-department',
  PlusIcon: 'material-symbols:add',
  Squares2x2Icon: 'material-symbols:grid-view',
  ChevronDoubleLeftIcon: 'material-symbols:keyboard-double-arrow-left',
  ChevronDoubleRightIcon: 'material-symbols:keyboard-double-arrow-right',
  MapPinIcon: 'material-symbols:location-on',
  HomeModernIcon: 'material-symbols:home',
  CheckboxSharpIcon: 'material-symbols:check-box',
  BlocksSharpIcon: 'material-symbols:grid-on'
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // 1. Remove Icons import
  const importRegex = /import\s*\{[^}]*\}\s*from\s*['"](?:\.\/|\.\.\/)*(?:components\/)?Icons['"];?\s*\n?/g;
  if (importRegex.test(content)) {
    content = content.replace(importRegex, '');
    changed = true;
  } else if (!Object.keys(iconMap).some(icon => content.includes(icon))) {
    // if no icons are used and no import, skip
    return;
  }

  // 2. Add @iconify/react import if not exists and we are going to use it
  if (!content.includes('@iconify/react')) {
    content = import { Icon } from "@iconify/react";\n + content;
    changed = true;
  }

  // 3. Replace icon components
  for (const [iconName, iconifyName] of Object.entries(iconMap)) {
    // match <IconName ... /> or <IconName></IconName>
    const tagRegex = new RegExp(<([^>]*)>, 'g');
    if (tagRegex.test(content)) {
      content = content.replace(tagRegex, (match, props) => {
        // check if props has className
        if (props.includes('className=')) {
          // append 'icon' to existing className
          let newProps = props.replace(/className=['"]([^'"]*)['"]/, (m, cls) => {
            const classes = cls.split(' ').filter(c => c !== 'icon');
            return className="icon ".trim(); // wait, literal string
          });
          // actually simpler regex
          newProps = props.replace(/className=['"]([^'"]*)['"]/, 'className="icon "');
          return <Icon icon="">;
        } else {
          return <Icon icon="" className="icon">;
        }
      });
      
      // also replace closing tags if they exist
      const closeTagRegex = new RegExp(</>, 'g');
      content = content.replace(closeTagRegex, </Icon>);
      
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated ' + filePath);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

walkDir('src');
