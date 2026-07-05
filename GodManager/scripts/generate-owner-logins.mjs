#!/usr/bin/env node
/**
 * Gera login (User role=owner) para cada Owner ativo que ainda não tem login.
 * Usa o e-mail real do owner se houver; senão gera um identificador SINTÉTICO
 * (nome.sobrenome@owner.godmanager.us) — pois a maioria dos owners não tem e-mail.
 * O identificador sintético é só o "usuário" de login (não é uma caixa de e-mail real);
 * o gestor entrega login+senha ao proprietário. Idempotente (pula quem já tem login).
 *
 * Uso:
 *   node scripts/generate-owner-logins.mjs --prod           (DRY-RUN: só mostra)
 *   node scripts/generate-owner-logins.mjs --prod --apply
 *
 * ⚠️ A lista exportada contém SENHAS em texto puro — não commitar; distribuir e apagar.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const APPLY = process.argv.includes('--apply');
const USE_PROD = process.argv.includes('--prod');
const SYNTH_DOMAIN = 'owner.godmanager.us';

function envFromDotLocal(varName) {
  try {
    const raw = readFileSync(join(ROOT, '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(new RegExp('^' + varName + '=("?)(.+?)\\1\\s*$'));
      if (m) return m[2];
    }
  } catch {
    /* sem .env.local */
  }
  return null;
}

const dbUrl = USE_PROD
  ? envFromDotLocal('DATABASE_URL_PRODUCTION')
  : envFromDotLocal('DATABASE_URL_LOCAL');
if (!dbUrl) {
  console.error('DATABASE_URL não encontrada em .env.local (use --prod).');
  process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const b = crypto.randomBytes(10);
  let s = '';
  for (let i = 0; i < 10; i++) s += chars[b[i] % chars.length];
  return s;
}
function splitName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || 'Owner', last: parts.slice(1).join(' ') || '-' };
}
/** Nome do owner -> slug de login; remove acentos e junta com pontos. */
function slugifyName(name) {
  let s = String(name || '').trim();
  s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  s = s.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
  return s || 'owner';
}
/** Garante identificador único (no banco e no lote): base@dom, base.2@dom, ... */
async function uniqueIdentifier(base, usedInBatch) {
  let n = 1;
  for (;;) {
    const candidate = (n === 1 ? base : `${base}.${n}`) + '@' + SYNTH_DOMAIN;
    if (!usedInBatch.has(candidate)) {
      const exists = await prisma.user.findUnique({ where: { email: candidate }, select: { id: true } });
      if (!exists) return candidate;
    }
    n++;
  }
}

async function main() {
  console.log(`[generate-owner-logins] modo=${APPLY ? 'APPLY' : 'DRY-RUN'} db=${USE_PROD ? 'PROD' : 'LOCAL'}`);
  const owners = await prisma.owner.findMany({
    where: { active: true },
    select: { id: true, name: true, email: true, clientId: true },
  });
  const out = [];
  const usedInBatch = new Set();
  let created = 0;
  let skipped = 0;
  for (const o of owners) {
    const byOwner = await prisma.user.findFirst({ where: { ownerId: o.id }, select: { id: true } });
    if (byOwner) {
      skipped++;
      continue;
    }
    let email = String(o.email || '').trim().toLowerCase();
    let synthetic = false;
    if (!email || !email.includes('@')) {
      email = await uniqueIdentifier(slugifyName(o.name), usedInBatch);
      synthetic = true;
    } else {
      const clash = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (clash) {
        console.log(`  [SKIP e-mail já em uso] ${email} (owner: ${o.name})`);
        skipped++;
        continue;
      }
    }
    usedInBatch.add(email);
    const pwd = genPassword();
    const { first, last } = splitName(o.name);
    out.push({ owner: o.name, login: email, senha: pwd, sintetico: synthetic });
    console.log(`  [${email}] ${APPLY ? 'criando' : 'criaria'} login (owner: ${o.name})${synthetic ? ' [sintético]' : ''}`);
    if (APPLY) {
      const hash = await bcrypt.hash(pwd, 10);
      await prisma.user.create({
        data: {
          firstName: first,
          lastName: last,
          email,
          passwordHash: hash,
          role: 'owner',
          ownerId: o.id,
          clientId: o.clientId,
          status: 'active',
        },
      });
      created++;
    }
  }
  if (APPLY && out.length) {
    const dir = join(ROOT, 'scripts', 'backups');
    mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = join(dir, `owner-logins-${stamp}.json`);
    writeFileSync(file, JSON.stringify(out, null, 2));
    console.log(`[lista] credenciais salvas em: ${file}`);
    console.log('[lista] ⚠️ contém SENHAS — não commitar; distribuir e apagar.');
  }
  console.log(
    `[resultado] logins ${APPLY ? 'criados' : 'a criar'}: ${APPLY ? created : out.length} | pulados: ${skipped}${APPLY ? '' : ' (dry-run — nada gravado)'}`,
  );
  await prisma.$disconnect();
}
main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
