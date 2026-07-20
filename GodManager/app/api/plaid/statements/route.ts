import { NextResponse } from 'next/server';
import { recordAudit } from '@/lib/auditServer';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { getPlaidClient } from '@/lib/plaid';
import { decryptField } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

async function loadToken(clientId: string): Promise<string | null> {
  const link = await prisma.bankLink.findFirst({
    where: { clientId, linkType: 'CLIENT', status: 'active' },
    select: { accessTokenEnc: true },
  });
  if (!link) return null;
  return decryptField(link.accessTokenEnc);
}

/**
 * GET /api/plaid/statements?clientId=            → lista extratos disponíveis (Plaid Statements add-on).
 * GET /api/plaid/statements?clientId=&download=  → baixa o PDF de um statement (statement_id).
 * Requer o produto Statements habilitado na conta Plaid e o banco reconectado.
 */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  void recordAudit({ request: req, actor: { id: user.id, email: user.email }, action: 'bank_data.access', entity: 'bank_data', entityId: 'plaid-statements' });
  const url = new URL(req.url);
  const scope = await resolveBankAccountClientScope(user, url.searchParams.get('clientId'));
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

  const token = await loadToken(scope.clientId);
  if (!token) return NextResponse.json({ ok: true, linked: false, statements: [] });

  const plaid = getPlaidClient();
  const downloadId = (url.searchParams.get('download') || '').trim();

  try {
    if (downloadId) {
      const res = await plaid.statementsDownload({ access_token: token, statement_id: downloadId }, { responseType: 'arraybuffer' });
      const buf = Buffer.from(res.data as ArrayBuffer);
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="statement-${downloadId.slice(0, 12)}.pdf"`,
        },
      });
    }

    const res = await plaid.statementsList({ access_token: token });
    const accounts = (res.data.accounts || []).map((a) => ({
      accountId: a.account_id,
      accountName: a.account_name || null,
      statements: (a.statements || []).map((s) => ({ statementId: s.statement_id, month: s.month, year: s.year })),
    }));
    return NextResponse.json({ ok: true, linked: true, institutionName: res.data.institution_name ?? null, accounts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    console.error('[plaid/statements]', msg);
    // Erro típico: produto Statements não habilitado / item sem consentimento
    return NextResponse.json(
      { ok: false, error: 'Plaid Statements indisponível. Habilite o produto Statements na conta Plaid e reconecte o banco.', detail: msg.slice(0, 200) },
      { status: 502 },
    );
  }
}
