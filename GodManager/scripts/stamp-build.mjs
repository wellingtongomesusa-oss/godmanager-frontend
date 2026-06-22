/**
 * Carimba build-date no GodManager_Premium.html antes do build (prebuild).
 * Fonte: RAILWAY_GIT_COMMIT_SHA || SOURCE_VERSION || 'dev' (7 chars).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const htmlPath = join(root, 'public', 'GodManager_Premium.html');

const raw =
  process.env.RAILWAY_GIT_COMMIT_SHA ||
  process.env.SOURCE_VERSION ||
  'dev';
const shortSha = raw === 'dev' ? 'dev' : String(raw).slice(0, 7);
const date = new Date().toISOString().slice(0, 10);
const stamp = `${date} ${shortSha}`;

let html = readFileSync(htmlPath, 'utf8');
const before = html;

html = html.replace(/<!-- Build: .*? -->/, `<!-- Build: ${stamp} -->`);
html = html.replace(
  /<meta name="build-date" content=".*?">/,
  `<meta name="build-date" content="${stamp}">`,
);

if (html === before) {
  console.log('[stamp-build] already stamped:', stamp);
} else {
  writeFileSync(htmlPath, html, 'utf8');
  console.log('[stamp-build]', stamp);
}
