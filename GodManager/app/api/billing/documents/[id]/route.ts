import { NextResponse } from 'next/server';
import type { BillingDocument, BillingLineItem, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { getClientScopeWhere, toClientScopeUser } from '@/lib/clientScope';
import { parseBillingPartyField } from '@/lib/billingParties';
import { billingStatementSync } from '@/lib/billingStatementSync';

export const dynamic = 'force-dynamic';

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

type BillingAttachmentRecord = {
  url: string;
  key: string;
  name: string;
  type: string;
  uploadedAt: string;
};

function parseAttachmentsJson(raw: unknown): BillingAttachmentRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: BillingAttachmentRecord[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const url = String(o.url || '').trim();
    const key = String(o.key || '').trim();
    if (!url || !key) continue;
    out.push({
      url,
      key,
      name: String(o.name || '').trim() || 'anexo',
      type: String(o.type || '').trim(),
      uploadedAt: String(o.uploadedAt || '').trim() || new Date().toISOString(),
    });
  }
  return out;
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
    receiverName: doc.receiverName,
    receiverAddress: doc.receiverAddress,
    receiverEmail: doc.receiverEmail,
    receiverPhone: doc.receiverPhone,
    billingContactId: doc.billingContactId,
    vendorId: doc.vendorId,
    propertyId: doc.propertyId,
    creditParty: doc.creditParty,
    debitParty: doc.debitParty,
    issueDate: doc.issueDate.toISOString(),
    dueDate: doc.dueDate ? doc.dueDate.toISOString() : null,
    total: decToNum(doc.total),
    notes: doc.notes,
    attachments: parseAttachmentsJson(doc.attachments),
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

function applyStatusSideEffects(
  existing: BillingDocument,
  newStatus: string,
  userId: string,
  data: Prisma.BillingDocumentUpdateInput
) {
  data.status = newStatus;
  if (newStatus === 'SENT' && !existing.sentAt) {
    data.sentAt = new Date();
  }
  if (newStatus === 'PAID' && !existing.paidAt) {
    data.paidAt = new Date();
  }
  if (newStatus === 'APPROVED') {
    if (!existing.approvedAt) {
      data.approvedAt = new Date();
    }
    if (!existing.approvedByUserId) {
      data.approvedByUserId = userId;
    }
  }
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const scopeUser = toClientScopeUser(user);

  try {
    const row = await prisma.billingDocument.findFirst({
      where: { id: params.id, ...getClientScopeWhere(scopeUser) },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!row) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    let approvedByName: string | null = null;
    if (row.approvedByUserId) {
      const u = await prisma.user.findUnique({
        where: { id: row.approvedByUserId },
        select: { firstName: true, lastName: true, email: true },
      });
      approvedByName = u
        ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email || row.approvedByUserId
        : row.approvedByUserId;
    }

    return NextResponse.json({
      ok: true,
      document: { ...documentToJson(row), approvedByName },
    });
  } catch (e) {
    console.error('[GET /api/billing/documents/:id]', e);
    return NextResponse.json({ ok: false, error: 'Failed to get document' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const scopeUser = toClientScopeUser(user);

  try {
    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
    }

    const existing = await prisma.billingDocument.findFirst({
      where: { id: params.id, ...getClientScopeWhere(scopeUser) },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    const data: Prisma.BillingDocumentUpdateInput = {};

    if (body.contactName != null) {
      const contactName = String(body.contactName).trim();
      if (!contactName) {
        return NextResponse.json({ ok: false, error: 'contactName cannot be empty' }, { status: 400 });
      }
      data.contactName = contactName;
    }
    if (body.number != null) {
      const n = String(body.number).trim();
      if (!n) {
        return NextResponse.json({ ok: false, error: 'number cannot be empty' }, { status: 400 });
      }
      data.number = n;
    }
    if (body.contactEmail != null) {
      data.contactEmail = String(body.contactEmail).trim() || null;
    }
    if (body.contactPhone != null) {
      data.contactPhone = String(body.contactPhone).trim() || null;
    }
    if (body.receiverName != null) {
      data.receiverName = String(body.receiverName).trim() || null;
    }
    if (body.receiverAddress != null) {
      data.receiverAddress = String(body.receiverAddress).trim() || null;
    }
    if (body.receiverEmail != null) {
      data.receiverEmail = String(body.receiverEmail).trim() || null;
    }
    if (body.receiverPhone != null) {
      data.receiverPhone = String(body.receiverPhone).trim() || null;
    }
    if (body.billingContactId != null) {
      data.billingContactId = String(body.billingContactId).trim() || null;
    }
    if (body.vendorId != null) {
      data.vendorId = String(body.vendorId).trim() || null;
    }
    if (body.propertyId != null) {
      data.propertyId = String(body.propertyId).trim() || null;
    }
    if (body.creditParty != null) {
      const parsed = parseBillingPartyField(body.creditParty);
      if (parsed && 'error' in parsed) {
        return NextResponse.json({ ok: false, error: 'invalid creditParty' }, { status: 400 });
      }
      if (parsed) data.creditParty = parsed.value;
    }
    if (body.debitParty != null) {
      const parsed = parseBillingPartyField(body.debitParty);
      if (parsed && 'error' in parsed) {
        return NextResponse.json({ ok: false, error: 'invalid debitParty' }, { status: 400 });
      }
      if (parsed) data.debitParty = parsed.value;
    }
    if (body.notes != null) {
      data.notes = String(body.notes).trim() || null;
    }

    if (body.addAttachment != null) {
      const rawAtt = body.addAttachment;
      if (!rawAtt || typeof rawAtt !== 'object') {
        return NextResponse.json({ ok: false, error: 'invalid addAttachment' }, { status: 400 });
      }
      const url = String((rawAtt as { url?: unknown }).url || '').trim();
      const key = String((rawAtt as { key?: unknown }).key || '').trim();
      if (!url || !key) {
        return NextResponse.json(
          { ok: false, error: 'addAttachment requires url and key' },
          { status: 400 }
        );
      }
      const current = parseAttachmentsJson(existing.attachments);
      current.push({
        url,
        key,
        name: String((rawAtt as { name?: unknown }).name || '').trim() || 'anexo',
        type: String((rawAtt as { type?: unknown }).type || '').trim(),
        uploadedAt: new Date().toISOString(),
      });
      data.attachments = current;
    }

    if (body.removeAttachmentKey != null) {
      const rk = String(body.removeAttachmentKey).trim();
      if (!rk) {
        return NextResponse.json({ ok: false, error: 'invalid removeAttachmentKey' }, { status: 400 });
      }
      const base =
        data.attachments != null
          ? parseAttachmentsJson(data.attachments)
          : parseAttachmentsJson(existing.attachments);
      data.attachments = base.filter((a) => a.key !== rk);
    }

    const issueDateParsed = parseOptionalDate(body.issueDate);
    if (issueDateParsed === undefined && body.issueDate != null && body.issueDate !== '') {
      return NextResponse.json({ ok: false, error: 'Invalid issueDate' }, { status: 400 });
    }
    if (issueDateParsed !== undefined) {
      data.issueDate = issueDateParsed ?? undefined;
    }

    const dueDateParsed = parseOptionalDate(body.dueDate);
    if (dueDateParsed === undefined && body.dueDate != null && body.dueDate !== '') {
      return NextResponse.json({ ok: false, error: 'Invalid dueDate' }, { status: 400 });
    }
    if (dueDateParsed !== undefined) {
      data.dueDate = dueDateParsed;
    }

    if (body.status != null) {
      const newStatus = String(body.status).trim();
      if (existing.docType === 'BILL') {
        if (newStatus === 'APPROVED') {
          const roleLower = String(user.role || '').toLowerCase();
          if (roleLower !== 'admin' && roleLower !== 'super_admin') {
            return NextResponse.json(
              { ok: false, error: 'sem permissao para aprovar' },
              { status: 403 }
            );
          }
        }
        if (newStatus === 'PAID' && existing.status !== 'APPROVED') {
          return NextResponse.json(
            { ok: false, error: 'bill precisa estar aprovado antes de pagar' },
            { status: 409 }
          );
        }
      }
      applyStatusSideEffects(existing, newStatus, user.id, data);
    }

    let itemsPayload: ProcessedItem[] | null = null;
    let itemsTotal: number | null = null;

    if (body.items !== undefined) {
      const processed = processItems(body.items, existing.clientId);
      if ('error' in processed) {
        return NextResponse.json({ ok: false, error: processed.error }, { status: 400 });
      }
      itemsPayload = processed.items;
      itemsTotal = processed.total;
      data.total = itemsTotal;
    }

    if (Object.keys(data).length === 0 && itemsPayload === null) {
      return NextResponse.json({ ok: false, error: 'No valid fields to update' }, { status: 400 });
    }

    const row = await prisma.$transaction(async (tx) => {
      if (itemsPayload !== null) {
        await tx.billingLineItem.deleteMany({ where: { documentId: existing.id } });
        if (itemsPayload.length > 0) {
          await tx.billingLineItem.createMany({
            data: itemsPayload.map((item) => ({
              documentId: existing.id,
              ...(item.clientId ? { clientId: item.clientId } : {}),
              categoryId: item.categoryId,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: item.lineTotal,
              sortOrder: item.sortOrder,
            })),
          });
        }
      }

      return tx.billingDocument.update({
        where: { id: existing.id },
        data,
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      });
    });

    let billingStatementSyncResult = null;
    if (row.docType === 'BILL') {
      try {
        billingStatementSyncResult = await billingStatementSync({
          document: row,
          actorId: user.id,
        });
      } catch (syncErr) {
        console.error('[PATCH /api/billing/documents/:id] billingStatementSync', syncErr);
        billingStatementSyncResult = { ok: false, skipped: 'guards' as const };
      }
    }

    return NextResponse.json({
      ok: true,
      document: documentToJson(row),
      billingStatementSync: billingStatementSyncResult,
    });
  } catch (e) {
    console.error('[PATCH /api/billing/documents/:id]', e);
    return NextResponse.json({ ok: false, error: 'Failed to update document' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUserFromSession();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const scopeUser = toClientScopeUser(user);

  try {
    const existing = await prisma.billingDocument.findFirst({
      where: { id: params.id, ...getClientScopeWhere(scopeUser) },
      select: { id: true, status: true },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    if (existing.status !== 'DRAFT' && existing.status !== 'CANCELLED') {
      return NextResponse.json(
        { ok: false, error: 'use cancelar em vez de excluir' },
        { status: 409 }
      );
    }

    await prisma.billingDocument.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[DELETE /api/billing/documents/:id]', e);
    return NextResponse.json({ ok: false, error: 'Failed to delete document' }, { status: 500 });
  }
}
