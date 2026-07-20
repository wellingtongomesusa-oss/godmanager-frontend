import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveFinanceCc, saveFinanceCc } from '@/lib/financeEmail';

export const dynamic = 'force-dynamic';

/**
 * CC financeiro da empresa contratante — cópia visível em statements e cobranças enviados por
 * finance@godmanager.us. Sem override, cai no e-mail do próprio Client. Admin/super_admin.
 */

async function resolveScopeClientId(
  user: { role: string; clientId: string | null },
  incoming: string | null,
): Promise<{ ok: true; clientId: string } | { ok: false; status: number; error: string }> {
  const role = String(user.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'super_admin') {
    return { ok: false, status: 403, error: 'Acesso restrito a administradores.' };
  }
  const inc = (incoming || '').trim();
  if (role === 'admin') {
    if (!user.clientId) return { ok: false, status: 400, error: 'Cliente não definido.' };
    if (inc && inc !== user.clientId) return { ok: false, status: 403, error: 'Sem acesso a este cliente.' };
    return { ok: true, clientId: user.clientId };
  }
  if (!inc) return { ok: false, status: 400, error: 'Envie clientId (cliente selecionado no Dashboard Admin).' };
  const c = await prisma.client.findUnique({ where: { id: inc }, select: { id: true } });
  if (!c) return { ok: false, status: 404, error: 'Cliente não encontrado.' };
  return { ok: true, clientId: inc };
}

export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  const url = new URL(req.url);
  const scope = await resolveScopeClientId(user, url.searchParams.get('clientId'));
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

  try {
    const override = await prisma.appSetting.findUnique({
      where: { key: `finance:ccEmail:${scope.clientId}` },
    });
    const overrideList = Array.isArray(override?.value) ? (override!.value as unknown[]).map(String) : [];
    const effective = await resolveFinanceCc(scope.clientId);
    return NextResponse.json({ ok: true, override: overrideList, effective });
  } catch (e) {
    console.error('[GET /api/settings/finance-cc]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const scope = await resolveScopeClientId(user, body?.clientId ?? null);
    if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

    const saved = await saveFinanceCc(scope.clientId, body?.cc ?? '');
    const effective = await resolveFinanceCc(scope.clientId);
    return NextResponse.json({ ok: true, override: saved, effective });
  } catch (e) {
    console.error('[POST /api/settings/finance-cc]', e);
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 });
  }
}
