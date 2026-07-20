import { NextResponse } from 'next/server';
import { recordAudit } from '@/lib/auditServer';
import { LeaseStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { categorizeChaseTxn, CHASE_TXN_TYPES } from '@/lib/chaseTxnCategory';

export const dynamic = 'force-dynamic';

const KEYS = ['TRUST_CHASE', 'OPERATING_TRUST', 'DEPOSIT_SECURITY'];
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * GET /api/bank-accounts/statement-flows?clientId=
 * Para cada conta trust, agrega as transações do EXTRATO (BankStatementTxn) do mês mais recente
 * importado: total de entradas, saídas e quebra por TIPO (Zelle/ACH/Wire/Cartão/Transferência/…).
 * Também devolve o total de CAUÇÃO dos contratos (soma Lease.securityDeposit ACTIVE+FUTURE) para
 * o alerta de divergência com a conta Security Deposit. Somente leitura.
 */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  void recordAudit({ request: req, actor: { id: user.id, email: user.email }, action: 'bank_data.access', entity: 'bank_data', entityId: 'statement-flows' });

  try {
    const url = new URL(req.url);
    const scope = await resolveBankAccountClientScope(user, url.searchParams.get('clientId'));
    if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

    const flows: Record<string, unknown> = {};
    for (const key of KEYS) {
      const latest = await prisma.bankStatementTxn.findFirst({
        where: { clientId: scope.clientId, bankAccountKey: key },
        orderBy: { periodMonth: 'desc' },
        select: { periodMonth: true },
      });
      if (!latest) { flows[key] = null; continue; }

      const txns = await prisma.bankStatementTxn.findMany({
        where: { clientId: scope.clientId, bankAccountKey: key, periodMonth: latest.periodMonth },
        select: { amount: true, description: true },
      });

      const byType: Record<string, { in: number; out: number; count: number }> = {};
      for (const t of CHASE_TXN_TYPES) byType[t] = { in: 0, out: 0, count: 0 };
      let entradas = 0, saidas = 0;
      for (const t of txns) {
        const amt = Number(t.amount);
        const cat = categorizeChaseTxn(t.description);
        byType[cat].count += 1;
        if (amt >= 0) { entradas += amt; byType[cat].in += amt; }
        else { saidas += Math.abs(amt); byType[cat].out += Math.abs(amt); }
      }
      flows[key] = {
        periodMonth: latest.periodMonth,
        entradas: round2(entradas),
        saidas: round2(saidas),
        count: txns.length,
        byType: CHASE_TXN_TYPES
          .map((t) => ({ type: t, in: round2(byType[t].in), out: round2(byType[t].out), count: byType[t].count }))
          .filter((x) => x.count > 0)
          .sort((a, b) => b.in + b.out - (a.in + a.out)),
      };
    }

    // Caução dos contratos (o que DEVERIA estar na conta Security Deposit).
    const dep = await prisma.lease.aggregate({
      _sum: { securityDeposit: true },
      where: { clientId: scope.clientId, status: { in: [LeaseStatus.ACTIVE, LeaseStatus.FUTURE] } },
    });
    const securityDepositHeld = dep._sum.securityDeposit != null ? round2(Number(dep._sum.securityDeposit)) : 0;

    return NextResponse.json({ ok: true, flows, securityDepositHeld });
  } catch (e) {
    console.error('[GET /api/bank-accounts/statement-flows]', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'Falha ao carregar os fluxos.' }, { status: 500 });
  }
}
