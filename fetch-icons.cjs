const fs = require('fs');
const path = require('path');
const https = require('https');

// 정규식을 통해 소스코드 내에서 사용된 아이콘들을 자동 추출합니다.
// 예: <Icon icon="mdi:magic" /> 또는 icon: "ph:warning-fill"
const iconRegex = /(?:<Icon[^>]+icon=["']([^"']+)["'])|(?:icon:\s*["']([^"']+)["'])/g;

function scanDirectory(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      scanDirectory(fullPath, fileList);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

async function fetchIcons() {
  console.log('Scanning src/ directory for Iconify icons...');
  const files = scanDirectory(path.join(__dirname, 'src'));
  const foundIcons = new Set();

  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    let match;
    while ((match = iconRegex.exec(content)) !== null) {
      const iconName = match[1] || match[2];
      if (iconName && iconName.includes(':')) {
        foundIcons.add(iconName);
      }
    }
  });

  const icons = Array.from(foundIcons);
  console.log(`Found ${icons.length} unique icons in your code.`);
  console.log(icons);

  // Group by prefix (e.g., mdi, material-symbols, ph)
  const grouped = {};
  icons.forEach(icon => {
    const [prefix, name] = icon.split(':');
    if (!grouped[prefix]) grouped[prefix] = [];
    grouped[prefix].push(name);
  });

  const bundle = [];
  for (const [prefix, names] of Object.entries(grouped)) {
    // Iconify API limit workaround: filter duplicates and construct URL
    const uniqueNames = Array.from(new Set(names));
    const url = `https://api.iconify.design/${prefix}.json?icons=${uniqueNames.join(',')}`;
    console.log(`Fetching ${prefix} collection...`);
    
    try {
      const data = await new Promise((resolve, reject) => {
        https.get(url, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            if (res.statusCode === 200) {
              resolve(JSON.parse(body));
            } else {
              reject(new Error(`Failed with status ${res.statusCode}`));
            }
          });
        }).on('error', reject);
      });
      bundle.push(data);
    } catch (e) {
      console.error(`Failed to fetch ${prefix}:`, e.message);
    }
  }
  
  fs.writeFileSync(path.join(__dirname, 'src/assets/icons-bundle.json'), JSON.stringify(bundle, null, 2));
  console.log('\n✅ Successfully updated src/assets/icons-bundle.json with all icons!');
}

fetchIcons();
