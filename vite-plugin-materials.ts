import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import type { Plugin } from 'vite';

const PUBLIC_DIR = path.resolve(__dirname, 'public');

// Standard IEEE 802.3 CRC-32 lookup table (fallback if zlib.crc32 is unavailable)
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[n] = c >>> 0;
}

function computeCrc32(buf: Buffer): number {
  if (typeof zlib.crc32 === 'function') {
    return zlib.crc32(buf) >>> 0;
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const STORE_ONLY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.woff', '.woff2', '.zip'
]);

/**
 * Pure Node.js ZIP builder (cross-platform: works on Windows & Vercel Linux without external binaries).
 * Sets UTF-8 filename flag (bit 11 = 0x0800) so Korean filenames like InfoVR_데모실행.bat extract cleanly.
 */
function createZipFromDir(sourceDir: string, outZipPath: string, rootFolderName = 'InfoVR_Offline_Demo'): void {
  const files: { fullPath: string; relPath: string }[] = [];

  function walk(currentDir: string, relBase: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      // Skip hidden files, docs folder (unused in demo), or existing zip files
      if (entry.name.startsWith('.') || entry.name === 'docs' || entry.name.endsWith('.zip')) {
        continue;
      }
      const full = path.join(currentDir, entry.name);
      const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(full, rel);
      } else if (entry.isFile()) {
        files.push({ fullPath: full, relPath: `${rootFolderName}/${rel}` });
      }
    }
  }

  walk(sourceDir, '');

  const fd = fs.openSync(outZipPath, 'w');
  const centralDirChunks: Buffer[] = [];
  let offset = 0;

  const now = new Date();
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff;
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;

  try {
    for (const file of files) {
      const nameBuf = Buffer.from(file.relPath, 'utf8');
      const rawBuf = fs.readFileSync(file.fullPath);
      const crc = computeCrc32(rawBuf);
      const ext = path.extname(file.fullPath).toLowerCase();

      let method = 0; // 0 = STORE, 8 = DEFLATE
      let dataBuf = rawBuf;
      if (!STORE_ONLY_EXTENSIONS.has(ext) && rawBuf.length > 64) {
        const deflated = zlib.deflateRawSync(rawBuf, { level: 1 });
        if (deflated.length < rawBuf.length) {
          method = 8;
          dataBuf = deflated;
        }
      }

      const localHeader = Buffer.alloc(30 + nameBuf.length);
      localHeader.writeUInt32LE(0x04034b50, 0); // Local file header signature
      localHeader.writeUInt16LE(20, 4);         // Version needed to extract (2.0)
      localHeader.writeUInt16LE(0x0800, 6);     // General purpose bit flag (bit 11: UTF-8 filename)
      localHeader.writeUInt16LE(method, 8);     // Compression method
      localHeader.writeUInt16LE(dosTime, 10);
      localHeader.writeUInt16LE(dosDate, 12);
      localHeader.writeUInt32LE(crc, 14);
      localHeader.writeUInt32LE(dataBuf.length, 18);
      localHeader.writeUInt32LE(rawBuf.length, 22);
      localHeader.writeUInt16LE(nameBuf.length, 26);
      localHeader.writeUInt16LE(0, 28);         // Extra field length
      nameBuf.copy(localHeader, 30);

      fs.writeSync(fd, localHeader);
      fs.writeSync(fd, dataBuf);

      const centralHeader = Buffer.alloc(46 + nameBuf.length);
      centralHeader.writeUInt32LE(0x02014b50, 0); // Central directory file header signature
      centralHeader.writeUInt16LE(20, 4);         // Version made by
      centralHeader.writeUInt16LE(20, 6);         // Version needed to extract
      centralHeader.writeUInt16LE(0x0800, 8);     // UTF-8 filename flag
      centralHeader.writeUInt16LE(method, 10);
      centralHeader.writeUInt16LE(dosTime, 12);
      centralHeader.writeUInt16LE(dosDate, 14);
      centralHeader.writeUInt32LE(crc, 16);
      centralHeader.writeUInt32LE(dataBuf.length, 20);
      centralHeader.writeUInt32LE(rawBuf.length, 24);
      centralHeader.writeUInt16LE(nameBuf.length, 28);
      centralHeader.writeUInt16LE(0, 30);         // Extra field length
      centralHeader.writeUInt16LE(0, 32);         // File comment length
      centralHeader.writeUInt16LE(0, 34);         // Disk number start
      centralHeader.writeUInt16LE(0, 36);         // Internal file attributes
      centralHeader.writeUInt32LE(0, 38);         // External file attributes
      centralHeader.writeUInt32LE(offset, 42);    // Relative offset of local header
      nameBuf.copy(centralHeader, 46);

      centralDirChunks.push(centralHeader);
      offset += localHeader.length + dataBuf.length;
    }

    const centralDirBuf = Buffer.concat(centralDirChunks);
    fs.writeSync(fd, centralDirBuf);

    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);            // End of central directory signature
    eocd.writeUInt16LE(0, 4);                     // Number of this disk
    eocd.writeUInt16LE(0, 6);                     // Disk where central directory starts
    eocd.writeUInt16LE(files.length, 8);          // Number of central directory records on this disk
    eocd.writeUInt16LE(files.length, 10);         // Total number of central directory records
    eocd.writeUInt32LE(centralDirBuf.length, 12); // Size of central directory
    eocd.writeUInt32LE(offset, 16);               // Offset of start of central directory
    eocd.writeUInt16LE(0, 20);                    // Comment length
    fs.writeSync(fd, eocd);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Vite plugin that dynamically serves file listings from public/ subdirectories
 * and builds both the Web (Vercel) version (dist/) and Offline Demo version (dist-demo/ & dist/InfoVR_Offline_Demo.zip).
 */
export function publicAssetsPlugin(): Plugin {
  const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tga', '.bmp']);
  const MODEL_EXTENSIONS = new Set(['.gltf', '.glb']);

  function scanDir(subDir: string, extensions: Set<string>): string[] {
    const fullPath = path.join(PUBLIC_DIR, subDir);
    try {
      if (!fs.existsSync(fullPath)) return [];
      return fs.readdirSync(fullPath)
        .filter(f => {
          const ext = path.extname(f).toLowerCase();
          return extensions.has(ext) && !f.startsWith('.');
        })
        .sort();
    } catch {
      return [];
    }
  }

  return {
    name: 'vite-plugin-public-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ? new URL(req.url, 'http://localhost').pathname : '';
        if (url === '/__materials_manifest') {
          const files = scanDir('materials', IMAGE_EXTENSIONS);
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-cache');
          res.end(JSON.stringify(files));
          return;
        }
        if (url === '/__models_manifest') {
          const files = scanDir('models', MODEL_EXTENSIONS);
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-cache');
          res.end(JSON.stringify(files));
          return;
        }
        if (url === '/InfoVR_Offline_Demo.zip') {
          const zipPath = path.resolve(__dirname, 'dist', 'InfoVR_Offline_Demo.zip');
          if (fs.existsSync(zipPath)) {
            const stat = fs.statSync(zipPath);
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Length', String(stat.size));
            res.setHeader('Content-Disposition', 'attachment; filename="InfoVR_Offline_Demo.zip"');
            fs.createReadStream(zipPath).pipe(res);
            return;
          }
        }
        if (req.method === 'POST' && url === '/__save_custom_models') {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              const customModelsPath = path.resolve(__dirname, './src/utils/customModels.json');
              fs.writeFileSync(customModelsPath, body, 'utf-8');
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: String(err) }));
            }
          });
          return;
        }
        next();
      });
    },
    // For production build:
    // 1) Generate static manifest files in dist/
    // 2) Create dist-demo/ (Offline Demo version where demo download button is hidden)
    // 3) Package dist-demo/ into dist/InfoVR_Offline_Demo.zip so the Web/Vercel version (dist/) can offer it for download
    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist');
      const demoOutDir = path.resolve(__dirname, 'dist-demo');
      if (!fs.existsSync(outDir)) return;

      fs.writeFileSync(
        path.join(outDir, '__materials_manifest'),
        JSON.stringify(scanDir('materials', IMAGE_EXTENSIONS))
      );
      fs.writeFileSync(
        path.join(outDir, '__models_manifest'),
        JSON.stringify(scanDir('models', MODEL_EXTENSIONS))
      );

      // Remove any stale zip in dist before copying to dist-demo
      const oldZipInDist = path.join(outDir, 'InfoVR_Offline_Demo.zip');
      if (fs.existsSync(oldZipInDist)) {
        fs.unlinkSync(oldZipInDist);
      }

      // 1. Build dist-demo (standalone local demo version without download UI)
      if (fs.existsSync(demoOutDir)) {
        fs.rmSync(demoOutDir, { recursive: true, force: true });
      }
      fs.cpSync(outDir, demoOutDir, { recursive: true });

      const demoIndexPath = path.join(demoOutDir, 'index.html');
      if (fs.existsSync(demoIndexPath)) {
        let html = fs.readFileSync(demoIndexPath, 'utf-8');
        if (!html.includes('__INFOVR_OFFLINE_DEMO__')) {
          html = html.replace(
            '<head>',
            '<head>\n  <script>window.__INFOVR_OFFLINE_DEMO__ = true;</script>'
          );
          fs.writeFileSync(demoIndexPath, html, 'utf-8');
        }
      }

      // 2. Package dist-demo into dist/InfoVR_Offline_Demo.zip for Web/Vercel download
      console.log('\n[offline-demo] Packaging dist-demo into dist/InfoVR_Offline_Demo.zip...');
      createZipFromDir(demoOutDir, oldZipInDist, 'InfoVR_Offline_Demo');
      const zipSizeMb = (fs.statSync(oldZipInDist).size / (1024 * 1024)).toFixed(2);
      console.log(`[offline-demo] Created dist/InfoVR_Offline_Demo.zip (${zipSizeMb} MB) & dist-demo/\n`);
    }
  };
}
