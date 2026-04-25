/**
 * One-shot: importa public/tenants_seed.js para a tabela tenants.
 * Tenta resolver propId -> Property.code e ligar via propertyId.
 * Corre: npx tsx scripts/import-tenants-seed.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

function loadSeed(): any[] {
  const file = path.resolve(__dirname, '..', 'public', 'tenants_seed.js');
  const raw = fs.readFileSync(file, 'utf8');
  const fn = new Function('window', raw + '; return window.GM_TENANTS_SEED;');
  const arr = fn({});
  if (!Array.isArray(arr)) throw new Error('GM_TENANTS_SEED nao e array');
  return arr;
}

function num(v: any): string {
  if (v === null || v === undefined || v === '') return '0';
  const n = Number(v);
  return Number.isNaN(n) ? '0' : String(n);
}

function dateOrNull(v: any): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildMetadata(s: any): Record<string, any> {
  const meta: Record<string, any> = {};
  const keep = ['propertyCsv', 'documents', 'paymentHistory', 'custom', 'source'];
  for (const k of keep) if (s[k] !== undefined) meta[k] = s[k];
  return meta;
}

async function main() {
  const seed = loadSeed();
  console.log('Seed tem', seed.length, 'tenants');

  // Mapa code -> id da tabela properties para resolver propertyId
  const props = await prisma.property.findMany({ select: { id: true, code: true } });
  const propMap = new Map(props.map((p) => [p.code, p.id]));
  console.log('Properties disponiveis:', props.length);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let linked = 0;

  for (const s of seed) {
    const code = String(s.id || '').trim();
    const name = String(s.name || '').trim();
    if (!code || !name) {
      skipped++;
      continue;
    }

    const propertyId = s.propId && propMap.get(String(s.propId)) ? propMap.get(String(s.propId))! : null;
    if (propertyId) linked++;

    const data = {
      code,
      name,
      email: s.email || null,
      phone: s.phone || null,
      unit: s.unit || null,
      propertyId,
      moveIn: dateOrNull(s.moveIn),
      leaseTo: dateOrNull(s.leaseTo),
      rent: num(s.rent),
      deposit: num(s.deposit),
      tenantType: s.tenantType || null,
      status: s.status || 'active',
      ssn: s.ssn || null,
      itin: s.itin || null,
      tags: Array.isArray(s.tags) ? s.tags : [],
      notes: s.notes || null,
      metadata: buildMetadata(s) as any,
      createdBy: 'seed-import',
    };

    try {
      const existing = await prisma.tenant.findUnique({ where: { code } });
      if (existing) {
        await prisma.tenant.update({ where: { code }, data });
        updated++;
      } else {
        await prisma.tenant.create({ data });
        inserted++;
      }
    } catch (e) {
      console.error('Erro em', code, '-', e);
      skipped++;
    }
  }

  console.log('---');
  console.log('Inseridos:', inserted);
  console.log('Actualizados:', updated);
  console.log('Skipped:', skipped);
  console.log('Linkados a Property:', linked, '/', seed.length);

  const total = await prisma.tenant.count();
  console.log('Total na tabela agora:', total);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
