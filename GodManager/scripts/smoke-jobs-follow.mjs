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
 var balls=host.querySelectorAll('.gm-jf-ball');
 var caps=host.querySelectorAll('.gm-jf-cap');
 var labels=host.querySelectorAll('.gm-jf-label');
 var sr=host.querySelectorAll('.gm-jf-sr');
 var current=host.querySelector('.gm-jf-step.is-current');
 var steps=[].slice.call(host.querySelectorAll('.gm-jf-step'));
 var numsOk=steps.length>0&&steps.every(function(s,idx){
  var b=s.querySelector('.gm-jf-ball');
  var c=s.querySelector('.gm-jf-cap');
  return b&&String(b.textContent||'').trim()===String(idx+1)&&c&&String(c.textContent||'').trim().length>0;
 });
 return{
  ok:true,
  htmlLen:html.length,
  hasStepper:!!stepper,
  ballCount:balls.length,
  capCount:caps.length,
  labelCount:labels.length,
  srCount:sr.length,
  htmlHasBallClass:html.indexOf('gm-jf-ball')>=0,
  htmlHasCapClass:html.indexOf('gm-jf-cap')>=0,
  hasCurrent:!!current,
  currentStage:current?current.getAttribute('data-stage'):null,
  numsOk:numsOk
 };
}`;

/** Snapshot do card renderizado no DOM (#jobs-follow-cards). */
const DOM_CARD_SNAPSHOT_JS = `function(card){
 if(!card)return{ok:false};
 var row=card.querySelector('.gm-jf-row');
 var addr=card.querySelector('.gm-jf-addr');
 var badge=card.querySelector('.gm-jf-badge');
 var dateEl=card.querySelector('.gm-jf-date');
 var valueEl=card.querySelector('.gm-jf-value');
 var stepper=card.querySelector('.gm-jf-stepper');
 var stagelabel=card.querySelector('.gm-jf-stagelabel');
 var rowStyle=row?window.getComputedStyle(row):null;
 var current=card.querySelector('.gm-jf-step.is-current');
 var doneCount=card.querySelectorAll('.gm-jf-step.is-done').length;
 var futureCount=card.querySelectorAll('.gm-jf-step.is-future').length;
 var visibleLabels=[].slice.call(card.querySelectorAll('.gm-jf-label,.gm-jf-sr')).filter(function(el){
  var cs=window.getComputedStyle(el);
  return cs.display!=='none'&&cs.visibility!=='hidden'&&parseFloat(cs.width)>1&&parseFloat(cs.height)>1;
 });
 var stepperStyle=stepper?window.getComputedStyle(stepper):null;
 var balls=stepper?[].slice.call(stepper.querySelectorAll('.gm-jf-ball')):[];
 var ballW=function(el){return el?(el.offsetWidth||parseFloat(window.getComputedStyle(el).width)||0):0;};
 var ballH=function(el){return el?(el.offsetHeight||parseFloat(window.getComputedStyle(el).height)||0):0;};
 var ballsUniform={ok:false};
 var equalGaps={ok:false};
 if(balls.length>=2){
  var widths=balls.map(ballW);
  var heights=balls.map(ballH);
  var uniform=widths.every(function(w){return Math.abs(w-20)<=1;})&&heights.every(function(h){return Math.abs(h-20)<=1;});
  var wSpread=Math.max.apply(null,widths)-Math.min.apply(null,widths);
  var hSpread=Math.max.apply(null,heights)-Math.min.apply(null,heights);
  ballsUniform={ok:true,uniform:uniform,count:balls.length,widths:widths,heights:heights,wSpread:wSpread,hSpread:hSpread};
  var ballRects=balls.map(function(b){return b.getBoundingClientRect();});
  var ballXs=ballRects.map(function(r){return r.left+r.width/2;});
  var gaps=[];
  for(var bi=1;bi<ballXs.length;bi++)gaps.push(ballXs[bi]-ballXs[bi-1]);
  var gapSpread=gaps.length?Math.max.apply(null,gaps)-Math.min.apply(null,gaps):0;
  equalGaps={ok:true,gaps:gaps,gapSpread:gapSpread,equal:gapSpread<=4};
 }
 var steps=stepper?[].slice.call(stepper.querySelectorAll('.gm-jf-step')):[];
 var numsCapsOk=steps.length>0&&steps.every(function(s,idx){
  var b=s.querySelector('.gm-jf-ball');
  var c=s.querySelector('.gm-jf-cap');
  return b&&String(b.textContent||'').trim()===String(idx+1)&&c&&String(c.textContent||'').trim().length>0;
 });
 var geometry={ok:false};
 if(stepper&&balls.length>=2){
  var ballRectsG=balls.map(function(b){return b.getBoundingClientRect();});
  var xs=ballRectsG.map(function(r){return r.left+r.width/2;});
  var ys=ballRectsG.map(function(r){return r.top+r.height/2;});
  var xIncreasing=true;
  for(var gi=1;gi<xs.length;gi++){if(xs[gi]<=xs[gi-1]+1)xIncreasing=false;}
  var ySpread=Math.max.apply(null,ys)-Math.min.apply(null,ys);
  var xSpread=Math.max.apply(null,xs)-Math.min.apply(null,xs);
  var horizontal=xIncreasing&&xSpread>=24&&ySpread<=40;
  var verticalStack=!xIncreasing&&ySpread>=24&&xSpread<=16;
  geometry={ok:true,stepCount:balls.length,xs:xs,ys:ys,xSpread:xSpread,ySpread:ySpread,xIncreasing:xIncreasing,horizontal:horizontal,verticalStack:verticalStack};
 }
 var rowLayout={ok:false};
 var columns={ok:false};
 if(row&&addr&&badge&&dateEl&&valueEl&&stepper&&stagelabel){
  var colEls=[addr,badge,dateEl,valueEl,stepper,stagelabel];
  var colRects=colEls.map(function(el){return el.getBoundingClientRect();});
  var cys=colRects.map(function(r){return r.top+r.height/2;});
  var colXs=colRects.map(function(r){return r.left+r.width/2;});
  var ySpread=Math.max.apply(null,cys)-Math.min.apply(null,cys);
  var xIncreasing=true;
  for(var ci=1;ci<colXs.length;ci++){if(colXs[ci]<=colXs[ci-1]+2)xIncreasing=false;}
  rowLayout={ok:true,sameLine:ySpread<=24,ySpread:ySpread,cys:cys,fieldCount:6};
  columns={ok:true,xIncreasing:xIncreasing,xs:colXs,fields:['addr','badge','date','value','stepper','stage']};
 }
 return{
  ok:true,hasRow:!!row,gridDisplay:rowStyle?rowStyle.display:null,
  hasAddr:!!addr,hasBadge:!!badge,hasDate:!!dateEl,hasValue:!!valueEl,
  hasStagelabel:!!stagelabel&&String(stagelabel.textContent||'').trim().length>0,
  stagelabelText:stagelabel?String(stagelabel.textContent||'').trim():'',
  noStagePrefix:!stagelabel||(!/current stage|etapa atual/i.test(String(stagelabel.textContent||''))),
  flexDirection:stepperStyle?stepperStyle.flexDirection:null,
  flexWrap:stepperStyle?stepperStyle.flexWrap:null,
  ballCount:balls.length,
  capCount:card.querySelectorAll('.gm-jf-cap').length,
  connectorCount:card.querySelectorAll('.gm-jf-connector').length,
  currentStage:current?current.getAttribute('data-stage'):null,
  currentBallW:balls.length&&current?ballW(current.querySelector('.gm-jf-ball')):0,
  doneCount:doneCount,futureCount:futureCount,
  visibleLabelCount:visibleLabels.length,
  numsCapsOk:numsCapsOk,
  ballsUniform:ballsUniform,
  equalGaps:equalGaps,
  geometry:geometry,
  rowLayout:rowLayout,
  columns:columns
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
      rp.ballCount >= 5 &&
      rp.capCount >= 5 &&
      rp.labelCount === 0 &&
      rp.srCount === 0 &&
      rp.htmlHasBallClass &&
      rp.htmlHasCapClass &&
      rp.numsOk &&
      rp.hasCurrent &&
      rp.currentStage === 'vendor_requested' &&
      rpInt.ok &&
      rpInt.currentStage === 'closed_internal' &&
      rpInt.numsOk;

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
      s1.ballCount >= 5 &&
      s1.capCount >= 5 &&
      s1.connectorCount >= 4 &&
      s1.visibleLabelCount === 0 &&
      s1.numsCapsOk &&
      s1.ballsUniform?.ok &&
      s1.ballsUniform.uniform &&
      s1.equalGaps?.ok &&
      s1.equalGaps.equal &&
      s1.currentStage === 'vendor_requested' &&
      s1.hasRow &&
      s1.gridDisplay === 'grid' &&
      s1.hasAddr &&
      s1.hasBadge &&
      s1.hasDate &&
      s1.hasValue &&
      s1.hasStagelabel &&
      s1.noStagePrefix &&
      s1.rowLayout?.ok &&
      s1.rowLayout.sameLine &&
      s1.rowLayout.fieldCount === 6 &&
      s1.columns?.ok &&
      s1.columns.xIncreasing &&
      s2.ok &&
      s2.currentStage === 'closed_internal' &&
      s2.visibleLabelCount === 0 &&
      s2.numsCapsOk &&
      s2.ballsUniform?.ok &&
      s2.ballsUniform.uniform &&
      s2.equalGaps?.ok &&
      s2.equalGaps.equal &&
      s2.flexDirection === 'row' &&
      s2.gridDisplay === 'grid' &&
      s2.hasAddr &&
      s2.hasBadge &&
      s2.hasStagelabel &&
      s2.noStagePrefix &&
      s2.rowLayout?.ok &&
      s2.rowLayout.sameLine &&
      s2.columns?.ok &&
      s2.columns.xIncreasing &&
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
