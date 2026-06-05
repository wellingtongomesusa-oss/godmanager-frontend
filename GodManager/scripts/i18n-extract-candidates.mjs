#!/usr/bin/env node
/**
 * Extract i18n candidate strings from Premium HTML (read-only).
 * Output: scripts/.i18n-candidates.json
 */
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  PREMIUM_HTML,
  readProjectFile,
  splitHtmlAndScripts,
  isSkippableText,
  detectLang,
  findPageRegions,
  extractAlertConfirmStrings,
  lineNumberAt,
  findScriptPageContext,
} from './i18n-lib.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, '.i18n-candidates.json');

function extractHtmlTextNodes(slice, baseLine) {
  const items = [];
  const re = />([^<]{4,240})</g;
  let m;
  while ((m = re.exec(slice)) !== null) {
    const text = m[1].replace(/\s+/g, ' ').trim();
    if (isSkippableText(text)) continue;
    const before = slice.slice(Math.max(0, m.index - 100), m.index);
    if (/data-i18n=/.test(before)) continue;
    items.push({
      text,
      lang: detectLang(text),
      line: baseLine + lineNumberAt(slice, m.index) - 1,
    });
  }
  return items;
}

function extractJsStringLiterals(scriptBody, scriptStartInFile, html) {
  const items = [];
  const pageId = findScriptPageContext(html, scriptStartInFile);
  const patterns = [
    /'((?:\\'|[^'\\]){4,200})'/g,
    /"((?:\\"|[^"\\]){4,200})"/g,
    /`((?:\\`|[^`\\]){4,200})`/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(scriptBody)) !== null) {
      const raw = m[1].replace(/\\n/g, ' ').replace(/\\'/g, "'").replace(/\\"/g, '"');
      if (raw.includes('${')) continue;
      if (isSkippableText(raw)) continue;
      if (/^[a-z_][a-zA-Z0-9_.]*$/.test(raw) && raw.length < 40) continue;
      if (/^(GET|POST|PATCH|DELETE|PUT|application\/json|credentials|include)$/i.test(raw)) continue;
      const ctx = scriptBody.slice(Math.max(0, m.index - 30), m.index);
      if (/\bt\s*\($/.test(ctx.trim()) || /data-i18n/.test(ctx)) continue;
      items.push({
        text: raw,
        lang: detectLang(raw),
        line: lineNumberAt(scriptBody, m.index),
        pageContext: pageId,
      });
    }
  }
  return items;
}

function dedupeItems(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const k = `${it.text}::${it.line}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

function main() {
  const html = readProjectFile(PREMIUM_HTML);
  const pages = findPageRegions(html);
  const { markup, scripts } = splitHtmlAndScripts(html);
  const byPage = {};
  const totals = {
    html_static: 0,
    js_dynamic: 0,
    alerts: 0,
    by_lang: { pt: 0, en: 0, es: 0, unknown: 0 },
  };

  function bumpLang(lang) {
    if (totals.by_lang[lang] !== undefined) totals.by_lang[lang]++;
    else totals.by_lang.unknown++;
  }

  for (const p of pages) {
    const slice = markup.slice(p.start, p.end);
    const baseLine = lineNumberAt(markup, p.start);
    const htmlStatic = dedupeItems(extractHtmlTextNodes(slice, baseLine));
    const key = `#${p.id}`;
    byPage[key] = { html_static: htmlStatic, js_dynamic: [], alerts: [] };
    for (const it of htmlStatic) {
      totals.html_static++;
      bumpLang(it.lang);
    }
  }

  byPage['#page-global'] = byPage['#page-global'] || { html_static: [], js_dynamic: [], alerts: [] };
  const globalMarkupAlerts = extractAlertConfirmStrings(markup).filter((a) => a.hardcoded);
  for (const a of globalMarkupAlerts) {
    const entry = { text: a.text, lang: detectLang(a.text), line: a.line };
    byPage['#page-global'].alerts.push(entry);
    totals.alerts++;
    bumpLang(entry.lang);
  }

  let scriptOffset = 0;
  const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let sm;
  while ((sm = scriptRe.exec(html)) !== null) {
    const body = sm[1];
    const fileIndex = sm.index;
    const pageId = findScriptPageContext(html, fileIndex);
    const key = `#${pageId}`;
    if (!byPage[key]) byPage[key] = { html_static: [], js_dynamic: [], alerts: [] };

    const jsItems = dedupeItems(extractJsStringLiterals(body, fileIndex, html));
    for (const it of jsItems) {
      byPage[key].js_dynamic.push(it);
      totals.js_dynamic++;
      bumpLang(it.lang);
    }

    const scriptAlerts = extractAlertConfirmStrings(body).filter((a) => a.hardcoded);
    for (const a of scriptAlerts) {
      const entry = {
        text: a.text,
        lang: detectLang(a.text),
        line: lineNumberAt(html, fileIndex) + a.line - 1,
      };
      byPage[key].alerts.push(entry);
      totals.alerts++;
      bumpLang(entry.lang);
    }
    scriptOffset++;
  }

  const output = {
    generatedAt: new Date().toISOString(),
    source: 'public/GodManager_Premium.html',
    by_page: byPage,
    totals,
    pageCount: Object.keys(byPage).length,
  };

  writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ ok: true, output: OUT, totals }, null, 2));
}

main();
