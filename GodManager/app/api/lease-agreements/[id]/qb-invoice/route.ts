import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveAnalyticsClientId } from '@/lib/analyticsResolveClientId';
import { getConnectionStatus } from '@/lib/quickbooks';
import { qbFindOrCreateCustomer, qbCreateInvoice, qbListItems } from '@/lib/quickbooksPost';
import { csrfGuard } from '@/lib/csrfGuard';
import { rateLimitGuard } from '@/lib/apiRateLimit';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';

/**
 * POST /api/lease-agreements/[id]/qb-invoice  { leaseFee, extra?, description? }
 * Gera a invoice do lease fee (+ extras) no QuickBooks e salva qbInvoiceId/qbInvoiceUrl no contrato.
 * Gracioso: se o QuickBooks não estiver conectado, responde 501 com instrução (não falha o contrato).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const bad = csrfGuard(req);
  if (bad) return bad;
  const rl = rateLimitGuard(req, { bucket: 'lease-qb-invoice', max: 20 });
  if (rl) return rl;
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  try {
    const clientId = await resolveAnalyticsClientId(user, req);
    if (!clientId) return NextResponse.json({ ok: false, error: 'No client context' }, { status: 400 });

    const id = String(params?.id || '');
    const lease = await prisma.leaseAgreement.findFirst({
      where: { id, clientId },
      include: { property: { select: { address: true, ownerName: true } }, tenant: { select: { name: true } } },
    });
    if (!lease) return NextResponse.json({ ok: false, error: 'Contrato não encontrado.' }, { status: 404 });

    const conn = await getConnectionStatus(clientId);
    const connected = !!conn && (conn as { connected?: boolean }).connected !== false;
    if (!connected) {
      return NextResponse.json(
        { ok: false, notConnected: true, error: 'QuickBooks não está conectado. Conecte em Integrações › QuickBooks para gerar a invoice do lease fee.' },
        { status: 501 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as { leaseFee?: unknown; extra?: unknown; description?: unknown };
    const leaseFee = Number(body.leaseFee);
    const extra = Number(body.extra) || 0;
    const amount = (Number.isFinite(leaseFee) ? leaseFee : 0) + (Number.isFinite(extra) ? extra : 0);
    if (!(amount > 0)) return NextResponse.json({ ok: false, error: 'Informe o valor do lease fee (> 0).' }, { status: 400 });

    // Cliente do QBO: nome do inquilino → owner → endereço.
    const customerName = (lease.tenant?.name || lease.property?.ownerName || lease.property?.address || `Contrato ${lease.leaseNumber}`).slice(0, 100);
    const customerId = await qbFindOrCreateCustomer(clientId, customerName);

    // Item de serviço (receita). Usa QB_LEASE_FEE_ITEM_ID se definido; senão o primeiro item do QBO.
    let itemId = String(process.env.QB_LEASE_FEE_ITEM_ID || '').trim();
    if (!itemId) {
      const items = await qbListItems(clientId);
      itemId = items[0]?.id ? String(items[0].id) : '';
    }
    if (!itemId) return NextResponse.json({ ok: false, error: 'Nenhum produto/serviço no QuickBooks para vincular à receita. Crie um item de serviço no QBO (ou defina QB_LEASE_FEE_ITEM_ID).' }, { status: 400 });

    const description = String(body.description || `Lease fee — contrato #${lease.leaseNumber} (${lease.property?.address || ''})`).slice(0, 900);
    const result = await qbCreateInvoice(clientId, {
      customerId,
      itemId,
      amount,
      memo: `Contrato #${lease.leaseNumber}`,
      description,
      allowOnlinePayment: true,
    });

    await prisma.leaseAgreement.update({
      where: { id },
      data: { qbInvoiceId: result.id || null, qbInvoiceUrl: result.invoiceLink || null },
    });
    await recordAudit({
      request: req, actor: { id: user.id, email: user.email },
      action: 'lease_agreement.qb_invoice', entity: 'lease_agreement', entityId: id, clientId,
      details: `Contrato #${lease.leaseNumber}: invoice ${result.docNumber || result.id} $${amount.toFixed(2)}`,
    });

    return NextResponse.json({ ok: true, invoiceId: result.id, docNumber: result.docNumber, invoiceUrl: result.invoiceLink, amount });
  } catch (e) {
    console.error('[lease qb-invoice POST]', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'Falha ao gerar a invoice no QuickBooks.' }, { status: 500 });
  }
}
