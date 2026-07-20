import { NextResponse } from 'next/server';
import { csrfGuard } from '@/lib/csrfGuard';
import { rateLimitGuard } from '@/lib/apiRateLimit';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { recordAudit } from '@/lib/auditServer';
import {
  parseGeneralLedgerEntries,
  glCycle15,
  matchProperty,
  normalizePropertyKey,
  type PropertyLite,
} from '@/lib/generalLedger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/owner-statement/gl-import  (multipart: file=<GL CSV>, clientId?)
 * Importa o General Ledger do AppFolio: RECEBIDO (4100 Credit) e ENVIADO ao owner (3250 Debit) por
 * casa, bucketizando pelo ciclo 15-a-15. Casa cada linha com a Property; guarda em PropertyGlTxn
 * (idempotente por sourceRefId, preserva `tipo` editado). Admin/manager/super_admin.
 */
function defaultTipo(kind: string, description: string): string {
  const d = String(description || '').toLowerCase();
  if (kind === 'MGM_FEE') return 'Management fee';
  if (kind === 'SENT') return 'Repasse ao owner';
  if (/pet/.test(d)) return 'Pet Fee';
  if (/late/.test(d)) return 'Multa/atraso';
  if (/reimburs|utility/.test(d)) return 'Reembolso';
  if (/application/.test(d)) return 'Taxa de aplicação';
  return 'Aluguel';
}

export async function POST(req: Request) {
  const bad = csrfGuard(req);
  if (bad) return bad;
  const rl = rateLimitGuard(req);
  if (rl) return rl;
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });

  try {
    const ct = req.headers.get('content-type') || '';
    if (!ct.includes('multipart/form-data')) {
      return NextResponse.json({ ok: false, error: 'Envie o CSV como multipart/form-data.' }, { status: 400 });
    }
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ ok: false, error: 'Arquivo (file) ausente.' }, { status: 400 });
    if (file.size > 25 * 1024 * 1024) return NextResponse.json({ ok: false, error: 'Arquivo muito grande (máx 25MB).' }, { status: 413 });

    const scope = await resolveBankAccountClientScope(user, (form.get('clientId') as string) || null);
    if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

    const csv = await file.text();
    const entries = parseGeneralLedgerEntries(csv);
    if (!entries.length) return NextResponse.json({ ok: false, error: 'Nenhuma linha 4100/3250 reconhecida no GL.' }, { status: 422 });

    const propsRaw = await prisma.property.findMany({
      where: { clientId: scope.clientId },
      select: { id: true, address: true, code: true, mgmtFeePct: true },
    });
    const props: PropertyLite[] = propsRaw.map((p) => ({
      id: p.id,
      address: p.address ?? null,
      code: p.code ?? null,
      mgmtFeePct: Number(p.mgmtFeePct ?? 0),
    }));

    const seq: Record<string, number> = {};
    const rows: Prisma.PropertyGlTxnCreateManyInput[] = [];
    let matched = 0;
    const unmatchedKeys = new Set<string>();
    const months = new Set<string>();

    for (const e of entries) {
      const p = matchProperty(e.propertyShort, e.propertyRaw, props);
      const propertyKey = normalizePropertyKey(e.propertyShort);
      if (p) matched++; else unmatchedKeys.add(e.propertyShort);
      const periodMonth = glCycle15(e.date);
      if (periodMonth) months.add(periodMonth);
      const cents = Math.round(e.amount * 100);
      const base = `${e.account}:${e.date}:${propertyKey}:${cents}`;
      seq[base] = (seq[base] || 0) + 1;
      const [mm, dd, yy] = e.date.split('/');
      rows.push({
        clientId: scope.clientId,
        propertyId: p?.id ?? null,
        propertyKey,
        propertyLabel: e.propertyShort.slice(0, 200),
        periodMonth,
        txnDate: new Date(`${yy}-${mm}-${dd}T00:00:00Z`),
        account: e.account,
        kind: e.kind,
        amount: new Prisma.Decimal(e.amount),
        payerPayee: e.payerPayee.slice(0, 200) || null,
        reference: e.reference.slice(0, 200) || null,
        description: e.description.slice(0, 300) || null,
        tipo: defaultTipo(e.kind, e.description),
        sourceRefId: `${base}:${seq[base]}`,
      });
    }

    // Idempotente: cria novas, ignora existentes (preserva `tipo` já editado).
    const created = await prisma.propertyGlTxn.createMany({ data: rows, skipDuplicates: true });

    await recordAudit({
      request: req, actor: { id: user.id, email: user.email },
      action: 'owner_statement.gl_import', entity: 'property_gl_txn', entityId: scope.clientId,
      clientId: scope.clientId,
      details: `GL: ${entries.length} linhas (${created.count} novas), ${matched} casadas, meses ${[...months].sort().join(',')}`,
    });

    return NextResponse.json({
      ok: true,
      totalLines: entries.length,
      inserted: created.count,
      received: entries.filter((e) => e.kind === 'RECEIVED').length,
      sent: entries.filter((e) => e.kind === 'SENT').length,
      mgmFee: entries.filter((e) => e.kind === 'MGM_FEE').length,
      matched,
      unmatched: unmatchedKeys.size,
      unmatchedSample: [...unmatchedKeys].slice(0, 8),
      months: [...months].sort(),
    });
  } catch (e) {
    console.error('[POST /api/owner-statement/gl-import]', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'Falha ao importar o GL.' }, { status: 500 });
  }
}
