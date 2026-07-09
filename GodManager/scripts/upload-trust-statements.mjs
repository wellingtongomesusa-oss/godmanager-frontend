#!/usr/bin/env node
/**
 * Sobe os extratos mensais (PDF) da Manager Prop (Chase, consolidado das 3 contas)
 * para o R2 e cria as linhas em BankStatement. 1 arquivo por mês (Jan–Jun 2026).
 *
 * Idempotente: se já existir BankStatement (clientId, periodMonth), PULA.
 *
 * Uso:
 *   node scripts/upload-trust-statements.mjs --prod            (DRY-RUN)
 *   node scripts/upload-trust-statements.mjs --prod --apply    (sobe + grava)
 *   node scripts/upload-trust-statements.mjs --prod --client=<id>
 */
import { readFileSync, existsSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APPLY = process.argv.includes('--apply');
const USE_PROD = process.argv.includes('--prod');
const clientArg = (process.argv.find((a) => a.startsWith('--client=')) || '').split('=')[1] || '';
const DL = join(homedir(), 'Downloads');

// mês (YYYY-MM) -> data de fechamento -> arquivo (tenta variações)
const MONTHS = [
  { period: '2026-01', date: '2026-01-30', stamp: '20260130' },
  { period: '2026-02', date: '2026-02-27', stamp: '20260227' },
  { period: '2026-03', date: '2026-03-31', stamp: '20260331' },
  { period: '2026-04', date: '2026-04-30', stamp: '20260430' },
  { period: '2026-05', date: '2026-05-29', stamp: '20260529' },
  { period: '2026-06', date: '2026-06-30', stamp: '20260630' },
];

function findFile(stamp) {
  const cands = [
    `${stamp}-statements-7236-.pdf`,
    `${stamp}-statements-7236- (1).pdf`,
    `${stamp}-statements-6352-.pdf`,
    `${stamp}-statements-7509-.pdf`,
  ];
  for (const c of cands) {
    const p = join(DL, c);
    if (existsSync(p)) return p;
  }
  return null;
}

function envVar(name) {
  try {
    for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) {
      const m = line.match(new RegExp('^' + name + '=("?)(.+?)\\1\\s*$'));
      if (m) return m[2];
    }
  } catch {}
  return null;
}

const dbUrl = USE_PROD ? envVar('DATABASE_URL_PRODUCTION') : envVar('DATABASE_URL_LOCAL');
if (!dbUrl) {
  console.error('DATABASE_URL não encontrada (.env.local, use --prod).');
  process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

const R2_ENDPOINT = envVar('R2_ENDPOINT');
const R2_BUCKET = envVar('R2_BUCKET_NAME');
const s3 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: envVar('R2_ACCESS_KEY_ID'),
    secretAccessKey: envVar('R2_SECRET_ACCESS_KEY'),
  },
});

async function resolveClientId() {
  if (clientArg) return clientArg;
  const clients = await prisma.client.findMany({
    where: { companyName: { contains: 'Manager Prop', mode: 'insensitive' } },
    select: { id: true, companyName: true },
  });
  if (clients.length === 1) return clients[0].id;
  console.error('Não resolveu cliente único "Manager Prop" — use --client=<id>.');
  return null;
}

async function main() {
  console.log(`[upload-trust-statements] modo=${APPLY ? 'APPLY' : 'DRY-RUN'} db=${USE_PROD ? 'PROD' : 'LOCAL'}`);
  if (!R2_ENDPOINT || !R2_BUCKET) {
    console.error('R2_ENDPOINT/R2_BUCKET_NAME ausentes no .env.local.');
    process.exit(1);
  }
  const clientId = await resolveClientId();
  if (!clientId) {
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log(`Cliente: ${clientId} | bucket: ${R2_BUCKET}`);

  let done = 0;
  let skipped = 0;
  for (const m of MONTHS) {
    const file = findFile(m.stamp);
    if (!file) {
      console.log(`  ! ${m.period}: arquivo não encontrado em ~/Downloads (stamp ${m.stamp}) — pula`);
      continue;
    }
    const existing = await prisma.bankStatement.findFirst({
      where: { clientId, periodMonth: m.period },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      console.log(`  = ${m.period}: já existe — pula`);
      continue;
    }
    const size = statSync(file).size;
    const fileName = `Chase-${m.period}.pdf`;
    const fileKey = `bank-statements/${clientId}/${m.period}.pdf`;
    console.log(`  ${APPLY ? '+' : '~'} ${m.period}: ${file.split('/').pop()} -> ${fileKey} (${size} bytes)`);
    if (APPLY) {
      const bytes = readFileSync(file);
      await s3.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: fileKey,
          Body: bytes,
          ContentType: 'application/pdf',
        }),
      );
      await prisma.bankStatement.create({
        data: {
          clientId,
          periodMonth: m.period,
          statementDate: new Date(m.date + 'T00:00:00.000Z'),
          bankName: 'Chase',
          fileKey,
          fileName,
          fileSize: size,
          uploadedBy: null,
        },
      });
      done++;
    }
  }

  console.log(`\n[resultado] ${APPLY ? 'enviados' : 'seriam enviados'}: ${done} | pulados: ${skipped}`);
  if (!APPLY) console.log('DRY-RUN — nada enviado/gravado. Rode com --apply.');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
