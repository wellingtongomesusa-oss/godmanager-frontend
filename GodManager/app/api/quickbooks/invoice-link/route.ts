import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { qbGetInvoiceLink } from '@/lib/quickbooksPost';
import { getConnectionStatus } from '@/lib/quickbooks';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

const keyFor = (clientId: string, id: string) => `qb_inv_link:${clientId}:${id}`;

async function savedLink(clientId: string, id: string): Promise<string | null> {
  try {
    const s = await prisma.appSetting.findUnique({ where: { key: keyFor(clientId, id) } });
    const v = s?.value;
    return typeof v === 'string' && v ? v : null;
  } catch {
    return null;
  }
}

/**
 * GET /api/quickbooks/invoice-link?id=&clientId=
 * Retorna o link de pagamento: primeiro o InvoiceLink nativo do QuickBooks; se não houver,
 * usa o link que o gestor colou (gerado dentro do QuickBooks).
 */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  const url = new URL(req.url);
  const id = (url.searchParams.get('id') || '').trim();
  if (!id) return NextResponse.json({ ok: false, error: 'id obrigatório.' }, { status: 400 });

  const scope = await resolveBankAccountClientScope(user, url.searchParams.get('clientId'));
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

  const conn = await getConnectionStatus(scope.clientId);
  if (!conn || conn.status !== 'CONNECTED') {
    return NextResponse.json({ ok: false, error: 'QuickBooks não conectado.' }, { status: 400 });
  }

  try {
    const { link } = await qbGetInvoiceLink(scope.clientId, id);
    if (link) return NextResponse.json({ ok: true, link, source: 'quickbooks' });
    const manual = await savedLink(scope.clientId, id);
    if (manual) return NextResponse.json({ ok: true, link: manual, source: 'manual' });
    return NextResponse.json({
      ok: true,
      link: null,
      canPaste: true,
      message: 'Esta invoice ainda não tem link de pagamento habilitado. Abra-a no QuickBooks, ative o pagamento online / gere o link (Share link) e cole aqui — fica salvo nesta conta.',
    });
  } catch (e) {
    console.error('[quickbooks/invoice-link]', e instanceof Error ? e.message : 'error');
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Falha ao obter o link.' }, { status: 502 });
  }
}

/**
 * POST /api/quickbooks/invoice-link { id, url, clientId? }
 * Salva o link de pagamento que o gestor gerou dentro do QuickBooks, para uma invoice.
 */
export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { id?: string; url?: string; clientId?: string };
  const id = String(body?.id || '').trim();
  const link = String(body?.url || '').trim();
  if (!id) return NextResponse.json({ ok: false, error: 'id obrigatório.' }, { status: 400 });
  if (!/^https:\/\/\S+$/.test(link)) return NextResponse.json({ ok: false, error: 'Link inválido (precisa começar com https://).' }, { status: 400 });

  const scope = await resolveBankAccountClientScope(user, body?.clientId ?? null);
  if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });

  try {
    await prisma.appSetting.upsert({
      where: { key: keyFor(scope.clientId, id) },
      update: { value: link, updatedBy: user.email || user.id },
      create: { key: keyFor(scope.clientId, id), value: link, updatedBy: user.email || user.id },
    });
    await recordAudit({
      request: req,
      actor: { id: user.id, email: user.email },
      action: 'quickbooks.invoice_link.save',
      entity: 'quickbooks',
      entityId: id,
      clientId: scope.clientId,
      details: 'manual payment link',
    });
    return NextResponse.json({ ok: true, link });
  } catch (e) {
    console.error('[quickbooks/invoice-link POST]', e instanceof Error ? e.message : 'error');
    return NextResponse.json({ ok: false, error: 'Falha ao salvar o link.' }, { status: 500 });
  }
}
