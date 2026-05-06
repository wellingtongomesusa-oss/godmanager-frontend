import sharp from 'sharp';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const publicDir = join(root, 'public');
const src = join(publicDir, 'icon-512.png');

const NAVY = { r: 15, g: 23, b: 42, alpha: 1 }; // #0f172a

async function main() {
  // apple-touch-icon: 180x180, fundo opaco navy, logo 140x140 centrado
  const logo180 = await sharp(src).resize(140, 140, { fit: 'contain', background: NAVY }).toBuffer();
  await sharp({
    create: { width: 180, height: 180, channels: 3, background: NAVY },
  })
    .composite([{ input: logo180, gravity: 'center' }])
    .png()
    .toFile(join(publicDir, 'apple-touch-icon.png'));

  // og-image: 1200x630, fundo opaco navy, logo 280x280 centrado-acima
  const logo280 = await sharp(src).resize(280, 280, { fit: 'contain', background: NAVY }).toBuffer();
  await sharp({
    create: { width: 1200, height: 630, channels: 3, background: NAVY },
  })
    .composite([{ input: logo280, gravity: 'center' }])
    .png()
    .toFile(join(publicDir, 'og-image.png'));

  console.log('OK: apple-touch-icon.png + og-image.png gerados em /public');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
