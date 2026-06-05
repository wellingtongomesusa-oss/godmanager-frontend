/**
 * Shared read-only helpers for GodManager i18n tooling (Pacote H).
 * No network, no DB, no writes except via explicit callers.
 */
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dir, '..');
export const PREMIUM_HTML = join(ROOT, 'public', 'GodManager_Premium.html');
export const GM_I18N_JS = join(ROOT, 'public', 'gm-i18n.js');

export const SILO_NAMES = ['LT_EXP_I18N', 'GV_I18N', 'TP_I18N', 'GM_RES_I18N'];

export function readProjectFile(path) {
  if (!existsSync(path)) throw new Error(`File not found: ${path}`);
  return readFileSync(path, 'utf8');
}

/** Extract key -> value map from a flat object literal block (single-line or multiline). */
export function parseObjectLiteralKeys(block) {
  const keys = {};
  const re = /([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(?:'((?:\\'|[^'])*)'|"((?:\\"|[^"])*)"|`((?:\\`|[^`])*)`)/g;
  let m;
  while ((m = re.exec(block)) !== null) {
    const key = m[1];
    const val = (m[2] ?? m[3] ?? m[4] ?? '').replace(/\\'/g, "'").replace(/\\"/g, '"');
    keys[key] = val;
  }
  return keys;
}

/** Parse gm-i18n.js locales en / pt / es. */
export function parseGmI18n(source) {
  const locales = {};
  const order = ['en', 'pt', 'es'];
  for (let i = 0; i < order.length; i++) {
    const loc = order[i];
    const next = order[i + 1];
    const startRe = new RegExp(`\\b${loc}\\s*:\\s*\\{`);
    const start = source.search(startRe);
    if (start < 0) {
      locales[loc] = {};
      continue;
    }
    const braceStart = source.indexOf('{', start);
    let depth = 0;
    let end = braceStart;
    for (let j = braceStart; j < source.length; j++) {
      const ch = source[j];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }
    const block = source.slice(braceStart + 1, end);
    locales[loc] = parseObjectLiteralKeys(block);
  }
  return { locales, allKeys: new Set(Object.keys(locales.en || {})) };
}

/** Parse inline silo const X_I18N={en:{...},pt:{...},es:{...}} */
export function parseSilos(source) {
  const silos = {};
  for (const name of SILO_NAMES) {
    const re = new RegExp(`(?:const|var)\\s+${name}\\s*=\\s*\\{`, 'm');
    const m = re.exec(source);
    if (!m) {
      silos[name] = { en: {}, pt: {}, es: {} };
      continue;
    }
    const braceStart = source.indexOf('{', m.index + m[0].length - 1);
    let depth = 0;
    let end = braceStart;
    for (let j = braceStart; j < source.length; j++) {
      const ch = source[j];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }
    const outer = source.slice(braceStart + 1, end);
    const locs = {};
    for (const loc of ['en', 'pt', 'es']) {
      const locRe = new RegExp(`\\b${loc}\\s*:\\s*\\{`);
      const lm = locRe.exec(outer);
      if (!lm) {
        locs[loc] = {};
        continue;
      }
      const lb = outer.indexOf('{', lm.index);
      let d = 0;
      let le = lb;
      for (let k = lb; k < outer.length; k++) {
        if (outer[k] === '{') d++;
        else if (outer[k] === '}') {
          d--;
          if (d === 0) {
            le = k;
            break;
          }
        }
      }
      locs[loc] = parseObjectLiteralKeys(outer.slice(lb + 1, le));
    }
    silos[name] = locs;
  }
  return silos;
}

export function collectUsedI18nKeys(html) {
  const used = new Set();
  for (const m of html.matchAll(/data-i18n=["']([a-zA-Z0-9_]+)["']/g)) used.add(m[1]);
  for (const m of html.matchAll(/\bt\s*\(\s*["']([a-zA-Z0-9_]+)["']\s*[,)]/g)) used.add(m[1]);
  for (const m of html.matchAll(/(?:ltExpT|gvT|tpT|gmResT)\s*\(\s*["']([a-zA-Z0-9_]+)["']\s*\)/g))
    used.add(m[1]);
  return used;
}

export function lineNumberAt(source, index) {
  return source.slice(0, index).split('\n').length;
}

/** Split HTML into static markup vs inline script blocks (preserve order). */
export function splitHtmlAndScripts(html) {
  const scripts = [];
  const markup = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (full, body, offset) => {
    const line = lineNumberAt(html, offset);
    scripts.push({ body, line, full });
    return '\n'.repeat((full.match(/\n/g) || []).length);
  });
  return { markup, scripts };
}

const SKIP_PATTERNS = [
  /^[\d\s$%.,+\-/:|\\]+$/,
  /^P\d{3,}$/i,
  /^\$[\d,.]+$/,
  /^\d{4}-\d{2}-\d{2}$/,
  /^#[0-9a-f]{3,8}$/i,
  /^rgba?\(/i,
  /^var\(--/,
  /^[a-z]+-[a-z0-9-]+$/i,
  /^cm[a-z0-9]{20,}$/i,
  /^https?:\/\//i,
  /^[A-Z]{2,5}$/,
  /^—+$/,
  /^\.{3,}$/,
  /^[<>]=?$/,
  /^v\d+\.\d+/i,
];

const TECH_PATTERNS = [
  /^function\s/,
  /^const\s/,
  /^var\s/,
  /^return\s/,
  /^if\s*\(/,
  /^else\b/,
  /^async\s/,
  /^await\s/,
  /^typeof\s/,
  /^document\./,
  /^window\./,
  /^fetch\s*\(/,
  /^\.map\s*\(/,
  /^\.filter\s*\(/,
  /^\.forEach\s*\(/,
  /^\.length\b/,
  /^null$/,
  /^true$/,
  /^false$/,
  /^undefined$/,
  /^[a-z_][a-zA-Z0-9_]*$/,
  /^[a-z]+\(/i,
];

export function isSkippableText(text) {
  const t = String(text || '').trim();
  if (t.length < 4) return true;
  if (!/[a-zA-ZÀ-ÿ]/.test(t)) return true;
  for (const p of SKIP_PATTERNS) if (p.test(t)) return true;
  for (const p of TECH_PATTERNS) if (p.test(t)) return true;
  if (/^[\w.-]+@[\w.-]+\.\w+$/.test(t)) return true;
  if (/^[A-Z][a-z]+(?:[A-Z][a-z]+)+$/.test(t) && t.length < 30) return true; // camelCase identifiers
  return false;
}

const PT_MARKERS =
  /\b(não|nao|ção|ções|ções|propriedade|despesa|inquilino|salvar|agendado|selecionar|gestão|gestao|demonstrativo|todas as|sem |erro|preencha|comentário|comentario|manutenção|manutencao|proprietário|proprietario|cancelar|excluir|carregando|aguarde|permissão|permissao|reagendado|fornecedor)\b/i;
const EN_MARKERS =
  /\b(the|and|with|your|upload|schedule|search|loading|save|cancel|delete|properties|dashboard|tenant|vendor|permission|error|select|please|click)\b/i;
const ES_MARKERS =
  /\b(el|la|los|las|con|su|guardar|cancelar|propiedad|inquilino|seleccionar|error|permiso|cargando|todas las)\b/i;

export function detectLang(text) {
  const t = String(text || '');
  let pt = 0;
  let en = 0;
  let es = 0;
  if (/[ãõáéíóúâêôàç]/i.test(t)) pt += 3;
  if (PT_MARKERS.test(t)) pt += 2;
  if (EN_MARKERS.test(t)) en += 2;
  if (ES_MARKERS.test(t)) es += 2;
  if (/\b(ção|ções|não|nao)\b/i.test(t)) pt += 2;
  if (pt >= en && pt >= es && pt > 0) return 'pt';
  if (es > en && es > 0) return 'es';
  if (en > 0) return 'en';
  if (/^[A-Z][A-Z\s/&-]{3,}$/.test(t.trim())) return 'en';
  return 'unknown';
}

export function slugify(text, maxLen = 48) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, maxLen)
    .replace(/_+$/g, '');
}

/** Map page id to key prefix segment. */
export function pageToPrefix(pageId) {
  const id = String(pageId || '').replace(/^#/, '').replace(/^page-/, '');
  if (!id || id === 'home') return 'page.home';
  const map = {
    longterm: 'page.dashboard',
    ltproperties: 'page.properties',
    ltexpenses: 'page.expenses',
    ltcleanings: 'page.cleanings',
    jobs: 'page.jobs',
    tenants: 'page.tenants',
    news: 'page.news',
    vendors: 'page.vendors',
    'owner-statement': 'page.owner_statement',
    'owner-statement-detail': 'page.owner_statement_detail',
    integrations: 'page.integrations',
    results: 'page.results',
    'results-upload': 'page.results_upload',
    forms_received: 'page.forms_received',
    tenantportal: 'page.tenant_portal',
    ownerportal: 'page.owner_portal',
  };
  if (map[id]) return map[id];
  return `page.${id.replace(/-/g, '_')}`;
}

export function findPageRegions(html) {
  const pages = [];
  const re = /<div\s+class="page[^"]*"\s+id="(page-[^"]+)"/g;
  let m;
  const hits = [];
  while ((m = re.exec(html)) !== null) hits.push({ id: m[1], index: m.index });
  for (let i = 0; i < hits.length; i++) {
    const start = hits[i].index;
    const end = i + 1 < hits.length ? hits[i + 1].index : html.length;
    pages.push({ id: hits[i].id, start, end, content: html.slice(start, end) });
  }
  return pages;
}

export function findScriptPageContext(html, charIndex) {
  const pages = findPageRegions(html);
  let last = 'page-global';
  for (const p of pages) {
    if (p.start <= charIndex) last = p.id;
    else break;
  }
  return last;
}

export function extractAlertConfirmStrings(source) {
  const out = [];
  const re = /\b(alert|confirm)\s*\(\s*(['"`])((?:\\.|(?!\2)[\s\S])*?)\2/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const fn = m[1];
    const raw = m[3].replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"');
    const line = lineNumberAt(source, m.index);
    const usesT = /\bt\s*\(/.test(source.slice(Math.max(0, m.index - 40), m.index + 20));
    if (isSkippableText(raw) && raw.length < 20) continue;
    out.push({ fn, text: raw.slice(0, 200), line, usesT, hardcoded: !usesT && !raw.includes('${') });
  }
  return out;
}
