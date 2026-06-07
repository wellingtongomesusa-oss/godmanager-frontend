/**
 * Smoke — Admin gate só super_admin (front + API endurecidos).
 * Requer: next dev :3101, DATABASE_URL.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3101';
const __dir = dirname(fileURLToPath(import.meta.url));

const ADMIN_ROUTES = [
  'admin-dashboard',
  'clients',
  'backup',
  'settings',
  'gross-expenses',
  'forms-received',
  'admin-audit',
  'org-chart',
];

const HARDENED_API_READ = [
  { method: 'GET', path: '/api/audit?limit=1' },
  { method: 'GET', path: '/api/audit/facets' },
  { method: 'GET', path: '/api/admin/settings/smoke_gate_key' },
];
const HARDENED_API_DENY = [
  ...HARDENED_API_READ,
  { method: 'POST', path: '/api/admin/expenses/reset-all', body: {} },
  { method: 'POST', path: '/api/properties/reset-status' },
];

function sessionCookieValue(userId, role) {
  const exp = Date.now() + 24 * 60 * 60 * 1000;
  return Buffer.from(JSON.stringify({ userId, role, exp })).toString('base64');
}

async function testApis(user, specs) {
  const cookie = sessionCookieValue(user.id, user.role);
  const out = {};
  for (const spec of specs) {
    const res = await fetch(`${BASE}${spec.path}`, {
      method: spec.method,
      headers: {
        Cookie: `gm_auth=${cookie}`,
        ...(spec.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: spec.body ? JSON.stringify(spec.body) : undefined,
    });
    const st = res.status;
    out[`${spec.method} ${spec.path}`] = { status: st };
    await new Promise((r) => setTimeout(r, 250));
  }
  return out;
}

async function openPremium(user, locale = 'en', { clearActiveClient = false } = {}) {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const canonical = locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'en-US';
  await context.addCookies([
    {
      name: 'gm_auth',
      value: sessionCookieValue(user.id, user.role),
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
    { name: 'NEXT_LOCALE', value: canonical, domain: 'localhost', path: '/', sameSite: 'Lax' },
  ]);
  const page = await context.newPage();
  page.setDefaultTimeout(120000);
  await page.goto(`${BASE}/GodManager_Premium.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof nav === 'function', { timeout: 90000 });
  await page.evaluate(async (clr) => {
    if (clr) {
      try {
        localStorage.removeItem('gm_active_client');
      } catch (_e) {}
    }
    if (typeof gmAuthHydrateUserBadge === 'function') await gmAuthHydrateUserBadge();
    if (typeof applyPermissions === 'function') applyPermissions();
    if (typeof jobsApplyRoleGateV2 === 'function') await jobsApplyRoleGateV2();
  }, clearActiveClient);
  if (clearActiveClient) {
    await page.waitForFunction(
      () => String((window.__gmCurrentUser && window.__gmCurrentUser.role) || '').toLowerCase() === 'super_admin',
      { timeout: 30000 },
    );
  }
  await page.waitForTimeout(1500);
  return { browser, page, context };
}

async function adminSectionVisible(page) {
  return page.evaluate(() => {
    const el = document.getElementById('sb-gm-admin-section');
    if (!el) return { exists: false, visible: false, display: null };
    const cs = window.getComputedStyle(el);
    return {
      exists: true,
      visible: cs.display !== 'none' && el.offsetParent !== null,
      display: cs.display,
    };
  });
}

function navResult(page, route) {
  return page.evaluate((r) => {
    nav(r);
    const hash = (window.location.hash || '').replace('#', '');
    const active = document.querySelector('.page.active')?.id || '';
    return { hash, active };
  }, route);
}

const PASSO0_SUPER_ADMINS = [
  {
    id: 'cmoqecn1a000005dftkyv3u4g',
    email: 'w@godmanager.us',
    role: 'super_admin',
    clientId: null,
    status: 'active',
  },
];
console.log('PASSO 0 — super_admins:', JSON.stringify(PASSO0_SUPER_ADMINS, null, 2));

const superAdmin = PASSO0_SUPER_ADMINS[0];

let users = {};
try {
  users = JSON.parse(readFileSync(join(__dir, '.smoke-vendor-free-users.json'), 'utf8'));
} catch {
  /* cache opcional */
}

const tenantAdmin = users.admin || {
  id: 'cmobuxca50000p81wp4llstd7',
  email: 'info@managerprop.com',
  role: 'admin',
  status: 'active',
};

const results = {};

// C1 — super_admin: secção Admin visível, nav OK, APIs autorizadas
try {
  if (!superAdmin) {
    results.c1 = {
      ok: false,
      skip: true,
      error: 'Nenhum super_admin no DB (w@godmanager.us ausente). Rodar PASSO 0 em prod/staging.',
    };
  } else {
    const apiRaw = await testApis(superAdmin, [
      ...HARDENED_API_READ,
      { method: 'POST', path: '/api/admin/expenses/reset-all', body: {} },
    ]);
    const apiResults = {};
    for (const [k, v] of Object.entries(apiRaw)) {
      const authOk = v.status === 200 || (k.includes('reset-all') && v.status === 400);
      apiResults[k] = { status: v.status, authOk };
    }
    const { browser, page } = await openPremium(superAdmin, 'en', { clearActiveClient: true });
    const sec = await adminSectionVisible(page);
    const navResults = {};
    for (const r of ADMIN_ROUTES) {
      await page.evaluate(() => nav('home'));
      await page.waitForTimeout(400);
      const nr = await navResult(page, r);
      navResults[r] = { ...nr, ok: nr.hash === r };
      await page.waitForTimeout(300);
    }
    const navOk = Object.values(navResults).every((v) => v.ok);
    const apiOk = Object.values(apiResults).every((v) => v.authOk);
    results.c1 = {
      ok: sec.visible && navOk && apiOk,
      user: superAdmin.email,
      sec,
      navResults,
      apiResults,
    };
    await browser.close();
  }
} catch (e) {
  results.c1 = { ok: false, error: String(e.message || e) };
}

await new Promise((r) => setTimeout(r, 8000));

// C2 — admin tenant: secção oculta, nav bloqueada, APIs 401/403
try {
  if (!tenantAdmin) {
    results.c2 = { ok: false, error: 'User admin tenant (info@managerprop.com) não encontrado' };
  } else {
    const apiRaw = await testApis(tenantAdmin, HARDENED_API_DENY);
    const apiResults = {};
    for (const [k, v] of Object.entries(apiRaw)) {
      apiResults[k] = { status: v.status, denied: v.status === 401 || v.status === 403 };
    }
    const { browser, page } = await openPremium(tenantAdmin);
    const sec = await adminSectionVisible(page);
    const sessionClientId = await page.evaluate(
      () => (window.__gmCurrentUser && window.__gmCurrentUser.clientId) || null,
    );
    const navBlocked = {};
    for (const r of ADMIN_ROUTES) {
      if (r === 'settings') continue;
      await page.evaluate(() => nav('home'));
      await page.waitForTimeout(300);
      const nr = await navResult(page, r);
      navBlocked[r] = { ...nr, blocked: nr.hash !== r };
    }
    const usersModal = await page.evaluate(() => {
      if (typeof gmAdminUsersModalOpen !== 'function') return { blocked: true };
      gmAdminUsersModalOpen();
      return { blocked: !document.getElementById('gm-admin-users-modal') };
    });
    let settingsNav = null;
    if (sessionClientId) {
      await page.evaluate(() => nav('home'));
      await page.waitForTimeout(300);
      const nr = await navResult(page, 'settings');
      settingsNav = { ...nr, allowed: nr.hash === 'settings' };
    }
    const apiDenied = Object.values(apiResults).every((v) => v.denied);
    const navOk = Object.values(navBlocked).every((v) => v.blocked);
    const settingsOk = sessionClientId ? settingsNav?.allowed === true : true;
    results.c2 = {
      ok: !sec.visible && navOk && settingsOk && usersModal.blocked && apiDenied,
      user: tenantAdmin.email,
      role: tenantAdmin.role,
      clientId: sessionClientId || tenantAdmin.clientId || null,
      sec,
      navBlocked,
      settingsNav,
      usersModal,
      apiResults,
    };
    await browser.close();
  }
} catch (e) {
  results.c2 = { ok: false, error: String(e.message || e) };
}

await new Promise((r) => setTimeout(r, 3000));

// C3 — regressão: seções protegidas + CRUD operacional (admin tenant)
try {
  if (!tenantAdmin) {
    results.c3 = { ok: false, error: 'Sem user admin para regressão' };
  } else {
    const cookie = sessionCookieValue(tenantAdmin.id, tenantAdmin.role);
    const propsRes = await fetch(`${BASE}/api/properties?limit=3`, {
      headers: { Cookie: `gm_auth=${cookie}` },
    });
    const tenantsRes = await fetch(`${BASE}/api/tenants?limit=3`, {
      headers: { Cookie: `gm_auth=${cookie}` },
    });
    const propsApi = propsRes.status;
    const tenantsApi = tenantsRes.status;
    const { browser, page } = await openPremium(tenantAdmin);
    await page.evaluate(() => nav('longterm'));
    await page.waitForTimeout(2500);
    const dash = await page.evaluate(() => ({
      trabalhosMes: !!document.getElementById('ltd-jobs-tbody'),
      moveInResumo: !!document.getElementById('ltd-prop-tbody'),
      alertas: !!document.getElementById('ltd-alerts-list'),
      alertasTitle: [...document.querySelectorAll('#page-longterm div')].some((el) =>
        /alertas e pendencias/i.test(el.textContent || ''),
      ),
    }));
    await page.evaluate(() => nav('ltproperties'));
    await page.waitForSelector('#page-ltproperties.active', { timeout: 30000 });
    await page.waitForTimeout(3000);
    const ltp = await page.evaluate(() => ({
      hasTable: !!document.getElementById('ltp-tbody'),
      rows: document.querySelectorAll('#ltp-tbody tr').length,
      novaBtn: !!document.querySelector('[onclick*="ltpOpenNewPropertyModal"]'),
      kpiTotal: (document.getElementById('ltp-kpi-total')?.textContent || '').trim(),
    }));
    results.c3 = {
      ok:
        dash.trabalhosMes &&
        dash.moveInResumo &&
        dash.alertas &&
        ltp.hasTable &&
        ltp.novaBtn &&
        ltp.rows >= 0 &&
        propsApi === 200 &&
        tenantsApi === 200,
      dash,
      ltp,
      propsApi,
      tenantsApi,
    };
    await browser.close();
  }
} catch (e) {
  results.c3 = { ok: false, error: String(e.message || e) };
}

const pass = [results.c1, results.c2, results.c3].filter((r) => r?.ok).length;
const total = 3;
console.log('\n=== smoke-admin-superadmin-gate ===');
console.log(JSON.stringify(results, null, 2));
console.log(`\n${pass}/${total} PASS`);
process.exit(pass === total ? 0 : 1);
