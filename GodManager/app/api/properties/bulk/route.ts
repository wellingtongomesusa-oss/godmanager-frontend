import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { canAccessClientId, toClientScopeUser } from '@/lib/clientScope';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

const MANAGE_ROLES = ['super_admin', 'admin', 'manager'];
const MAX_IDS = 500;

/**
 * PATCH /api/properties/bulk
 * Edição em massa de management fee / HOA Admin em várias propriedades.
 * body: { ids: string[], mgmtFeePct?: number, hoaAdmin?: boolean, allowDowngrade?: boolean }
 *
 * Só admin/manager/super_admin, e cada casa precisa estar no escopo do usuário.
 * mgmtFeePct=0 numa casa com fee>0 é bloqueado (anti-zeragem acidental), salvo allowDowngrade.
 */
export async function PATCH(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  if (!MANAGE_ROLES.includes(String(user.role || '').toLowerCase())) {
    return NextResponse.json({ ok: false, error: 'Sem permissão para edição em massa.' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    ids?: unknown;
    mgmtFeePct?: unknown;
    hoaAdmin?: unknown;
    allowDowngrade?: unknown;
  };

  const ids = Array.isArray(body.ids) ? body.ids.map((x) => String(x)).filter(Boolean) : [];
  if (!ids.length) return NextResponse.json({ ok: false, error: 'Nenhuma propriedade selecionada.' }, { status: 400 });
  if (ids.length > MAX_IDS) return NextResponse.json({ ok: false, error: `Máximo de ${MAX_IDS} por vez.` }, { status: 400 });

  const setFee = body.mgmtFeePct !== undefined && body.mgmtFeePct !== null && body.mgmtFeePct !== '';
  const setHoa = typeof body.hoaAdmin === 'boolean';
  if (!setFee && !setHoa) {
    return NextResponse.json({ ok: false, error: 'Informe mgmtFeePct e/ou hoaAdmin.' }, { status: 400 });
  }

  let feeVal = 0;
  if (setFee) {
    feeVal = Number(body.mgmtFeePct);
    if (!Number.isFinite(feeVal) || feeVal < 0 || feeVal > 100) {
      return NextResponse.json({ ok: false, error: 'mgmtFeePct deve estar entre 0 e 100.' }, { status: 400 });
    }
  }
  const allowDowngrade = body.allowDowngrade === true;

  const scopeUser = toClientScopeUser(user);
  const rows = await prisma.property.findMany({
    where: { id: { in: ids } },
    select: { id: true, code: true, clientId: true, mgmtFeePct: true },
  });

  let updated = 0;
  const skipped: Array<{ id: string; reason: string }> = [];

  for (const p of rows) {
    if (!canAccessClientId(scopeUser, p.clientId)) {
      skipped.push({ id: p.id, reason: 'fora do escopo' });
      continue;
    }
    const data: { mgmtFeePct?: string; hoaAdmin?: boolean } = {};
    if (setFee) {
      const current = Number(String(p.mgmtFeePct)) || 0;
      if (current > 0 && feeVal === 0 && !allowDowngrade) {
        skipped.push({ id: p.id, reason: 'zeragem bloqueada (use allowDowngrade)' });
        continue;
      }
      data.mgmtFeePct = String(feeVal);
    }
    if (setHoa) data.hoaAdmin = body.hoaAdmin as boolean;

    await prisma.property.update({ where: { id: p.id }, data });
    updated += 1;
  }

  // ids pedidos que não existem
  const foundIds = new Set(rows.map((r) => r.id));
  for (const id of ids) if (!foundIds.has(id)) skipped.push({ id, reason: 'não encontrada' });

  await recordAudit({
    request: req,
    actor: { id: user.id, email: user.email },
    action: 'property.bulk_update',
    entity: 'property',
    entityId: `${updated} casas`,
    clientId: scopeUser.clientId ?? undefined,
    details: `bulk: ${setFee ? `mgmtFeePct=${feeVal} ` : ''}${setHoa ? `hoaAdmin=${body.hoaAdmin} ` : ''}| ok=${updated} skip=${skipped.length}`,
  });

  return NextResponse.json({ ok: true, updated, skipped });
}
