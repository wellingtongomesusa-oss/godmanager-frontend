import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { getPlaidClient } from '@/lib/plaid';
import { decryptField } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * GET /api/plaid/transactions?clientId=&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Lê as transações da conta bancária vinculada (BankLink CLIENT) via Plaid.
 * Read-only — não move dinheiro. Alimenta a conciliação (#7).
 */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });

  const url = new URL(req.url);
  const scope = await resolveBankAccountClientScope(user, url.searchParams.get('clientId'));
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

  const link = await prisma.bankLink.findFirst({
    where: { clientId: scope.clientId, linkType: 'CLIENT', status: 'active' },
    select: { accessTokenEnc: true, accountId: true, institutionName: true, accountMask: true, metadata: true },
  });
  if (!link) {
    return NextResponse.json({ ok: true, linked: false, transactions: [] });
  }

  const accessToken = decryptField(link.accessTokenEnc);
  if (!accessToken) {
    return NextResponse.json({ ok: false, error: 'Token bancário inválido; reconecte o banco.' }, { status: 400 });
  }

  // Conta a usar: a mapeada para o bankAccountKey (multi-conta) ou a conta padrão do link.
  const bankAccountKey = (url.searchParams.get('bankAccountKey') || '').trim().toUpperCase();
  const meta = (link.metadata as Record<string, unknown> | null) || {};
  const mapping = (meta.mapping as Record<string, string> | undefined) || {};
  const mappedAccountId = bankAccountKey && mapping[bankAccountKey] ? mapping[bankAccountKey] : link.accountId;

  const now = new Date();
  const to = (url.searchParams.get('to') || '').match(/^\d{4}-\d{2}-\d{2}$/) ? url.searchParams.get('to')! : ymd(now);
  const from = (url.searchParams.get('from') || '').match(/^\d{4}-\d{2}-\d{2}$/)
    ? url.searchParams.get('from')!
    : ymd(new Date(now.getTime() - 31 * 86400000));

  try {
    const plaid = getPlaidClient();
    const res = await plaid.transactionsGet({
      access_token: accessToken,
      start_date: from,
      end_date: to,
      options: { count: 500, offset: 0, ...(mappedAccountId ? { account_ids: [mappedAccountId] } : {}) },
    });
    const txs = (res.data.transactions || []).map((t) => ({
      id: t.transaction_id,
      date: t.date,
      name: t.merchant_name || t.name || '—',
      // Plaid: amount positivo = saída (débito). Conciliação: positivo=crédito → invertemos.
      amount: -Number(t.amount || 0),
      pending: !!t.pending,
      category: Array.isArray(t.category) ? t.category.join(' / ') : null,
    }));
    return NextResponse.json({
      ok: true,
      linked: true,
      institutionName: link.institutionName,
      accountMask: link.accountMask,
      from,
      to,
      count: txs.length,
      transactions: txs,
    });
  } catch (e) {
    console.error('[GET /api/plaid/transactions]', e instanceof Error ? e.message : 'error');
    return NextResponse.json({ ok: false, error: 'Falha ao ler transações do banco.' }, { status: 502 });
  }
}
