/**
 * Gera sample HTML de auditoria em ~/Downloads para revisao visual.
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3101';
const users = JSON.parse(readFileSync(join(__dir, '.smoke-vendor-free-users.json'), 'utf8'));

function sessionCookieValue(userId, role) {
  const exp = Date.now() + 24 * 60 * 60 * 1000;
  return Buffer.from(JSON.stringify({ userId, role, exp })).toString('base64');
}

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
await context.addCookies([
  {
    name: 'gm_auth',
    value: sessionCookieValue(users.admin.id, users.admin.role),
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  },
]);
const page = await context.newPage();
await page.goto(`${BASE}/GodManager_Premium.html`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof ltpExportAudit === 'function', { timeout: 60000 });

const meta = await page.evaluate(() => {
  const mock = [
    {
      id: 'P0001',
      address: '4521 Palm Ave, Kissimmee FL',
      owner: 'John Smith',
      tenant: 'Maria Oliveira',
      bedrooms: 4,
      bathrooms: 3,
      sqft: 2100,
      moveIn: '2024-03-01',
      occupancy: 'rented',
      rent: 2850,
      deposit: 2850,
      guaranteeLimit: 500,
      mgmpct: 15,
      month: '2026-06',
      status: 'approved',
      statusOverride: 'ALG',
    },
    {
      id: 'P0002',
      address: '8832 Oak Lane, Orlando FL',
      owner: 'Jane Doe',
      tenant: '',
      bedrooms: 3,
      bathrooms: 2,
      sqft: 1650,
      moveIn: '',
      occupancy: 'vacant',
      rent: 0,
      deposit: 0,
      guaranteeLimit: 0,
      mgmpct: 12,
      month: '2026-06',
      status: 'approved',
      statusOverride: 'VG',
    },
    {
      id: 'P0003',
      address: '1200 Lake Dr, Davenport FL',
      owner: 'ACME Holdings',
      tenant: 'Bob Wilson',
      bedrooms: 5,
      bathrooms: 3.5,
      sqft: 2800,
      moveIn: '2025-11-15',
      occupancy: 'rented',
      rent: 3200,
      deposit: 3200,
      guaranteeLimit: 800,
      mgmpct: 18,
      month: '2026-06',
      status: 'pending',
      statusOverride: 'ALG',
    },
  ];
  const payload = { schemaVersion: 2, savedAt: new Date().toISOString(), items: mock };
  localStorage.setItem('gm_properties_v2', JSON.stringify(payload));
  if (typeof setLanguage === 'function') setLanguage('pt');
  nav('ltproperties');
  return { seeded: mock.length };
});

await page.waitForTimeout(1500);
await page.evaluate(async () => {
  if (typeof ltpRender === 'function') await ltpRender();
  await ltpExportAudit();
});

const html = await page.evaluate(() => window.__ltpLastExportAuditHtml || '');
const out = join(homedir(), 'Downloads', 'GM_Properties_Auditoria_SAMPLE_Wellington.html');
writeFileSync(out, html, 'utf8');
console.log('Sample written:', out, 'bytes:', html.length, 'seeded:', meta.seeded);
await browser.close();
