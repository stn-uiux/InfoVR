const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp'); // Try CJS first

const dirs = [
  path.join(__dirname, 'src', 'assets'),
  path.join(__dirname, 'src', 'assets', 'gwacheon')
];

async function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file.endsWith('.png') && !file.endsWith('_thumb.png')) {
      const filePath = path.join(dir, file);
      const thumbPath = path.join(dir, file.replace('.png', '_thumb.png'));
      if (!fs.existsSync(thumbPath)) {
        console.log(`Processing ${file}...`);
        try {
          const image = await Jimp.read(filePath);
          image.resize({ w: 256 }); // Resize to width 256
          await image.write(thumbPath);
          console.log(`Saved ${thumbPath}`);
        } catch (e) {
          console.error(`Error processing ${file}:`, e);
        }
      }
    }
  }
}

async function run() {
  for (const dir of dirs) {
    if (fs.existsSync(dir)) {
      await processDir(dir);
    }
  }
  console.log("Done!");
}
run();
