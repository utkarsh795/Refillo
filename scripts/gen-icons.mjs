/**
 * Generates PWA icons (192x192 and 512x512) from the source icon image.
 * Run once with: node scripts/gen-icons.mjs
 */
import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '../icon-src.jpg');
const OUT = join(__dirname, '../public/icons');

mkdirSync(OUT, { recursive: true });

const sizes = [192, 512];

for (const size of sizes) {
  await sharp(SRC)
    .resize(size, size, { fit: 'cover' })
    .png()
    .toFile(join(OUT, `icon-${size}.png`));
  console.log(`✓ icon-${size}.png`);
}
console.log('Icons generated in public/icons/');
