#!/usr/bin/env node
/**
 * Generate hierarchical i18n key suggestions from extract output.
 * Input:  scripts/.i18n-candidates.json
 * Output: scripts/.i18n-keygen.suggested.json
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { pageToPrefix, slugify, detectLang } from './i18n-lib.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const CANDIDATES = join(__dir, '.i18n-candidates.json');
const OUT = join(__dir, '.i18n-keygen.suggested.json');

function inferSegment(text, type) {
  const t = String(text).toLowerCase();
  if (type === 'alerts') return 'alert';
  if (/modal|dialog/i.test(t) || t.length < 30) return 'modal';
  if (/^(total|gross|net|margin|kpi)/i.test(t) || t === t.toUpperCase()) return 'kpi';
  if (/^(save|cancel|delete|close|apply|upload|search)/i.test(t)) return 'action';
  if (t.endsWith('?')) return 'confirm';
  return 'label';
}

function buildKey(pageId, type, text) {
  const pagePrefix = pageToPrefix(pageId.replace(/^#/, ''));
  const seg = inferSegment(text, type);
  const slug = slugify(text) || 'text';
  if (type === 'alerts') {
    return `${seg}.${slug}`;
  }
  if (seg === 'kpi') {
    return `${pagePrefix}.kpi.${slug}.label`;
  }
  if (seg === 'action' || seg === 'confirm') {
    return `common.${seg}.${slug}`;
  }
  if (seg === 'modal') {
    return `modal.${slug}`;
  }
  return `${pagePrefix}.${slug}`;
}

function localePlaceholders(text, lang) {
  const src = String(text).trim();
  const l = lang === 'pt' || lang === 'en' || lang === 'es' ? lang : detectLang(src);
  const out = { en: 'TODO_EN', pt: 'TODO_PT', es: 'TODO_ES' };
  if (l === 'pt') {
    out.pt = src;
  } else if (l === 'es') {
    out.es = src;
  } else {
    out.en = src;
  }
  return out;
}

function main() {
  if (!existsSync(CANDIDATES)) {
    console.error('Missing candidates file. Run: node scripts/i18n-extract-candidates.mjs');
    process.exit(1);
  }
  const data = JSON.parse(readFileSync(CANDIDATES, 'utf8'));
  const textToKey = new Map();
  const keys = {};
  const duplicates = [];
  let generated = 0;

  for (const [pageId, buckets] of Object.entries(data.by_page || {})) {
    for (const type of ['html_static', 'js_dynamic', 'alerts']) {
      for (const item of buckets[type] || []) {
        const text = String(item.text || '').trim();
        if (!text || text.length < 4) continue;
        const norm = text.toLowerCase();
        let key;
        if (textToKey.has(norm)) {
          key = textToKey.get(norm);
          duplicates.push({ text, key, page: pageId, type });
        } else {
          key = buildKey(pageId, type === 'alerts' ? 'alerts' : type, text);
          let candidate = key;
          let n = 2;
          while (keys[candidate] && keys[candidate].sourceText !== text) {
            candidate = `${key}_${n++}`;
          }
          key = candidate;
          textToKey.set(norm, key);
          keys[key] = {
            sourceText: text,
            detectedLang: item.lang || detectLang(text),
            pages: [pageId],
            types: [type],
            translations: localePlaceholders(text, item.lang),
          };
          generated++;
        }
        if (keys[key] && !keys[key].pages.includes(pageId)) {
          keys[key].pages.push(pageId);
          if (keys[key].pages.length > 1 && !key.startsWith('common.')) {
            const commonKey = `common.${slugify(text)}`;
            if (!keys[commonKey]) {
              keys[commonKey] = { ...keys[key], promotedFrom: key };
              textToKey.set(norm, commonKey);
            }
          }
        }
      }
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    source: 'scripts/.i18n-candidates.json',
    stats: {
      uniqueKeys: Object.keys(keys).length,
      duplicateHits: duplicates.length,
      pagesCovered: Object.keys(data.by_page || {}).length,
    },
    keys,
    duplicateMappings: duplicates.slice(0, 200),
  };

  writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ ok: true, output: OUT, stats: output.stats }, null, 2));
}

main();
