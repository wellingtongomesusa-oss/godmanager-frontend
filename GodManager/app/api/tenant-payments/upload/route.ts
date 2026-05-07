import { NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getR2Bucket, getR2Client } from '@/lib/r2';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { toClientScopeUser } from '@/lib/clientScope';
import {
  INCOME_REGISTER_HEADER,
  parseIncomeRegister,
  sha256Hex,
} from '@/lib/incomeRegisterParser';
import { resolveTenantPaymentClientId } from '@/lib/tenantPaymentScope';
import { matchProperty, matchTenantByDate } from '@/lib/tenantPaymentMatcher';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const ct = req.headers.get('content-type') || '';
  if (!ct.toLowerCase().includes('multipart/form-data')) {
    return NextResponse.json({ ok: false, error: 'Expected multipart/form-data' }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid form body' }, { status: 400 });
  }

  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ ok: false, error: 'file field required' }, { status: 400 });
  }

  const blob = file as File;
  const name = String(blob.name || '');
  if (!name.toLowerCase().endsWith('.csv')) {
    return NextResponse.json({ ok: false, error: 'Only .csv files are accepted' }, { status: 400 });
  }
  if (blob.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: 'File too large (max 10 MB)' }, { status: 400 });
  }

  const text = await blob.text();
  const firstNl = text.indexOf('\n');
  const firstLine = (firstNl === -1 ? text : text.slice(0, firstNl)).trim();
  if (firstLine !== INCOME_REGISTER_HEADER.trim()) {
    return NextResponse.json({ ok: false, error: 'Invalid CSV header for Income Register' }, { status: 400 });
  }

  const contentHash = await sha256Hex(text);
  const existing = await prisma.csvBatch.findUnique({
    where: { contentHash },
    select: { uploadedAt: true },
  });
  if (existing) {
    return NextResponse.json(
      {
        error: 'duplicate',
        message: 'Este ficheiro já foi importado em ' + existing.uploadedAt.toISOString(),
      },
      { status: 409 },
    );
  }

  const { rows, errors: parserErrors } = parseIncomeRegister(text);
  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: 'empty', parserErrors }, { status: 400 });
  }

  const clientId = await resolveTenantPaymentClientId(user);
  if (!clientId) {
    return NextResponse.json(
      { ok: false, error: 'No client scope — configure clientId or seed Manager Prop' },
      { status: 403 },
    );
  }

  const scopeUser = toClientScopeUser(user);
  if (scopeUser.role !== 'super_admin' && scopeUser.clientId !== clientId) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const totalReceiptAmount = rows.reduce((s, r) => s + r.receiptAmount, 0);
  const distinctPayers = new Set(rows.map((r) => r.payerName)).size;

  const batch = await prisma.$transaction(async (tx) => {
    const b = await tx.csvBatch.create({
      data: {
        clientId,
        type: 'income_register',
        filename: name.slice(0, 500),
        contentHash,
        rowCount: rows.length,
        totalAmount: new Prisma.Decimal(totalReceiptAmount.toFixed(2)),
        uploadedBy: user.id,
      },
    });

    await tx.tenantPayment.createMany({
      data: rows.map((r) => ({
        clientId,
        propertyId: null,
        tenantId: null,
        payerName: r.payerName,
        propertyAddress: r.propertyAddress,
        unit: r.unit,
        paymentDate: r.paymentDate,
        type: r.type,
        reference: r.reference,
        receiptAmount: new Prisma.Decimal(r.receiptAmount.toFixed(2)),
        cashAccount: r.cashAccount,
        counterpartAccount: r.counterpartAccount,
        description: r.description,
        csvBatchId: b.id,
      })),
    });

    return b;
  });

  const [properties, tenants, createdPayments] = await Promise.all([
    prisma.property.findMany({
      where: { clientId },
      select: { id: true, address: true },
    }),
    prisma.tenant.findMany({
      where: { clientId },
      select: { id: true, name: true, propertyId: true, moveIn: true, leaseTo: true, status: true },
    }),
    prisma.tenantPayment.findMany({
      where: { csvBatchId: batch.id },
      select: { id: true, propertyAddress: true, payerName: true, paymentDate: true },
    }),
  ]);

  const matchUpdates = createdPayments.map((p) => {
    const propertyId = matchProperty(p.propertyAddress, properties);
    const tenantId = matchTenantByDate(p.paymentDate, tenants, propertyId);
    return { id: p.id, propertyId, tenantId };
  });

  const matchedProperty = matchUpdates.filter((u) => u.propertyId != null).length;
  const matched = matchUpdates.filter((u) => u.tenantId != null).length;
  const unmatched = matchUpdates.filter((u) => u.tenantId == null).length;

  const persist = matchUpdates.filter((u) => u.propertyId != null || u.tenantId != null);
  const CHUNK = 100;
  for (let i = 0; i < persist.length; i += CHUNK) {
    const slice = persist.slice(i, i + CHUNK);
    await prisma.$transaction(
      slice.map((u) =>
        prisma.tenantPayment.update({
          where: { id: u.id },
          data: {
            ...(u.propertyId != null ? { propertyId: u.propertyId } : {}),
            ...(u.tenantId != null ? { tenantId: u.tenantId } : {}),
          },
        }),
      ),
    );
  }

  const safeFilename = name.replace(/[/\\]/g, '_');
  const r2ObjectKey = `csv-batches/${batch.id}/${safeFilename}`;
  let r2Warning: string | undefined;

  try {
    await getR2Client().send(
      new PutObjectCommand({
        Bucket: getR2Bucket(),
        Key: r2ObjectKey,
        Body: Buffer.from(text, 'utf-8'),
        ContentType: 'text/csv',
      }),
    );
    await prisma.csvBatch.update({
      where: { id: batch.id },
      data: { r2Key: r2ObjectKey },
    });
  } catch (err) {
    console.error('[tenant-payments/upload] R2 audit upload failed', err);
    r2Warning = 'CSV stored in DB but R2 audit upload failed';
  }

  return NextResponse.json({
    batchId: batch.id,
    rowsInserted: rows.length,
    totalReceiptAmount,
    distinctPayers,
    parserErrors,
    matchedProperty,
    matched,
    unmatched,
    ...(r2Warning ? { r2Warning } : {}),
  });
}
