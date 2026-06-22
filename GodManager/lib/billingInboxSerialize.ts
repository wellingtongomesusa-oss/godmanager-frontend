import type { BillingDocument, BillingLineItem, Prisma } from '@prisma/client';

export type DocWithItems = BillingDocument & { items: BillingLineItem[] };

function decToNum(v: Prisma.Decimal | null | undefined): number {
  if (v == null) return 0;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : 0;
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

export function documentToJson(doc: DocWithItems) {
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
