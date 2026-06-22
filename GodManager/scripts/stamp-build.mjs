/**
 * Carimba build-date no GodManager_Premium.html antes do build (prebuild).
 * SHA: RAILWAY_GIT_COMMIT_SHA || SOURCE_VERSION || git rev-parse --short HEAD || 'dev'.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const htmlPath = join(root, 'public', 'GodManager_Premium.html');

function getSha() {
  const fromEnv = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.SOURCE_VERSION;
  if (fromEnv) return String(fromEnv).slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
}

const shortSha = getSha();
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
