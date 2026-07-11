import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import {
  canManageBankBalances,
  resolveBankAccountClientScope,
} from '@/lib/bankAccountBalancesScope';
import {
  parseGeneralLedgerPayments,
  normalizePropertyKey,
  effectiveMgmtFeePct,
  matchProperty,
  type PropertyLite,
} from '@/lib/generalLedger';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

/**
 * GET /api/owner-statement/rent-receipts?clientId=
 * Aluguéis recebidos por mês (do general ledger) já com mgmt fee descontado.
 * Retorna totais mensais (p/ card + gráfico) e a quebra por casa (p/ detalhe).
 */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  }
  if (!canManageBankBalances(user.role)) {
    return NextResponse.json({ ok: false, error: 'Acesso negado.' }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const scope = await resolveBankAccountClientScope(user, url.searchParams.get('clientId'));
    if (!scope.ok) {
      return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
    }

    const rows = await prisma.propertyRentReceipt.findMany({
      where: { clientId: scope.clientId },
      orderBy: [{ periodMonth: 'asc' }, { propertyLabel: 'asc' }],
    });

    const monthsMap = new Map<
      string,
      { month: string; gross: number; fee: number; net: number; count: number; properties: number }
    >();
    const byProperty = rows.map((r) => {
      const gross = Number(r.grossReceived);
      const fee = Number(r.mgmtFeeAmount);
      const net = Number(r.netOwner);
      const m = monthsMap.get(r.periodMonth) || {
        month: r.periodMonth,
        gross: 0,
        fee: 0,
        net: 0,
        count: 0,
        properties: 0,
      };
      m.gross += gross;
      m.fee += fee;
      m.net += net;
      m.count += r.paymentCount;
      m.properties += 1;
      monthsMap.set(r.periodMonth, m);
      return {
        propertyLabel: r.propertyLabel,
        propertyId: r.propertyId,
        matched: !!r.propertyId,
        periodMonth: r.periodMonth,
        gross,
        pct: Number(r.mgmtFeePct),
        fee,
        net,
        count: r.paymentCount,
      };
    });

    const months = [...monthsMap.values()].sort((a, b) => a.month.localeCompare(b.month));
    const latest = months.length ? months[months.length - 1].month : null;

    return NextResponse.json({
      ok: true,
      latest,
      months: months.map((m) => ({
        month: m.month,
        gross: Math.round(m.gross * 100) / 100,
        fee: Math.round(m.fee * 100) / 100,
        net: Math.round(m.net * 100) / 100,
        count: m.count,
        properties: m.properties,
      })),
      byProperty,
    });
  } catch (e) {
    console.error('[api/owner-statement/rent-receipts GET]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}

/**
 * POST /api/owner-statement/rent-receipts
 * Upload do General Ledger (AppFolio CSV) → agrega aluguel recebido por casa/mês,
 * calcula mgmt fee (regra da propriedade; default 8%) e grava (upsert idempotente).
 * Aceita multipart (campo "file") ou JSON { csv }. super_admin manda clientId.
 */
export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  if (!canManageBankBalances(user.role)) {
    return NextResponse.json({ ok: false, error: 'Acesso negado.' }, { status: 403 });
  }

  try {
    // Lê o CSV (multipart file OU json.csv) + clientId
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
    if (!csv.trim()) {
      return NextResponse.json({ ok: false, error: 'Arquivo/CSV vazio.' }, { status: 400 });
    }

    const scope = await resolveBankAccountClientScope(user, bodyClientId);
    if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
    const clientId = scope.clientId;

    // Parse + agrega por (casa, mês)
    const payments = parseGeneralLedgerPayments(csv);
    if (!payments.length) {
      return NextResponse.json({ ok: false, error: 'Nenhum pagamento de aluguel encontrado no CSV.' }, { status: 400 });
    }
    const agg = new Map<
      string,
      { propShort: string; propRaw: string; month: string; gross: number; count: number }
    >();
    for (const p of payments) {
      const key = normalizePropertyKey(p.propertyShort) + '|' + p.month;
      const cur = agg.get(key) || { propShort: p.propertyShort, propRaw: p.propertyRaw, month: p.month, gross: 0, count: 0 };
      cur.gross += p.credit;
      cur.count += 1;
      agg.set(key, cur);
    }

    const propsDb = await prisma.property.findMany({
      where: { clientId },
      select: { id: true, address: true, code: true, mgmtFeePct: true },
    });
    const propsLite: PropertyLite[] = propsDb.map((p) => ({
      id: p.id,
      address: p.address,
      code: p.code,
      mgmtFeePct: Number(p.mgmtFeePct),
    }));

    let saved = 0;
    let unmatched = 0;
    const monthsSet = new Set<string>();
    for (const a of agg.values()) {
      const p = matchProperty(a.propShort, a.propRaw, propsLite);
      if (!p) unmatched++;
      const pct = effectiveMgmtFeePct(p ? p.mgmtFeePct : NaN);
      const fee = Math.round(a.gross * pct) / 100;
      const net = Math.round((a.gross - fee) * 100) / 100;
      const propertyKey = normalizePropertyKey(a.propShort);
      monthsSet.add(a.month);
      await prisma.propertyRentReceipt.upsert({
        where: { clientId_propertyKey_periodMonth: { clientId, propertyKey, periodMonth: a.month } },
        create: {
          clientId,
          propertyId: p ? p.id : null,
          propertyKey,
          propertyLabel: a.propShort,
          periodMonth: a.month,
          grossReceived: a.gross.toFixed(2),
          mgmtFeePct: pct.toFixed(2),
          mgmtFeeAmount: fee.toFixed(2),
          netOwner: net.toFixed(2),
          paymentCount: a.count,
        },
        update: {
          propertyId: p ? p.id : null,
          propertyLabel: a.propShort,
          grossReceived: a.gross.toFixed(2),
          mgmtFeePct: pct.toFixed(2),
          mgmtFeeAmount: fee.toFixed(2),
          netOwner: net.toFixed(2),
          paymentCount: a.count,
        },
      });
      saved++;
    }

    await recordAudit({
      request: req,
      actor: { id: user.id, email: user.email },
      action: 'rent_receipts.import',
      entity: 'rent_receipts',
      entityId: clientId,
      clientId,
      details: `payments:${payments.length} rows:${saved} unmatched:${unmatched} months:${monthsSet.size}`,
    });

    return NextResponse.json({
      ok: true,
      saved,
      unmatched,
      months: [...monthsSet].sort(),
      payments: payments.length,
    });
  } catch (e) {
    console.error('[api/owner-statement/rent-receipts POST]', e);
    return NextResponse.json({ ok: false, error: 'Erro ao importar.' }, { status: 500 });
  }
}
