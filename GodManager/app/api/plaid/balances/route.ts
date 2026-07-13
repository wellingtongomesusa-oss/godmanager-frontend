import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { canManageBankBalances, resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { getPlaidClient } from '@/lib/plaid';
import { decryptField } from '@/lib/encryption';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

const KEYS = ['TRUST_CHASE', 'OPERATING_TRUST', 'DEPOSIT_SECURITY'] as const;

/**
 * GET /api/plaid/balances?clientId=&register=1
 * Puxa o saldo atual (Plaid) de cada conta mapeada. Se register=1, grava cada saldo em
 * BankAccountBalance (aparece na Home/Statement). Retorna os saldos por chave.
 */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  if (!canManageBankBalances(user.role)) return NextResponse.json({ ok: false, error: 'Acesso negado.' }, { status: 403 });

  const url = new URL(req.url);
  const scope = await resolveBankAccountClientScope(user, url.searchParams.get('clientId'));
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
  const register = url.searchParams.get('register') === '1';

  const link = await prisma.bankLink.findFirst({
    where: { clientId: scope.clientId, linkType: 'CLIENT', status: 'active' },
    select: { accessTokenEnc: true, metadata: true },
  });
  if (!link) return NextResponse.json({ ok: true, linked: false, balances: {} });

  const token = decryptField(link.accessTokenEnc);
  if (!token) return NextResponse.json({ ok: false, error: 'Token inválido; reconecte.' }, { status: 400 });

  const meta = (link.metadata as Record<string, unknown> | null) || {};
  const mapping = (meta.mapping as Record<string, string> | undefined) || {};

  try {
    const plaid = getPlaidClient();
    const res = await plaid.accountsGet({ access_token: token });
    const byId = new Map(res.data.accounts.map((a) => [a.account_id, a]));

    const today = new Date();
    const balanceDate = new Date(today.toISOString().slice(0, 10) + 'T12:00:00.000Z');
    const balances: Record<string, { balance: number; accountName: string; mask: string | null } | null> = {};
    let registered = 0;

    for (const key of KEYS) {
      const acctId = mapping[key];
      const acct = acctId ? byId.get(acctId) : undefined;
      if (!acct) { balances[key] = null; continue; }
      const bal = acct.balances?.current ?? acct.balances?.available ?? 0;
      balances[key] = { balance: Number(bal), accountName: acct.name || acct.official_name || '—', mask: acct.mask || null };
      if (register && Number.isFinite(Number(bal)) && Number(bal) >= 0) {
        await prisma.bankAccountBalance.create({
          data: {
            clientId: scope.clientId,
            accountType: key,
            balance: new Prisma.Decimal(Number(bal).toFixed(2)),
            balanceDate,
            recordedBy: user.id,
          },
        });
        registered++;
      }
    }

    if (register && registered > 0) {
      await recordAudit({
        request: req, actor: { id: user.id, email: user.email },
        action: 'plaid.balances.register', entity: 'bank_account', entityId: scope.clientId, clientId: scope.clientId,
        details: `registered:${registered}`,
      });
    }
    return NextResponse.json({ ok: true, linked: true, balances, registered });
  } catch (e) {
    console.error('[plaid/balances GET]', e instanceof Error ? e.message : 'error');
    return NextResponse.json({ ok: false, error: 'Falha ao ler saldos do banco.' }, { status: 502 });
  }
}
