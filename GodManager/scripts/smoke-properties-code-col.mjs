/**
 * Smoke — Properties: coluna "Código" como 1ª coluna + busca por code.
 * Requer: next start :3101, DATABASE_URL.
 * Prova por DOM real (viewport 1400px):
 *  - 1º <th> do thead = "Código"; 1ª <td> de cada linha casa /^P\d+$/;
 *  - thead colCount == tbody colCount;
 *  - busca "P0044" retorna só a linha do P0044; busca por endereço continua;
 *  - filtros occ/occupancy continuam filtrando.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3101';
const __dir = dirname(fileURLToPath(import.meta.url));
const users = JSON.parse(readFileSync(join(__dir, '.smoke-vendor-free-users.json'), 'utf8'));

function sessionCookieValue(userId, role) {
  const exp = Date.now() + 24 * 60 * 60 * 1000;
  return Buffer.from(JSON.stringify({ userId, role, exp })).toString('base64');
}

const MOCK_PROPS = [
  { id: 'P0044', address: '6483 Trailblaze Bend', owner: 'NDB Real Estate', tenant: '', rent: 2300, deposit: 0, mgmpct: 8, status: 'pending', occupancy: 'vacant', month: '2026-06' },
  { id: 'P0085', address: '7686 Agrigento Street Clermont, FL 34714', owner: 'Shayra B LLC', tenant: 'Jovanka L. Romero', rent: 2600, deposit: 2600, mgmpct: 8, status: 'approved', occupancy: 'rented', month: '2026-06' },
  { id: 'P0100', address: '123 Smoke Test Ave Orlando, FL 32801', owner: 'Smoke Owner LLC', tenant: 'Test Tenant', rent: 1800, deposit: 1800, mgmpct: 10, status: 'approved', occupancy: 'rented', month: '2026-06' },
];

async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await context.addCookies([
    { name: 'gm_auth', value: sessionCookieValue(users.admin.id, users.admin.role), domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' },
  ]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.setDefaultTimeout(120000);

  try {
    await page.goto(`${BASE}/GodManager_Premium.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => typeof nav === 'function', { timeout: 60000 });

    // injetar mocks no cache gm_properties_v2 e navegar
    await page.evaluate((mocks) => {
      window.gmPropertiesSave(mocks);
      window.gmPropertiesBootstrap = async () => {}; // não sobrescrever mocks via API
      nav('ltproperties');
    }, MOCK_PROPS);
    await page.waitForTimeout(500);
    await page.evaluate(async () => { await ltpRender(); });
    await page.waitForTimeout(500);

    const snap = await page.evaluate(() => {
      const page2 = document.getElementById('page-ltproperties');
      const tbody = document.getElementById('ltp-tbody');
      const table = tbody.closest('table');
      const ths = Array.from(table.querySelectorAll('thead th'));
      const rows = Array.from(tbody.querySelectorAll('tr'));
      const firstTds = rows.map((tr) => (tr.querySelector('td') || {}).textContent || '');
      return {
        pageActive: !!(page2 && page2.classList.contains('active')),
        theadCount: table.querySelectorAll('thead tr').length,
        thFirst: (ths[0] || {}).textContent || '',
        thCount: ths.length,
        rowTdCounts: rows.map((tr) => tr.querySelectorAll('td').length),
        rowCount: rows.length,
        firstTds,
        codeColMono: rows.length ? getComputedStyle(rows[0].querySelector('td')).fontFamily.toLowerCase().includes('mono') : false,
        searchPlaceholder: (document.getElementById('ltp-search') || {}).placeholder || '',
      };
    });

    async function applySearch(value) {
      return page.evaluate(async (v) => {
        document.getElementById('ltp-search').value = v;
        await ltpRender();
        const rows = Array.from(document.querySelectorAll('#ltp-tbody tr'));
        return rows.map((tr) => (tr.querySelector('td') || {}).textContent || '');
      }, value);
    }

    const byCode = await applySearch('P0044');
    const byAddr = await applySearch('agrigento');
    const byNone = await applySearch('zzz-nao-existe');
    await applySearch('');

    const byOccupancy = await page.evaluate(async () => {
      const sel = document.getElementById('ltp-filter-occupancy');
      if (typeof ltpPopulateOccupancyFilter === 'function') await ltpPopulateOccupancyFilter();
      sel.value = 'rented';
      await ltpRender();
      const codes = Array.from(document.querySelectorAll('#ltp-tbody tr')).map((tr) => (tr.querySelector('td') || {}).textContent || '');
      sel.value = '';
      await ltpRender();
      return codes;
    });

    const checks = {
      pageActive: snap.pageActive,
      headerOnce: snap.theadCount === 1,
      firstThIsCodigo: snap.thFirst.trim().toLowerCase() === 'código',
      colCountsMatch: snap.thCount === 21 && snap.rowTdCounts.every((n) => n === snap.thCount),
      allFirstTdsAreCodes: snap.rowCount === 3 && snap.firstTds.every((t) => /^P\d+$/.test(t.trim())),
      codeColMono: snap.codeColMono,
      placeholderUpdated: snap.searchPlaceholder.includes('código'),
      searchByCode: byCode.length === 1 && byCode[0].trim() === 'P0044',
      searchByAddressStillWorks: byAddr.length === 1 && byAddr[0].trim() === 'P0085',
      searchNoMatchEmpty: byNone.length === 0,
      occupancyFilterIntact: byOccupancy.length === 2 && byOccupancy.every((c) => ['P0085', 'P0100'].includes(c.trim())),
      noPageErrors: errors.length === 0,
    };
    const pass = Object.values(checks).every(Boolean);
    console.log(JSON.stringify({ pass, checks, snap: { thFirst: snap.thFirst.trim(), thCount: snap.thCount, rowTdCounts: snap.rowTdCounts, firstTds: snap.firstTds, placeholder: snap.searchPlaceholder }, byCode, byAddr, byOccupancy, errors }, null, 2));
    process.exit(pass ? 0 : 1);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error('SMOKE FAILED:', e);
  process.exit(1);
});
