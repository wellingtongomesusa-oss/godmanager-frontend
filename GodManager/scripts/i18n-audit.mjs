#!/usr/bin/env node
/**
 * i18n audit — read-only scan of Premium HTML + gm-i18n.js.
 * Output: scripts/.i18n-audit.report.json
 */
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  ROOT,
  PREMIUM_HTML,
  GM_I18N_JS,
  SILO_NAMES,
  readProjectFile,
  parseGmI18n,
  parseSilos,
  collectUsedI18nKeys,
  splitHtmlAndScripts,
  isSkippableText,
  detectLang,
  findPageRegions,
  extractAlertConfirmStrings,
  lineNumberAt,
} from './i18n-lib.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPORT_JSON = join(__dir, '.i18n-audit.report.json');
const DOCS_DIR = join(ROOT, 'docs');
const REPORT_MD = join(DOCS_DIR, 'i18n-audit-2026-06-05.md');

function extractHardcodedHtml(markup) {
  const items = [];
  const re = />([^<]{4,200})</g;
  let m;
  while ((m = re.exec(markup)) !== null) {
    const text = m[1].replace(/\s+/g, ' ').trim();
    if (isSkippableText(text)) continue;
    const before = markup.slice(Math.max(0, m.index - 120), m.index);
    if (/data-i18n=/.test(before)) continue;
    items.push({ text, line: lineNumberAt(markup, m.index), lang: detectLang(text) });
  }
  return items;
}

function duplicateSiloKeys(gmLocales, silos) {
  const gmEn = gmLocales.en || {};
  const dupes = {};
  for (const siloName of SILO_NAMES) {
    const siloEn = silos[siloName]?.en || {};
    const matches = [];
    for (const [key, val] of Object.entries(siloEn)) {
      const gmVal = gmEn[key];
      if (gmVal !== undefined && String(gmVal).trim() === String(val).trim()) {
        matches.push({ key, value: val });
      } else if (gmVal !== undefined) {
        matches.push({ key, siloValue: val, gmValue: gmVal, sameKeyDifferentValue: true });
      }
    }
    dupes[siloName] = {
      siloKeyCount: Object.keys(siloEn).length,
      exactDuplicatesWithGmI18n: matches.filter((x) => !x.sameKeyDifferentValue),
      sameKeyDifferentValue: matches.filter((x) => x.sameKeyDifferentValue),
    };
  }
  return dupes;
}

function localeDiscrepancies(locales) {
  const enKeys = Object.keys(locales.en || {});
  const ptKeys = new Set(Object.keys(locales.pt || {}));
  const esKeys = new Set(Object.keys(locales.es || {}));
  const missingInPt = enKeys.filter((k) => !ptKeys.has(k));
  const missingInEs = enKeys.filter((k) => !esKeys.has(k));
  const extraInPt = [...ptKeys].filter((k) => !(k in (locales.en || {})));
  const extraInEs = [...esKeys].filter((k) => !(k in (locales.en || {})));
  return { missingInPt, missingInEs, extraInPt, extraInEs };
}

function hardcodedByPage(html, markup) {
  const pages = findPageRegions(html);
  const byPage = {};
  for (const p of pages) {
    const slice = markup.slice(p.start, p.end);
    const items = extractHardcodedHtml(slice);
    if (items.length) byPage[p.id] = { count: items.length, samples: items.slice(0, 8) };
  }
  return byPage;
}

function buildMarkdown(report) {
  const s = report.summary;
  const topPages = report.hardcodedByPageTop10
    .map((p) => `| \`${p.page}\` | ${p.count} |`)
    .join('\n');
  return `# GodManager i18n — Auditoria (2026-06-05)

Relatório gerado por \`scripts/i18n-audit.mjs\` (read-only). Sem impacto em runtime.

## Sumário executivo

| Métrica | Valor |
|---------|------:|
| Chaves em gm-i18n.js (en) | ${s.gmI18nKeyCountEn} |
| Chaves usadas (data-i18n / t()) | ${s.usedKeyCount} |
| Chaves órfãs | ${s.orphanKeyCount} |
| Chaves fantasmas | ${s.ghostKeyCount} |
| Discrepâncias locale (falta em pt) | ${s.localeMissingPt} |
| Discrepâncias locale (falta em es) | ${s.localeMissingEs} |
| Texto HTML hardcoded (suspeito) | ${s.hardcodedHtmlCount} |
| Alerts/confirms hardcoded | ${s.hardcodedAlertsCount} |
| Páginas #page-* | ${s.pageCount} |

## Chaves fantasmas (data-i18n sem entrada em gm-i18n.js)

${report.ghostKeys.length ? report.ghostKeys.map((k) => `- \`${k}\``).join('\n') : '_Nenhuma_'}

## Silos paralelos vs gm-i18n.js

${SILO_NAMES.map((name) => {
  const d = report.siloDuplicates[name];
  return `### ${name}\n- Chaves no silo (en): ${d.siloKeyCount}\n- Duplicatas exactas com gm-i18n: ${d.exactDuplicatesWithGmI18n.length}\n- Mesma chave, valor diferente: ${d.sameKeyDifferentValue.length}`;
}).join('\n\n')}

## Top 10 páginas — texto hardcoded (HTML)

| Página | Ocorrências |
|--------|------------:|
${topPages}

## Alerts / confirms hardcoded (amostra)

${report.hardcodedAlerts.sample
  .slice(0, 15)
  .map((a) => `- L${a.line} \`${a.fn}()\`: "${a.text.slice(0, 80)}${a.text.length > 80 ? '…' : ''}"`)
  .join('\n')}

## Recomendação de ordem de migração (Pacote H)

1. **H.1** — Persistência locale pós-login (cookie / localStorage).
2. **H.2** — Sidebar + topbar + \`TITLES{}\` (~85 strings, alta visibilidade).
3. **H.5** — Jobs (maior concentração PT recente).
4. **H.3** — Home (\`CARDS[]\`) + Dashboard longterm.
5. **H.4** — Properties + Owner Statement.
6. **H.6** — Tenants + Expenses (unificar silos \`LT_EXP_I18N\`, \`GV_I18N\`).
7. **H.7** — News, Results (corrigir fantasmas), Forms.
8. **H.QA** — Smoke 3 locales.

## Artefactos

- JSON completo: \`scripts/.i18n-audit.report.json\`
- Candidatos: \`scripts/.i18n-candidates.json\` (via \`i18n-extract-candidates.mjs\`)
- Chaves sugeridas: \`scripts/.i18n-keygen.suggested.json\`

---

_Gerado em ${report.generatedAt}. Re-executar: \`node scripts/i18n-tooling.mjs\`_
`;
}

function main() {
  const html = readProjectFile(PREMIUM_HTML);
  const i18nSrc = readProjectFile(GM_I18N_JS);
  const { locales } = parseGmI18n(i18nSrc);
  const silos = parseSilos(html);
  const used = collectUsedI18nKeys(html);
  const enKeys = Object.keys(locales.en || {});
  const orphans = enKeys.filter((k) => !used.has(k));
  const ghostFromData = [...html.matchAll(/data-i18n=["']([a-zA-Z0-9_]+)["']/g)].map((m) => m[1]);
  const ghosts = [...new Set(ghostFromData)].filter((k) => !(k in (locales.en || {})));
  const localeGap = localeDiscrepancies(locales);
  const { markup, scripts } = splitHtmlAndScripts(html);
  const hardcodedHtml = extractHardcodedHtml(markup);
  const alertsMarkup = extractAlertConfirmStrings(markup);
  const alertsScripts = scripts.flatMap((s) => extractAlertConfirmStrings(s.body).map((a) => ({ ...a, scriptLine: s.line + a.line - 1 })));
  const hardcodedAlerts = [...alertsMarkup, ...alertsScripts].filter((a) => a.hardcoded);
  const byPageRaw = hardcodedByPage(html, markup);
  const hardcodedByPageTop10 = Object.entries(byPageRaw)
    .map(([page, v]) => ({ page, count: v.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const pages = findPageRegions(html);

  const report = {
    generatedAt: new Date().toISOString(),
    files: {
      premiumHtml: 'public/GodManager_Premium.html',
      gmI18nJs: 'public/gm-i18n.js',
    },
    summary: {
      gmI18nKeyCountEn: enKeys.length,
      gmI18nKeyCountPt: Object.keys(locales.pt || {}).length,
      gmI18nKeyCountEs: Object.keys(locales.es || {}).length,
      usedKeyCount: used.size,
      orphanKeyCount: orphans.length,
      ghostKeyCount: ghosts.length,
      localeMissingPt: localeGap.missingInPt.length,
      localeMissingEs: localeGap.missingInEs.length,
      hardcodedHtmlCount: hardcodedHtml.length,
      hardcodedAlertsCount: hardcodedAlerts.length,
      pageCount: pages.length,
      siloCount: SILO_NAMES.length,
    },
    usedKeys: [...used].sort(),
    orphanKeys: orphans.sort(),
    ghostKeys: ghosts.sort(),
    localeDiscrepancies: localeGap,
    siloDuplicates: duplicateSiloKeys(locales, silos),
    siloKeyCounts: Object.fromEntries(
      SILO_NAMES.map((n) => [n, Object.keys(silos[n]?.en || {}).length]),
    ),
    hardcodedByPageTop10,
    hardcodedByPage: byPageRaw,
    hardcodedAlerts: {
      count: hardcodedAlerts.length,
      sample: hardcodedAlerts.slice(0, 50),
    },
    hardcodedHtmlSample: hardcodedHtml.slice(0, 40),
  };

  mkdirSync(DOCS_DIR, { recursive: true });
  writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2) + '\n', 'utf8');
  writeFileSync(REPORT_MD, buildMarkdown(report), 'utf8');

  console.log(JSON.stringify({ ok: true, reportJson: REPORT_JSON, reportMd: REPORT_MD, summary: report.summary }, null, 2));
}

main();
