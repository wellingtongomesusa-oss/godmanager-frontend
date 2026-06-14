import { NextResponse } from 'next/server';
import type { BillingDocument, BillingLineItem, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { getClientScopeForCreate, getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';

export const dynamic = 'force-dynamic';

const DOC_TYPES = new Set(['INVOICE', 'BILL']);

type DocWithItems = BillingDocument & { items: BillingLineItem[] };

function decToNum(v: Prisma.Decimal | null | undefined): number {
  if (v == null) return 0;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function calcLineTotal(quantity: number, unitPrice: number): number {
  return roundMoney(quantity * unitPrice);
}

function parseMonthRange(month: string): { gte: Date; lte: Date } | null {
  const trimmed = month.trim();
  if (!/^\d{4}-\d{2}$/.test(trimmed)) return null;
  const [y, m] = trimmed.split('-').map((x) => parseInt(x, 10));
  if (!y || m < 1 || m > 12) return null;
  return {
    gte: new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0)),
    lte: new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)),
  };
}

function parseOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

function lineItemToJson(item: BillingLineItem) {
  return {
    id: item.id,
    documentId: item.documentId,
    clientId: item.clientId,
    categoryId: item.categoryId,
    description: item.description,
    quantity: decToNum(item.quantity),
    unitPrice: decToNum(item.unitPrice),
    lineTotal: decToNum(item.lineTotal),
    sortOrder: item.sortOrder,
  };
}

function documentToJson(doc: DocWithItems) {
  return {
    id: doc.id,
    clientId: doc.clientId,
    docType: doc.docType,
    number: doc.number,
    status: doc.status,
    contactName: doc.contactName,
    contactEmail: doc.contactEmail,
    contactPhone: doc.contactPhone,
    billingContactId: doc.billingContactId,
    vendorId: doc.vendorId,
    propertyId: doc.propertyId,
    issueDate: doc.issueDate.toISOString(),
    dueDate: doc.dueDate ? doc.dueDate.toISOString() : null,
    total: decToNum(doc.total),
    notes: doc.notes,
    createdByUserId: doc.createdByUserId,
    approvedByUserId: doc.approvedByUserId,
    approvedAt: doc.approvedAt ? doc.approvedAt.toISOString() : null,
    paidAt: doc.paidAt ? doc.paidAt.toISOString() : null,
    sentAt: doc.sentAt ? doc.sentAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    items: doc.items.map(lineItemToJson),
  };
}

type ProcessedItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  categoryId: string | null;
  sortOrder: number;
  clientId?: string;
};

function processItems(
  rawItems: unknown,
  clientId: string | null
): { items: ProcessedItem[]; total: number } | { error: string } {
  const list = Array.isArray(rawItems) ? rawItems : [];
  const items: ProcessedItem[] = [];
  let total = 0;

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!item || typeof item !== 'object') {
      return { error: 'item description is required' };
    }
    const description = String((item as { description?: unknown }).description ?? '').trim();
    if (!description) {
      return { error: 'item description is required' };
    }
    const quantityRaw = (item as { quantity?: unknown }).quantity;
    const unitPriceRaw = (item as { unitPrice?: unknown }).unitPrice;
    const quantity =
      quantityRaw != null && Number.isFinite(Number(quantityRaw)) ? Number(quantityRaw) : 1;
    const unitPrice =
      unitPriceRaw != null && Number.isFinite(Number(unitPriceRaw)) ? Number(unitPriceRaw) : 0;
    const lineTotal = calcLineTotal(quantity, unitPrice);
    total = roundMoney(total + lineTotal);

    const categoryRaw = (item as { categoryId?: unknown }).categoryId;
    const sortOrderRaw = (item as { sortOrder?: unknown }).sortOrder;

    items.push({
      description,
      quantity,
      unitPrice,
      lineTotal,
      categoryId:
        categoryRaw != null ? String(categoryRaw).trim() || null : null,
      sortOrder:
        sortOrderRaw != null && Number.isFinite(Number(sortOrderRaw))
          ? Number(sortOrderRaw)
          : i,
      ...(clientId ? { clientId } : {}),
    });
  }

  return { items, total: roundMoney(total) };
}

async function nextDocumentNumber(
  tx: Prisma.TransactionClient,
  clientId: string | null,
  docType: string
): Promise<string> {
  const prefix = docType === 'INVOICE' ? 'INV-' : 'BILL-';
  const latest = await tx.billingDocument.findFirst({
    where: {
      docType,
      ...(clientId ? { clientId } : { clientId: null }),
    },
    orderBy: { number: 'desc' },
    select: { number: true },
  });

  let next = 1;
  if (latest?.number) {
    const match = latest.number.match(/\d+/);
    if (match) {
      next = parseInt(match[0], 10) + 1;
    }
  }

  return `${prefix}${String(next).padStart(4, '0')}`;
}

export async function GET(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const scopeUser = toClientScopeUser(user);

  try {
    const { searchParams } = new URL(req.url);
    const docType = searchParams.get('docType')?.trim() || '';
    const status = searchParams.get('status')?.trim() || '';
    const month = searchParams.get('month')?.trim() || '';
    const q = searchParams.get('q')?.trim() || '';

    const monthRange = month ? parseMonthRange(month) : null;

    const rows = await prisma.billingDocument.findMany({
      where: {
        ...getClientScopeWhere(scopeUser),
        ...(docType ? { docType } : {}),
        ...(status ? { status } : {}),
        ...(monthRange ? { issueDate: { gte: monthRange.gte, lte: monthRange.lte } } : {}),
        ...(q
          ? {
              OR: [
                { number: { contains: q, mode: 'insensitive' } },
                { contactName: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { issueDate: 'desc' },
    });

    return NextResponse.json({ ok: true, documents: rows.map(documentToJson) });
  } catch (e) {
    console.error('[GET /api/billing/documents]', e);
    return NextResponse.json({ ok: false, error: 'Failed to list documents' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const scopeUser = toClientScopeUser(user);

  try {
    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
    }

    const docType = String(body.docType ?? '').trim().toUpperCase();
    if (!DOC_TYPES.has(docType)) {
      return NextResponse.json(
        { ok: false, error: 'docType must be INVOICE or BILL' },
        { status: 400 }
      );
    }

    const contactName = String(body.contactName ?? '').trim();
    if (!contactName) {
      return NextResponse.json({ ok: false, error: 'contactName is required' }, { status: 400 });
    }

    const scopedClientId = getClientScopeForCreate(scopeUser);
    const bodyClientId =
      typeof body.clientId === 'string' ? String(body.clientId).trim() : null;
    const clientId = scopedClientId ?? (bodyClientId || null);

    const issueDateParsed = parseOptionalDate(body.issueDate);
    if (issueDateParsed === undefined && body.issueDate != null && body.issueDate !== '') {
      return NextResponse.json({ ok: false, error: 'Invalid issueDate' }, { status: 400 });
    }
    const dueDateParsed = parseOptionalDate(body.dueDate);
    if (dueDateParsed === undefined && body.dueDate != null && body.dueDate !== '') {
      return NextResponse.json({ ok: false, error: 'Invalid dueDate' }, { status: 400 });
    }

    const itemsWithClient = processItems(body.items, clientId);
    if ('error' in itemsWithClient) {
      return NextResponse.json({ ok: false, error: itemsWithClient.error }, { status: 400 });
    }

    const row = await prisma.$transaction(async (tx) => {
      const number = await nextDocumentNumber(tx, clientId, docType);

      return tx.billingDocument.create({
        data: {
          ...(clientId ? { clientId } : {}),
          docType,
          number,
          status: body.status != null ? String(body.status).trim() || 'DRAFT' : 'DRAFT',
          contactName,
          contactEmail:
            body.contactEmail != null ? String(body.contactEmail).trim() || null : null,
          contactPhone:
            body.contactPhone != null ? String(body.contactPhone).trim() || null : null,
          billingContactId:
            body.billingContactId != null
              ? String(body.billingContactId).trim() || null
              : null,
          vendorId: body.vendorId != null ? String(body.vendorId).trim() || null : null,
          propertyId:
            body.propertyId != null ? String(body.propertyId).trim() || null : null,
          issueDate: issueDateParsed ?? new Date(),
          dueDate: dueDateParsed ?? null,
          total: itemsWithClient.total,
          notes: body.notes != null ? String(body.notes).trim() || null : null,
          createdByUserId: user.id,
          items: {
            create: itemsWithClient.items.map((item) => ({
              ...(item.clientId ? { clientId: item.clientId } : {}),
              categoryId: item.categoryId,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: item.lineTotal,
              sortOrder: item.sortOrder,
            })),
          },
        },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      });
    });

    return NextResponse.json({ ok: true, document: documentToJson(row) }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/billing/documents]', e);
    return NextResponse.json({ ok: false, error: 'Failed to create document' }, { status: 500 });
  }
}
