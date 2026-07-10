import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { encrypt, decrypt } from '@/lib/encryption';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

function canRevealPassword(role: string): boolean {
  return ['super_admin', 'admin', 'manager'].includes(String(role || '').toLowerCase());
}

async function resolveAccountAccess(propertyId: string, id: string) {
  const user = await getCurrentUserFromSession();
  if (!user) return { ok: false as const, status: 401, error: 'Não autenticado.' };
  const row = await prisma.utilityAccount.findUnique({ where: { id } });
  if (!row || row.propertyId !== propertyId) {
    return { ok: false as const, status: 404, error: 'Conta não encontrada.' };
  }
  const role = String(user.role || '').toLowerCase();
  if (role !== 'super_admin' && (!user.clientId || row.clientId !== user.clientId)) {
    return { ok: false as const, status: 403, error: 'Acesso negado.' };
  }
  return { ok: true as const, user, row };
}

/** GET ?reveal=1 — revela a senha em texto (só admin/manager/super_admin). */
export async function GET(
  req: NextRequest,
  { params }: { params: { propertyId: string; id: string } },
) {
  const acc = await resolveAccountAccess(params.propertyId, params.id);
  if (!acc.ok) return NextResponse.json({ ok: false, error: acc.error }, { status: acc.status });

  const reveal = new URL(req.url).searchParams.get('reveal');
  if (reveal !== '1') {
    return NextResponse.json({ ok: false, error: 'reveal=1 requerido' }, { status: 400 });
  }
  if (!canRevealPassword(acc.user.role)) {
    return NextResponse.json({ ok: false, error: 'Sem permissão para ver a senha.' }, { status: 403 });
  }
  let password = '';
  try {
    password = acc.row.passwordEnc ? decrypt(acc.row.passwordEnc) : '';
  } catch {
    return NextResponse.json({ ok: false, error: 'Falha ao decifrar.' }, { status: 500 });
  }
  await recordAudit({
    request: req,
    actor: { id: acc.user.id, email: acc.user.email },
    action: 'utility_account.reveal_password',
    entity: 'utility_account',
    entityId: acc.row.id,
    clientId: acc.row.clientId,
    details: `${acc.row.serviceType} · ${acc.row.company}`,
  });
  return NextResponse.json({ ok: true, password });
}

/** PATCH — edita a conta (se vier password, re-criptografa; se vier ''=limpa). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { propertyId: string; id: string } },
) {
  const acc = await resolveAccountAccess(params.propertyId, params.id);
  if (!acc.ok) return NextResponse.json({ ok: false, error: acc.error }, { status: acc.status });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  if (body.company != null) {
    const v = String(body.company).trim();
    if (!v) return NextResponse.json({ ok: false, error: 'Empresa obrigatória.' }, { status: 400 });
    data.company = v;
  }
  if (body.serviceType != null) data.serviceType = String(body.serviceType).trim();
  if (body.accountNumber !== undefined)
    data.accountNumber = body.accountNumber ? String(body.accountNumber).trim() : null;
  if (body.login !== undefined) data.login = body.login ? String(body.login).trim() : null;
  if (body.notes !== undefined) data.notes = body.notes ? String(body.notes).trim() : null;
  if (body.password !== undefined) {
    const p = String(body.password ?? '');
    data.passwordEnc = p ? encrypt(p) : null;
  }

  await prisma.utilityAccount.update({ where: { id: acc.row.id }, data });
  await recordAudit({
    request: req,
    actor: { id: acc.user.id, email: acc.user.email },
    action: 'utility_account.update',
    entity: 'utility_account',
    entityId: acc.row.id,
    clientId: acc.row.clientId,
    details: `property ${params.propertyId}`,
  });
  return NextResponse.json({ ok: true });
}

/** DELETE — exclui a conta. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { propertyId: string; id: string } },
) {
  const acc = await resolveAccountAccess(params.propertyId, params.id);
  if (!acc.ok) return NextResponse.json({ ok: false, error: acc.error }, { status: acc.status });

  await prisma.utilityAccount.delete({ where: { id: acc.row.id } });
  await recordAudit({
    request: req,
    actor: { id: acc.user.id, email: acc.user.email },
    action: 'utility_account.delete',
    entity: 'utility_account',
    entityId: acc.row.id,
    clientId: acc.row.clientId,
    details: `${acc.row.serviceType} · ${acc.row.company}`,
  });
  return NextResponse.json({ ok: true });
}
