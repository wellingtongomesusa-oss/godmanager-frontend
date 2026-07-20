import { NextResponse } from 'next/server';
import { csrfGuard } from '@/lib/csrfGuard';
import { rateLimitGuard } from '@/lib/apiRateLimit';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import {
  canManageBankBalances,
  resolveBankAccountClientScope,
} from '@/lib/bankAccountBalancesScope';
import { generateDownloadUrl, getR2Client, getR2Bucket } from '@/lib/r2';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { recordAudit } from '@/lib/auditServer';

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
  void recordAudit({ request: req, actor: { id: user.id, email: user.email }, action: 'bank_data.access', entity: 'bank_data', entityId: 'bank-statements' });

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

/**
 * POST /api/bank-accounts/statements   (multipart/form-data)
 *   file: PDF, periodMonth: 'YYYY-MM', clientId?
 * Sobe o extrato para o R2 e cria/atualiza a linha do mês.
 */
export async function POST(req: Request) {
  const bad = csrfGuard(req);
  if (bad) return bad;
  const rl = rateLimitGuard(req);
  if (rl) return rl;
  const user = await getCurrentUserFromSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  }
  if (!canManageBankBalances(user.role)) {
    return NextResponse.json({ ok: false, error: 'Acesso negado.' }, { status: 403 });
  }

  try {
    const form = await req.formData();
    const file = form.get('file');
    const periodMonth = String(form.get('periodMonth') || '').trim();
    const clientIdRaw = form.get('clientId');

    const scope = await resolveBankAccountClientScope(
      user,
      clientIdRaw != null ? String(clientIdRaw) : null,
    );
    if (!scope.ok) {
      return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
    }
    if (!/^\d{4}-\d{2}$/.test(periodMonth)) {
      return NextResponse.json({ ok: false, error: 'periodMonth inválido (use YYYY-MM).' }, { status: 400 });
    }
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ ok: false, error: 'Arquivo (PDF) obrigatório.' }, { status: 400 });
    }
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: 'Arquivo muito grande (máx 25MB).' }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const fileKey = `bank-statements/${scope.clientId}/${periodMonth}.pdf`;
    await getR2Client().send(
      new PutObjectCommand({
        Bucket: getR2Bucket(),
        Key: fileKey,
        Body: bytes,
        ContentType: 'application/pdf',
      }),
    );

    const statementDate = new Date(`${periodMonth}-01T00:00:00.000Z`);
    const fileName = `Statement-${periodMonth}.pdf`;
    const existing = await prisma.bankStatement.findFirst({
      where: { clientId: scope.clientId, periodMonth },
      select: { id: true },
    });
    if (existing) {
      await prisma.bankStatement.update({
        where: { id: existing.id },
        data: { fileKey, fileName, fileSize: bytes.length, statementDate, uploadedBy: user.id },
      });
    } else {
      await prisma.bankStatement.create({
        data: {
          clientId: scope.clientId,
          periodMonth,
          statementDate,
          bankName: 'Chase',
          fileKey,
          fileName,
          fileSize: bytes.length,
          uploadedBy: user.id,
        },
      });
    }

    await recordAudit({
      request: req,
      actor: { id: user.id, email: user.email },
      action: 'bank_statement.upload',
      entity: 'bank_statement',
      entityId: scope.clientId,
      details: `periodMonth: ${periodMonth} | ${bytes.length} bytes`,
      clientId: scope.clientId,
    });

    return NextResponse.json({ ok: true, periodMonth });
  } catch (e) {
    console.error('[api/bank-accounts/statements POST]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno ao subir extrato.' }, { status: 500 });
  }
}
