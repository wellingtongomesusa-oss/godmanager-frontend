import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

// Menus da área financeira: Statement/saldos (home), Ramp/QuickBooks/AppFolio (integrations),
// Bookkeeping (results) e Invoice/Cobrança/Caixa de Entrada (billing).
const FINANCE_MENUS = ['home', 'integrations', 'results', 'billing'];
const APPROVER_ROLES = ['super_admin', 'admin'];

function canManage(role: string): boolean {
  return APPROVER_ROLES.includes(String(role || '').toLowerCase());
}
function hasFinance(menu: string[] | null | undefined): boolean {
  const set = new Set(menu || []);
  return FINANCE_MENUS.every((m) => set.has(m));
}

/**
 * GET /api/finance-access?clientId=
 * Lista usuários do cliente com o status de acesso financeiro (para liberar/revogar).
 */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  if (!canManage(user.role)) return NextResponse.json({ ok: false, error: 'Acesso negado.' }, { status: 403 });

  const url = new URL(req.url);
  const qClient = (url.searchParams.get('clientId') || '').trim();
  const clientId = user.role === 'super_admin' ? qClient || user.clientId || undefined : user.clientId || undefined;

  const users = await prisma.user.findMany({
    where: {
      role: { notIn: ['super_admin'] },
      ...(clientId ? { clientId } : {}),
    },
    orderBy: [{ firstName: 'asc' }],
    select: { id: true, email: true, firstName: true, lastName: true, role: true, menuAccess: true, clientId: true },
    take: 500,
  });

  return NextResponse.json({
    ok: true,
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email,
      role: u.role,
      hasFinance: hasFinance(u.menuAccess),
    })),
  });
}

/**
 * POST /api/finance-access  { userId?|email?, action:'grant'|'revoke' }
 * Libera (definitivo) ou revoga o acesso financeiro de um usuário. Só admin/super_admin.
 */
export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  if (!canManage(user.role)) return NextResponse.json({ ok: false, error: 'Acesso negado.' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { userId?: string; email?: string; action?: string };
  const action = String(body?.action || '').toLowerCase();
  if (action !== 'grant' && action !== 'revoke') {
    return NextResponse.json({ ok: false, error: "action deve ser 'grant' ou 'revoke'." }, { status: 400 });
  }

  const target = await prisma.user.findFirst({
    where: body.userId
      ? { id: String(body.userId) }
      : body.email
        ? { email: { equals: String(body.email).trim(), mode: 'insensitive' } }
        : { id: '__none__' },
    select: { id: true, email: true, role: true, menuAccess: true, clientId: true },
  });
  if (!target) return NextResponse.json({ ok: false, error: 'Usuário não encontrado.' }, { status: 404 });

  // admin (não super) só gerencia a própria empresa
  if (user.role !== 'super_admin' && target.clientId !== user.clientId) {
    return NextResponse.json({ ok: false, error: 'Sem acesso a este usuário.' }, { status: 403 });
  }
  if (String(target.role) === 'super_admin') {
    return NextResponse.json({ ok: false, error: 'Não é possível alterar um super admin.' }, { status: 400 });
  }

  const current = new Set(target.menuAccess || []);
  if (action === 'grant') {
    FINANCE_MENUS.forEach((m) => current.add(m));
  } else {
    FINANCE_MENUS.forEach((m) => current.delete(m));
  }
  const newMenu = Array.from(current);
  const keepRole = ['super_admin', 'admin', 'manager'].includes(String(target.role));
  await prisma.user.update({
    where: { id: target.id },
    data: {
      menuAccess: newMenu,
      // ao liberar, sobe para manager se estiver abaixo; ao revogar, não rebaixa (mantém a role atual).
      ...(action === 'grant' && !keepRole ? { role: 'manager' } : {}),
    },
  });

  await recordAudit({
    request: req,
    actor: { id: user.id, email: user.email },
    action: action === 'grant' ? 'finance_access.grant' : 'finance_access.revoke',
    entity: 'user',
    entityId: target.id,
    clientId: target.clientId ?? undefined,
    details: `${target.email} FINANCE ${action}`,
  });

  return NextResponse.json({ ok: true, action, userId: target.id, hasFinance: action === 'grant' });
}
