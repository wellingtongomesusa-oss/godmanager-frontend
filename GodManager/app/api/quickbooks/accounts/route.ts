import { NextResponse } from 'next/server';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { qbListAccounts, qbListVendors, qbListCustomers, qbListItems } from '@/lib/quickbooksPost';

export const dynamic = 'force-dynamic';

/**
 * GET /api/quickbooks/accounts?clientId=
 * Chart of accounts + vendors + customers + items do QuickBooks (para mapear lançamentos).
 */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });

  const clientId = new URL(req.url).searchParams.get('clientId');
  const scope = await resolveBankAccountClientScope(user, clientId);
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

  try {
    const [accounts, vendors, customers, items] = await Promise.all([
      qbListAccounts(scope.clientId),
      qbListVendors(scope.clientId),
      qbListCustomers(scope.clientId),
      qbListItems(scope.clientId),
    ]);
    const expense = accounts.filter((a) => a.classification === 'Expense');
    const payment = accounts.filter(
      (a) => a.accountType === 'Bank' || a.accountType === 'Credit Card',
    );
    const income = accounts.filter((a) => a.classification === 'Revenue');
    return NextResponse.json({
      ok: true,
      accounts: { expense, payment, income, all: accounts },
      vendors,
      customers,
      items,
    });
  } catch (e) {
    console.error('[quickbooks/accounts]', e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Falha ao ler QuickBooks.' }, { status: 502 });
  }
}
