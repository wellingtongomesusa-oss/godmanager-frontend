import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import {
  canManageBankBalances,
  resolveBankAccountClientScope,
} from '@/lib/bankAccountBalancesScope';
import { generateDownloadUrl } from '@/lib/r2';

export const dynamic = 'force-dynamic';

/**
 * GET /api/bank-accounts/statements?clientId=
 * Lista os extratos (PDF) do cliente com link de download presigned (privado, 5 min).
 * Restrito a quem gerencia contas (admin/manager/super_admin).
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

    const rows = await prisma.bankStatement.findMany({
      where: { clientId: scope.clientId },
      orderBy: { periodMonth: 'desc' },
    });

    let downloadOk = true;
    const statements = await Promise.all(
      rows.map(async (r) => {
        let downloadUrl: string | null = null;
        try {
          downloadUrl = await generateDownloadUrl(r.fileKey, r.fileName, 300);
        } catch {
          downloadOk = false;
        }
        return {
          id: r.id,
          periodMonth: r.periodMonth,
          statementDate: r.statementDate.toISOString().slice(0, 10),
          bankName: r.bankName,
          fileName: r.fileName,
          fileSize: r.fileSize,
          downloadUrl,
        };
      }),
    );

    return NextResponse.json({ ok: true, statements, downloadOk });
  } catch (e) {
    console.error('[api/bank-accounts/statements GET]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}
