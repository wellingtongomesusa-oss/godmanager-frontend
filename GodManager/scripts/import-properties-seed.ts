/**
 * One-shot: importa public/properties_seed.js para a tabela properties (Postgres).
 *
 * Corre: npx tsx scripts/import-properties-seed.ts
 *
 * - Le window.GM_PROPERTIES_SEED do ficheiro.
 * - Faz upsert por 'code' (id do seed) para ser idempotente.
 * - Preserva campos nao-mapeados em metadata (JSONB).
 * - NAO apaga dados existentes.
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

type SeedItem = {
  id: string;
  name?: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  owner?: string;
  currentRent?: number | string;
  marketRent?: number | string;
  mgmtPct?: number | string;
  mgmtFeeUsd?: number | string;
  mgmtFlatFee?: number | string;
  minFee?: number | string;
  waiveWhenVacant?: boolean;
  hoa?: number | string;
  maintenance?: number | string;
  reserve?: number | string;
  netOwner?: number | string;
  homeWarrantyExp?: string;
  insuranceExp?: string;
  taxYearEnd?: string;
  description?: string;
  notes?: string;
  sqft?: number | string;
  units?: number | string;
  status?: string;
  source?: string;
  [k: string]: any;
};

function loadSeed(): SeedItem[] {
  const file = path.resolve(__dirname, '..', 'public', 'properties_seed.js');
  const raw = fs.readFileSync(file, 'utf8');
  // stub window
  const sandbox: any = { window: {} };
  const fn = new Function('window', raw + '; return window.GM_PROPERTIES_SEED;');
  const arr = fn(sandbox.window);
  if (!Array.isArray(arr)) throw new Error('GM_PROPERTIES_SEED nao e array');
  return arr;
}

function num(v: any): string {
  if (v === null || v === undefined || v === '') return '0';
  const n = Number(v);
  if (Number.isNaN(n)) return '0';
  return String(n);
}

function intOrNull(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : Math.round(n);
}

function floatOrNull(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function buildNotes(s: SeedItem): string | null {
  const parts = [s.description, s.notes].filter(Boolean);
  return parts.length > 0 ? parts.join(' | ') : null;
}

function buildMetadata(s: SeedItem): Record<string, any> {
  const meta: Record<string, any> = {};
  const keep = [
    'name',
    'marketRent',
    'mgmtFeeUsd',
    'mgmtFlatFee',
    'minFee',
    'waiveWhenVacant',
    'hoa',
    'maintenance',
    'reserve',
    'netOwner',
    'homeWarrantyExp',
    'insuranceExp',
    'taxYearEnd',
    'sqft',
    'units',
    'source',
  ];
  for (const k of keep) {
    if (s[k] !== undefined && s[k] !== null && s[k] !== '') meta[k] = s[k];
  }
  return meta;
}

async function main() {
  const seed = loadSeed();
  console.log('Seed tem', seed.length, 'casas');

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const s of seed) {
    const code = String(s.id || '').trim();
    if (!code || !s.address) {
      console.warn('Skip: falta code ou address', s);
      skipped++;
      continue;
    }

    const data = {
      code,
      address: String(s.address),
      city: s.city || null,
      state: s.state || null,
      zip: s.zip || null,
      bedrooms: intOrNull(s.bedrooms),
      bathrooms: floatOrNull(s.bathrooms),
      rent: num(s.currentRent),
      deposit: '0',
      ownerName: s.owner || null,
      mgmtFeePct: num(s.mgmtPct),
      status: (s.status || 'active').toLowerCase(),
      notes: buildNotes(s),
      metadata: buildMetadata(s) as any,
      createdBy: 'seed-import',
    };

    try {
      const existing = await prisma.property.findUnique({ where: { code } });
      if (existing) {
        await prisma.property.update({ where: { code }, data });
        updated++;
      } else {
        await prisma.property.create({ data });
        inserted++;
      }
    } catch (e) {
      console.error('Erro em', code, '-', e);
      skipped++;
    }
  }

  console.log('---');
  console.log('Inseridas:', inserted);
  console.log('Actualizadas:', updated);
  console.log('Skipped:', skipped);

  const total = await prisma.property.count();
  console.log('Total na tabela agora:', total);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
