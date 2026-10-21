/**
 * generate-icons.mjs
 * Resizes icon-src.jpg into 192×192 and 512×512 PNGs for PWA manifest.
 * Run: node scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const src = resolve(root, 'icon-src.jpg');
const outDir = resolve(root, 'public', 'icons');

if (!existsSync(src)) {
  console.error('❌  icon-src.jpg not found in project root.');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

for (const size of [192, 512]) {
  const dest = resolve(outDir, `icon-${size}.png`);
  await sharp(src)
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .png({ compressionLevel: 9 })
    .toFile(dest);
  console.log(`✓  public/icons/icon-${size}.png`);
}

console.log('\nDone! Icons are ready in public/icons/');
