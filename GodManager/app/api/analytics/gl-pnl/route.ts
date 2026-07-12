import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import {
  canManageBankBalances,
  resolveBankAccountClientScope,
} from '@/lib/bankAccountBalancesScope';
import { recordAudit } from '@/lib/auditServer';
import {
  parseFullGeneralLedger,
  aggregatePropertyMonthPnl,
  normPropKey,
} from '@/lib/generalLedgerFull';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

/** GET /api/analytics/gl-pnl?clientId= → P&L por casa/mês (totais mensais + por casa). */
export async function GET(req: NextRequest) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  if (!canManageBankBalances(user.role)) {
    return NextResponse.json({ ok: false, error: 'Acesso negado.' }, { status: 403 });
  }
  const scope = await resolveBankAccountClientScope(user, new URL(req.url).searchParams.get('clientId'));
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

  const rows = await prisma.propertyMonthPnl.findMany({
    where: { clientId: scope.clientId },
    orderBy: [{ periodMonth: 'asc' }, { propertyLabel: 'asc' }],
  });
  const monthsMap = new Map<string, { month: string; income: number; expenses: number; mgmtFee: number; net: number; properties: number }>();
  const byProperty = rows.map((r) => {
    const income = Number(r.income), expenses = Number(r.expenses), mgmtFee = Number(r.mgmtFee), net = Number(r.netOwner);
    const m = monthsMap.get(r.periodMonth) || { month: r.periodMonth, income: 0, expenses: 0, mgmtFee: 0, net: 0, properties: 0 };
    m.income += income; m.expenses += expenses; m.mgmtFee += mgmtFee; m.net += net; m.properties += 1;
    monthsMap.set(r.periodMonth, m);
    return { propertyId: r.propertyId, propertyLabel: r.propertyLabel, periodMonth: r.periodMonth, income, expenses, mgmtFee, net, byCategory: r.byCategory };
  });
  const round = (n: number) => Math.round(n * 100) / 100;
  const months = [...monthsMap.values()].sort((a, b) => a.month.localeCompare(b.month)).map((m) => ({
    month: m.month, income: round(m.income), expenses: round(m.expenses), mgmtFee: round(m.mgmtFee), net: round(m.net), properties: m.properties,
  }));
  return NextResponse.json({ ok: true, months, byProperty, latest: months.length ? months[months.length - 1].month : null });
}

/** POST /api/analytics/gl-pnl  (multipart file | json {csv}) → parseia GL completo e grava P&L. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  if (!canManageBankBalances(user.role)) {
    return NextResponse.json({ ok: false, error: 'Acesso negado.' }, { status: 403 });
  }
  try {
    let csv = '';
    let bodyClientId: string | null = null;
    const ct = req.headers.get('content-type') || '';
    if (ct.includes('multipart/form-data')) {
      const form = await req.formData();
      const f = form.get('file');
      if (f instanceof File) csv = await f.text();
      const cid = form.get('clientId');
      if (typeof cid === 'string') bodyClientId = cid;
    } else {
      const j = (await req.json().catch(() => ({}))) as { csv?: string; clientId?: string };
      csv = String(j?.csv || '');
      bodyClientId = j?.clientId ?? null;
    }
    if (!csv.trim()) return NextResponse.json({ ok: false, error: 'Arquivo/CSV vazio.' }, { status: 400 });

    const scope = await resolveBankAccountClientScope(user, bodyClientId);
    if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
    const clientId = scope.clientId;

    const glRows = parseFullGeneralLedger(csv);
    const pnl = aggregatePropertyMonthPnl(glRows);
    if (!pnl.length) return NextResponse.json({ ok: false, error: 'Nenhum lançamento de receita/despesa encontrado.' }, { status: 400 });

    const props = await prisma.property.findMany({ where: { clientId }, select: { id: true, address: true, code: true } });
    const matchProp = (short: string): string | null => {
      const k = normPropKey(short);
      for (const p of props) {
        const cands = [normPropKey(p.address || ''), normPropKey(p.code || '')].filter(Boolean);
        if (cands.some((c) => c === k || c.startsWith(k) || k.startsWith(c))) return p.id;
      }
      return null;
    };

    let saved = 0, unmatched = 0;
    const monthsSet = new Set<string>();
    for (const p of pnl) {
      const pid = matchProp(p.propertyShort);
      if (!pid) unmatched++;
      monthsSet.add(p.month);
      const key = normPropKey(p.propertyShort);
      await prisma.propertyMonthPnl.upsert({
        where: { clientId_propertyKey_periodMonth: { clientId, propertyKey: key, periodMonth: p.month } },
        create: {
          clientId, propertyId: pid, propertyKey: key, propertyLabel: p.propertyShort, periodMonth: p.month,
          income: p.income.toFixed(2), expenses: p.expenses.toFixed(2), mgmtFee: p.mgmtFee.toFixed(2), netOwner: p.net.toFixed(2),
          byCategory: p.byCategory as Prisma.InputJsonValue,
        },
        update: {
          propertyId: pid, propertyLabel: p.propertyShort,
          income: p.income.toFixed(2), expenses: p.expenses.toFixed(2), mgmtFee: p.mgmtFee.toFixed(2), netOwner: p.net.toFixed(2),
          byCategory: p.byCategory as Prisma.InputJsonValue,
        },
      });
      saved++;
    }

    await recordAudit({
      request: req, actor: { id: user.id, email: user.email },
      action: 'gl_pnl.import', entity: 'gl_pnl', entityId: clientId, clientId,
      details: `rows:${glRows.length} pnl:${saved} unmatched:${unmatched} months:${monthsSet.size}`,
    });
    return NextResponse.json({ ok: true, saved, unmatched, months: [...monthsSet].sort(), glRows: glRows.length });
  } catch (e) {
    console.error('[api/analytics/gl-pnl POST]', e);
    return NextResponse.json({ ok: false, error: 'Erro ao importar P&L.' }, { status: 500 });
  }
}
