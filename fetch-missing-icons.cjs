const fs = require('fs');
const https = require('https');
const path = require('path');

const bundlePath = path.join(__dirname, 'src', 'assets', 'icons-bundle.json');

const iconsToFetch = {
  'mdi': ['chevron-down', 'format-list-bulleted', 'file-upload-outline', 'package-variant-closed'],
  'fluent': ['chevron-up-24-regular', 'document-multiple-24-regular'],
  'ri': ['box-3-fill'],
  'line-md': ['loading-twotone-loop'],
  'ph': ['stack-fill'],
  'lucide': ['library']
};

async function fetchIcons(prefix, icons) {
  return new Promise((resolve, reject) => {
    const url = `https://api.iconify.design/${prefix}.json?icons=${icons.join(',')}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function run() {
  let bundle = [];
  if (fs.existsSync(bundlePath)) {
    bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
  }

  for (const [prefix, icons] of Object.entries(iconsToFetch)) {
    console.log(`Fetching ${prefix}...`);
    try {
      const data = await fetchIcons(prefix, icons);
      
      // Check if prefix already exists in bundle
      const existing = bundle.find(b => b.prefix === prefix);
      if (existing) {
        Object.assign(existing.icons, data.icons);
      } else {
        bundle.push(data);
      }
    } catch (e) {
      console.error(`Failed to fetch ${prefix}`, e);
    }
  }

  fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2));
  console.log('Icons updated successfully!');
}

run();
