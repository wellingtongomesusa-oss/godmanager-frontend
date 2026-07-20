import { NextResponse } from 'next/server';
import { csrfGuard } from '@/lib/csrfGuard';
import { rateLimitGuard } from '@/lib/apiRateLimit';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { getPlaidClient } from '@/lib/plaid';
import { decryptField } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

const KEYS = ['TRUST_CHASE', 'OPERATING_TRUST', 'DEPOSIT_SECURITY'];

/**
 * GET /api/plaid/link-accounts?clientId=
 *   → lista as contas do banco conectado (Plaid) + o mapeamento atual (conta -> chave de conciliação).
 * POST { clientId, mapping:{TRUST_CHASE, OPERATING_TRUST, DEPOSIT_SECURITY} }
 *   → salva o mapeamento (qual conta do Chase é Trust/Operating/Security Deposit).
 */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  const scope = await resolveBankAccountClientScope(user, new URL(req.url).searchParams.get('clientId'));
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

  const link = await prisma.bankLink.findFirst({
    where: { clientId: scope.clientId, linkType: 'CLIENT', status: 'active' },
    select: { accessTokenEnc: true, metadata: true },
  });
  if (!link) return NextResponse.json({ ok: true, linked: false, accounts: [], mapping: {} });

  const token = decryptField(link.accessTokenEnc);
  if (!token) return NextResponse.json({ ok: false, error: 'Token inválido; reconecte.' }, { status: 400 });

  try {
    const plaid = getPlaidClient();
    const res = await plaid.accountsGet({ access_token: token });
    const accounts = (res.data.accounts || []).map((a) => ({
      id: a.account_id,
      name: a.name || a.official_name || '—',
      mask: a.mask || null,
      subtype: a.subtype || null,
      type: a.type || null,
      currentBalance: a.balances?.current ?? null,
      availableBalance: a.balances?.available ?? null,
    }));
    const meta = (link.metadata as Record<string, unknown> | null) || {};
    const mapping = (meta.mapping as Record<string, string> | undefined) || {};
    return NextResponse.json({ ok: true, linked: true, accounts, mapping });
  } catch (e) {
    console.error('[plaid/link-accounts GET]', e instanceof Error ? e.message : 'error');
    return NextResponse.json({ ok: false, error: 'Falha ao ler contas do banco.' }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const bad = csrfGuard(req);
  if (bad) return bad;
  const rl = rateLimitGuard(req);
  if (rl) return rl;
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { clientId?: string; mapping?: Record<string, string> };
  const scope = await resolveBankAccountClientScope(user, body?.clientId ?? null);
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

  const link = await prisma.bankLink.findFirst({
    where: { clientId: scope.clientId, linkType: 'CLIENT', status: 'active' },
    select: { id: true, metadata: true },
  });
  if (!link) return NextResponse.json({ ok: false, error: 'Nenhum banco conectado.' }, { status: 400 });

  const mapIn = body?.mapping || {};
  const mapping: Record<string, string> = {};
  for (const k of KEYS) {
    const v = String(mapIn[k] || '').trim();
    if (v) mapping[k] = v.slice(0, 100);
  }
  const meta = ((link.metadata as Record<string, unknown> | null) || {}) as Record<string, unknown>;
  meta.mapping = mapping;
  await prisma.bankLink.update({ where: { id: link.id }, data: { metadata: meta as Prisma.InputJsonValue } });
  return NextResponse.json({ ok: true, mapping });
}
