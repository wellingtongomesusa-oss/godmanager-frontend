import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

const FINANCE_MENUS = ['home', 'integrations', 'results', 'billing']; // Statement/saldos, Ramp/QuickBooks/AppFolio, Bookkeeping, Invoice/Cobrança/Caixa de Entrada
const APPROVER_ROLES = ['super_admin', 'admin'];

function canApprove(role: string): boolean {
  return APPROVER_ROLES.includes(String(role || '').toLowerCase());
}

/**
 * GET /api/access-request
 *   admin/super_admin → { pending: [...] } (para o popup de aprovação)
 *   usuário comum      → { myRequest: {...}|null } (status do próprio pedido)
 */
export async function GET() {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });

  if (canApprove(user.role)) {
    const where = user.role === 'super_admin' && !user.clientId ? { status: 'PENDING' } : { status: 'PENDING', clientId: user.clientId ?? undefined };
    const pending = await prisma.accessRequest.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: { id: true, userEmail: true, userName: true, resource: true, message: true, createdAt: true },
    });
    return NextResponse.json({ ok: true, isApprover: true, pending: pending.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })) });
  }

  const mine = await prisma.accessRequest.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, resource: true, status: true, createdAt: true },
  });
  return NextResponse.json({ ok: true, isApprover: false, myRequest: mine ? { ...mine, createdAt: mine.createdAt.toISOString() } : null });
}

/** POST /api/access-request { resource?, message? } — usuário pede liberação. */
export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  if (!user.clientId) return NextResponse.json({ ok: false, error: 'Usuário sem empresa definida.' }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { resource?: string; message?: string };
  const resource = String(body?.resource || 'FINANCE').trim().toUpperCase().slice(0, 40);
  const message = body?.message ? String(body.message).slice(0, 300) : null;

  // evita pedido duplicado pendente
  const existing = await prisma.accessRequest.findFirst({ where: { userId: user.id, resource, status: 'PENDING' } });
  if (existing) return NextResponse.json({ ok: true, alreadyPending: true, requestId: existing.id });

  const created = await prisma.accessRequest.create({
    data: {
      clientId: user.clientId,
      userId: user.id,
      userEmail: user.email ?? '',
      userName: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || null,
      resource,
      message,
    },
    select: { id: true },
  });
  await recordAudit({
    request: req, actor: { id: user.id, email: user.email },
    action: 'access_request.create', entity: 'access_request', entityId: created.id, clientId: user.clientId,
    details: resource,
  });
  return NextResponse.json({ ok: true, requestId: created.id });
}

/**
 * PATCH /api/access-request { requestId, decision:'APPROVED'|'DENIED' }
 * Só admin/super_admin. APPROVED → concede acesso financeiro (role manager + menus).
 */
export async function PATCH(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  if (!canApprove(user.role)) return NextResponse.json({ ok: false, error: 'Acesso negado.' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { requestId?: string; decision?: string };
  const requestId = String(body?.requestId || '').trim();
  const decision = String(body?.decision || '').trim().toUpperCase();
  if (!requestId || (decision !== 'APPROVED' && decision !== 'DENIED')) {
    return NextResponse.json({ ok: false, error: 'requestId e decision (APPROVED|DENIED) obrigatórios.' }, { status: 400 });
  }

  const reqRow = await prisma.accessRequest.findUnique({ where: { id: requestId } });
  if (!reqRow || reqRow.status !== 'PENDING') return NextResponse.json({ ok: false, error: 'Pedido não encontrado ou já decidido.' }, { status: 404 });
  // admin (não super) só decide da própria empresa
  if (user.role !== 'super_admin' && reqRow.clientId !== user.clientId) {
    return NextResponse.json({ ok: false, error: 'Sem acesso a este pedido.' }, { status: 403 });
  }

  if (decision === 'APPROVED') {
    const target = await prisma.user.findUnique({ where: { id: reqRow.userId }, select: { role: true, menuAccess: true } });
    if (target) {
      const keepRole = ['super_admin', 'admin', 'manager'].includes(String(target.role));
      const newMenu = Array.from(new Set([...(target.menuAccess || []), ...FINANCE_MENUS]));
      await prisma.user.update({
        where: { id: reqRow.userId },
        data: { menuAccess: newMenu, ...(keepRole ? {} : { role: 'manager' }) },
      });
    }
  }

  await prisma.accessRequest.update({
    where: { id: requestId },
    data: { status: decision, decidedById: user.id, decidedByEmail: user.email ?? null, decidedAt: new Date() },
  });
  await recordAudit({
    request: req, actor: { id: user.id, email: user.email },
    action: decision === 'APPROVED' ? 'access_request.approve' : 'access_request.deny',
    entity: 'access_request', entityId: requestId, clientId: reqRow.clientId,
    details: `${reqRow.userEmail} ${reqRow.resource}`,
  });
  return NextResponse.json({ ok: true, decision });
}
