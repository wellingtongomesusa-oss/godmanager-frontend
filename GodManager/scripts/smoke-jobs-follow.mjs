/**
 * Smoke — Jobs Follow (read-only acompanhamento + horizontal ring stepper).
 * Valida DOM REAL: gmJobsFollowRenderStepper HTML + gmJobsFollowRender no #page-jobs-follow.
 * C1: vendor_requested — aneis horizontais, etapa atual destacada, sem lista vertical
 * C2: closed_internal — caminho interno, etapa atual em closed_internal
 * C3: read-only, filtros, Jobs page intacta
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

async function runAsUser(user, fn) {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
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
  const errors = [];
  page.on('pageerror', (e) => errors.push(`${user.email}: ${e.message}`));
  page.setDefaultTimeout(120000);
  let patchCount = 0;
  await page.route('**/api/pm/expenses/**', async (route) => {
    if (route.request().method() === 'PATCH') patchCount += 1;
    await route.continue();
  });
  try {
    await page.goto(`${BASE}/GodManager_Premium.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => typeof nav === 'function', { timeout: 60000 });
    return { ...(await fn(page)), errors, patchCount };
  } finally {
    await browser.close();
  }
}

async function followReady(page) {
  await page.evaluate(async () => {
    if (typeof gmJobsSetDateFilter === 'function') gmJobsSetDateFilter('all');
    if (typeof gmJobsSetPropertyFilter === 'function') gmJobsSetPropertyFilter('');
    if (typeof gmJobsSetVendorFilter === 'function') gmJobsSetVendorFilter('');
    nav('jobs-follow');
  });
  await page.waitForTimeout(2500);
  await page.evaluate(async () => {
    window.__jobsExpensesCacheAt = 0;
    if (typeof jobsInvalidateApiCache === 'function') jobsInvalidateApiCache();
    try {
      if (typeof jobsFetchFromApi === 'function') await jobsFetchFromApi();
    } catch (_e) {
      /* API local 500 — smoke usa mock */
    }
    if (typeof gmJobsFollowInit === 'function') await gmJobsFollowInit();
  });
  await page.waitForTimeout(2000);
}

function injectMocks(page) {
  return page.evaluate(() => {
    const mocks = [
      {
        id: 'smoke-follow-vreq',
        vendorId: 'v-smoke-1',
        vendorName: 'ACME Plumbing Co',
        propertyCode: 'P0099',
        propAddress: '123 Smoke Test St, Orlando FL',
        status: 'SCHEDULED',
        ownerCharged: 150,
        serviceDate: '2024-01-15',
        metadata: { followUp: { stage: 'vendor_requested' }, houseLabel: '123 Smoke Test St' },
      },
      {
        id: 'smoke-follow-internal',
        propertyCode: 'P0102',
        propAddress: '222 Internal Path Way',
        status: 'SCHEDULED',
        isVendorFree: true,
        ownerCharged: 90,
        serviceDate: '2025-01-10',
        metadata: { followUp: { stage: 'closed_internal' }, houseLabel: '222 Internal Path Way' },
      },
      {
        id: 'smoke-follow-final',
        vendorId: 'v-smoke-2',
        vendorName: 'Beta HVAC LLC',
        propertyCode: 'P0100',
        propAddress: '456 Finalized Ave, Kissimmee FL',
        status: 'FINALIZED',
        ownerCharged: 220,
        serviceDate: '2025-06-01',
        metadata: { houseLabel: '456 Finalized Ave' },
      },
    ];
    if (typeof ltExpMapApiToRow !== 'function') return { ok: false, reason: 'ltExpMapApiToRow missing' };
    const mapped = mocks.map((e) => ltExpMapApiToRow(e));
    window.__jobsApiRowsCache = mapped;
    window.__jobsExpensesCacheAt = Date.now();
    const origFetch = window.jobsFetchFromApi;
    window.jobsFetchFromApi = async function () {
      window.__jobsApiRowsCache = mapped;
      return mapped;
    };
    const done = () => {
      if (typeof gmJobsFollowRender === 'function') gmJobsFollowRender();
      window.jobsFetchFromApi = origFetch;
      return { ok: true, count: mapped.length };
    };
    if (typeof gmJobsFollowPopulateFilters === 'function') {
      return gmJobsFollowPopulateFilters().then(done);
    }
    return done();
  });
}

/** Inspeciona HTML gerado por gmJobsFollowRenderStepper (render real, nao mock estrutural). */
const RENDER_HTML_PROBE_JS = `function(row){
 if(!row||typeof gmJobsFollowRenderStepper!=='function')return{ok:false,reason:'gmJobsFollowRenderStepper missing'};
 var html=gmJobsFollowRenderStepper(row);
 var host=document.createElement('div');
 host.innerHTML=html;
 var stepper=host.querySelector('.gm-jf-stepper');
 var rings=host.querySelectorAll('.gm-jf-ring');
 var labels=host.querySelectorAll('.gm-jf-label');
 var sr=host.querySelectorAll('.gm-jf-sr');
 var current=host.querySelector('.gm-jf-step.is-current');
 var caption=host.querySelector('.gm-jf-current-caption');
 return{
  ok:true,
  htmlLen:html.length,
  hasStepperWrap:!!host.querySelector('.gm-jf-stepper-wrap'),
  ringCount:rings.length,
  labelCount:labels.length,
  srCount:sr.length,
  htmlHasLabelClass:html.indexOf('gm-jf-label')>=0,
  hasCurrent:!!current,
  currentStage:current?current.getAttribute('data-stage'):null,
  hasCaption:!!caption,
  captionHasText:caption?String(caption.textContent||'').trim().length>0:false,
  htmlHasCurrentRing28:html.indexOf('is-current')>=0&&html.indexOf('width:28px')>=0,
  htmlHasDoneRing12:html.indexOf('is-done')>=0&&html.indexOf('width:12px')>=0
 };
}`;

/** Snapshot do card renderizado no DOM (#jobs-follow-cards). */
const DOM_CARD_SNAPSHOT_JS = `function(card){
 if(!card)return{ok:false};
 var stepper=card.querySelector('.gm-jf-stepper');
 var wrap=card.querySelector('.gm-jf-stepper-wrap');
 var caption=card.querySelector('.gm-jf-current-caption');
 var current=card.querySelector('.gm-jf-step.is-current');
 var doneCount=card.querySelectorAll('.gm-jf-step.is-done').length;
 var futureCount=card.querySelectorAll('.gm-jf-step.is-future').length;
 var visibleLabels=[].slice.call(card.querySelectorAll('.gm-jf-label,.gm-jf-sr')).filter(function(el){
  var cs=window.getComputedStyle(el);
  return cs.display!=='none'&&cs.visibility!=='hidden'&&parseFloat(cs.width)>1&&parseFloat(cs.height)>1;
 });
 var visibleStepText=[].slice.call(stepper?stepper.querySelectorAll('.gm-jf-step *'):[]).filter(function(el){
  if(el.classList.contains('gm-jf-ring')||el.classList.contains('gm-jf-connector'))return false;
  var cs=window.getComputedStyle(el);
  if(cs.display==='none'||cs.visibility==='hidden'||parseFloat(cs.opacity)===0)return false;
  var t=String(el.textContent||'').trim();
  return t.length>0;
 });
 var stepperStyle=stepper?window.getComputedStyle(stepper):null;
 var currentRing=current?current.querySelector('.gm-jf-ring'):null;
 var doneRing=card.querySelector('.gm-jf-step.is-done .gm-jf-ring');
 var ringW=function(el){return el?(el.offsetWidth||parseFloat(window.getComputedStyle(el).width)||0):0;};
 var currentRingInline=currentRing?String(currentRing.getAttribute('style')||''):'';
 var doneRingInline=doneRing?String(doneRing.getAttribute('style')||''):'';
 var geometry={ok:false};
 if(stepper){
  var steps=[].slice.call(stepper.querySelectorAll('.gm-jf-step'));
  if(steps.length>=2){
   var rects=steps.map(function(s){return s.getBoundingClientRect();});
   var xs=rects.map(function(r){return r.left+r.width/2;});
   var ys=rects.map(function(r){return r.top+r.height/2;});
   var xIncreasing=true;
   for(var gi=1;gi<xs.length;gi++){if(xs[gi]<=xs[gi-1]+1)xIncreasing=false;}
   var ySpread=Math.max.apply(null,ys)-Math.min.apply(null,ys);
   var xSpread=Math.max.apply(null,xs)-Math.min.apply(null,xs);
   var horizontal=xIncreasing&&xSpread>=24&&ySpread<=28;
   var verticalStack=!xIncreasing&&ySpread>=24&&xSpread<=16;
   geometry={ok:true,stepCount:steps.length,xs:xs,ys:ys,xSpread:xSpread,ySpread:ySpread,xIncreasing:xIncreasing,horizontal:horizontal,verticalStack:verticalStack};
  }
 }
 return{
  ok:true,hasWrap:!!wrap,
  hasCaption:!!caption&&String(caption.textContent||'').trim().length>0,
  captionText:caption?String(caption.textContent||'').trim():'',
  flexDirection:stepperStyle?stepperStyle.flexDirection:null,
  flexWrap:stepperStyle?stepperStyle.flexWrap:null,
  ringCount:card.querySelectorAll('.gm-jf-ring').length,
  connectorCount:card.querySelectorAll('.gm-jf-connector').length,
  currentStage:current?current.getAttribute('data-stage'):null,
  currentRingW:ringW(currentRing),
  doneRingW:ringW(doneRing),
  currentRingInline:currentRingInline,
  doneRingInline:doneRingInline,
  currentHasHalo:currentRingInline.indexOf('box-shadow')>=0,
  doneCount:doneCount,futureCount:futureCount,
  visibleLabelCount:visibleLabels.length,
  visibleStepTextCount:visibleStepText.length,
  geometry:geometry
 };
}`;

async function smokeAdmin() {
  return runAsUser(users.admin, async (page) => {
    await followReady(page);

    const renderProbe = await page.evaluate((probeSrc) => {
      const probe = new Function('return ' + probeSrc)();
      const mockApi = {
        id: 'probe-vendor',
        vendorId: 'v-probe',
        vendorName: 'Probe Vendor',
        status: 'SCHEDULED',
        ownerCharged: 80,
        serviceDate: '2026-05-20',
        metadata: { followUp: { stage: 'vendor_requested' } },
      };
      const row = ltExpMapApiToRow(mockApi);
      const vendor = probe(row);
      const internalApi = {
        id: 'probe-internal',
        status: 'SCHEDULED',
        isVendorFree: true,
        ownerCharged: 50,
        serviceDate: '2026-05-21',
        metadata: { followUp: { stage: 'closed_internal' } },
      };
      const rowInt = ltExpMapApiToRow(internalApi);
      const internal = probe(rowInt);
      return { vendor, internal };
    }, RENDER_HTML_PROBE_JS);

    await injectMocks(page);
    await page.waitForTimeout(800);

    const c1 = await page.evaluate((snapSrc) => {
      const snap = new Function('return ' + snapSrc)();
      const pg = document.getElementById('page-jobs-follow');
      const vreq = document.querySelector('[data-job-id="smoke-follow-vreq"]');
      return {
        pageActive: !!(pg && pg.classList.contains('active')),
        cardCount: document.querySelectorAll('#jobs-follow-cards .gm-jf-card').length,
        snap: snap(vreq),
      };
    }, DOM_CARD_SNAPSHOT_JS);

    const c2 = await page.evaluate((snapSrc) => {
      const snap = new Function('return ' + snapSrc)();
      const internal = document.querySelector('[data-job-id="smoke-follow-internal"]');
      const row = (window.__jobsApiRowsCache || []).find((r) => r.id === 'smoke-follow-internal');
      const path =
        row && typeof gmJobsFollowStepperPath === 'function' ? gmJobsFollowStepperPath(row) : [];
      return {
        snap: snap(internal),
        path,
        stage:
          row && typeof gmJobFollowUpDisplayStage === 'function'
            ? gmJobFollowUpDisplayStage(row)
            : null,
      };
    }, DOM_CARD_SNAPSHOT_JS);

    const c2filters = await page.evaluate(async () => {
      if (typeof gmJobsFollowSetDateFilter === 'function') gmJobsFollowSetDateFilter('all');
      const oldDateVisible = !!document.querySelector('[data-job-id="smoke-follow-vreq"]');
      if (typeof gmJobsSetPropertyFilter === 'function') gmJobsSetPropertyFilter('P0099');
      if (typeof gmJobsFollowRender === 'function') gmJobsFollowRender();
      const afterProp = [...document.querySelectorAll('#jobs-follow-cards .gm-jf-card')].map((c) =>
        c.getAttribute('data-job-id'),
      );
      if (typeof gmJobsSetPropertyFilter === 'function') gmJobsSetPropertyFilter('');
      if (typeof gmJobsSetVendorFilter === 'function') gmJobsSetVendorFilter('ACME Plumbing Co');
      if (typeof gmJobsFollowRender === 'function') gmJobsFollowRender();
      const afterVendor = [...document.querySelectorAll('#jobs-follow-cards .gm-jf-card')].map((c) =>
        c.getAttribute('data-job-id'),
      );
      if (typeof gmJobsSetVendorFilter === 'function') gmJobsSetVendorFilter('');
      if (typeof gmJobsFollowRender === 'function') gmJobsFollowRender();
      return {
        dateFilter: window.__jobsDateFilter,
        oldDateVisible,
        propFilterOk: afterProp.length === 1 && afterProp[0] === 'smoke-follow-vreq',
        vendorFilterOk: afterVendor.length === 1 && afterVendor[0] === 'smoke-follow-vreq',
      };
    });

    const c3 = await page.evaluate(() => {
      const followPatchBtn = !!document.querySelector(
        '#page-jobs-follow [onclick*="gmJobFollowUpPatch"],#page-jobs-follow [onclick*="followUpPatch"]',
      );
      nav('jobs');
      const jobsTable = !!document.getElementById('jobs-table');
      const jobsSubtitleLen = (document.getElementById('jobs-page-subtitle') || {}).textContent.length;
      return { followPatchBtn, jobsTable, jobsSubtitleLen };
    });

    const rp = renderProbe.vendor;
    const rpInt = renderProbe.internal;
    const s1 = c1.snap;
    const s2 = c2.snap;

    const renderOk =
      rp.ok &&
      rp.ringCount >= 5 &&
      rp.labelCount === 0 &&
      rp.srCount === 0 &&
      !rp.htmlHasLabelClass &&
      rp.hasCurrent &&
      rp.currentStage === 'vendor_requested' &&
      rp.hasCaption &&
      rp.htmlHasCurrentRing28 &&
      rp.htmlHasDoneRing12 &&
      rpInt.ok &&
      rpInt.currentStage === 'closed_internal' &&
      !rpInt.htmlHasLabelClass;

    const domOk =
      c1.pageActive &&
      c1.cardCount >= 3 &&
      s1.ok &&
      s1.flexDirection === 'row' &&
      s1.flexWrap === 'nowrap' &&
      s1.geometry?.ok &&
      s1.geometry.horizontal &&
      !s1.geometry.verticalStack &&
      s1.geometry.xIncreasing &&
      s1.ringCount >= 5 &&
      s1.connectorCount >= 4 &&
      s1.visibleLabelCount === 0 &&
      s1.visibleStepTextCount === 0 &&
      s1.currentStage === 'vendor_requested' &&
      s1.hasCaption &&
      s1.currentRingInline.indexOf('28px') >= 0 &&
      s1.doneRingInline.indexOf('12px') >= 0 &&
      s1.currentHasHalo &&
      s2.ok &&
      s2.currentStage === 'closed_internal' &&
      s2.visibleLabelCount === 0 &&
      s2.visibleStepTextCount === 0 &&
      s2.flexDirection === 'row' &&
      s2.hasCaption &&
      s2.geometry?.ok &&
      s2.geometry.horizontal &&
      !s2.geometry.verticalStack;

    const ok =
      renderOk &&
      domOk &&
      c2.path.includes('closed_internal') &&
      !c2.path.includes('vendor_requested') &&
      c2filters.dateFilter === 'all' &&
      c2filters.propFilterOk &&
      c2filters.vendorFilterOk &&
      c3.jobsTable &&
      !c3.followPatchBtn;

    return { ok, role: 'admin', renderProbe, c1, c2, c2filters, c3, renderOk, domOk };
  });
}

async function smokeMaintenance() {
  return runAsUser(users.maint, async (page) => {
    await page.waitForFunction(() => typeof jobsApplyRoleGateV2 === 'function', { timeout: 60000 });
    await page.waitForTimeout(4000);
    const gate = await page.evaluate(async () => {
      if (typeof gmAuthHydrateUserBadge === 'function') await gmAuthHydrateUserBadge();
      if (typeof jobsApplyRoleGateV2 === 'function') await jobsApplyRoleGateV2();
      if (typeof gmApplyJobsOnlySidebarMode === 'function') gmApplyJobsOnlySidebarMode();
      const el = document.getElementById('nav-jobs-follow');
      const jobsOnly = document.getElementById('nav-jobs');
      return {
        navFollowHidden: !el || el.style.display === 'none' || el.offsetParent === null,
        navJobsVisible: !!(jobsOnly && jobsOnly.offsetParent !== null),
      };
    });
    return { ok: gate.navFollowHidden && gate.navJobsVisible, role: 'maintenance', gate };
  });
}

const adminRun = await smokeAdmin();
await new Promise((r) => setTimeout(r, 4000));
const maintRun = await smokeMaintenance();

const summary = {
  pass:
    adminRun.ok &&
    maintRun.ok &&
    adminRun.patchCount === 0 &&
    (adminRun.errors?.length || 0) === 0 &&
    (maintRun.errors?.length || 0) === 0,
  admin: adminRun,
  maintenance: maintRun,
};

console.log(JSON.stringify(summary, null, 2));
process.exit(summary.pass ? 0 : 1);
