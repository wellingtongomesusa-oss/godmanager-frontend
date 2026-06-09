/**
 * Smoke — toggle idioma visível no mobile (topbar .tr scroll).
 * Requer: next start :3101 (ou SMOKE_BASE_URL).
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3101';
const __dir = dirname(fileURLToPath(import.meta.url));
const CHANNEL = 'chrome';

function sessionCookieValue(userId, role) {
  const exp = Date.now() + 24 * 60 * 60 * 1000;
  return Buffer.from(JSON.stringify({ userId, role, exp })).toString('base64');
}

function parseNextLocale(cookieStr) {
  const m = String(cookieStr || '').match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}

let user;
try {
  const cache = JSON.parse(readFileSync(join(__dir, '.smoke-vendor-free-users.json'), 'utf8'));
  user = cache.admin;
} catch {
  console.error('FAIL: .smoke-vendor-free-users.json não encontrado');
  process.exit(1);
}
if (!user?.id) {
  console.error('FAIL: user admin em cache');
  process.exit(1);
}

const results = { channel: CHANNEL, c1: null, c2: null };

async function openPremium(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(`${BASE}/GodManager_Premium.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('#lang-current', { timeout: 60000 });
  await page.waitForFunction(() => typeof gmSetLang === 'function', { timeout: 60000 });
}

// ── C1: mobile — lang visível, clicável, menu + persistência ES ──
try {
  const browser = await chromium.launch({ headless: true, channel: CHANNEL });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addCookies([
    {
      name: 'gm_auth',
      value: sessionCookieValue(user.id, user.role),
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  await openPremium(page, { width: 390, height: 844 });

  const beforeClick = await page.evaluate(() => {
    const btn = document.getElementById('lang-current');
    const wrap = document.querySelector('.tb-lang-wrap');
    const r = btn?.getBoundingClientRect();
    const cs = wrap ? getComputedStyle(wrap) : null;
    return {
      visible: !!(btn && r && r.width > 0 && r.height > 0 && getComputedStyle(btn).display !== 'none'),
      box: r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null,
      order: cs?.order ?? null,
      flexShrink: cs?.flexShrink ?? null,
    };
  });

  const vpW = 390;
  const inViewport =
    beforeClick.box &&
    beforeClick.box.x >= 0 &&
    beforeClick.box.x + beforeClick.box.width <= vpW + 1;

  await page.click('#lang-current');
  await page.waitForFunction(
    () => document.getElementById('lang-menu')?.style.display === 'block',
    { timeout: 5000 },
  );

  const menuBox = await page.evaluate(() => {
    const menu = document.getElementById('lang-menu');
    const r = menu?.getBoundingClientRect();
    return r ? { x: r.x, y: r.y, width: r.width, height: r.height, display: menu.style.display } : null;
  });
  const menuInViewport =
    menuBox &&
    menuBox.x >= 0 &&
    menuBox.x + menuBox.width <= vpW + 1 &&
    menuBox.y >= 0;

  await page.evaluate(() => {
    gmSetLang('es-ES');
  });
  await page.waitForTimeout(300);

  const persisted = await page.evaluate(() => {
    const cookies = document.cookie;
    const ls = localStorage.getItem('gm_lang');
    const btn = document.getElementById('lang-current')?.textContent?.trim();
    return {
      gm_lang: ls,
      next_locale: (cookies.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/i) || [])[1]
        ? decodeURIComponent((cookies.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/i) || [])[1])
        : null,
      btnLabel: btn,
    };
  });

  const esOk =
    (persisted.gm_lang === 'es' || String(persisted.gm_lang || '').startsWith('es')) &&
    (persisted.next_locale === 'es-ES' || String(persisted.next_locale || '').toLowerCase().startsWith('es'));

  results.c1 = {
    ok:
      beforeClick.visible &&
      inViewport &&
      beforeClick.order === '-1' &&
      menuInViewport &&
      esOk,
    visible: beforeClick.visible,
    inViewport,
    order: beforeClick.order,
    box: beforeClick.box,
    menuInViewport,
    menuBox,
    persisted,
    esOk,
  };
  await browser.close();
} catch (e) {
  results.c1 = { ok: false, error: e.message };
}

// ── C2: desktop — topbar inalterada (ordem DOM + order CSS default) ──
try {
  const browser = await chromium.launch({ headless: true, channel: CHANNEL });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([
    {
      name: 'gm_auth',
      value: sessionCookieValue(user.id, user.role),
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  await openPremium(page, { width: 1440, height: 900 });

  const desktop = await page.evaluate(() => {
    const tr = document.querySelector('.tr');
    if (!tr) return { error: 'no .tr' };
    const children = [...tr.children].map((el) => ({
      id: el.id || null,
      className: el.className || '',
      tag: el.tagName,
      order: getComputedStyle(el).order,
      rect: (() => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      })(),
    }));
    const langWrap = document.querySelector('.tb-lang-wrap');
    const langOrder = langWrap ? getComputedStyle(langWrap).order : null;
    const langRect = langWrap?.getBoundingClientRect();
    const signature = children.map((c) =>
      c.id || (c.className.includes('tb-lang-wrap') ? 'tb-lang-wrap' : c.className.split(' ')[0] || c.tag),
    );
    return {
      children,
      signature,
      langOrder,
      langRect: langRect
        ? { x: langRect.x, y: langRect.y, width: langRect.width, height: langRect.height }
        : null,
    };
  });

  const domOrderOk =
    desktop.signature?.[0] === 'btn-exit-client' &&
    desktop.signature?.[1] === 'tb-session-label' &&
    desktop.signature?.[2] === 'btn-topbar-clients' &&
    desktop.signature?.[3] === 'tb-lang-wrap' &&
    desktop.signature?.[5] === 'btn-topbar-historico';

  const langOrderDefault = desktop.langOrder === '0' || desktop.langOrder === 0;

  results.c2 = {
    ok: domOrderOk && langOrderDefault && !desktop.error,
    domOrderOk,
    langOrder: desktop.langOrder,
    langOrderDefault,
    children: desktop.children,
    langRect: desktop.langRect,
  };
  await browser.close();
} catch (e) {
  results.c2 = { ok: false, error: e.message };
}

const pass = results.c1?.ok && results.c2?.ok;
console.log(JSON.stringify({ pass, ...results }, null, 2));
process.exit(pass ? 0 : 1);
