import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { resolveBankAccountClientScope } from '@/lib/bankAccountBalancesScope';
import { normalizePropertyKey } from '@/lib/generalLedger';
import { putObject, generateDownloadUrl } from '@/lib/r2';
import { csrfGuard } from '@/lib/csrfGuard';
import { rateLimitGuard } from '@/lib/apiRateLimit';
import { recordAudit } from '@/lib/auditServer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = /\.(pdf|jpe?g|png)$/i;

/** POST (multipart: file, propertyId?, propertyLabel, periodMonth, clientId?) — anexa o recibo de pagamento à casa/mês. */
export async function POST(req: Request) {
  const bad = csrfGuard(req);
  if (bad) return bad;
  const rl = rateLimitGuard(req, { bucket: 'rent-receipts-receipt', max: 60 });
  if (rl) return rl;
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });

  const ct = req.headers.get('content-type') || '';
  if (!ct.toLowerCase().includes('multipart/form-data')) {
    return NextResponse.json({ ok: false, error: 'Envie multipart/form-data.' }, { status: 400 });
  }
  try {
    const form = await req.formData();
    const scope = await resolveBankAccountClientScope(user, (form.get('clientId') as string) || null);
    if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
    const clientId = scope.clientId;

    const file = form.get('file');
    if (!file || typeof file === 'string') return NextResponse.json({ ok: false, error: 'Arquivo (file) ausente.' }, { status: 400 });
    const blob = file as File;
    const name = String(blob.name || 'recibo');
    if (!ALLOWED.test(name)) return NextResponse.json({ ok: false, error: 'Só PDF/JPG/PNG.' }, { status: 415 });
    if (blob.size > MAX_BYTES) return NextResponse.json({ ok: false, error: 'Arquivo muito grande (máx 10MB).' }, { status: 413 });

    const periodMonth = String(form.get('periodMonth') || '');
    if (!/^\d{4}-\d{2}$/.test(periodMonth)) return NextResponse.json({ ok: false, error: 'periodMonth inválido.' }, { status: 400 });
    let propertyId = form.get('propertyId') ? String(form.get('propertyId')) : null;
    let propertyLabel = String(form.get('propertyLabel') || '').trim();
    if (propertyId) {
      const p = await prisma.property.findFirst({ where: { id: propertyId, clientId }, select: { id: true, address: true } });
      if (!p) return NextResponse.json({ ok: false, error: 'Imóvel não encontrado.' }, { status: 404 });
      if (!propertyLabel) propertyLabel = p.address || '';
    } else propertyId = null;
    if (!propertyLabel) return NextResponse.json({ ok: false, error: 'Imóvel é obrigatório.' }, { status: 400 });

    const propertyKey = normalizePropertyKey(propertyLabel);
    const ext = (name.match(ALLOWED)?.[0] || '.pdf').toLowerCase();
    const safeKeyPart = propertyKey.replace(/[^a-z0-9]+/g, '-').slice(0, 60) || 'casa';
    const contentType = ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : 'image/jpeg';
    const key = `rent-receipts/${clientId}/${periodMonth}/${safeKeyPart}${ext}`;

    const buf = Buffer.from(await blob.arrayBuffer());
    await putObject(key, buf, contentType);

    await prisma.rentReceiptConfirmation.upsert({
      where: { clientId_propertyKey_periodMonth: { clientId, propertyKey, periodMonth } },
      create: {
        clientId, propertyId, propertyKey, propertyLabel: propertyLabel.slice(0, 200), periodMonth,
        receiptFileKey: key, receiptFileName: name.slice(0, 200), receiptSource: 'manual', confirmedByUserId: user.id,
      },
      update: { propertyId: propertyId ?? undefined, receiptFileKey: key, receiptFileName: name.slice(0, 200), receiptSource: 'manual' },
    });

    await recordAudit({
      request: req, actor: { id: user.id, email: user.email },
      action: 'rent_receipt.attach', entity: 'rent_receipt_confirmation', entityId: propertyKey, clientId,
      details: `${propertyLabel} · ${periodMonth} · recibo`,
    });

    return NextResponse.json({ ok: true, fileName: name });
  } catch (e) {
    console.error('[POST /api/rent-receipts/receipt]', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'Falha ao anexar recibo.' }, { status: 500 });
  }
}

/** GET (?propertyKey=&month=&clientId=) — redirect ao recibo (presigned, 300s). Só do próprio cliente. */
export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  try {
    const url = new URL(req.url);
    const scope = await resolveBankAccountClientScope(user, url.searchParams.get('clientId'));
    if (!scope.ok) return NextResponse.json({ ok: false, error: scope.error }, { status: scope.status });
    const propertyKey = String(url.searchParams.get('propertyKey') || '');
    const periodMonth = String(url.searchParams.get('month') || '');
    const row = await prisma.rentReceiptConfirmation.findUnique({
      where: { clientId_propertyKey_periodMonth: { clientId: scope.clientId, propertyKey, periodMonth } },
      select: { receiptFileKey: true },
    });
    if (!row?.receiptFileKey) return NextResponse.json({ ok: false, error: 'Sem recibo.' }, { status: 404 });
    const signed = await generateDownloadUrl(row.receiptFileKey, undefined, 300);
    return NextResponse.redirect(signed);
  } catch (e) {
    console.error('[GET /api/rent-receipts/receipt]', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'Falha ao abrir recibo.' }, { status: 500 });
  }
}
