import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { csrfGuard } from '@/lib/csrfGuard';
import { rateLimitGuard } from '@/lib/apiRateLimit';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

/**
 * Mapa de conciliação do robô: categoria FL / conta bancária → conta REAL do QuickBooks do cliente.
 * GET  ?clientId= → { mapping }
 * POST { mapping, clientId? } → salva (upsert). Só admin/manager.
 */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  try {
    const url = new URL(req.url);
    const scope = await resolveBankAccountClientScope(user, url.searchParams.get('clientId'));
    if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
    const row = await prisma.qboReconcileMap.findUnique({ where: { clientId: scope.clientId } });
    return NextResponse.json({ ok: true, mapping: (row?.mapping as unknown) || { cat: {}, bank: {} } });
  } catch (e) {
    console.error('[GET /api/quickbooks/reconcile-map]', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'Falha ao ler o mapa.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const bad = csrfGuard(req);
  if (bad) return bad;
  const rl = rateLimitGuard(req, { bucket: 'qb-reconcile-map', max: 30 });
  if (rl) return rl;
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  const role = String(user.role || '').toLowerCase();
  if (role !== 'super_admin' && role !== 'admin' && role !== 'manager') {
    return NextResponse.json({ ok: false, error: 'Acesso negado.' }, { status: 403 });
  }
  try {
    const body = (await req.json().catch(() => ({}))) as { mapping?: unknown; clientId?: string };
    const scope = await resolveBankAccountClientScope(user, body.clientId || null);
    if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
    const m = (body.mapping || {}) as { cat?: Record<string, unknown>; bank?: Record<string, unknown> };
    // Sanitiza: só strings (IDs de conta).
    const clean = {
      cat: Object.fromEntries(Object.entries(m.cat || {}).filter(([, v]) => typeof v === 'string' && v).map(([k, v]) => [k, String(v)])),
      bank: Object.fromEntries(Object.entries(m.bank || {}).filter(([, v]) => typeof v === 'string' && v).map(([k, v]) => [k, String(v)])),
    };
    await prisma.qboReconcileMap.upsert({
      where: { clientId: scope.clientId },
      update: { mapping: clean },
      create: { clientId: scope.clientId, mapping: clean },
    });
    await recordAudit({
      request: req, actor: { id: user.id, email: user.email },
      action: 'quickbooks.reconcile_map_save', entity: 'qbo_reconcile_map', entityId: scope.clientId, clientId: scope.clientId,
      details: `cat=${Object.keys(clean.cat).length} bank=${Object.keys(clean.bank).length}`,
    });
    return NextResponse.json({ ok: true, mapping: clean });
  } catch (e) {
    console.error('[POST /api/quickbooks/reconcile-map]', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'Falha ao salvar o mapa.' }, { status: 500 });
  }
}
