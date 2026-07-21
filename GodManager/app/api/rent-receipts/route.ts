import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { normalizePropertyKey } from '@/lib/generalLedger';

export const dynamic = 'force-dynamic';

const round2 = (n: number) => Math.round(n * 100) / 100;
const DUE_DAY = 5;

/**
 * GET /api/rent-receipts?month=YYYY-MM&filter=all|received|overdue|paid|awaiting&q=
 * Status de recebimento por casa/mês: junta GL 4100 (recebido), confirmação manual e
 * OwnerMonthPayout (pago ao owner). Regra: pago>recebido>vencido(após dia 05)>aguardando.
 */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  try {
    const url = new URL(req.url);
    const scope = await resolveBankAccountClientScope(user, url.searchParams.get('clientId'));
    if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
    const clientId = scope.clientId;

    const now = new Date();
    const month = /^\d{4}-\d{2}$/.test(url.searchParams.get('month') || '')
      ? (url.searchParams.get('month') as string)
      : `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const filter = (url.searchParams.get('filter') || 'all').toLowerCase();
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();

    const [y, m] = month.split('-').map(Number);
    const monthStart = new Date(Date.UTC(y, m - 1, 1));
    const monthEnd = new Date(Date.UTC(y, m, 1));
    const dueCutoff = new Date(Date.UTC(y, m - 1, DUE_DAY, 23, 59, 59));
    const pastDue = now.getTime() > dueCutoff.getTime();

    const [props, gl, confs, payouts] = await Promise.all([
      prisma.property.findMany({ where: { clientId }, select: { id: true, code: true, address: true, ownerName: true } }),
      prisma.propertyGlTxn.findMany({
        where: { clientId, kind: 'RECEIVED', txnDate: { gte: monthStart, lt: monthEnd } },
        select: { propertyId: true, propertyLabel: true, amount: true },
      }),
      prisma.rentReceiptConfirmation.findMany({ where: { clientId, periodMonth: month } }),
      prisma.ownerMonthPayout.findMany({
        where: { yearMonth: month, property: { clientId } },
        select: { propertyId: true, paidAmount: true, closedAt: true },
      }),
    ]);

    const glByProp = new Map<string, number>();
    const glByKey = new Map<string, number>();
    for (const t of gl) {
      const a = Number(t.amount);
      if (t.propertyId) glByProp.set(t.propertyId, (glByProp.get(t.propertyId) || 0) + a);
      const k = normalizePropertyKey(t.propertyLabel);
      glByKey.set(k, (glByKey.get(k) || 0) + a);
    }
    const confByProp = new Map<string, (typeof confs)[number]>();
    const confByKey = new Map<string, (typeof confs)[number]>();
    for (const c of confs) {
      if (c.propertyId) confByProp.set(c.propertyId, c);
      confByKey.set(c.propertyKey, c);
    }
    const paidByProp = new Map<string, { paid: number; closed: boolean }>();
    for (const p of payouts) {
      const prev = paidByProp.get(p.propertyId) || { paid: 0, closed: false };
      paidByProp.set(p.propertyId, { paid: prev.paid + Number(p.paidAmount || 0), closed: prev.closed || !!p.closedAt });
    }

    const rows = props.map((p) => {
      const key = normalizePropertyKey(p.address || '');
      const glRecv = round2((p.id ? glByProp.get(p.id) : 0) || glByKey.get(key) || 0);
      const conf = confByProp.get(p.id) || confByKey.get(key) || null;
      const pay = paidByProp.get(p.id) || { paid: 0, closed: false };
      const received = !!conf?.receivedConfirmed || glRecv > 0;
      const paid = pay.paid > 0 || pay.closed;
      let status: 'paid' | 'received' | 'overdue' | 'awaiting';
      if (paid) status = 'paid';
      else if (received) status = 'received';
      else if (pastDue) status = 'overdue';
      else status = 'awaiting';
      return {
        propertyId: p.id,
        propertyKey: key,
        code: p.code || '',
        name: p.address || '',
        owner: p.ownerName || '',
        glReceived: glRecv,
        confirmed: !!conf?.receivedConfirmed,
        confirmedAt: conf?.receivedAt ? conf.receivedAt.toISOString() : null,
        amount: conf?.amount != null ? round2(Number(conf.amount)) : glRecv || null,
        receiptFileName: conf?.receiptFileName || null,
        hasReceipt: !!conf?.receiptFileKey,
        paidAmount: round2(pay.paid),
        status,
      };
    });

    const filtered = rows
      .filter((r) => (filter === 'all' ? true : r.status === filter))
      .filter((r) => (!q ? true : [r.code, r.name, r.owner].join(' ').toLowerCase().includes(q)))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const counts = { all: rows.length, received: 0, overdue: 0, paid: 0, awaiting: 0 };
    for (const r of rows) counts[r.status] += 1;

    return NextResponse.json({ ok: true, month, dueDay: DUE_DAY, pastDue, counts, rows: filtered });
  } catch (e) {
    console.error('[GET /api/rent-receipts]', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'Falha ao carregar recebimentos.' }, { status: 500 });
  }
}
